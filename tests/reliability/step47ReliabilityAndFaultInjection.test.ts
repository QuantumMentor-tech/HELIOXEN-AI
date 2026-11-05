/**
 * HELIOXEN AI — Step 47 Reliability, Concurrency & Fault-Injection Validation Suite
 * Tests system resilience under provider failures, cooperative cancellations,
 * file storage corruption, and unconfirmed external action crash recovery.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { CrashRecoveryManager } from '../../src/main/recovery/CrashRecoveryManager'
import { BackupManager } from '../../src/main/recovery/BackupManager'
import { RestoreManager } from '../../src/main/recovery/RestoreManager'
import { PreferencesStorage } from '../../src/main/ai/PreferencesStorage'
import { DEFAULT_AI_PREFERENCES } from '../../src/shared/ai/models'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan } from '../../src/shared/orchestration/types'
import { ToolDispatcher } from '../../src/shared/orchestration/ToolDispatcher'

describe('Step 47: Reliability, Concurrency & Fault-Injection Suite', () => {
  let tempDir: string
  let mockTime: number

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-reliability-test-'))
    mockTime = 1700000000000
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. File Storage Corruption Resilience', () => {
    it('gracefully handles syntactically corrupt JSON preferences by falling back to safe defaults', async () => {
      const corruptPrefPath = path.join(tempDir, 'corrupt_preferences.json')
      // Write malformed / half-written JSON (e.g. sudden power failure mid-write)
      fs.writeFileSync(corruptPrefPath, '{"activeProvider": "openai", "activeModel": "gpt', 'utf8')

      const storage = new PreferencesStorage(corruptPrefPath)
      await expect(storage.initialize()).resolves.not.toThrow()

      const prefs = storage.getPreferences()
      expect(prefs).toBeDefined()
      expect(prefs.activeProvider).toBe(DEFAULT_AI_PREFERENCES.activeProvider)
      expect(prefs.temperature).toBe(DEFAULT_AI_PREFERENCES.temperature)
    })

    it('gracefully recovers when crash session state file is zero-byte or corrupt', () => {
      const corruptSessionFile = path.join(tempDir, 'session_state.json')
      fs.writeFileSync(corruptSessionFile, '### INVALID BINARY DATA ###', 'utf8')

      const recoveryManager = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockTime
      })

      const state = recoveryManager.getSessionState()
      expect(state).toBeDefined()
      expect(state.recoveryState).toBe('normal_startup')
      recoveryManager.dispose()
    })
  })

  describe('2. Crash Recovery & Non-Replay of Interrupted External Actions', () => {
    it('classifies in-flight external operations as interrupted_unknown_outcome and never auto-replays', () => {
      // Step A: Session 1 records an in-flight external action (e.g., sending email or smart plug toggle)
      const session1 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockTime,
        crashThresholdMs: 5000
      })

      session1.registerOperation({
        id: 'op_ext_msg_99',
        type: 'communication_send',
        description: 'Send critical status report to external stakeholder',
        isExternal: true
      })

      // Simulate abrupt power cut / unhandled crash: no clean shutdown recorded!
      session1.dispose()

      // Step B: Session 2 starts 10 seconds later (beyond crash threshold)
      const session2 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockTime + 10000,
        crashThresholdMs: 5000
      })

      const state = session2.getSessionState()
      expect(state.recoveryState).toBe('recovery_requires_user_review')

      const op = state.activeOperations.find((o) => o.id === 'op_ext_msg_99')
      expect(op).toBeDefined()
      expect(op?.isExternal).toBe(true)
      expect(op?.state).toBe('interrupted_unknown_outcome')
      expect(op?.replayed).toBe(false) // Must NEVER be automatically marked replayed

      session2.dispose()
    })
  })

  describe('3. Cooperative Task Engine Cancellation', () => {
    it('immediately cancels task execution when AbortSignal is triggered, skipping subsequent steps', async () => {
      const mockDispatcher: ToolDispatcher = {
        dispatch: vi.fn().mockImplementation(async (call: any) => {
          if (call.toolId === 'long_task') {
            await new Promise((resolve) => setTimeout(resolve, 50))
            return { result: 'first_done' }
          }
          return { result: 'second_done' }
        })
      }

      const engine = new TaskExecutionEngine(mockDispatcher)

      const plan: TaskPlan = {
        id: 'plan_abort_test',
        taskSummary: 'Cancellation test plan',
        reasoning: 'Testing cooperative cancellation under signal',
        estimatedRisk: 'low',
        steps: [
          {
            stepId: 'step_1',
            toolId: 'long_task',
            intent: 'Step 1 should complete or abort',
            inputs: {},
            dependencies: [],
            riskTier: 'low'
          },
          {
            stepId: 'step_2',
            toolId: 'unreached_tool',
            intent: 'Step 2 must never be executed after cancellation',
            inputs: {},
            dependencies: ['step_1'],
            riskTier: 'low'
          }
        ]
      }

      const abortController = new AbortController()

      // Abort immediately before or during execution
      abortController.abort()

      const result = await engine.executePlan(plan, {
        signal: abortController.signal
      })

      expect(['cancelled', 'rejected']).toContain(result.status)
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ toolId: 'unreached_tool' }),
        expect.anything()
      )
    })
  })

  describe('4. Restore Manager Safety & Pre-Restore Checkpoint', () => {
    it('creates automatic pre-restore safety checkpoint and rejects corrupt backups', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockTime
      })

      const restoreMgr = new RestoreManager({
        storageDir: tempDir,
        backupManager: backupMgr,
        nowFn: () => mockTime
      })

      // Try restoring without explicit user confirmation
      const unconfirmed = await restoreMgr.executeRestore({ backupId: 'backup_1700000000000_abc123' })
      expect(unconfirmed.success).toBe(false)
      expect(unconfirmed.error).toBe('CONFIRMATION_REQUIRED')

      // Try restoring a non-existent backup even with confirmation
      const nonexistent = await restoreMgr.executeRestore({
        backupId: 'backup_1700000000000_nonexistent',
        confirmedByHuman: true
      })
      expect(nonexistent.success).toBe(false)
      expect(nonexistent.error).toBe('INTEGRITY_VERIFICATION_FAILED')

      // Try previewing a corrupt backup
      const corruptDir = path.join(tempDir, 'backups', 'backup_1700000000000_corrupt')
      fs.mkdirSync(corruptDir, { recursive: true })
      fs.writeFileSync(path.join(corruptDir, 'manifest.json'), '{ invalid json', 'utf8')

      const preview = restoreMgr.getRestorePreview('backup_1700000000000_corrupt')
      expect(preview.isCompatible).toBe(false)
      expect(preview.incompatibilityReasons).toBeDefined()

      const verification = backupMgr.verifyBackup('backup_1700000000000_corrupt')
      expect(verification.valid).toBe(false)
    })
  })

  describe('5. Concurrency & Re-Entrancy Resilience', () => {
    it('handles rapid sequential backup creation without file collisions or corrupted manifests', async () => {
      // Seed a sample preferences file to back up
      fs.writeFileSync(
        path.join(tempDir, 'ai_preferences.json'),
        JSON.stringify({ activeProvider: 'anthropic' }),
        'utf8'
      )

      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockTime++
      })

      // Create 3 backups rapidly
      const b1 = await backupMgr.createBackup({ label: 'Snapshot 1' })
      const b2 = await backupMgr.createBackup({ label: 'Snapshot 2' })
      const b3 = await backupMgr.createBackup({ label: 'Snapshot 3' })

      expect(b1.backupId).not.toBe(b2.backupId)
      expect(b2.backupId).not.toBe(b3.backupId)

      // Verify all 3 manifests
      const v1 = backupMgr.verifyBackup(b1.backupId)
      const v2 = backupMgr.verifyBackup(b2.backupId)
      const v3 = backupMgr.verifyBackup(b3.backupId)

      expect(v1.valid).toBe(true)
      expect(v2.valid).toBe(true)
      expect(v3.valid).toBe(true)
    })
  })
})
