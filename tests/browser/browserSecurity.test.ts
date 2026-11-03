/**
 * HELIOXEN AI — Step 31: Browser Security & Sandbox Isolation Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { BrowserSessionManager, BrowserSessionAdapter } from '../../src/main/browser/BrowserSessionManager'
import { BrowserTabManager, BrowserViewAdapter } from '../../src/main/browser/BrowserTabManager'
import { NavigationPolicy } from '../../src/main/browser/NavigationPolicy'

describe('Step 31: Browser Security and Sandbox Isolation', () => {
  it('enforces strict webPreferences on all created tab views', async () => {
    let capturedPreferences: any = null

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
      createView: (webPreferences: any) => {
        capturedPreferences = webPreferences
        return {
          webPreferences,
          webContents: {
            loadURL: vi.fn().mockResolvedValue(undefined),
            reload: vi.fn(),
            stop: vi.fn(),
            close: vi.fn(),
            setWindowOpenHandler: vi.fn(),
            navigationHistory: {
              canGoBack: () => false,
              canGoForward: () => false,
              goBack: vi.fn(),
              goForward: vi.fn()
            },
            on: vi.fn()
          },
          setBounds: vi.fn()
        }
      },
      attachView: vi.fn(),
      detachView: vi.fn()
    }

    const tabManager = new BrowserTabManager(sessionManager, viewAdapter)
    await tabManager.createTab()

    expect(capturedPreferences).toBeDefined()
    // Verification of strict isolation
    expect(capturedPreferences.nodeIntegration).toBe(false)
    expect(capturedPreferences.contextIsolation).toBe(true)
    expect(capturedPreferences.sandbox).toBe(true)
    expect(capturedPreferences.webSecurity).toBe(true)
    expect(capturedPreferences.preload).toBeUndefined()
    expect(capturedPreferences.allowRunningInsecureContent).toBe(false)
  })

  it('denies all permission requests by default', () => {
    let requestHandler: Function | null = null
    let checkHandler: Function | null = null

    const sessionAdapter: BrowserSessionAdapter = {
      fromPartition: () => ({
        setPermissionRequestHandler: vi.fn().mockImplementation((fn) => {
          requestHandler = fn
        }),
        setPermissionCheckHandler: vi.fn().mockImplementation((fn) => {
          checkHandler = fn
        }),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      })
    }

    const sessionManager = new BrowserSessionManager(sessionAdapter)
    sessionManager.createSession({ sessionId: 'sec-test' })

    expect(requestHandler).toBeTypeOf('function')
    expect(checkHandler).toBeTypeOf('function')

    // Test permission request rejection
    const mockWebContents = {}
    const callback = vi.fn()

    requestHandler!(mockWebContents, 'geolocation', callback, {})
    expect(callback).toHaveBeenCalledWith(false)

    requestHandler!(mockWebContents, 'notifications', callback, {})
    expect(callback).toHaveBeenCalledWith(false)

    requestHandler!(mockWebContents, 'media', callback, {})
    expect(callback).toHaveBeenCalledWith(false)

    // Test permission check handler returns false
    const checkResult = checkHandler!(mockWebContents, 'camera', 'https://example.com', {})
    expect(checkResult).toBe(false)
  })

  it('cancels all unapproved download attempts via will-download listener', () => {
    let downloadListener: Function | null = null

    const sessionAdapter: BrowserSessionAdapter = {
      fromPartition: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        on: vi.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'will-download') {
            downloadListener = handler
          }
        })
      })
    }

    const sessionManager = new BrowserSessionManager(sessionAdapter)
    sessionManager.createSession({ sessionId: 'download-test' })

    expect(downloadListener).toBeTypeOf('function')

    const mockItem = {
      cancel: vi.fn(),
      getURL: () => 'https://malicious.test/payload.exe'
    }
    const mockEvent = {
      preventDefault: vi.fn()
    }

    downloadListener!(mockEvent, mockItem, {})
    expect(mockItem.cancel).toHaveBeenCalled()
    expect(mockEvent.preventDefault).toHaveBeenCalled()
  })

  it('denies arbitrary popup windows via setWindowOpenHandler', async () => {
    let windowOpenHandler: Function | null = null

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
          setWindowOpenHandler: vi.fn().mockImplementation((fn) => {
            windowOpenHandler = fn
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
    await tabManager.createTab()

    expect(windowOpenHandler).toBeTypeOf('function')
    const decision = windowOpenHandler!({ url: 'https://external-popup.example.com' })
    // Popups must be denied so Electron does not open an uncontrolled native window
    expect(decision).toEqual({ action: 'deny' })
  })

  it('rejects forbidden URL schemes and credential leaks via NavigationPolicy', () => {
    expect(() => NavigationPolicy.validateUrl('javascript:alert(1)')).toThrow(/is prohibited/)
    expect(() => NavigationPolicy.validateUrl('file:///C:/Windows/System32')).toThrow(/is prohibited/)
    expect(() => NavigationPolicy.validateUrl('data:text/html,<h1>PWNED</h1>')).toThrow(/is prohibited/)
    expect(() => NavigationPolicy.validateUrl('vbscript:msgbox(1)')).toThrow(/is prohibited/)
    expect(() => NavigationPolicy.validateUrl('https://admin:supersecret@mybank.com')).toThrow(/embedded credentials/i)
  })
})
