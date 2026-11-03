/**
 * HELIOXEN AI — Step 28: Desktop Window Discovery Manager
 * Secure, read-only desktop window enumeration.
 * Queries Electron application windows and permitted top-level desktop windows via desktopCapturer.
 * Never captures window contents, screenshots, or injects input.
 */

import { BrowserWindow, desktopCapturer } from 'electron'
import {
  WindowMetadataEntry,
  WindowDiscoveryRequest,
  WindowDiscoveryResult
} from '../../shared/telemetry/types'

export interface WindowDiscoveryAdapter {
  getAppWindows: () => BrowserWindow[]
  getDesktopSources?: () => Promise<Array<{ id: string; name: string; display_id?: string }>>
}

export class WindowDiscoveryManager {
  private readonly adapter: WindowDiscoveryAdapter

  constructor(adapter?: WindowDiscoveryAdapter) {
    this.adapter = adapter ?? {
      getAppWindows: () => {
        try {
          return BrowserWindow.getAllWindows()
        } catch {
          return []
        }
      },
      getDesktopSources: async () => {
        try {
          if (!desktopCapturer || typeof desktopCapturer.getSources !== 'function') {
            return []
          }
          const sources = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: 1, height: 1 },
            fetchWindowIcons: false
          })
          return sources.map((s) => ({
            id: s.id,
            name: s.name,
            display_id: s.display_id
          }))
        } catch {
          return []
        }
      }
    }
  }

  /**
   * Discovers permitted desktop windows and HELIOXEN application windows.
   */
  public async getDesktopWindows(request: WindowDiscoveryRequest = {}): Promise<WindowDiscoveryResult> {
    const includeSelf = request.includeSelf ?? true
    const redactTitles = request.redactSensitiveTitles ?? false
    const limit = Math.min(request.limit ?? 50, 100)

    const windows: WindowMetadataEntry[] = []
    let activeWindowId: string | undefined

    // 1. Enumerate HELIOXEN application windows
    try {
      const appWindows = this.adapter.getAppWindows()
      for (const win of appWindows) {
        if (!win || win.isDestroyed()) continue

        const isFocused = win.isFocused()
        const id = `win_helioxen_${win.id}`
        if (isFocused) {
          activeWindowId = id
        }

        if (includeSelf) {
          const rawTitle = win.getTitle() || 'HELIOXEN Assistant'
          const title = redactTitles ? this.redactTitle(rawTitle) : rawTitle
          const bounds = win.getBounds()

          windows.push({
            id,
            title,
            appAssociation: 'HELIOXEN AI',
            isVisible: win.isVisible(),
            isMinimized: win.isMinimized(),
            isActive: isFocused,
            isSelfApp: true,
            bounds: {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height
            }
          })
        }
      }
    } catch {
      // Ignore app window query failure in restricted environments
    }

    // 2. Enumerate external desktop windows via desktopCapturer
    let externalSuccess = true
    if (this.adapter.getDesktopSources) {
      try {
        const sources = await this.adapter.getDesktopSources()
        for (const src of sources) {
          if (windows.length >= limit) break
          if (!src.name || src.name.trim() === '') continue

          // Skip self if name matches app title
          if (src.name.includes('HELIOXEN') && !includeSelf) continue

          const safeId = `win_ext_${this.hashIdentifier(src.id)}`
          const title = redactTitles ? this.redactTitle(src.name) : src.name

          windows.push({
            id: safeId,
            title,
            appAssociation: this.inferAppAssociation(src.name),
            isVisible: true,
            isMinimized: false,
            isActive: false, // External active focus is not determinable without native Win32 APIs
            isSelfApp: false,
            displayId: src.display_id || undefined
          })
        }
      } catch {
        externalSuccess = false
      }
    }

    const boundedWindows = windows.slice(0, limit)

    return {
      status: boundedWindows.length === 0 ? 'partial' : 'completed',
      windows: boundedWindows,
      totalCount: boundedWindows.length,
      activeWindowId,
      limitation: externalSuccess
        ? 'External window enumeration retrieves visible desktop windows via Electron desktopCapturer. Native external focus and minimized states are restricted without native Win32 APIs.'
        : 'External desktop window enumeration was restricted or unavailable in current runtime.',
      acquiredAt: Date.now()
    }
  }

  /**
   * Redacts sensitive fragments such as email addresses, URLs, and local disk paths from titles.
   */
  public redactTitle(rawTitle: string): string {
    return rawTitle
      // Redact emails
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
      // Redact URLs
      .replace(/https?:\/\/[^\s/$.?#].[^\s]*/gi, '[REDACTED_URL]')
      // Redact Windows absolute file paths (e.g. C:\Users\... or C:\dir\file.ext)
      .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]+/g, '[REDACTED_PATH]')
  }

  private inferAppAssociation(title: string): string | undefined {
    // Standard window title pattern: "Document - Application Name"
    const parts = title.split(' - ')
    if (parts.length > 1) {
      return parts[parts.length - 1].trim()
    }
    return undefined
  }

  private hashIdentifier(rawId: string): string {
    let hash = 0
    for (let i = 0; i < rawId.length; i++) {
      hash = (hash << 5) - hash + rawId.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }
}
