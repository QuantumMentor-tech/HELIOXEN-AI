/**
 * HELIOXEN AI — Step 30: System Operations Manager
 * Implements a strict, reviewed allowlist of predefined operating-system operations.
 * Strictly prohibits arbitrary shell/PowerShell command strings and untrusted execution primitives.
 */

import { shell, screen } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  SystemOpenPathRequest,
  SystemOpenPathResult,
  SystemShowInFolderRequest,
  SystemShowInFolderResult,
  SystemOpenUrlRequest,
  SystemOpenUrlResult,
  SystemAlertBeepResult,
  DisplayMetricsResult
} from '../../shared/interaction/types'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

export interface SystemOperationAdapter {
  openPath: (targetPath: string) => Promise<string>
  showItemInFolder: (targetPath: string) => void
  openExternal: (url: string) => Promise<void>
  beep: () => void
  getPrimaryDisplay: () => any
  getAllDisplays: () => any[]
}

const PROTECTED_SYSTEM_PATHS = [
  'c:\\windows',
  'c:\\windows\\system32',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\system volume information',
  'c:\\$recycle.bin'
]

const RESERVED_DEVICE_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i

export class SystemOperationManager {
  private readonly adapter: SystemOperationAdapter

  constructor(adapter?: SystemOperationAdapter) {
    this.adapter = adapter ?? {
      openPath: async (targetPath: string) => {
        return await shell.openPath(targetPath)
      },
      showItemInFolder: (targetPath: string) => {
        shell.showItemInFolder(targetPath)
      },
      openExternal: async (url: string) => {
        await shell.openExternal(url)
      },
      beep: () => {
        shell.beep()
      },
      getPrimaryDisplay: () => {
        return screen.getPrimaryDisplay()
      },
      getAllDisplays: () => {
        return screen.getAllDisplays()
      }
    }
  }

  /**
   * Opens an authorized file or directory using the operating system's default handler.
   */
  public async openPath(request: SystemOpenPathRequest): Promise<SystemOpenPathResult> {
    const rawPath = request.targetPath.trim()
    if (!rawPath) {
      throw new IpcException('VALIDATION_ERROR', 'Target path cannot be empty')
    }

    const resolved = path.resolve(rawPath)
    this.validateSystemPath(resolved)

    if (!fs.existsSync(resolved)) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Target path does not exist on disk: '${resolved}'`)
    }

    const errMsg = await this.adapter.openPath(resolved)
    if (errMsg) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Operating system failed to open path: ${errMsg}`)
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'system:openPath',
      targetPath: resolved
    })

    return {
      success: true,
      targetPath: resolved,
      openedAt: new Date().toISOString()
    }
  }

  /**
   * Highlights and reveals a verified file or folder in Windows File Explorer.
   */
  public async showInFolder(request: SystemShowInFolderRequest): Promise<SystemShowInFolderResult> {
    const rawPath = request.targetPath.trim()
    if (!rawPath) {
      throw new IpcException('VALIDATION_ERROR', 'Target path cannot be empty')
    }

    const resolved = path.resolve(rawPath)
    this.validateSystemPath(resolved)

    if (!fs.existsSync(resolved)) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Target path does not exist on disk: '${resolved}'`)
    }

    this.adapter.showItemInFolder(resolved)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'system:showInFolder',
      targetPath: resolved
    })

    return {
      success: true,
      targetPath: resolved,
      revealedAt: new Date().toISOString()
    }
  }

  /**
   * Opens an explicitly validated HTTP or HTTPS web URL in the user's default browser.
   * Strictly blocks non-web schemes (file:, javascript:, data:, powershell:, ms-settings:).
   */
  public async openExternalUrl(request: SystemOpenUrlRequest): Promise<SystemOpenUrlResult> {
    const rawUrl = request.url.trim()
    if (!rawUrl) {
      throw new IpcException('VALIDATION_ERROR', 'URL cannot be empty')
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(rawUrl)
    } catch {
      throw new IpcException('VALIDATION_ERROR', `Malformed URL provided: '${rawUrl}'`)
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Protocol '${parsedUrl.protocol}' is prohibited. Only http: and https: protocols are permitted.`
      )
    }

    await this.adapter.openExternal(parsedUrl.toString())

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'system:openExternalUrl',
      domain: parsedUrl.hostname
    })

    return {
      success: true,
      url: parsedUrl.toString(),
      domain: parsedUrl.hostname,
      openedAt: new Date().toISOString()
    }
  }

  /**
   * Emits a standard operating system alert sound.
   */
  public systemAlertBeep(): SystemAlertBeepResult {
    this.adapter.beep()

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'system:systemAlert'
    })

    return {
      success: true,
      beepedAt: new Date().toISOString()
    }
  }

  /**
   * Retrieves host display metrics, screen boundaries, and scaling factors.
   */
  public getDisplayMetrics(): DisplayMetricsResult {
    try {
      const primary = this.adapter.getPrimaryDisplay()
      const all = this.adapter.getAllDisplays()

      return {
        primaryDisplay: {
          id: primary?.id ?? 1,
          bounds: primary?.bounds ?? { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: primary?.workArea ?? { x: 0, y: 0, width: 1920, height: 1040 },
          scaleFactor: primary?.scaleFactor ?? 1
        },
        allDisplaysCount: all?.length ?? 1,
        queriedAt: new Date().toISOString()
      }
    } catch {
      return {
        primaryDisplay: {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 0, width: 1920, height: 1040 },
          scaleFactor: 1
        },
        allDisplaysCount: 1,
        queriedAt: new Date().toISOString()
      }
    }
  }

  private validateSystemPath(resolvedPath: string): void {
    const lower = resolvedPath.toLowerCase()
    for (const forbidden of PROTECTED_SYSTEM_PATHS) {
      if (lower === forbidden || lower.startsWith(forbidden + '\\')) {
        throw new IpcException(
          'OPERATION_UNAVAILABLE',
          `Direct access to protected system path '${resolvedPath}' is prohibited`
        )
      }
    }

    const baseName = path.basename(resolvedPath)
    if (RESERVED_DEVICE_NAMES.test(baseName)) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Path references reserved device name: '${baseName}'`
      )
    }
  }
}

export const systemOperationManager = new SystemOperationManager()
