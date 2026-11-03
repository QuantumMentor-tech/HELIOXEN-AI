/**
 * HELIOXEN AI — Step 29: Authorized Path Manager
 * Manages authorized directory roots for user-consented filesystem operations.
 */

import path from 'path'
import { PathValidator } from '../../shared/filesystem/PathValidator'

export class AuthorizedPathManager {
  private readonly authorizedRoots = new Map<string, { rootPath: string; grantedAt: number; label?: string }>()

  /**
   * Registers an authorized directory scope for the current session or task.
   */
  public authorizeRoot(rootPath: string, label?: string): string {
    const canonical = path.normalize(path.resolve(rootPath))

    // Ensure the root itself does not violate system protected directory restrictions
    const lower = canonical.toLowerCase()
    for (const sysRoot of PathValidator.getProtectedRoots()) {
      if (lower === sysRoot || lower.startsWith(sysRoot + path.sep)) {
        throw new Error(`Cannot authorize protected system root directory: "${canonical}"`)
      }
    }

    const id = `root_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.authorizedRoots.set(id, {
      rootPath: canonical,
      grantedAt: Date.now(),
      label
    })

    return canonical
  }

  /**
   * Validates whether a given root path is authorized.
   */
  public isAuthorizedRoot(targetPath: string): boolean {
    const canonical = path.normalize(path.resolve(targetPath))
    for (const entry of this.authorizedRoots.values()) {
      if (canonical === entry.rootPath) {
        return true
      }
    }
    return false
  }

  /**
   * Clears all authorized roots (e.g. on task or session completion).
   */
  public clear(): void {
    this.authorizedRoots.clear()
  }
}

export const authorizedPathManager = new AuthorizedPathManager()

