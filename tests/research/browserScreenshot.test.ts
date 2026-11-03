/**
 * HELIOXEN AI — Step 32: Browser Screenshot Service Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { BrowserScreenshotService } from '../../src/main/research/BrowserScreenshotService'
import { BrowserTabManager, BrowserViewAdapter } from '../../src/main/browser/BrowserTabManager'
import { BrowserSessionManager, BrowserSessionAdapter } from '../../src/main/browser/BrowserSessionManager'

describe('Step 32: Browser Screenshot Service', () => {
  const createMockEnvironment = (captureMock?: () => Promise<any>) => {
    const sessionAdapter: BrowserSessionAdapter = {
      fromPartition: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      })
    }
    const sessionManager = new BrowserSessionManager(sessionAdapter)

    const viewAdapter: BrowserViewAdapter = {
      createView: (webPreferences: any) => ({
        webPreferences,
        webContents: {
          loadURL: vi.fn().mockResolvedValue(undefined),
          reload: vi.fn(),
          stop: vi.fn(),
          close: vi.fn(),
          capturePage: captureMock ?? vi.fn().mockResolvedValue({
            getSize: () => ({ width: 1280, height: 720 }),
            toJPEG: vi.fn().mockReturnValue(Buffer.from('MOCK_JPEG_IMAGE_BYTES')),
            toPNG: vi.fn().mockReturnValue(Buffer.from('MOCK_PNG_IMAGE_BYTES'))
          }),
          navigationHistory: {
            canGoBack: () => false,
            canGoForward: () => false,
            goBack: vi.fn(),
            goForward: vi.fn()
          },
          on: vi.fn()
        },
        setBounds: vi.fn()
      }),
      attachView: vi.fn(),
      detachView: vi.fn()
    }

    const tabManager = new BrowserTabManager(sessionManager, viewAdapter)
    const screenshotService = new BrowserScreenshotService(tabManager)
    return { sessionManager, tabManager, screenshotService }
  }

  it('captures visible viewport screenshot and returns metadata with dataUrl', async () => {
    const { tabManager, screenshotService } = createMockEnvironment()
    const tab = await tabManager.createTab({ url: 'https://example.com/viewport' })

    const screenshot = await screenshotService.captureTabScreenshot({
      tabId: tab.tabId,
      format: 'jpeg',
      quality: 90
    })

    expect(screenshot.id).toMatch(/^scr_/)
    expect(screenshot.tabId).toBe(tab.tabId)
    expect(screenshot.pageUrl).toBe('https://example.com/viewport')
    expect(screenshot.width).toBe(1280)
    expect(screenshot.height).toBe(720)
    expect(screenshot.mimeType).toBe('image/jpeg')
    expect(screenshot.dataUrl).toContain('data:image/jpeg;base64,')
    expect(screenshot.sizeBytes).toBeGreaterThan(0)
    expect(screenshot.isDiscarded).toBe(false)
  })

  it('supports retrieving and discarding a temporary screenshot', async () => {
    const { tabManager, screenshotService } = createMockEnvironment()
    const tab = await tabManager.createTab({ url: 'https://example.com' })

    const screenshot = await screenshotService.captureTabScreenshot({
      tabId: tab.tabId
    })

    // Retrieve
    const retrieved = screenshotService.getScreenshot(screenshot.id)
    expect(retrieved.id).toBe(screenshot.id)

    // Discard
    const discardRes = screenshotService.discardScreenshot(screenshot.id)
    expect(discardRes.success).toBe(true)

    // Retrieval after discard throws
    expect(() => screenshotService.getScreenshot(screenshot.id)).toThrow(/does not exist or was discarded/)
  })

  it('handles cancellation signal before capture', async () => {
    const { tabManager, screenshotService } = createMockEnvironment()
    const tab = await tabManager.createTab({ url: 'https://example.com' })

    const controller = new AbortController()
    controller.abort()

    await expect(
      screenshotService.captureTabScreenshot({ tabId: tab.tabId }, controller.signal)
    ).rejects.toThrow(/cancelled/i)
  })

  it('rejects capture from non-existent tab', async () => {
    const { screenshotService } = createMockEnvironment()

    await expect(
      screenshotService.captureTabScreenshot({ tabId: 'tab_non_existent' })
    ).rejects.toThrow(/does not exist/i)
  })
})

