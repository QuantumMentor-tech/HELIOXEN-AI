/**
 * HELIOXEN AI — Step 31: Browser Tab Manager
 * Manages tab lifecycle, active tab switching, navigation states, and view isolation.
 * Strictly enforces that remote web content has no Node.js integration, no privileged preload,
 * and context isolation with sandboxing enabled.
 */

import { WebContentsView, BrowserWindow } from 'electron'
import {
  BrowserTabState,
  CreateTabRequest,
  NavigateTabRequest,
  TabLoadingStatus
} from '../../shared/browser/types'
import { NavigationPolicy } from './NavigationPolicy'
import { browserSessionManager, BrowserSessionManager } from './BrowserSessionManager'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

export interface BrowserViewAdapter {
  createView: (webPreferences: any) => any
  attachView?: (win: BrowserWindow, view: any, bounds?: any) => void
  detachView?: (win: BrowserWindow, view: any) => void
}

export class BrowserTabManager {
  private readonly sessionManager: BrowserSessionManager
  private readonly viewAdapter: BrowserViewAdapter
  private readonly tabs = new Map<string, BrowserTabState>()
  private readonly tabViews = new Map<string, any>()
  private activeTabId?: string
  private currentBounds = { x: 0, y: 80, width: 1200, height: 720 }

