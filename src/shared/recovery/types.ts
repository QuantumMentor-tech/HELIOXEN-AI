/**
 * HELIOXEN AI — Step 46: Recovery, Backup & Self-Repair Domain Types
 * Typed contracts for crash recovery, verified backups, data integrity, and bounded self-repair.
 */

export type RecoveryState =
  | 'normal_startup'
  | 'startup_validation_in_progress'
  | 'previous_session_clean'
  | 'previous_session_interrupted'
  | 'recovery_data_available'
  | 'recovery_requires_user_review'
  | 'recovery_in_progress'
  | 'recovery_completed'
  | 'recovery_failed'
  | 'data_integrity_issue_detected'
  | 'recovery_unavailable_or_unsafe'

export type InterruptedOperationState =
  | 'not_started'
  | 'started_local'
  | 'dispatched_confirmed_success'
  | 'dispatched_confirmed_failed'
  | 'cancelled'
  | 'interrupted_unknown_outcome'

export interface InterruptedOperation {
  readonly id: string
  readonly type: string
  readonly description: string
  readonly isExternal: boolean
  readonly idempotencyKey?: string
  readonly state: InterruptedOperationState
  readonly startedAt: number
  readonly lastUpdatedAt: number
  readonly details?: Record<string, unknown>
  readonly requiresUserReview: boolean
  readonly replayed: boolean
}

export interface SessionState {
  readonly sessionId: string
  readonly pid: number
  readonly appVersion: string
  readonly startedAt: number
  readonly lastHeartbeatAt: number
  readonly cleanShutdown: boolean
  readonly shutdownAt?: number
  readonly recoveryState: RecoveryState
  readonly activeOperations: InterruptedOperation[]
}

export type BackupCategory =
  | 'ai_preferences'
  | 'voice_preferences'
  | 'productivity'
  | 'memory'
  | 'office'
  | 'agents'
  | 'plugins'
  | 'skills'
  | 'media_metadata'
  | 'communication_drafts'
  | 'devices'
  | 'smart_home'

export interface BackupArtifactMetadata {
  readonly name: string
  readonly category: BackupCategory
  readonly relativePath: string
  readonly sizeBytes: number
  readonly sha256: string
}

export interface BackupManifest {
  readonly manifestVersion: number
  readonly backupId: string
  readonly createdAt: number
  readonly appVersion: string
  readonly schemaVersion: number
  readonly totalSizeBytes: number
  readonly includedCategories: BackupCategory[]
  readonly artifacts: BackupArtifactMetadata[]
  readonly isEncrypted: boolean
  readonly status: 'complete' | 'staged' | 'corrupt'
  readonly verificationResult?: {
    readonly verified: boolean
    readonly verifiedAt: number
    readonly errors?: string[]
  }
}

export interface BackupCreationRequest {
  readonly categories?: BackupCategory[]
  readonly label?: string
}

export interface BackupCreationResult {
  readonly success: boolean
  readonly backupId?: string
  readonly manifest?: BackupManifest
  readonly message: string
  readonly error?: string
  readonly durationMs: number
}

export interface BackupVerificationResult {
  readonly backupId: string
  readonly valid: boolean
  readonly checkedArtifacts: number
  readonly mismatchedChecksums: string[]
  readonly missingArtifacts: string[]
  readonly errors: string[]
  readonly verifiedAt: number
}

export interface RestorePreview {
  readonly backupId: string
  readonly createdAt: number
  readonly includedCategories: BackupCategory[]
  readonly affectedStores: string[]
  readonly requiresRestart: boolean
  readonly warningMessage: string
  readonly isCompatible: boolean
  readonly incompatibilityReasons?: string[]
}

export interface RestoreExecutionRequest {
  readonly backupId: string
  readonly createCheckpoint: boolean
  readonly confirmedByHuman: boolean
}

export interface RestoreExecutionResult {
  readonly success: boolean
  readonly backupId: string
  readonly restoredCategories: BackupCategory[]
  readonly checkpointCreated?: string
  readonly rolledBack: boolean
  readonly message: string
  readonly error?: string
  readonly executedAt: number
}

export interface DiagnosticFinding {
  readonly id: string
  readonly level: 'info' | 'warning' | 'error' | 'critical'
  readonly category: 'session' | 'storage' | 'backup' | 'cache' | 'operations'
  readonly title: string
  readonly description: string
  readonly suggestedRepairId?: string
}

export interface DiagnosticReport {
  readonly reportId: string
  readonly generatedAt: number
  readonly recoveryState: RecoveryState
  readonly sessionClean: boolean
  readonly findings: DiagnosticFinding[]
  readonly availableRepairs: string[]
  readonly latestVerifiedBackupId?: string
}

export type ApprovedRepairId =
  | 'REPAIR_CLEAN_STALE_TEMP_FILES'
  | 'REPAIR_RECREATE_CACHE_DIRS'
  | 'REPAIR_CLEAR_CORRUPTED_CACHE'
  | 'REPAIR_RESET_DEFAULT_PREFERENCES'
  | 'REPAIR_RECONCILE_STUCK_OPERATIONS'
  | 'REPAIR_RESTORE_FROM_CHECKPOINT'

export interface SelfRepairDefinition {
  readonly id: ApprovedRepairId
  readonly name: string
  readonly description: string
  readonly allowedTargetPaths: string[]
  readonly requiresHumanApproval: boolean
  readonly riskLevel: 'low' | 'moderate' | 'high'
}

export interface SelfRepairRequest {
  readonly repairId: ApprovedRepairId
  readonly confirmedByHuman?: boolean
  readonly parameters?: Record<string, unknown>
}

export interface SelfRepairResult {
  readonly success: boolean
  readonly repairId: string
  readonly message: string
  readonly error?: string
  readonly changesSummary: string[]
  readonly rolledBack?: boolean
  readonly executedAt: number
}

export interface RecoveryOverview {
  readonly session: SessionState
  readonly lastVerifiedBackup?: BackupManifest | null
  readonly backupCount: number
  readonly diagnosticFindingsCount: number
  readonly pendingRepairsCount: number
}
