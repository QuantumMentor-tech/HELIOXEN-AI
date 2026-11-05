/**
 * HELIOXEN AI — Step 46: Recovery Service Facade
 * Consolidated entrypoint for Crash Recovery, Verified Backups,
 * Restore Execution, and Bounded Self-Repair.
 */

import {
  RecoveryOverview,
  SessionState,
  BackupManifest,
  BackupCreationRequest,
  BackupCreationResult,
  BackupVerificationResult,
  RestorePreview,
  RestoreExecutionRequest,
  RestoreExecutionResult,
  DiagnosticReport,
  SelfRepairRequest,
  SelfRepairResult
} from '../../shared/recovery/types'
import { CrashRecoveryManager } from './CrashRecoveryManager'
import { BackupManager } from './BackupManager'
import { RestoreManager } from './RestoreManager'
import { SelfRepairManager } from './SelfRepairManager'

export interface RecoveryServiceOptions {
  readonly storageDir: string
  readonly appVersion?: string
  readonly nowFn?: () => number
}

export class RecoveryService {
  private readonly crashRecoveryManager: CrashRecoveryManager
  private readonly backupManager: BackupManager
  private readonly restoreManager: RestoreManager
  private readonly selfRepairManager: SelfRepairManager

  constructor(options: RecoveryServiceOptions) {
    const { storageDir, appVersion, nowFn } = options

    this.crashRecoveryManager = new CrashRecoveryManager({
      storageDir,
      appVersion,
      nowFn
    })

    this.backupManager = new BackupManager({
      storageDir,
      appVersion,
      nowFn
    })

    this.restoreManager = new RestoreManager({
      storageDir,
      backupManager: this.backupManager,
      nowFn
    })

    this.selfRepairManager = new SelfRepairManager({
      storageDir,
      crashRecoveryManager: this.crashRecoveryManager,
      backupManager: this.backupManager,
      nowFn
    })
  }

  public getCrashRecoveryManager(): CrashRecoveryManager {
    return this.crashRecoveryManager
  }

  public getBackupManager(): BackupManager {
    return this.backupManager
  }

  public getRestoreManager(): RestoreManager {
    return this.restoreManager
  }

  public getSelfRepairManager(): SelfRepairManager {
    return this.selfRepairManager
  }

  public getOverview(): RecoveryOverview {
    const session = this.crashRecoveryManager.getSessionState()
    const backups = this.backupManager.listBackups()
    const lastVerifiedBackup = backups.length > 0 ? backups[0] : null
    const diag = this.selfRepairManager.runDiagnostics()

    return {
      session,
      lastVerifiedBackup,
      backupCount: backups.length,
      diagnosticFindingsCount: diag.findings.length,
      pendingRepairsCount: diag.availableRepairs.length
    }
  }

  public getSessionState(): SessionState {
    return this.crashRecoveryManager.getSessionState()
  }

  public listBackups(): BackupManifest[] {
    return this.backupManager.listBackups()
  }

  public async createBackup(request?: BackupCreationRequest): Promise<BackupCreationResult> {
    return await this.backupManager.createBackup(request)
  }

  public verifyBackup(backupId: string): BackupVerificationResult {
    return this.backupManager.verifyBackup(backupId)
  }

  public getRestorePreview(backupId: string): RestorePreview {
    return this.restoreManager.getRestorePreview(backupId)
  }

  public async executeRestore(request: RestoreExecutionRequest): Promise<RestoreExecutionResult> {
    return await this.restoreManager.executeRestore(request)
  }

  public runDiagnostics(): DiagnosticReport {
    return this.selfRepairManager.runDiagnostics()
  }

  public async executeRepair(request: SelfRepairRequest): Promise<SelfRepairResult> {
    return await this.selfRepairManager.executeRepair(request)
  }

  public recordCleanShutdown(): void {
    this.crashRecoveryManager.recordCleanShutdown()
  }

  public dispose(): void {
    this.crashRecoveryManager.dispose()
  }
}

