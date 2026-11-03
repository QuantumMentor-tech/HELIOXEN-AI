/**
 * HELIOXEN AI — Step 30: Target Window Resolver
 * Validates, re-checks, and resolves target window references immediately before action dispatch.
 * Prevents input delivery to closed, substituted, or stale window targets.
 */

import { BrowserWindow } from 'electron'
import {
  TargetWindowReference,
  TargetValidationResult
} from '../../shared/interaction/types'
import { windowDiscoveryManager, WindowDiscoveryManager } from '../telemetry'
import { IpcException } from '../../shared/ipc/errors'

export interface TargetResolverAdapter {
  findAppWindow: (windowId: string) => BrowserWindow | null
  getDesktopWindows: () => Promise<readonly {
    id: string
    title: string
    appAssociation?: string
    bounds?: { x: number; y: number; width: number; height: number }
    isVisible?: boolean
    isMinimized?: boolean
    isActive?: boolean
    isSelfApp?: boolean
  }[]>
}

export class TargetResolver {
  private readonly adapter: TargetResolverAdapter

  constructor(adapter?: TargetResolverAdapter) {
    this.adapter = adapter ?? {
      findAppWindow: (windowId: string) => {
        try {
          const windows = BrowserWindow.getAllWindows()
          for (const win of windows) {
            if (win && !win.isDestroyed()) {
              if (`win_helioxen_${win.id}` === windowId || String(win.id) === windowId) {
                return win
              }
            }
          }
          return null
        } catch {
          return null
        }
      },
      getDesktopWindows: async () => {
        try {
          const res = await windowDiscoveryManager.getDesktopWindows({ includeSelf: true, limit: 100 })
          return res.windows
        } catch {
          return []
        }
      }
    }
  }

  /**
   * Resolves and verifies that a target window is currently alive, valid, and matches expectations.
   * Throws IpcException if window cannot be found or violates constraints.
   */
  public async resolveAndValidateTarget(target: TargetWindowReference): Promise<TargetValidationResult> {
    if (!target.windowId) {
      throw new IpcException('VALIDATION_ERROR', 'Target window reference is missing required windowId')
    }

    // 1. First check if it is a HELIOXEN app window
    const appWin = this.adapter.findAppWindow(target.windowId)
    if (appWin && !appWin.isDestroyed()) {
      const bounds = appWin.getBounds()
      const title = appWin.getTitle() || 'HELIOXEN Assistant'
      const appAssociation = 'HELIOXEN AI'

      // Check expected title substring
      if (target.expectedTitleSubstring && !title.toLowerCase().includes(target.expectedTitleSubstring.toLowerCase())) {
        throw new IpcException(
          'OPERATION_UNAVAILABLE',
          `Target window title mismatch: expected to contain '${target.expectedTitleSubstring}', found '${title}'`
        )
      }

      // Check expected app association
      if (target.expectedAppAssociation && target.expectedAppAssociation.toLowerCase() !== appAssociation.toLowerCase()) {
        throw new IpcException(
          'OPERATION_UNAVAILABLE',
          `Target window app mismatch: expected '${target.expectedAppAssociation}', found '${appAssociation}'`
        )
      }

      // Validate bounds
      if (bounds.width <= 0 || bounds.height <= 0) {
        throw new IpcException(
          'OPERATION_UNAVAILABLE',
          `Target window has invalid dimensions (${bounds.width}x${bounds.height})`
        )
      }

      return {
        isValid: true,
        windowId: target.windowId,
        title,
        appAssociation,
        bounds,
        isFocused: appWin.isFocused(),
        isSelfApp: true
      }
    }

    // 2. Query external desktop windows
    const desktopWindows = await this.adapter.getDesktopWindows()
    const match = desktopWindows.find((w) => w.id === target.windowId)

    if (!match) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Target window '${target.windowId}' is closed, stale, or no longer available`
      )
    }

    if (match.isMinimized) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Target window '${target.windowId}' is currently minimized`
      )
    }

    if (target.expectedTitleSubstring && !match.title.toLowerCase().includes(target.expectedTitleSubstring.toLowerCase())) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Target window title mismatch: expected to contain '${target.expectedTitleSubstring}', found '${match.title}'`
      )
    }

    const appAssociation = match.appAssociation || 'Unknown App'
    if (target.expectedAppAssociation && target.expectedAppAssociation.toLowerCase() !== appAssociation.toLowerCase()) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Target window app mismatch: expected '${target.expectedAppAssociation}', found '${appAssociation}'`
      )
    }

    const bounds = match.bounds ?? { x: 0, y: 0, width: 800, height: 600 }
    if (bounds.width <= 0 || bounds.height <= 0) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Target window has invalid dimensions (${bounds.width}x${bounds.height})`
      )
    }

    return {
      isValid: true,
      windowId: match.id,
      title: match.title,
      appAssociation,
      bounds,
      isFocused: Boolean(match.isActive),
      isSelfApp: Boolean(match.isSelfApp)
    }
  }
}

export const targetResolver = new TargetResolver()
