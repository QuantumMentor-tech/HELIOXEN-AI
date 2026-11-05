/**
 * HELIOXEN AI — Step 46: Recovery Contracts & Security Guardrails
 * Strict path sanitization, schema validation, and forbidden repair enforcement.
 */

import { z } from 'zod'
import {
  BackupCategory,
  ApprovedRepairId,
  SelfRepairDefinition
} from './types'

export const SAFE_BACKUP_ID_REGEX = /^backup_[a-zA-Z0-9_-]{1,64}$/

export function isValidBackupId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  return SAFE_BACKUP_ID_REGEX.test(id)
}

export const BACKUP_CATEGORIES: BackupCategory[] = [
  'ai_preferences',
  'voice_preferences',
  'productivity',
  'memory',
  'office',
  'agents',
  'plugins',
  'skills',
  'media_metadata',
  'communication_drafts',
  'devices',
  'smart_home'
]

export const CATEGORY_STORAGE_PATHS: Record<BackupCategory, string> = {
  ai_preferences: 'ai_preferences.json',
  voice_preferences: 'voice_preferences.json',
  productivity: 'productivity_store.json',
  memory: 'memory_store.json',
  office: 'office/office_documents_store.json',
  agents: 'agents/agents_store.json',
  plugins: 'plugins/plugins_store.json',
  skills: 'skills/skills_store.json',
  media_metadata: 'media_library/media_store.json',
  communication_drafts: 'communication/communication_store.json',
  devices: 'devices/android_devices.json',
  smart_home: 'smart-home/smart_home_store.json'
}

export const APPROVED_REPAIR_DEFINITIONS: Record<ApprovedRepairId, SelfRepairDefinition> = {
  REPAIR_CLEAN_STALE_TEMP_FILES: {
    id: 'REPAIR_CLEAN_STALE_TEMP_FILES',
    name: 'Clean Stale Application Temp Files',
    description: 'Safely removes orphaned application-owned temporary and staging artifacts older than 24 hours.',
    allowedTargetPaths: ['backups/.staging_*', 'temp', 'cache'],
    requiresHumanApproval: false,
    riskLevel: 'low'
  },
  REPAIR_RECREATE_CACHE_DIRS: {
    id: 'REPAIR_RECREATE_CACHE_DIRS',
    name: 'Recreate Missing Cache Directories',
    description: 'Ensures required ephemeral directories (media thumbnails, caches) exist without altering persistent data.',
    allowedTargetPaths: ['media_library/thumbnails', 'cache', 'temp'],
    requiresHumanApproval: false,
    riskLevel: 'low'
  },
  REPAIR_CLEAR_CORRUPTED_CACHE: {
    id: 'REPAIR_CLEAR_CORRUPTED_CACHE',
    name: 'Quarantine and Clear Corrupted Cache Entries',
    description: 'Moves known-corrupt temporary files (.corrupt.*.json) to an isolated quarantine archive and resets regenerable cache.',
    allowedTargetPaths: ['cache', '*.corrupt.*.json'],
    requiresHumanApproval: true,
    riskLevel: 'moderate'
  },
  REPAIR_RESET_DEFAULT_PREFERENCES: {
    id: 'REPAIR_RESET_DEFAULT_PREFERENCES',
    name: 'Reset Preferences to Verified Defaults',
    description: 'Resets corrupted or unparseable AI preference files to certified factory defaults while archiving previous content.',
    allowedTargetPaths: ['ai_preferences.json', 'voice_preferences.json'],
    requiresHumanApproval: true,
    riskLevel: 'high'
  },
  REPAIR_RECONCILE_STUCK_OPERATIONS: {
    id: 'REPAIR_RECONCILE_STUCK_OPERATIONS',
    name: 'Reconcile Stuck Operations',
    description: 'Marks interrupted or expired in-flight operations as abandoned/interrupted without replaying external side-effects.',
    allowedTargetPaths: ['session_state.json'],
    requiresHumanApproval: false,
    riskLevel: 'low'
  },
  REPAIR_RESTORE_FROM_CHECKPOINT: {
    id: 'REPAIR_RESTORE_FROM_CHECKPOINT',
    name: 'Rollback to Last Safety Checkpoint',
    description: 'Restores user stores from the immediate pre-restore checkpoint after an aborted or failing restore operation.',
    allowedTargetPaths: ['backups/checkpoint_pre_restore_*'],
    requiresHumanApproval: true,
    riskLevel: 'high'
  }
}

/**
 * Checks whether an operation violates self-repair security boundaries.
 * HELIOXEN is strictly prohibited from mutating application code, Electron security settings,
 * or arbitrary shell commands.
 */
export function isForbiddenRepairOperation(targetPath: string, actionName: string): { forbidden: boolean; reason?: string } {
  const normPath = targetPath.toLowerCase().replace(/\\/g, '/')
  const normAction = actionName.toLowerCase()

  if (
    normPath.includes('.git') ||
    normPath.includes('node_modules') ||
    normPath.endsWith('.ts') ||
    normPath.endsWith('.tsx') ||
    normPath.endsWith('.js') ||
    normPath.endsWith('.jsx') ||
    normPath.includes('package.json') ||
    normPath.includes('tsconfig') ||
    normPath.includes('vite.config')
  ) {
    return {
      forbidden: true,
      reason: 'Mutating application source code, configuration, or build infrastructure is strictly prohibited.'
    }
  }

  if (
    normAction.includes('shell') ||
    normAction.includes('exec') ||
    normAction.includes('eval') ||
    normAction.includes('cmd') ||
    normAction.includes('powershell') ||
    normAction.includes('bash')
  ) {
    return {
      forbidden: true,
      reason: 'Executing arbitrary shell or script evaluation in self-repair is permanently prohibited.'
    }
  }

  if (
    normPath.includes('credentials.json') &&
    (normAction.includes('decrypt_plaintext') || normAction.includes('export_raw'))
  ) {
    return {
      forbidden: true,
      reason: 'Exporting raw plaintext credential vaults is strictly prohibited.'
    }
  }

  return { forbidden: false }
}

export const BackupCreationRequestSchema = z.object({
  categories: z.array(z.string()).optional(),
  label: z.string().max(64).optional()
})

export const BackupVerificationRequestSchema = z.object({
  backupId: z.string().min(1).max(128).regex(SAFE_BACKUP_ID_REGEX, {
    message: 'Invalid backup identifier format.'
  })
})

export const RestorePreviewRequestSchema = z.object({
  backupId: z.string().min(1).max(128).regex(SAFE_BACKUP_ID_REGEX, {
    message: 'Invalid backup identifier format.'
  })
})

export const RestoreExecutionRequestSchema = z.object({
  backupId: z.string().min(1).max(128).regex(SAFE_BACKUP_ID_REGEX, {
    message: 'Invalid backup identifier format.'
  }),
  createCheckpoint: z.boolean().default(true),
  confirmedByHuman: z.boolean()
})

export const SelfRepairRequestSchema = z.object({
  repairId: z.enum([
    'REPAIR_CLEAN_STALE_TEMP_FILES',
    'REPAIR_RECREATE_CACHE_DIRS',
    'REPAIR_CLEAR_CORRUPTED_CACHE',
    'REPAIR_RESET_DEFAULT_PREFERENCES',
    'REPAIR_RECONCILE_STUCK_OPERATIONS',
    'REPAIR_RESTORE_FROM_CHECKPOINT'
  ]),
  confirmedByHuman: z.boolean().optional(),
  parameters: z.record(z.string(), z.unknown()).optional()
})

