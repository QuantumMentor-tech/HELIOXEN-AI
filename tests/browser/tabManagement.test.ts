/**
 * HELIOXEN AI — Step 31: Browser Tab Manager Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  BrowserTabManager,
  BrowserViewAdapter
} from '../../src/main/browser/BrowserTabManager'
import { BrowserSessionManager, BrowserSessionAdapter } from '../../src/main/browser/BrowserSessionManager'

describe('Step 31: Browser Tab Manager', () => {
  const createMockEnvironment = () => {
    const sessionAdapter: BrowserSessionAdapter = {
      fromPartition: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      })
    }
    const sessionManager = new BrowserSessionManager(sessionAdapter)

    const views = new Map<string, any>()
    const viewAdapter: BrowserViewAdapter = {
      createView: (webPreferences: any) => {
        const eventHandlers = new Map<string, Function[]>()
        const webContents = {
          loadURL: vi.fn().mockImplementation(async (url: string) => {
            const handlers = eventHandlers.get('did-navigate') || []
            handlers.forEach((h) => h({}, url))
          }),
          reload: vi.fn(),
          stop: vi.fn(),
          close: vi.fn(),
          setWindowOpenHandler: vi.fn(),
          navigationHistory: {
            canGoBack: vi.fn().mockReturnValue(true),
            canGoForward: vi.fn().mockReturnValue(false),
            goBack: vi.fn(),
            goForward: vi.fn()
          },
          on: vi.fn().mockImplementation((event: string, handler: Function) => {
            if (!eventHandlers.has(event)) {
              eventHandlers.set(event, [])
            }
            eventHandlers.get(event)!.push(handler)
          }),
          _trigger: (event: string, ...args: any[]) => {
            const handlers = eventHandlers.get(event) || []
            handlers.forEach((h) => h({}, ...args))
          }
        }

        const view = {
          webPreferences,
          webContents,
          setBounds: vi.fn()
        }
        return view
      },
      attachView: vi.fn(),
      detachView: vi.fn()
    }

    const tabManager = new BrowserTabManager(sessionManager, viewAdapter)
    return { sessionManager, tabManager, viewAdapter, views }
  }

  it('creates a new browser tab with default empty state', async () => {
    const { tabManager } = createMockEnvironment()

    const tab = await tabManager.createTab()

    expect(tab.tabId).toBeDefined()
    expect(tab.url).toBe('about:blank')
    expect(tab.title).toBe('New Tab')
    expect(tab.loading).toBe(false)
    expect(tab.status).toBe('empty')
  })

  it('creates and navigates a tab with an initial validated URL', async () => {
    const { tabManager } = createMockEnvironment()

    const tab = await tabManager.createTab({
      url: 'https://example.com'
    })

    expect(tab.url).toBe('https://example.com/')
  })

  it('navigates an existing tab to a new validated URL', async () => {
    const { tabManager } = createMockEnvironment()

    const tab = await tabManager.createTab()
    const updated = await tabManager.navigateTab({
      tabId: tab.tabId,
      url: 'https://www.google.com'
    })

    expect(updated.url).toBe('https://www.google.com/')
  })

  it('switches between tabs and tracks the active tab', async () => {
    const { tabManager } = createMockEnvironment()

    const tab1 = await tabManager.createTab()
    const tab2 = await tabManager.createTab()

    const switched = tabManager.switchTab(tab1.tabId)
    expect(switched.tabId).toBe(tab1.tabId)

    const switched2 = tabManager.switchTab(tab2.tabId)
    expect(switched2.tabId).toBe(tab2.tabId)
  })

  it('supports reload, stop, goBack, and goForward navigation actions', async () => {
    const { tabManager } = createMockEnvironment()

    const tab = await tabManager.createTab({ url: 'https://example.com' })

    const reloaded = tabManager.reloadTab(tab.tabId)
    expect(reloaded.tabId).toBe(tab.tabId)

    const stopped = tabManager.stopTab(tab.tabId)
    expect(stopped.tabId).toBe(tab.tabId)

    const backTab = tabManager.goBack(tab.tabId)
    expect(backTab.tabId).toBe(tab.tabId)

    const forwardTab = tabManager.goForward(tab.tabId)
    expect(forwardTab.tabId).toBe(tab.tabId)
  })

  it('closes a tab and automatically switches to an adjacent tab when the active tab is closed', async () => {
    const { tabManager } = createMockEnvironment()

    const tab1 = await tabManager.createTab()
    const tab2 = await tabManager.createTab()

    // tab2 is active. Close it.
    const closeRes = tabManager.closeTab(tab2.tabId)
    expect(closeRes.success).toBe(true)
    expect(closeRes.closedTabId).toBe(tab2.tabId)
    expect(closeRes.newActiveTabId).toBe(tab1.tabId)

    expect(() => tabManager.getTabState(tab2.tabId)).toThrow(/does not exist/)
  })

  it('rejects navigation or actions on unknown or closed tabs', async () => {
    const { tabManager } = createMockEnvironment()

    await expect(
      tabManager.navigateTab({ tabId: 'tab_missing', url: 'https://example.com' })
    ).rejects.toThrow(/does not exist/)

    expect(() => tabManager.switchTab('tab_missing')).toThrow(/does not exist/)
    expect(() => tabManager.closeTab('tab_missing')).toThrow(/does not exist/)
  })
})

