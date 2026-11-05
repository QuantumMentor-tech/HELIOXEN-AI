/**
 * HELIOXEN AI — Step 46: Main Recovery Exports & Factory
 */

import { app } from 'electron'
import { RecoveryService } from './RecoveryService'

export * from './CrashRecoveryManager'
export * from './BackupManager'
export * from './RestoreManager'
export * from './SelfRepairManager'
export * from './RecoveryService'

let recoveryServiceInstance: RecoveryService | null = null

export function getRecoveryService(customStorageDir?: string): RecoveryService {
  if (!recoveryServiceInstance) {
    const storageDir = customStorageDir || (typeof app?.getPath === 'function' ? app.getPath('userData') : process.cwd())
    recoveryServiceInstance = new RecoveryService({
      storageDir,
      appVersion: typeof app?.getVersion === 'function' ? app.getVersion() : '0.1.0-alpha.1'
    })
  }
  return recoveryServiceInstance
}