  constructor(sessionManager?: BrowserSessionManager, viewAdapter?: BrowserViewAdapter) {
    this.sessionManager = sessionManager ?? browserSessionManager
    this.viewAdapter = viewAdapter ?? {
      createView: (webPreferences: any) => {
        try {
          return new WebContentsView({ webPreferences })
        } catch {
          return null
        }
      },
      attachView: (win: BrowserWindow, view: any, bounds?: any) => {
        try {
          if (!win || win.isDestroyed() || !view) return
          if ((win as any).contentView?.addChildView) {
            ;(win as any).contentView.addChildView(view)
            if (bounds && view.setBounds) {
              view.setBounds(bounds)
            }
          }
        } catch {
          // ignore
        }
      },
      detachView: (win: BrowserWindow, view: any) => {
        try {
          if (!win || win.isDestroyed() || !view) return
          if ((win as any).contentView?.removeChildView) {
            ;(win as any).contentView.removeChildView(view)
          }
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Creates an isolated browser tab.
   */
  public async createTab(request: CreateTabRequest = {}): Promise<BrowserTabState> {
    const session = this.sessionManager.getSession(request.sessionId)
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    // Configure isolated webPreferences
    const partitionSession = this.sessionManager.getPartitionSession(session.sessionId)
    const webPreferences = {
      session: partitionSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // CRITICAL: NEVER attach privileged HELIOXEN preload to untrusted web content!
      preload: undefined
    }

    const view = this.viewAdapter.createView(webPreferences)
    if (view) {
      this.configureViewEvents(tabId, view)
      this.tabViews.set(tabId, view)
    }

    const now = Date.now()
    const state: BrowserTabState = {
      tabId,
      sessionId: session.sessionId,
      url: 'about:blank',
      title: 'New Tab',
      loading: false,
      status: 'empty',
      canGoBack: false,
      canGoForward: false,
      createdAt: now,
      updatedAt: now
    }

    this.tabs.set(tabId, state)
    session.tabCount = (session.tabCount || 0) + 1

    if (request.activate ?? true) {
      this.switchTab(tabId)
    }

    if (request.url) {
      await this.navigateTab({ tabId, url: request.url })
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:createTab',
      tabId,
      sessionId: session.sessionId
    })

    return this.getTabState(tabId)
  }

  /**
   * Navigates a specified tab to a validated URL.
   */
  public async navigateTab(request: NavigateTabRequest): Promise<BrowserTabState> {
    const tab = this.getTabState(request.tabId)
    const validatedUrl = NavigationPolicy.validateUrl(request.url)

    tab.url = validatedUrl
    tab.loading = true
    tab.status = 'loading'
    tab.updatedAt = Date.now()

    const view = this.tabViews.get(request.tabId)
    if (view?.webContents?.loadURL) {
      try {
        await view.webContents.loadURL(validatedUrl)
      } catch (err: any) {
        tab.loading = false
        tab.status = 'failed'
        tab.error = err?.message || 'Navigation failed'
      }
    } else {
      // In testing environments without genuine WebContentsView
      tab.loading = false
      tab.status = 'loaded'
      tab.title = validatedUrl
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:navigateTab',
      tabId: request.tabId,
      url: validatedUrl
    })

    return tab
  }

  /**
   * Selects and brings a tab into active view.
   */
  public switchTab(tabId: string): BrowserTabState {
    const tab = this.getTabState(tabId)
    const prevActiveId = this.activeTabId

    this.activeTabId = tabId
    const session = this.sessionManager.getSession(tab.sessionId)
    session.activeTabId = tabId

    // Attach view to main window if available
    try {
      const windows = BrowserWindow.getAllWindows()
      const mainWin = windows[0]
      if (mainWin && !mainWin.isDestroyed()) {
        if (prevActiveId && this.tabViews.has(prevActiveId)) {
          this.viewAdapter.detachView?.(mainWin, this.tabViews.get(prevActiveId))
        }
        if (this.tabViews.has(tabId)) {
          this.viewAdapter.attachView?.(mainWin, this.tabViews.get(tabId), this.currentBounds)
        }
      }
    } catch {
      // In headless or test environments
    }

    return tab
  }

  /**
   * Reloads a tab.
   */
  public reloadTab(tabId: string): BrowserTabState {
    const tab = this.getTabState(tabId)
    const view = this.tabViews.get(tabId)

    if (view?.webContents?.reload) {
      tab.loading = true
      tab.status = 'loading'
      view.webContents.reload()
    }

    return tab
  }

  /**
   * Stops loading on a tab.
   */
  public stopTab(tabId: string): BrowserTabState {
    const tab = this.getTabState(tabId)
    const view = this.tabViews.get(tabId)

    if (view?.webContents?.stop) {
      view.webContents.stop()
      tab.loading = false
      tab.status = tab.status === 'loading' ? 'loaded' : tab.status
    }

    return tab
  }

  /**
   * Navigates back in browser history.
   */
  public goBack(tabId: string): BrowserTabState {
    const tab = this.getTabState(tabId)
    const view = this.tabViews.get(tabId)

    if (view?.webContents?.navigationHistory?.canGoBack?.()) {
      view.webContents.navigationHistory.goBack()
    }

    return tab
  }

  /**
   * Navigates forward in browser history.
   */
  public goForward(tabId: string): BrowserTabState {
    const tab = this.getTabState(tabId)
    const view = this.tabViews.get(tabId)

    if (view?.webContents?.navigationHistory?.canGoForward?.()) {
      view.webContents.navigationHistory.goForward()
    }

    return tab
  }

  /**
   * Closes a tab and cleanly releases its resources.
   */
  public closeTab(tabId: string): { success: boolean; closedTabId: string; newActiveTabId?: string } {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Browser tab '${tabId}' does not exist`)
    }

    const session = this.sessionManager.getSession(tab.sessionId)

    // Detach and clean up view
    const view = this.tabViews.get(tabId)
    if (view) {
      try {
        const windows = BrowserWindow.getAllWindows()
        const mainWin = windows[0]
        if (mainWin && !mainWin.isDestroyed()) {
          this.viewAdapter.detachView?.(mainWin, view)
        }
        if (typeof view.webContents?.close === 'function') {
          view.webContents.close()
        }
      } catch {
        // ignore
      }
      this.tabViews.delete(tabId)
    }

    this.tabs.delete(tabId)
    session.tabCount = Math.max(0, (session.tabCount || 1) - 1)

    // If active tab was closed, switch to adjacent tab
    let newActiveTabId: string | undefined
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.values()).filter((t) => t.sessionId === session.sessionId)
      if (remaining.length > 0) {
        newActiveTabId = remaining[remaining.length - 1].tabId
        this.switchTab(newActiveTabId)
      } else {
        this.activeTabId = undefined
        session.activeTabId = undefined
      }
    } else {
      newActiveTabId = this.activeTabId
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:closeTab',
      tabId,
      newActiveTabId
    })

    return {
      success: true,
      closedTabId: tabId,
      newActiveTabId
    }
  }

  /**
   * Retrieves tab state by ID.
   */
  public getTabState(tabId: string): BrowserTabState {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Browser tab '${tabId}' does not exist or has been closed`)
    }
    return tab
  }

