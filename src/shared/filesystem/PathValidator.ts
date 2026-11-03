/**
 * HELIOXEN AI — Step 29: Path Validator
 * Strictly validates path safety, canonicalization, containment, and system protections.
 */

import path from 'path'
import fs from 'fs'

export interface PathValidationResult {
  readonly valid: boolean
  readonly canonicalPath?: string
  readonly relativePath?: string
  readonly error?: string
}

const RESERVED_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

export class PathValidator {
  private static protectedSystemRoots: string[] = []

  /**
   * Initializes protected operating system roots.
   */
  public static getProtectedRoots(): string[] {
    if (this.protectedSystemRoots.length === 0) {
      const roots: string[] = []
      if (process.platform === 'win32') {
        const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
        roots.push(path.normalize(sysRoot).toLowerCase())
        if (process.env['ProgramFiles']) {
          roots.push(path.normalize(process.env['ProgramFiles']).toLowerCase())
        }
        if (process.env['ProgramFiles(x86)']) {
          roots.push(path.normalize(process.env['ProgramFiles(x86)']).toLowerCase())
        }
      } else {
        roots.push('/etc', '/bin', '/sbin', '/usr', '/var', '/proc', '/sys')
      }
      this.protectedSystemRoots = roots
    }
    return this.protectedSystemRoots
  }

  /**
   * Validates that targetPath is safely contained within authorizedRoot.
   */
  public static validateContainment(targetPath: string, authorizedRoot: string): PathValidationResult {
    if (!authorizedRoot || typeof authorizedRoot !== 'string' || authorizedRoot.trim() === '') {
      return { valid: false, error: 'Authorized root directory path must be provided' }
    }

    if (!targetPath || typeof targetPath !== 'string' || targetPath.trim() === '') {
      return { valid: false, error: 'Target path must be provided' }
    }

    // 1. Resolve canonical normalized paths
    const canonicalRoot = path.normalize(path.resolve(authorizedRoot))
    const canonicalTarget = path.isAbsolute(targetPath)
      ? path.normalize(path.resolve(targetPath))
      : path.normalize(path.resolve(canonicalRoot, targetPath))

    // 2. Traversal and containment check
    const rel = path.relative(canonicalRoot, canonicalTarget)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return {
        valid: false,
        error: `Path traversal detected: "${targetPath}" is outside authorized root "${authorizedRoot}"`
      }
    }

    // 3. System protected paths check
    const lowerTarget = canonicalTarget.toLowerCase()
    for (const sysRoot of this.getProtectedRoots()) {
      if (lowerTarget === sysRoot || lowerTarget.startsWith(sysRoot + path.sep)) {
        return {
          valid: false,
          error: `Access violation: Path resides in protected system directory "${sysRoot}"`
        }
      }
    }

    // 4. Filename validity and Windows reserved names
    const fileName = path.basename(canonicalTarget)
    if (fileName && fileName !== '.' && fileName !== '..') {
      const baseNameWithoutExt = fileName.split('.')[0].toUpperCase()
      if (RESERVED_DEVICE_NAMES.has(baseNameWithoutExt)) {
        return {
          valid: false,
          error: `Invalid filename: "${fileName}" is a reserved operating system device name`
        }
      }

      // Check for illegal characters in filename
      if (/[<>:"/\\|?*\x00-\x1F]/.test(fileName)) {
        return {
          valid: false,
          error: `Invalid filename: "${fileName}" contains prohibited characters`
        }
      }
    }

    // 5. Symbolic link / reparse point realpath check
    try {
      if (fs.existsSync(canonicalTarget)) {
        const realTarget = fs.realpathSync(canonicalTarget)
        const realRel = path.relative(canonicalRoot, realTarget)
        if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
          return {
            valid: false,
            error: `Symlink escape detected: real path "${realTarget}" escapes authorized root`
          }
        }
      }
    } catch {
      // If path does not exist yet (e.g. create destination), containment check above is sufficient
    }

    return {
      valid: true,
      canonicalPath: canonicalTarget,
      relativePath: rel || '.'
    }
  }
}

