/**
 * HELIOXEN AI — Step 31: Browser Navigation Policy
 * Strictly validates, normalizes, and sanitizes URLs requested for browser navigation.
 * Prevents protocol smuggling, credential embedding, and navigation to unsafe schemes.
 */

import { IpcException } from '../../shared/ipc/errors'

export class NavigationPolicy {
  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

  /**
   * Validates and returns a normalized URL string.
   * Throws IpcException if URL is invalid, uses an unapproved protocol, or contains credentials.
   */
  public static validateUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new IpcException('VALIDATION_ERROR', 'URL must be a non-empty string')
    }

    const trimmed = rawUrl.trim()
    if (!trimmed) {
      throw new IpcException('VALIDATION_ERROR', 'URL cannot be empty or blank')
    }

    if (trimmed.length > 2048) {
      throw new IpcException('VALIDATION_ERROR', 'URL exceeds maximum length of 2048 characters')
    }

    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new IpcException('VALIDATION_ERROR', `Malformed URL provided: '${trimmed}'`)
    }

    // Protocol check
    if (!this.ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Protocol '${parsed.protocol}' is prohibited. Only http: and https: protocols are permitted.`
      )
    }

    // Credentials check
    if (parsed.username || parsed.password) {
      throw new IpcException(
        'VALIDATION_ERROR',
        'Embedded credentials in URLs (user:pass@host) are prohibited for security'
      )
    }

    return parsed.toString()
  }

  /**
   * Determines whether a given URL is permitted for navigation without throwing.
   */
  public static isUrlAllowed(url: string): boolean {
    try {
      this.validateUrl(url)
      return true
    } catch {
      return false
    }
  }
}

