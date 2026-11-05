/**
 * HELIOXEN AI — Step 46: Controlled Self-Repair Manager
 * Bounded read-only diagnostics and strictly deterministic allowlisted repairs.
 * Permanently prohibits source-code rewriting, shell execution, and security bypasses.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  DiagnosticReport,
  DiagnosticFinding,
  SelfRepairRequest,
  SelfRepairResult,
  ApprovedRepairId
} from '../../shared/recovery/types'
import {
  APPROVED_REPAIR_DEFINITIONS,
  isForbiddenRepairOperation
} from '../../shared/recovery/contracts'
import { CrashRecoveryManager } from './CrashRecoveryManager'
import { BackupManager } from './BackupManager'
import { securityLogger } from '../security/securityLogger'

export interface SelfRepairManagerOptions {
  readonly storageDir: string
  readonly crashRecoveryManager: CrashRecoveryManager
  readonly backupManager: BackupManager
  readonly nowFn?: () => number
}

export class SelfRepairManager {
  private readonly storageDir: string
  private readonly crashRecoveryManager: CrashRecoveryManager
  private readonly backupManager: BackupManager
  private readonly nowFn: () => number

  constructor(options: SelfRepairManagerOptions) {
    this.storageDir = options.storageDir
    this.crashRecoveryManager = options.crashRecoveryManager
    this.backupManager = options.backupManager
    this.nowFn = options.nowFn ?? (() => Date.now())
  }

  public runDiagnostics(): DiagnosticReport {
    const now = this.nowFn()
    const reportId = `diag_${now}_${crypto.randomBytes(4).toString('hex')}`
    const findings: DiagnosticFinding[] = []
    const availableRepairs: string[] = []

    const session = this.crashRecoveryManager.getSessionState()
    const previous = this.crashRecoveryManager.getPreviousSessionState()

    // 1. Session & Crash Finding
    if (previous && !previous.cleanShutdown) {
      findings.push({
        id: 'finding_session_interrupted',
        level: 'warning',
        category: 'session',
        title: 'Interrupted Prior Session Detected',
        description: `Previous application session (${previous.sessionId}) did not complete a clean shutdown.`,
        suggestedRepairId: 'REPAIR_RECONCILE_STUCK_OPERATIONS'
      })
      availableRepairs.push('REPAIR_RECONCILE_STUCK_OPERATIONS')
    }

    // 2. Interrupted Operations Finding
    const pendingOps = session.activeOperations.filter((op) => op.requiresUserReview)
    if (pendingOps.length > 0) {
      findings.push({
        id: 'finding_interrupted_operations',
        level: 'warning',
        category: 'operations',
        title: `${pendingOps.length} Interrupted Operation(s) Require Review`,
        description: 'Operations were interrupted during the prior session. Automatic re-execution has been blocked to prevent duplicate external actions.',
        suggestedRepairId: 'REPAIR_RECONCILE_STUCK_OPERATIONS'
      })
      if (!availableRepairs.includes('REPAIR_RECONCILE_STUCK_OPERATIONS')) {
        availableRepairs.push('REPAIR_RECONCILE_STUCK_OPERATIONS')
      }
    }

    // 3. Stale Temporary/Staging Artifacts
    const backupsDir = this.backupManager.getBackupsDirectory()
    let hasStaleTemp = false
    if (fs.existsSync(backupsDir)) {
      const items = fs.readdirSync(backupsDir)
      for (const item of items) {
        if (item.startsWith('.staging_') || item.includes('.tmp.')) {
          hasStaleTemp = true
          break
        }
      }
    }

    if (hasStaleTemp) {
      findings.push({
        id: 'finding_stale_staging',
        level: 'info',
        category: 'backup',
        title: 'Stale Backup Staging Directories Detected',
        description: 'Temporary staging folders from interrupted or aborted backup attempts were found in storage.',
        suggestedRepairId: 'REPAIR_CLEAN_STALE_TEMP_FILES'
      })
      availableRepairs.push('REPAIR_CLEAN_STALE_TEMP_FILES')
    }

    // 4. Missing Cache / Disposable Directories
    const thumbnailsDir = path.resolve(this.storageDir, 'media_library/thumbnails')
    if (!fs.existsSync(thumbnailsDir)) {
      findings.push({
        id: 'finding_missing_thumbnails_dir',
        level: 'info',
        category: 'cache',
        title: 'Missing Thumbnail Cache Directory',
        description: 'Disposable media thumbnail directory is missing and can be safely recreated.',
        suggestedRepairId: 'REPAIR_RECREATE_CACHE_DIRS'
      })
      if (!availableRepairs.includes('REPAIR_RECREATE_CACHE_DIRS')) {
        availableRepairs.push('REPAIR_RECREATE_CACHE_DIRS')
      }
    }

    // 5. Corrupted Storage Cache Files
    try {
      const files = fs.readdirSync(this.storageDir)
      const corruptFiles = files.filter((f) => f.includes('.corrupt.'))
      if (corruptFiles.length > 0) {
        findings.push({
          id: 'finding_corrupted_json_artifacts',
          level: 'warning',
          category: 'storage',
          title: `${corruptFiles.length} Corrupted File Artifacts Detected`,
          description: `Quarantined corruption records found: ${corruptFiles.join(', ')}.`,
          suggestedRepairId: 'REPAIR_CLEAR_CORRUPTED_CACHE'
        })
        availableRepairs.push('REPAIR_CLEAR_CORRUPTED_CACHE')
      }
    } catch {
      // ignore
    }

    // 6. Latest Verified Backup Finding
    const backups = this.backupManager.listBackups()
    const latestVerified = backups.length > 0 ? backups[0] : undefined

    if (!latestVerified) {
      findings.push({
        id: 'finding_no_verified_backups',
        level: 'warning',
        category: 'backup',
        title: 'No Verified Backups Found',
        description: 'The system does not yet have a verified backup snapshot of user data stores.'
      })
    }

    securityLogger.logEvent('SELF_REPAIR_DIAGNOSTIC', 'system', 'PERMITTED', {
      reportId,
      findingsCount: findings.length,
      availableRepairsCount: availableRepairs.length
    })

    return {
      reportId,
      generatedAt: now,
      recoveryState: session.recoveryState,
      sessionClean: session.cleanShutdown,
      findings,
      availableRepairs,
      latestVerifiedBackupId: latestVerified?.backupId
    }
  }

  public async executeRepair(request: SelfRepairRequest): Promise<SelfRepairResult> {
    const now = this.nowFn()
    const { repairId, confirmedByHuman = false } = request

    // 1. Definition Existence Check
    const def = APPROVED_REPAIR_DEFINITIONS[repairId]
    if (!def) {
      securityLogger.logEvent('SELF_REPAIR_ACTION', 'user', 'DENIED', {
        repairId,
        reason: 'Repair identifier not found in approved self-repair catalog'
      })
      return {
        success: false,
        repairId,
        message: `Unknown or unapproved self-repair operation: "${repairId}".`,
        error: 'UNAPPROVED_REPAIR_OPERATION',
        changesSummary: [],
        executedAt: now
      }
    }

    // 2. Strict Negative Security Check: forbidden operations defense
    for (const target of def.allowedTargetPaths) {
      const check = isForbiddenRepairOperation(target, repairId)
      if (check.forbidden) {
        securityLogger.logEvent('SELF_REPAIR_ACTION', 'user', 'DENIED', {
          repairId,
          target,
          reason: check.reason
        })
        return {
          success: false,
          repairId,
          message: `Self-repair rejected: ${check.reason}`,
          error: 'FORBIDDEN_REPAIR_MUTATION',
          changesSummary: [],
          executedAt: now
        }
      }
    }

    // 3. User Confirmation Requirement
    if (def.requiresHumanApproval && !confirmedByHuman) {
      securityLogger.logEvent('SELF_REPAIR_ACTION', 'user', 'DENIED', {
        repairId,
        reason: 'Self-repair requires explicit user approval.'
      })
      return {
        success: false,
        repairId,
        message: `Repair "${def.name}" requires explicit user confirmation.`,
        error: 'APPROVAL_REQUIRED',
        changesSummary: [],
        executedAt: now
      }
    }

    // 4. Execute deterministic approved repair
    const changes: string[] = []

    try {
      switch (repairId) {
        case 'REPAIR_CLEAN_STALE_TEMP_FILES': {
          const backupsDir = this.backupManager.getBackupsDirectory()
          if (fs.existsSync(backupsDir)) {
            const items = fs.readdirSync(backupsDir)
            for (const item of items) {
              if (item.startsWith('.staging_') || item.includes('.tmp.')) {
                const target = path.join(backupsDir, item)
                fs.rmSync(target, { recursive: true, force: true })
                changes.push(`Removed stale artifact: ${item}`)
              }
            }
          }
          break
        }

        case 'REPAIR_RECREATE_CACHE_DIRS': {
          const thumbnailsDir = path.resolve(this.storageDir, 'media_library/thumbnails')
          if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true })
            changes.push('Created media_library/thumbnails directory.')
          }
          const cacheDir = path.resolve(this.storageDir, 'cache')
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true })
            changes.push('Created cache directory.')
          }
          break
        }

        case 'REPAIR_CLEAR_CORRUPTED_CACHE': {
          const files = fs.readdirSync(this.storageDir)
          const quarantineDir = path.resolve(this.storageDir, 'quarantine')
          if (!fs.existsSync(quarantineDir)) {
            fs.mkdirSync(quarantineDir, { recursive: true })
          }

          for (const file of files) {
            if (file.includes('.corrupt.')) {
              const src = path.join(this.storageDir, file)
              const dest = path.join(quarantineDir, file)
              fs.renameSync(src, dest)
              changes.push(`Quarantined corrupted artifact: ${file}`)
            }
          }
          break
        }

        case 'REPAIR_RESET_DEFAULT_PREFERENCES': {
          const prefPath = path.resolve(this.storageDir, 'ai_preferences.json')
          if (fs.existsSync(prefPath)) {
            const bakPath = `${prefPath}.bak.${now}`
            fs.copyFileSync(prefPath, bakPath)
            changes.push(`Archived current preferences to ${path.basename(bakPath)}`)
          }
          const defaultPrefs = {
            schemaVersion: 1,
            routingMode: 'balanced',
            temperature: 0.7,
            maxTokens: 2048,
            updatedAt: now
          }
          fs.writeFileSync(prefPath, JSON.stringify(defaultPrefs, null, 2), 'utf-8')
          changes.push('Reset ai_preferences.json to verified factory defaults.')
          break
        }

        case 'REPAIR_RECONCILE_STUCK_OPERATIONS': {
          const session = this.crashRecoveryManager.getSessionState()
          for (const op of session.activeOperations) {
            if (op.requiresUserReview) {
              this.crashRecoveryManager.markOperationReviewed(op.id)
              changes.push(`Reconciled interrupted operation: ${op.description || op.id}`)
            }
          }
          this.crashRecoveryManager.setRecoveryState('recovery_completed')
          break
        }

        case 'REPAIR_RESTORE_FROM_CHECKPOINT': {
          const backupsDir = this.backupManager.getBackupsDirectory()
          if (!fs.existsSync(backupsDir)) {
            throw new Error('Backups directory does not exist.')
          }
          const entries = fs.readdirSync(backupsDir)
          const checkpoints = entries.filter((e) => e.startsWith('checkpoint_pre_restore_')).sort().reverse()
          if (checkpoints.length === 0) {
            throw new Error('No safety checkpoints available to restore from.')
          }
          const latestCheckpoint = path.join(backupsDir, checkpoints[0])
          const checkpointFiles = fs.readdirSync(latestCheckpoint)
          for (const file of checkpointFiles) {
            const src = path.join(latestCheckpoint, file)
            const dest = path.join(this.storageDir, file)
            fs.copyFileSync(src, dest)
            changes.push(`Restored ${file} from checkpoint ${checkpoints[0]}`)
          }
          break
        }

        default:
          throw new Error(`Handler not implemented for repair: ${repairId}`)
      }

      securityLogger.logEvent('SELF_REPAIR_ACTION', 'user', 'PERMITTED', {
        repairId,
        changesCount: changes.length,
        changesSummary: changes
      })

      return {
        success: true,
        repairId,
        message: `Successfully executed self-repair "${def.name}".`,
        changesSummary: changes,
        executedAt: now
      }
    } catch (err: any) {
      securityLogger.logEvent('SELF_REPAIR_ACTION', 'user', 'ERROR', {
        repairId,
        error: err.message
      })

      return {
        success: false,
        repairId,
        message: `Self-repair execution failed: ${err.message}`,
        error: err.message,
        changesSummary: changes,
        executedAt: now
      }
    }
  }
}

