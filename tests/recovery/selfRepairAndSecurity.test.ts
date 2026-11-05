import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { CrashRecoveryManager } from '../../src/main/recovery/CrashRecoveryManager'
import { BackupManager } from '../../src/main/recovery/BackupManager'
import { SelfRepairManager } from '../../src/main/recovery/SelfRepairManager'
import { isForbiddenRepairOperation } from '../../src/shared/recovery/contracts'
import { ApprovedRepairId } from '../../src/shared/recovery/types'

describe('Controlled Self-Repair & Security Boundaries (Step 46)', () => {
  let tempDir: string
  let mockCurrentTime: number
  let crashRecoveryMgr: CrashRecoveryManager
  let backupMgr: BackupManager
  let selfRepairMgr: SelfRepairManager

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-repair-test-'))
    mockCurrentTime = 1700000000000

    crashRecoveryMgr = new CrashRecoveryManager({
      storageDir: tempDir,
      nowFn: () => mockCurrentTime
    })

    backupMgr = new BackupManager({
      storageDir: tempDir,
      nowFn: () => mockCurrentTime
    })

    selfRepairMgr = new SelfRepairManager({
      storageDir: tempDir,
      crashRecoveryManager: crashRecoveryMgr,
      backupManager: backupMgr,
      nowFn: () => mockCurrentTime
    })
  })

  afterEach(() => {
    crashRecoveryMgr.dispose()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Bounded Read-Only Diagnostics', () => {
    it('produces structured diagnostic report with clean baseline', () => {
      const report = selfRepairMgr.runDiagnostics()
      expect(report.reportId).toBeDefined()
      expect(report.generatedAt).toBe(mockCurrentTime)
      expect(Array.isArray(report.findings)).toBe(true)
      expect(Array.isArray(report.availableRepairs)).toBe(true)
    })

    it('identifies missing cache directories and suggests REPAIR_RECREATE_CACHE_DIRS', () => {
      const report = selfRepairMgr.runDiagnostics()
      const thumbFinding = report.findings.find((f) => f.id === 'finding_missing_thumbnails_dir')
      expect(thumbFinding).toBeDefined()
      expect(thumbFinding?.suggestedRepairId).toBe('REPAIR_RECREATE_CACHE_DIRS')
      expect(report.availableRepairs).toContain('REPAIR_RECREATE_CACHE_DIRS')
    })

    it('detects stale backup staging folders and suggests REPAIR_CLEAN_STALE_TEMP_FILES', () => {
      // Create a stale staging folder
      const staleDir = path.join(backupMgr.getBackupsDirectory(), '.staging_backup_old_1234')
      fs.mkdirSync(staleDir, { recursive: true })

      const report = selfRepairMgr.runDiagnostics()
      const staleFinding = report.findings.find((f) => f.id === 'finding_stale_staging')
      expect(staleFinding).toBeDefined()
      expect(staleFinding?.suggestedRepairId).toBe('REPAIR_CLEAN_STALE_TEMP_FILES')
    })

    it('detects corrupted storage files and suggests REPAIR_CLEAR_CORRUPTED_CACHE', () => {
      fs.writeFileSync(path.join(tempDir, 'productivity_store.corrupt.12345.json'), 'corrupt', 'utf-8')

      const report = selfRepairMgr.runDiagnostics()
      const corruptFinding = report.findings.find((f) => f.id === 'finding_corrupted_json_artifacts')
      expect(corruptFinding).toBeDefined()
      expect(corruptFinding?.suggestedRepairId).toBe('REPAIR_CLEAR_CORRUPTED_CACHE')
    })
  })

  describe('2. Approved Self-Repair Execution', () => {
    it('executes REPAIR_RECREATE_CACHE_DIRS safely without modifying data', async () => {
      const result = await selfRepairMgr.executeRepair({
        repairId: 'REPAIR_RECREATE_CACHE_DIRS',
        confirmedByHuman: false
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'media_library/thumbnails'))).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'cache'))).toBe(true)
    })

    it('executes REPAIR_CLEAN_STALE_TEMP_FILES and purges staging directories', async () => {
      const staleDir = path.join(backupMgr.getBackupsDirectory(), '.staging_backup_stale_test')
      fs.mkdirSync(staleDir, { recursive: true })
      expect(fs.existsSync(staleDir)).toBe(true)

      const result = await selfRepairMgr.executeRepair({
        repairId: 'REPAIR_CLEAN_STALE_TEMP_FILES',
        confirmedByHuman: false
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(staleDir)).toBe(false)
    })

    it('executes REPAIR_CLEAR_CORRUPTED_CACHE and moves corrupted files to quarantine', async () => {
      const corruptFile = path.join(tempDir, 'settings.corrupt.999.json')
      fs.writeFileSync(corruptFile, 'corrupt', 'utf-8')

      const result = await selfRepairMgr.executeRepair({
        repairId: 'REPAIR_CLEAR_CORRUPTED_CACHE',
        confirmedByHuman: true
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(corruptFile)).toBe(false)
      const quarantineDir = path.join(tempDir, 'quarantine')
      expect(fs.existsSync(path.join(quarantineDir, 'settings.corrupt.999.json'))).toBe(true)
    })

    it('requires human approval for high-risk REPAIR_RESET_DEFAULT_PREFERENCES', async () => {
      const prefFile = path.join(tempDir, 'ai_preferences.json')
      fs.writeFileSync(prefFile, JSON.stringify({ corrupted: true }), 'utf-8')

      // Without human approval: must be denied
      const unconfirmedResult = await selfRepairMgr.executeRepair({
        repairId: 'REPAIR_RESET_DEFAULT_PREFERENCES',
        confirmedByHuman: false
      })
      expect(unconfirmedResult.success).toBe(false)
      expect(unconfirmedResult.error).toBe('APPROVAL_REQUIRED')

      // With human approval: resets to safe defaults while archiving previous file
      const confirmedResult = await selfRepairMgr.executeRepair({
        repairId: 'REPAIR_RESET_DEFAULT_PREFERENCES',
        confirmedByHuman: true
      })
      expect(confirmedResult.success).toBe(true)
      const resetContent = JSON.parse(fs.readFileSync(prefFile, 'utf-8'))
      expect(resetContent.routingMode).toBe('balanced')
      expect(resetContent.temperature).toBe(0.7)
    })

    it('reconciles stuck operations without auto-replaying external actions', async () => {
      crashRecoveryMgr.registerOperation({
        id: 'op_stuck_1',
        type: 'communication:send',
        description: 'Send message',
        isExternal: true
      })
      crashRecoveryMgr.setRecoveryState('recovery_requires_user_review')

      const result = await selfRepairMgr.executeRepair({
        repairId: 'REPAIR_RECONCILE_STUCK_OPERATIONS',
        confirmedByHuman: false
      })

      expect(result.success).toBe(true)
      expect(crashRecoveryMgr.getSessionState().recoveryState).toBe('recovery_completed')
    })
  })

  describe('3. Strict Security Boundaries & Forbidden Operations Defense', () => {
    it('strictly rejects unapproved repair IDs', async () => {
      const result = await selfRepairMgr.executeRepair({
        repairId: 'ARBITRARY_UNAPPROVED_REPAIR' as unknown as ApprovedRepairId
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('UNAPPROVED_REPAIR_OPERATION')
    })

    it('strictly forbids modifying application source code or build configuration', () => {
      expect(isForbiddenRepairOperation('src/main/index.ts', 'modify').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('src/renderer/App.tsx', 'overwrite').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('package.json', 'update_deps').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('node_modules/electron', 'replace').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('.git/config', 'edit').forbidden).toBe(true)
    })

    it('strictly forbids arbitrary shell execution or script evaluation', () => {
      expect(isForbiddenRepairOperation('temp', 'shell_exec').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('temp', 'run_powershell_script').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('temp', 'eval_code').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('temp', 'cmd_run').forbidden).toBe(true)
    })

    it('strictly forbids raw plaintext credential export', () => {
      expect(isForbiddenRepairOperation('credentials.json', 'decrypt_plaintext').forbidden).toBe(true)
      expect(isForbiddenRepairOperation('credentials.json', 'export_raw').forbidden).toBe(true)
    })
  })
})