  /**
   * Retrieves the WebContentsView instance for a tab (main process internal only).
   */
  public getTabView(tabId: string): any {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Browser tab '${tabId}' does not exist or has been closed`)
    }
    return this.tabViews.get(tabId)
  }

  /**
   * Returns all active tabs.
   */
  public listTabs(sessionId?: string): BrowserTabState[] {
    const all = Array.from(this.tabs.values())
    if (sessionId) {
      return all.filter((t) => t.sessionId === sessionId)
    }
    return all
  }

  /**
   * Sets the screen bounds for the active browser view.
   */
  public setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.currentBounds = { ...bounds }
    if (this.activeTabId && this.tabViews.has(this.activeTabId)) {
      const view = this.tabViews.get(this.activeTabId)
      if (view?.setBounds) {
        view.setBounds(bounds)
      }
    }
  }

  private configureViewEvents(tabId: string, view: any): void {
    const wc = view?.webContents
    if (!wc || typeof wc.on !== 'function') return

    wc.__helioxenTabId = tabId

    // Deny arbitrary new windows and popups
    if (typeof wc.setWindowOpenHandler === 'function') {
      wc.setWindowOpenHandler(({ url }: { url: string }) => {
        if (NavigationPolicy.isUrlAllowed(url)) {
          // Open in a new tab within the same session
          this.createTab({ url, activate: true }).catch(() => {})
        }
        return { action: 'deny' }
      })
    }

    wc.on('did-start-loading', () => {
      const tab = this.tabs.get(tabId)
      if (tab) {
        tab.loading = true
        tab.status = 'loading'
        tab.updatedAt = Date.now()
      }
    })

    wc.on('did-stop-loading', () => {
      const tab = this.tabs.get(tabId)
      if (tab) {
        tab.loading = false
        tab.status = tab.status === 'loading' ? 'loaded' : tab.status
        tab.canGoBack = Boolean(wc.navigationHistory?.canGoBack?.())
        tab.canGoForward = Boolean(wc.navigationHistory?.canGoForward?.())
        tab.updatedAt = Date.now()
      }
    })

    wc.on('page-title-updated', (_e: any, title: string) => {
      const tab = this.tabs.get(tabId)
      if (tab && title) {
        tab.title = title
        tab.updatedAt = Date.now()
      }
    })

    wc.on('did-navigate', (_e: any, url: string) => {
      const tab = this.tabs.get(tabId)
      if (tab && url) {
        tab.url = url
        tab.canGoBack = Boolean(wc.navigationHistory?.canGoBack?.())
        tab.canGoForward = Boolean(wc.navigationHistory?.canGoForward?.())
        tab.updatedAt = Date.now()
      }
    })

    wc.on('did-fail-load', (_e: any, errorCode: number, errorDescription: string) => {
      const tab = this.tabs.get(tabId)
      if (tab) {
        tab.loading = false
        tab.status = 'failed'
        tab.error = `Load failed (${errorCode}): ${errorDescription}`
        tab.updatedAt = Date.now()
      }
    })

    wc.on('render-process-gone', (_e: any, details: { reason: string }) => {
      const tab = this.tabs.get(tabId)
      if (tab) {
        tab.loading = false
        tab.status = 'crashed'
        tab.error = `Web renderer crashed: ${details?.reason || 'unknown'}`
        tab.updatedAt = Date.now()
      }
    })
  }
}

export const browserTabManager = new BrowserTabManager()

