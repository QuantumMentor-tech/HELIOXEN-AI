/**
 * HELIOXEN AI — Step 46: Restore Manager
 * Previews restore impact, enforces human confirmation, creates pre-restore safety checkpoints,
 * performs staged restores, and provides automatic rollback upon validation failure.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  RestorePreview,
  RestoreExecutionRequest,
  RestoreExecutionResult,
  BackupManifest
} from '../../shared/recovery/types'
import {
  CATEGORY_STORAGE_PATHS,
  isValidBackupId
} from '../../shared/recovery/contracts'
import { BackupManager } from './BackupManager'
import { securityLogger } from '../security/securityLogger'

export interface RestoreManagerOptions {
  readonly storageDir: string
  readonly backupManager: BackupManager
  readonly nowFn?: () => number
}

export class RestoreManager {
  private readonly storageDir: string
  private readonly backupManager: BackupManager
  private readonly nowFn: () => number

  constructor(options: RestoreManagerOptions) {
    this.storageDir = options.storageDir
    this.backupManager = options.backupManager
    this.nowFn = options.nowFn ?? (() => Date.now())
  }

  public getRestorePreview(backupId: string): RestorePreview {
    if (!isValidBackupId(backupId)) {
      return {
        backupId,
        createdAt: 0,
        includedCategories: [],
        affectedStores: [],
        requiresRestart: false,
        warningMessage: 'Invalid backup identifier.',
        isCompatible: false,
        incompatibilityReasons: ['Invalid backup ID format.']
      }
    }

    const manifest = this.backupManager.getBackup(backupId)
    if (!manifest) {
      return {
        backupId,
        createdAt: 0,
        includedCategories: [],
        affectedStores: [],
        requiresRestart: false,
        warningMessage: 'Backup manifest could not be found or read.',
        isCompatible: false,
        incompatibilityReasons: ['Backup not found.']
      }
    }

    const affectedStores: string[] = []
    for (const cat of manifest.includedCategories) {
      const relPath = CATEGORY_STORAGE_PATHS[cat]
      if (relPath) affectedStores.push(relPath)
    }

    const incompatibilityReasons: string[] = []
    if (manifest.manifestVersion > 1) {
      incompatibilityReasons.push(`Unsupported manifest version: ${manifest.manifestVersion}`)
    }

    const isCompatible = incompatibilityReasons.length === 0
    const warningMessage = `Restoring will overwrite ${affectedStores.length} active data stores with data from ${new Date(manifest.createdAt).toLocaleString()}. A pre-restore safety checkpoint will be generated automatically.`

    return {
      backupId: manifest.backupId,
      createdAt: manifest.createdAt,
      includedCategories: manifest.includedCategories,
      affectedStores,
      requiresRestart: false,
      warningMessage,
      isCompatible,
      incompatibilityReasons: isCompatible ? undefined : incompatibilityReasons
    }
  }

  public async executeRestore(request: RestoreExecutionRequest): Promise<RestoreExecutionResult> {
    const now = this.nowFn()
    const { backupId, confirmedByHuman, createCheckpoint = true } = request

    // 1. Mandatory Human Confirmation Enforcement
    if (!confirmedByHuman) {
      securityLogger.logEvent('BACKUP_RESTORE', 'user', 'DENIED', {
        backupId,
        reason: 'Restoration rejected: Mandatory human confirmation was not provided.'
      })
      return {
        success: false,
        backupId,
        restoredCategories: [],
        rolledBack: false,
        message: 'Restoration rejected: Explicit user confirmation is required.',
        error: 'CONFIRMATION_REQUIRED',
        executedAt: now
      }
    }

    // 2. Validate backup identifier
    if (!isValidBackupId(backupId)) {
      return {
        success: false,
        backupId,
        restoredCategories: [],
        rolledBack: false,
        message: 'Invalid backup identifier.',
        error: 'INVALID_BACKUP_ID',
        executedAt: now
      }
    }

    // 3. Verify backup checksum integrity before trusting it
    const verification = this.backupManager.verifyBackup(backupId)
    if (!verification.valid) {
      securityLogger.logEvent('BACKUP_RESTORE', 'user', 'DENIED', {
        backupId,
        reason: 'Backup failed cryptographic integrity verification.',
        errors: verification.errors,
        mismatchedChecksums: verification.mismatchedChecksums
      })
      return {
        success: false,
        backupId,
        restoredCategories: [],
        rolledBack: false,
        message: 'Backup failed cryptographic integrity verification. Cannot restore untrusted or corrupted data.',
        error: 'INTEGRITY_VERIFICATION_FAILED',
        executedAt: now
      }
    }

    const manifest = this.backupManager.getBackup(backupId)
    if (!manifest) {
      return {
        success: false,
        backupId,
        restoredCategories: [],
        rolledBack: false,
        message: 'Manifest not found.',
        error: 'MANIFEST_NOT_FOUND',
        executedAt: now
      }
    }

    const backupDir = path.join(this.backupManager.getBackupsDirectory(), backupId)
    let checkpointDir: string | undefined

    try {
      // 4. Create Pre-Restore Safety Checkpoint of current live data
      if (createCheckpoint) {
        const checkpointId = `checkpoint_pre_restore_${now}_${crypto.randomBytes(4).toString('hex')}`
        checkpointDir = path.join(this.backupManager.getBackupsDirectory(), checkpointId)
        fs.mkdirSync(checkpointDir, { recursive: true })

        for (const cat of manifest.includedCategories) {
          const relPath = CATEGORY_STORAGE_PATHS[cat]
          if (!relPath) continue
          const livePath = path.resolve(this.storageDir, relPath)
          if (fs.existsSync(livePath)) {
            const destPath = path.join(checkpointDir, `${cat}.json`)
            fs.copyFileSync(livePath, destPath)
          }
        }
      }

      // 5. Staged restoration: copy backup artifacts to target live locations
      const restoredCategories: string[] = []
      for (const art of manifest.artifacts) {
        // Path traversal defense
        if (art.relativePath.includes('..') || path.isAbsolute(art.relativePath)) {
          throw new Error(`Unsafe path in artifact: ${art.relativePath}`)
        }

        const sourceArtifactPath = path.join(backupDir, art.relativePath)
        const targetRelPath = CATEGORY_STORAGE_PATHS[art.category]
        if (!targetRelPath) continue

        const targetFullPath = path.resolve(this.storageDir, targetRelPath)
        const targetDir = path.dirname(targetFullPath)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }

        // Copy atomically via temp file
        const tempTargetPath = `${targetFullPath}.tmp.${now}`
        fs.copyFileSync(sourceArtifactPath, tempTargetPath)
        fs.renameSync(tempTargetPath, targetFullPath)

        restoredCategories.push(art.category)
      }

      // 6. Post-restore integrity verification: ensure all restored JSON files parse cleanly
      for (const cat of manifest.includedCategories) {
        const relPath = CATEGORY_STORAGE_PATHS[cat]
        if (!relPath) continue
        const fullPath = path.resolve(this.storageDir, relPath)
        if (fs.existsSync(fullPath)) {
          const raw = fs.readFileSync(fullPath, 'utf-8')
          JSON.parse(raw) // Throws if corrupt
        }
      }

      securityLogger.logEvent('BACKUP_RESTORE', 'user', 'PERMITTED', {
        backupId,
        restoredCategories,
        checkpointCreated: checkpointDir ? path.basename(checkpointDir) : undefined
      })

      return {
        success: true,
        backupId,
        restoredCategories: manifest.includedCategories,
        checkpointCreated: checkpointDir ? path.basename(checkpointDir) : undefined,
        rolledBack: false,
        message: `Successfully restored ${restoredCategories.length} data categories from backup ${backupId}.`,
        executedAt: now
      }
    } catch (err: any) {
      console.error('[RestoreManager] Restore failed, rolling back to pre-restore checkpoint:', err)

      // 7. Automatic Rollback from Safety Checkpoint
      let rolledBack = false
      if (checkpointDir && fs.existsSync(checkpointDir)) {
        try {
          for (const cat of manifest.includedCategories) {
            const checkpointFile = path.join(checkpointDir, `${cat}.json`)
            const relPath = CATEGORY_STORAGE_PATHS[cat]
            if (fs.existsSync(checkpointFile) && relPath) {
              const livePath = path.resolve(this.storageDir, relPath)
              fs.copyFileSync(checkpointFile, livePath)
            }
          }
          rolledBack = true
        } catch (rbErr) {
          console.error('[RestoreManager] Critical: Failed to rollback from checkpoint:', rbErr)
        }
      }

      securityLogger.logEvent('BACKUP_RESTORE', 'user', 'ERROR', {
        backupId,
        error: err.message,
        rolledBack
      })

      return {
        success: false,
        backupId,
        restoredCategories: [],
        checkpointCreated: checkpointDir ? path.basename(checkpointDir) : undefined,
        rolledBack,
        message: rolledBack
          ? `Restoration failed: ${err.message}. Changes successfully rolled back to pre-restore checkpoint.`
          : `Restoration failed: ${err.message}. Rollback could not be verified.`,
        error: err.message,
        executedAt: now
      }
    }
  }
}

