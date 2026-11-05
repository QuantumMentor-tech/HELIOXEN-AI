/**
 * HELIOXEN AI — Step 46: Backup Manager
 * Atomic, staged, SHA-256 verified backup creation and retention policy management.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  BackupCategory,
  BackupManifest,
  BackupArtifactMetadata,
  BackupCreationRequest,
  BackupCreationResult,
  BackupVerificationResult
} from '../../shared/recovery/types'
import {
  BACKUP_CATEGORIES,
  CATEGORY_STORAGE_PATHS,
  isValidBackupId
} from '../../shared/recovery/contracts'
import { securityLogger } from '../security/securityLogger'

export interface BackupManagerOptions {
  readonly storageDir: string
  readonly appVersion?: string
  readonly maxRetainedBackups?: number
  readonly nowFn?: () => number
}

export class BackupManager {
  private readonly storageDir: string
  private readonly backupsDir: string
  private readonly appVersion: string
  private readonly maxRetainedBackups: number
  private readonly nowFn: () => number

  constructor(options: BackupManagerOptions) {
    this.storageDir = options.storageDir
    this.appVersion = options.appVersion ?? '0.1.0-alpha.1'
    this.maxRetainedBackups = options.maxRetainedBackups ?? 5
    this.nowFn = options.nowFn ?? (() => Date.now())

    this.backupsDir = path.resolve(this.storageDir, 'backups')
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true })
    }
  }

  public getBackupsDirectory(): string {
    return this.backupsDir
  }

  private calculateFileSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  }

  public async createBackup(request?: BackupCreationRequest): Promise<BackupCreationResult> {
    const startTime = this.nowFn()
    const backupId = `backup_${startTime}_${crypto.randomBytes(4).toString('hex')}`
    const stagingDir = path.join(this.backupsDir, `.staging_${backupId}`)
    const finalDir = path.join(this.backupsDir, backupId)

    const categoriesToBackup: BackupCategory[] = (request?.categories as BackupCategory[]) || BACKUP_CATEGORIES

    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true })
      }
      fs.mkdirSync(stagingDir, { recursive: true })

      const artifacts: BackupArtifactMetadata[] = []
      let totalSizeBytes = 0

      // Copy eligible existing store files into staging
      for (const cat of categoriesToBackup) {
        const relPath = CATEGORY_STORAGE_PATHS[cat]
        if (!relPath) continue

        const sourcePath = path.resolve(this.storageDir, relPath)
        if (fs.existsSync(sourcePath)) {
          const stats = fs.statSync(sourcePath)
          if (stats.isFile()) {
            const destName = `${cat}.json`
            const destPath = path.join(stagingDir, destName)
            fs.copyFileSync(sourcePath, destPath)

            const sha256 = this.calculateFileSha256(destPath)
            artifacts.push({
              name: destName,
              category: cat,
              relativePath: destName,
              sizeBytes: stats.size,
              sha256
            })
            totalSizeBytes += stats.size
          }
        }
      }

      // Write Manifest
      const manifest: BackupManifest = {
        manifestVersion: 1,
        backupId,
        createdAt: startTime,
        appVersion: this.appVersion,
        schemaVersion: 1,
        totalSizeBytes,
        includedCategories: artifacts.map((a) => a.category),
        artifacts,
        isEncrypted: false,
        status: 'staged',
        verificationResult: {
          verified: true,
          verifiedAt: startTime
        }
      }

      const manifestPath = path.join(stagingDir, 'manifest.json')
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

      // Pre-commit validation of the staged backup
      for (const art of artifacts) {
        const artPath = path.join(stagingDir, art.relativePath)
        if (!fs.existsSync(artPath)) {
          throw new Error(`Staged artifact missing: ${art.relativePath}`)
        }
        const checkSha = this.calculateFileSha256(artPath)
        if (checkSha !== art.sha256) {
          throw new Error(`Checksum mismatch during staging validation for ${art.relativePath}`)
        }
      }

      // Update manifest status to complete
      const finalManifest: BackupManifest = {
        ...manifest,
        status: 'complete'
      }
      fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2), 'utf-8')

      // Atomic promotion: rename staging directory to final backup folder
      fs.renameSync(stagingDir, finalDir)

      const durationMs = this.nowFn() - startTime

      securityLogger.logEvent('BACKUP_CREATE', 'user', 'PERMITTED', {
        backupId,
        artifactCount: artifacts.length,
        totalSizeBytes,
        durationMs
      })

      // Apply retention policy after successful backup creation
      this.applyRetentionPolicy(this.maxRetainedBackups)

      return {
        success: true,
        backupId,
        manifest: finalManifest,
        message: `Successfully created verified backup with ${artifacts.length} data stores.`,
        durationMs
      }
    } catch (err: any) {
      // Clean up staging directory on error
      if (fs.existsSync(stagingDir)) {
        try {
          fs.rmSync(stagingDir, { recursive: true, force: true })
        } catch {
          // ignore cleanup error
        }
      }

      securityLogger.logEvent('BACKUP_CREATE', 'user', 'ERROR', {
        backupId,
        error: err.message
      })

      return {
        success: false,
        backupId,
        message: 'Failed to create backup.',
        error: err.message,
        durationMs: this.nowFn() - startTime
      }
    }
  }

  public listBackups(): BackupManifest[] {
    if (!fs.existsSync(this.backupsDir)) return []

    const results: BackupManifest[] = []
    const entries = fs.readdirSync(this.backupsDir, { withFileTypes: true })

    for (const ent of entries) {
      if (ent.isDirectory() && isValidBackupId(ent.name)) {
        const manifestPath = path.join(this.backupsDir, ent.name, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
          try {
            const raw = fs.readFileSync(manifestPath, 'utf-8')
            const parsed = JSON.parse(raw) as BackupManifest
            if (parsed.status === 'complete') {
              results.push(parsed)
            }
          } catch (err) {
            console.warn(`[BackupManager] Failed to parse manifest for ${ent.name}:`, err)
          }
        }
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  public getBackup(backupId: string): BackupManifest | null {
    if (!isValidBackupId(backupId)) return null
    const manifestPath = path.join(this.backupsDir, backupId, 'manifest.json')
    if (!fs.existsSync(manifestPath)) return null

    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8')
      return JSON.parse(raw) as BackupManifest
    } catch {
      return null
    }
  }

  public verifyBackup(backupId: string): BackupVerificationResult {
    const now = this.nowFn()
    if (!isValidBackupId(backupId)) {
      return {
        backupId,
        valid: false,
        checkedArtifacts: 0,
        mismatchedChecksums: [],
        missingArtifacts: [],
        errors: ['Invalid backup identifier format.'],
        verifiedAt: now
      }
    }

    const backupFolder = path.join(this.backupsDir, backupId)
    const manifestPath = path.join(backupFolder, 'manifest.json')

    if (!fs.existsSync(backupFolder) || !fs.existsSync(manifestPath)) {
      return {
        backupId,
        valid: false,
        checkedArtifacts: 0,
        mismatchedChecksums: [],
        missingArtifacts: [],
        errors: [`Backup directory or manifest.json not found for ${backupId}`],
        verifiedAt: now
      }
    }

    let manifest: BackupManifest
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8')
      manifest = JSON.parse(raw) as BackupManifest
    } catch (err: any) {
      return {
        backupId,
        valid: false,
        checkedArtifacts: 0,
        mismatchedChecksums: [],
        missingArtifacts: [],
        errors: [`Malformed manifest JSON: ${err.message}`],
        verifiedAt: now
      }
    }

    const mismatchedChecksums: string[] = []
    const missingArtifacts: string[] = []
    const errors: string[] = []
    let checkedArtifacts = 0

    for (const art of manifest.artifacts || []) {
      // Path traversal defense: artifact relativePath must not contain '..' or root separators
      if (art.relativePath.includes('..') || path.isAbsolute(art.relativePath)) {
        errors.push(`Unsafe path detected in artifact: ${art.relativePath}`)
        continue
      }

      const artPath = path.join(backupFolder, art.relativePath)
      if (!fs.existsSync(artPath)) {
        missingArtifacts.push(art.relativePath)
        continue
      }

      checkedArtifacts++
      const calculatedSha = this.calculateFileSha256(artPath)
      if (calculatedSha !== art.sha256) {
        mismatchedChecksums.push(art.relativePath)
      }
    }

    const valid = errors.length === 0 && missingArtifacts.length === 0 && mismatchedChecksums.length === 0

    return {
      backupId,
      valid,
      checkedArtifacts,
      mismatchedChecksums,
      missingArtifacts,
      errors,
      verifiedAt: now
    }
  }

  public applyRetentionPolicy(maxRetained: number = this.maxRetainedBackups): { removedBackups: string[]; keptBackups: string[] } {
    const backups = this.listBackups()
    if (backups.length <= maxRetained) {
      return {
        removedBackups: [],
        keptBackups: backups.map((b) => b.backupId)
      }
    }

    // Keep the most recent maxRetained backups; never delete all backups
    const toKeep = backups.slice(0, Math.max(1, maxRetained))
    const toRemove = backups.slice(Math.max(1, maxRetained))
    const removedBackups: string[] = []

    for (const b of toRemove) {
      const folder = path.join(this.backupsDir, b.backupId)
      if (fs.existsSync(folder)) {
        try {
          fs.rmSync(folder, { recursive: true, force: true })
          removedBackups.push(b.backupId)
        } catch (err) {
          console.warn(`[BackupManager] Failed to prune backup ${b.backupId}:`, err)
        }
      }
    }

    if (removedBackups.length > 0) {
      securityLogger.logEvent('BACKUP_RETENTION', 'system', 'PERMITTED', {
        prunedCount: removedBackups.length,
        retainedCount: toKeep.length,
        removedBackups
      })
    }

    return {
      removedBackups,
      keptBackups: toKeep.map((b) => b.backupId)
    }
  }
}

