/**
 * HELIOXEN AI — Step 28: Desktop Window Discovery Tests
 */

import { describe, it, expect } from 'vitest'
import { WindowDiscoveryManager, WindowDiscoveryAdapter } from '../../src/main/telemetry/WindowDiscoveryManager'
import { WindowDiscoveryResultSchema } from '../../src/shared/telemetry/contracts'

describe('Step 28: Desktop Window Discovery', () => {
  it('discovers application windows and desktop sources with safe opaque identifiers', async () => {
    const mockAdapter: WindowDiscoveryAdapter = {
      getAppWindows: () => [
        {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          isVisible: () => true,
          isMinimized: () => false,
          getTitle: () => 'HELIOXEN Assistant - Primary',
          getBounds: () => ({ x: 50, y: 50, width: 1280, height: 800 })
        } as any
      ],
      getDesktopSources: async () => [
        { id: 'window:12345:0', name: 'Document.docx - Microsoft Word', display_id: 'display_1' },
        { id: 'window:67890:0', name: 'Inbox - user@example.com - Outlook', display_id: 'display_1' }
      ]
    }

    const manager = new WindowDiscoveryManager(mockAdapter)
    const result = await manager.getDesktopWindows()

    expect(result.status).toBe('completed')
    expect(result.totalCount).toBe(3)
    expect(result.activeWindowId).toBe('win_helioxen_1')
    expect(result.limitation).toBeDefined()

    const helioxenWin = result.windows.find((w) => w.isSelfApp)
    expect(helioxenWin).toBeDefined()
    expect(helioxenWin?.id).toBe('win_helioxen_1')
    expect(helioxenWin?.isActive).toBe(true)
    expect(helioxenWin?.bounds).toEqual({ x: 50, y: 50, width: 1280, height: 800 })

    const externalWin = result.windows.find((w) => !w.isSelfApp && w.title.includes('Microsoft Word'))
    expect(externalWin).toBeDefined()
    expect(externalWin?.appAssociation).toBe('Microsoft Word')
    expect(externalWin?.id.startsWith('win_ext_')).toBe(true)

    // Verify strict Zod schema validation
    const parseResult = WindowDiscoveryResultSchema.safeParse(result)
    expect(parseResult.success).toBe(true)
  })

  it('redacts sensitive information from window titles when requested', async () => {
    const mockAdapter: WindowDiscoveryAdapter = {
      getAppWindows: () => [],
      getDesktopSources: async () => [
        {
          id: 'window:999:0',
          name: 'Confidential Report - john.doe@secretcorp.com - C:\\Users\\Administrator\\Docs\\plan.pdf - https://internal.corp/review'
        }
      ]
    }

    const manager = new WindowDiscoveryManager(mockAdapter)
    const result = await manager.getDesktopWindows({ redactSensitiveTitles: true })

    expect(result.windows.length).toBe(1)
    const title = result.windows[0].title
    expect(title).toContain('[REDACTED_EMAIL]')
    expect(title).toContain('[REDACTED_PATH]')
    expect(title).toContain('[REDACTED_URL]')
    expect(title).not.toContain('john.doe@secretcorp.com')
    expect(title).not.toContain('C:\\Users\\Administrator')
    expect(title).not.toContain('https://internal.corp')
  })

  it('filters out self application windows when includeSelf is false', async () => {
    const mockAdapter: WindowDiscoveryAdapter = {
      getAppWindows: () => [
        {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          isVisible: () => true,
          isMinimized: () => false,
          getTitle: () => 'HELIOXEN Assistant',
          getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 })
        } as any
      ],
      getDesktopSources: async () => [
        { id: 'window:111:0', name: 'External Editor' }
      ]
    }

    const manager = new WindowDiscoveryManager(mockAdapter)
    const result = await manager.getDesktopWindows({ includeSelf: false })

    expect(result.windows.every((w) => !w.isSelfApp)).toBe(true)
    expect(result.windows.length).toBe(1)
    expect(result.windows[0].title).toBe('External Editor')
  })

  it('gracefully handles stale or destroyed BrowserWindow instances', async () => {
    const mockAdapter: WindowDiscoveryAdapter = {
      getAppWindows: () => [
        {
          id: 1,
          isDestroyed: () => true, // Destroyed window
          isFocused: () => false,
          isVisible: () => false,
          isMinimized: () => false,
          getTitle: () => 'Destroyed Window',
          getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 })
        } as any
      ],
      getDesktopSources: async () => []
    }

    const manager = new WindowDiscoveryManager(mockAdapter)
    const result = await manager.getDesktopWindows()

    expect(result.windows.length).toBe(0)
  })

  it('enforces maximum result limit', async () => {
    const mockAdapter: WindowDiscoveryAdapter = {
      getAppWindows: () => [],
      getDesktopSources: async () => [
        { id: '1', name: 'Win 1' },
        { id: '2', name: 'Win 2' },
        { id: '3', name: 'Win 3' }
      ]
    }

    const manager = new WindowDiscoveryManager(mockAdapter)
    const result = await manager.getDesktopWindows({ limit: 2 })

    expect(result.windows.length).toBe(2)
  })
})

