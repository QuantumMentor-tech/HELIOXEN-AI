/**
 * HELIOXEN AI — Step 46: Crash Recovery Manager
 * Detects interrupted sessions, tracks in-flight operations, and guarantees that
 * interrupted external actions are never automatically replayed upon restart.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  SessionState,
  RecoveryState,
  InterruptedOperation,
  InterruptedOperationState
} from '../../shared/recovery/types'
import { securityLogger } from '../security/securityLogger'

export interface CrashRecoveryManagerOptions {
  readonly storageDir: string
  readonly appVersion?: string
  readonly nowFn?: () => number
  readonly heartbeatIntervalMs?: number
  readonly crashThresholdMs?: number
}

export class CrashRecoveryManager {
  private readonly storageDir: string
  private readonly sessionFilePath: string
  private readonly appVersion: string
  private readonly nowFn: () => number
  private readonly heartbeatIntervalMs: number
  private readonly crashThresholdMs: number

  private currentSession: SessionState
  private heartbeatTimer: NodeJS.Timeout | null = null
  private previousSessionState: SessionState | null = null

  constructor(options: CrashRecoveryManagerOptions) {
    this.storageDir = options.storageDir
    this.appVersion = options.appVersion ?? '0.1.0-alpha.1'
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000
    this.crashThresholdMs = options.crashThresholdMs ?? 60000

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true })
    }
    this.sessionFilePath = path.join(this.storageDir, 'session_state.json')

    // 1. Inspect previous session before creating current one
    this.previousSessionState = this.readPersistedSession()

    // 2. Determine initial recovery state based on prior session
    const recoveryState = this.evaluateInitialRecoveryState(this.previousSessionState)

    // 3. Initialize current session
    const now = this.nowFn()
    const sessionId = `sess_${now}_${crypto.randomBytes(4).toString('hex')}`

    this.currentSession = {
      sessionId,
      pid: process.pid,
      appVersion: this.appVersion,
      startedAt: now,
      lastHeartbeatAt: now,
      cleanShutdown: false,
      recoveryState,
      activeOperations: this.reconcilePreviousInterruptedOperations(this.previousSessionState)
    }

    this.persistSession()
    this.startHeartbeat()

    if (recoveryState === 'previous_session_interrupted' || recoveryState === 'recovery_requires_user_review') {
      securityLogger.logEvent('RECOVERY_CRASH_DETECTED', 'system', 'PERMITTED', {
        previousSessionId: this.previousSessionState?.sessionId,
        interruptedOperationsCount: this.currentSession.activeOperations.length,
        recoveryState
      })
    }
  }

  private readPersistedSession(): SessionState | null {
    try {
      if (!fs.existsSync(this.sessionFilePath)) return null
      const content = fs.readFileSync(this.sessionFilePath, 'utf-8')
      return JSON.parse(content) as SessionState
    } catch (err) {
      console.warn('[CrashRecoveryManager] Error reading prior session state:', err)
      return null
    }
  }

  private evaluateInitialRecoveryState(prior: SessionState | null): RecoveryState {
    if (!prior) {
      return 'normal_startup'
    }

    if (prior.cleanShutdown) {
      return 'previous_session_clean'
    }

    // If cleanShutdown is false, check if heartbeat elapsed abnormally
    const elapsed = this.nowFn() - (prior.lastHeartbeatAt || prior.startedAt)
    if (elapsed > this.crashThresholdMs) {
      const hasUnresolvedExternal = prior.activeOperations?.some(
        (op) => op.isExternal && (op.state === 'started_local' || op.state === 'interrupted_unknown_outcome')
      )
      return hasUnresolvedExternal ? 'recovery_requires_user_review' : 'previous_session_interrupted'
    }

    return 'previous_session_interrupted'
  }

  private reconcilePreviousInterruptedOperations(prior: SessionState | null): InterruptedOperation[] {
    if (!prior || !prior.activeOperations || prior.activeOperations.length === 0) {
      return []
    }

    const now = this.nowFn()
    return prior.activeOperations.map((op) => {
      // If operation was already finished or cancelled, retain status
      if (
        op.state === 'dispatched_confirmed_success' ||
        op.state === 'dispatched_confirmed_failed' ||
        op.state === 'cancelled'
      ) {
        return op
      }

      // External operations must NEVER be auto-replayed. Mark as interrupted unknown outcome.
      const requiresReview = op.isExternal || op.state === 'started_local'
      return {
        ...op,
        state: 'interrupted_unknown_outcome' as InterruptedOperationState,
        lastUpdatedAt: now,
        requiresUserReview: requiresReview,
        replayed: false
      }
    })
  }

  private persistSession(): void {
    try {
      const tempPath = `${this.sessionFilePath}.tmp.${this.nowFn()}`
      fs.writeFileSync(tempPath, JSON.stringify(this.currentSession, null, 2), 'utf-8')
      fs.renameSync(tempPath, this.sessionFilePath)
    } catch (err) {
      console.warn('[CrashRecoveryManager] Failed to persist session state:', err)
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => {
      this.currentSession = {
        ...this.currentSession,
        lastHeartbeatAt: this.nowFn()
      }
      this.persistSession()
    }, this.heartbeatIntervalMs)

    // Unref timer so it does not block node process exit in tests
    if (typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref()
    }
  }

  public registerOperation(op: {
    id: string
    type: string
    description: string
    isExternal: boolean
    idempotencyKey?: string
    details?: Record<string, unknown>
  }): InterruptedOperation {
    const now = this.nowFn()
    const operation: InterruptedOperation = {
      id: op.id,
      type: op.type,
      description: op.description,
      isExternal: op.isExternal,
      idempotencyKey: op.idempotencyKey,
      state: 'started_local',
      startedAt: now,
      lastUpdatedAt: now,
      details: op.details,
      requiresUserReview: false,
      replayed: false
    }

    this.currentSession = {
      ...this.currentSession,
      activeOperations: [...this.currentSession.activeOperations.filter((o) => o.id !== op.id), operation]
    }
    this.persistSession()
    return operation
  }

  public completeOperation(
    operationId: string,
    outcome: 'success' | 'failed' | 'cancelled'
  ): void {
    const now = this.nowFn()
    const stateMap: Record<string, InterruptedOperationState> = {
      success: 'dispatched_confirmed_success',
      failed: 'dispatched_confirmed_failed',
      cancelled: 'cancelled'
    }

    this.currentSession = {
      ...this.currentSession,
      activeOperations: this.currentSession.activeOperations.map((op) => {
        if (op.id !== operationId) return op
        return {
          ...op,
          state: stateMap[outcome] ?? 'dispatched_confirmed_failed',
          lastUpdatedAt: now
        }
      })
    }
    this.persistSession()
  }

  public markOperationReviewed(operationId: string): void {
    const now = this.nowFn()
    this.currentSession = {
      ...this.currentSession,
      activeOperations: this.currentSession.activeOperations.map((op) => {
        if (op.id !== operationId) return op
        return {
          ...op,
          requiresUserReview: false,
          lastUpdatedAt: now
        }
      })
    }

    // If no more operations require review, update recovery state
    const anyPending = this.currentSession.activeOperations.some((op) => op.requiresUserReview)
    if (!anyPending && this.currentSession.recoveryState === 'recovery_requires_user_review') {
      this.currentSession = {
        ...this.currentSession,
        recoveryState: 'recovery_completed'
      }
    }
    this.persistSession()
  }

  public setRecoveryState(state: RecoveryState): void {
    this.currentSession = {
      ...this.currentSession,
      recoveryState: state,
      lastHeartbeatAt: this.nowFn()
    }
    this.persistSession()
  }

  public getSessionState(): SessionState {
    return { ...this.currentSession }
  }

  public getPreviousSessionState(): SessionState | null {
    return this.previousSessionState ? { ...this.previousSessionState } : null
  }

  public recordCleanShutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    const now = this.nowFn()
    this.currentSession = {
      ...this.currentSession,
      cleanShutdown: true,
      shutdownAt: now,
      lastHeartbeatAt: now,
      recoveryState: 'normal_startup',
      activeOperations: this.currentSession.activeOperations.filter(
        (op) => op.state !== 'dispatched_confirmed_success' && op.state !== 'cancelled'
      )
    }
    this.persistSession()
  }

  public dispose(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

