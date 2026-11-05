import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { CrashRecoveryManager } from '../../src/main/recovery/CrashRecoveryManager'
import { BackupManager } from '../../src/main/recovery/BackupManager'
import { RestoreManager } from '../../src/main/recovery/RestoreManager'
import { isValidBackupId } from '../../src/shared/recovery/contracts'

describe('Crash Recovery & Verified Backups (Step 46)', () => {
  let tempDir: string
  let mockCurrentTime: number

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-recovery-test-'))
    mockCurrentTime = 1700000000000

    // Seed sample store files to backup
    fs.writeFileSync(
      path.join(tempDir, 'ai_preferences.json'),
      JSON.stringify({ routingMode: 'balanced', temperature: 0.7 }),
      'utf-8'
    )
    fs.writeFileSync(
      path.join(tempDir, 'productivity_store.json'),
      JSON.stringify({ notes: [{ id: 'n1', title: 'Test Note' }] }),
      'utf-8'
    )
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Crash Detection & Interrupted Operation Handling', () => {
    it('initializes clean normal startup when no prior session exists', () => {
      const manager = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })

      const state = manager.getSessionState()
      expect(state.recoveryState).toBe('normal_startup')
      expect(state.cleanShutdown).toBe(false)
      expect(state.activeOperations).toHaveLength(0)

      manager.recordCleanShutdown()
      expect(manager.getSessionState().cleanShutdown).toBe(true)
      manager.dispose()
    })

    it('detects clean shutdown from previous session on restart', () => {
      // Session 1: Clean Exit
      const manager1 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      manager1.recordCleanShutdown()
      manager1.dispose()

      // Session 2: Startup
      mockCurrentTime += 5000
      const manager2 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })

      const state2 = manager2.getSessionState()
      expect(state2.recoveryState).toBe('previous_session_clean')
      manager2.dispose()
    })

    it('detects interrupted session when prior session did not record clean exit', () => {
      // Session 1: Exits abruptly without recordCleanShutdown()
      const manager1 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      manager1.registerOperation({
        id: 'op_email_send_1',
        type: 'communication:send',
        description: 'Send urgent client email',
        isExternal: true
      })
      manager1.dispose() // simulate abrupt termination

      // Session 2: Restart 2 minutes later
      mockCurrentTime += 120000
      const manager2 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime,
        crashThresholdMs: 60000
      })

      const state2 = manager2.getSessionState()
      expect(state2.recoveryState).toBe('recovery_requires_user_review')
      expect(state2.activeOperations).toHaveLength(1)

      const interruptedOp = state2.activeOperations[0]
      expect(interruptedOp.id).toBe('op_email_send_1')
      expect(interruptedOp.state).toBe('interrupted_unknown_outcome')
      expect(interruptedOp.requiresUserReview).toBe(true)
      // Critical safety invariant: external actions are NEVER automatically replayed
      expect(interruptedOp.replayed).toBe(false)

      manager2.dispose()
    })

    it('allows reconciling interrupted operations and transitioning to recovery_completed', () => {
      // Pre-seed an interrupted session
      const manager1 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      manager1.registerOperation({
        id: 'op_smart_lock_1',
        type: 'smart_home:actuate',
        description: 'Unlock front door',
        isExternal: true
      })
      manager1.dispose()

      mockCurrentTime += 90000
      const manager2 = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })

      expect(manager2.getSessionState().recoveryState).toBe('recovery_requires_user_review')

      manager2.markOperationReviewed('op_smart_lock_1')
      const updatedState = manager2.getSessionState()
      expect(updatedState.activeOperations[0].requiresUserReview).toBe(false)
      expect(updatedState.recoveryState).toBe('recovery_completed')

      manager2.dispose()
    })
  })

  describe('2. Backup Creation & Verification', () => {
    it('validates backup IDs matching SAFE_BACKUP_ID_REGEX', () => {
      expect(isValidBackupId('backup_1700000000_abcd')).toBe(true)
      expect(isValidBackupId('backup_my-safe-backup-01')).toBe(true)
      expect(isValidBackupId('backup_../malicious')).toBe(false)
      expect(isValidBackupId('backup; rm -rf /')).toBe(false)
      expect(isValidBackupId('')).toBe(false)
    })

    it('creates an atomic, staged, verified backup with SHA-256 manifest', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })

      const res = await backupMgr.createBackup()
      expect(res.success).toBe(true)
      expect(res.backupId).toBeDefined()
      expect(res.manifest).toBeDefined()
      expect(res.manifest?.status).toBe('complete')
      expect(res.manifest?.artifacts.length).toBeGreaterThanOrEqual(2)

      const manifestArtifacts = res.manifest?.artifacts || []
      const aiPrefArt = manifestArtifacts.find((a) => a.category === 'ai_preferences')
      expect(aiPrefArt).toBeDefined()
      expect(aiPrefArt?.sha256).toBeDefined()
      expect(aiPrefArt?.sizeBytes).toBeGreaterThan(0)
    })

    it('verifies cryptographic checksums of a valid backup successfully', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })

      const createRes = await backupMgr.createBackup()
      const backupId = createRes.backupId!

      const verifyRes = backupMgr.verifyBackup(backupId)
      expect(verifyRes.valid).toBe(true)
      expect(verifyRes.checkedArtifacts).toBeGreaterThanOrEqual(2)
      expect(verifyRes.mismatchedChecksums).toHaveLength(0)
      expect(verifyRes.missingArtifacts).toHaveLength(0)
    })

    it('detects tampered backup artifact and fails verification', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })

      const createRes = await backupMgr.createBackup()
      const backupId = createRes.backupId!

      // Tamper with one of the backup files on disk
      const backupDir = path.join(backupMgr.getBackupsDirectory(), backupId)
      const tamperedFile = path.join(backupDir, 'ai_preferences.json')
      fs.appendFileSync(tamperedFile, '\n/* TAMPERED_DATA */', 'utf-8')

      const verifyRes = backupMgr.verifyBackup(backupId)
      expect(verifyRes.valid).toBe(false)
      expect(verifyRes.mismatchedChecksums).toContain('ai_preferences.json')
    })

    it('enforces retention policy by pruning older backups while keeping latest verified', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        maxRetainedBackups: 2,
        nowFn: () => mockCurrentTime
      })

      // Create 3 backups
      mockCurrentTime += 1000
      await backupMgr.createBackup()
      mockCurrentTime += 1000
      await backupMgr.createBackup()
      mockCurrentTime += 1000
      const lastBackup = await backupMgr.createBackup()

      const remaining = backupMgr.listBackups()
      expect(remaining.length).toBe(2)
      // Latest backup is preserved
      expect(remaining[0].backupId).toBe(lastBackup.backupId)
    })
  })

  describe('3. Restore Workflow & Rollback Guarantees', () => {
    it('provides accurate restore preview indicating affected active data stores', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      const createRes = await backupMgr.createBackup()

      const restoreMgr = new RestoreManager({
        storageDir: tempDir,
        backupManager: backupMgr,
        nowFn: () => mockCurrentTime
      })

      const preview = restoreMgr.getRestorePreview(createRes.backupId!)
      expect(preview.backupId).toBe(createRes.backupId)
      expect(preview.isCompatible).toBe(true)
      expect(preview.affectedStores).toContain('ai_preferences.json')
      expect(preview.affectedStores).toContain('productivity_store.json')
    })

    it('strictly denies restore execution if human confirmation is missing', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      const createRes = await backupMgr.createBackup()

      const restoreMgr = new RestoreManager({
        storageDir: tempDir,
        backupManager: backupMgr,
        nowFn: () => mockCurrentTime
      })

      const res = await restoreMgr.executeRestore({
        backupId: createRes.backupId!,
        createCheckpoint: true,
        confirmedByHuman: false // Unconfirmed
      })

      expect(res.success).toBe(false)
      expect(res.error).toBe('CONFIRMATION_REQUIRED')
    })

    it('creates pre-restore safety checkpoint and restores valid backup upon confirmation', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      const createRes = await backupMgr.createBackup()

      // Mutate live file after backup
      const liveFile = path.join(tempDir, 'ai_preferences.json')
      fs.writeFileSync(liveFile, JSON.stringify({ routingMode: 'fast_cost_effective' }), 'utf-8')

      const restoreMgr = new RestoreManager({
        storageDir: tempDir,
        backupManager: backupMgr,
        nowFn: () => mockCurrentTime
      })

      const res = await restoreMgr.executeRestore({
        backupId: createRes.backupId!,
        createCheckpoint: true,
        confirmedByHuman: true
      })

      expect(res.success).toBe(true)
      expect(res.checkpointCreated).toBeDefined()

      // Verify restored content matches backup snapshot
      const restoredContent = JSON.parse(fs.readFileSync(liveFile, 'utf-8'))
      expect(restoredContent.routingMode).toBe('balanced')
    })

    it('rejects restoration of tampered backup to protect data integrity', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime
      })
      const createRes = await backupMgr.createBackup()

      // Corrupt backup artifact
      const backupFile = path.join(backupMgr.getBackupsDirectory(), createRes.backupId!, 'ai_preferences.json')
      fs.writeFileSync(backupFile, '{ invalid json', 'utf-8')

      const restoreMgr = new RestoreManager({
        storageDir: tempDir,
        backupManager: backupMgr,
        nowFn: () => mockCurrentTime
      })

      const res = await restoreMgr.executeRestore({
        backupId: createRes.backupId!,
        createCheckpoint: true,
        confirmedByHuman: true
      })

      expect(res.success).toBe(false)
      expect(res.error).toBe('INTEGRITY_VERIFICATION_FAILED')
    })
  })
})

