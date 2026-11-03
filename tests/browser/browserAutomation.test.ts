/**
 * HELIOXEN AI — Step 33: Browser Agent Automation Tests
 * Tests page element inspection, locator resolution, clicking, scrolling, field filling, and dropdown selection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserAgentManager } from '../../src/main/browser/BrowserAgentManager'
import { BrowserTabManager, BrowserViewAdapter } from '../../src/main/browser/BrowserTabManager'
import { BrowserSessionManager, BrowserSessionAdapter } from '../../src/main/browser/BrowserSessionManager'

describe('Step 33: Browser Agent Automation', () => {
  let sessionManager: BrowserSessionManager
  let tabManager: BrowserTabManager
  let agentManager: BrowserAgentManager
  let mockWebContents: any

  const defaultMockElements = [
    {
      elementId: 'el_btn_save',
      role: 'button' as const,
      tagName: 'button',
      name: 'Save Changes',
      label: 'Save Changes',
      disabled: false,
      locator: {
        role: 'button' as const,
        id: 'btn-save',
        label: 'Save Changes'
      }
    },
    {
      elementId: 'el_link_docs',
      role: 'link' as const,
      tagName: 'a',
      name: 'Documentation',
      label: 'Documentation',
      disabled: false,
      locator: {
        role: 'link' as const,
        name: 'Documentation'
      }
    },
    {
      elementId: 'el_input_query',
      role: 'input' as const,
      type: 'text',
      tagName: 'input',
      name: 'search_query',
      label: 'Search Query',
      disabled: false,
      locator: {
        role: 'input' as const,
        id: 'input-query',
        nameAttr: 'search_query'
      }
    },
    {
      elementId: 'el_select_theme',
      role: 'select' as const,
      tagName: 'select',
      name: 'theme_select',
      label: 'Select Theme',
      disabled: false,
      locator: {
        role: 'select' as const,
        id: 'theme-select'
      }
    }
  ]

  const defaultMockForms = [
    {
      formId: 'user-form',
      action: 'https://example.org/save',
      method: 'POST',
      fields: [
        {
          fieldId: 'input-query',
          role: 'input',
          type: 'text',
          name: 'search_query',
          label: 'Search Query',
          currentValue: '',
          isSensitive: false,
          required: false
        }
      ],
      submitButtonName: 'Save Changes'
    }
  ]

  beforeEach(() => {
    const sessionAdapter: BrowserSessionAdapter = {
      fromPartition: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      })
    }
    sessionManager = new BrowserSessionManager(sessionAdapter)

    mockWebContents = {
      loadURL: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn(),
      stop: vi.fn(),
      close: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      getURL: vi.fn().mockReturnValue('https://example.org/dashboard'),
      getTitle: vi.fn().mockReturnValue('Dashboard Overview'),
      executeJavaScript: vi.fn().mockImplementation(async (script: string) => {
        if (script.includes('candidates')) {
          return {
            elements: defaultMockElements,
            forms: defaultMockForms,
            isTruncated: false
          }
        }
        return { success: true }
      }),
      sendInputEvent: vi.fn(),
      navigationHistory: {
        canGoBack: vi.fn().mockReturnValue(false),
        canGoForward: vi.fn().mockReturnValue(false),
        goBack: vi.fn(),
        goForward: vi.fn()
      },
      on: vi.fn()
    }

    const viewAdapter: BrowserViewAdapter = {
      createView: (webPreferences: any) => ({
        webPreferences,
        webContents: mockWebContents,
        setBounds: vi.fn()
      })
    }

    tabManager = new BrowserTabManager(sessionManager, viewAdapter)
    agentManager = new BrowserAgentManager(tabManager)
  })

  it('inspects page elements and returns a structured PageInspectionSnapshot', async () => {
    const tab = await tabManager.createTab({ url: 'https://example.org/dashboard' })

    const snapshot = await agentManager.inspectPage({ tabId: tab.tabId })

    expect(snapshot).toBeDefined()
    expect(snapshot.tabId).toBe(tab.tabId)
    expect(snapshot.url).toBe('https://example.org/dashboard')
    expect(snapshot.elements.length).toBe(4)
    expect(snapshot.forms.length).toBe(1)
    expect(snapshot.forms[0].formId).toBe('user-form')
  })

  it('clicks an element targeted by role and label', async () => {
    const tab = await tabManager.createTab({ url: 'https://example.org/dashboard' })

    const result = await agentManager.clickElement({
      tabId: tab.tabId,
      target: {
        role: 'button',
        label: 'Save Changes'
      }
    })

    expect(result.action).toBe('click')
    expect(result.success).toBe(true)
    expect(result.message).toContain('Clicked element')
    expect(mockWebContents.executeJavaScript).toHaveBeenCalled()
  })

  it('fails safely when target element is not found on page', async () => {
    const tab = await tabManager.createTab({ url: 'https://example.org/dashboard' })

    await expect(
      agentManager.clickElement({
        tabId: tab.tabId,
        target: {
          id: 'non-existent-button'
        }
      })
    ).rejects.toThrow(/Target element not found matching locator/i)
  })

  it('scrolls the viewport down and top', async () => {
    const tab = await tabManager.createTab({ url: 'https://example.org/dashboard' })

    const scrollDown = await agentManager.scrollPage({
      tabId: tab.tabId,
      direction: 'down',
      distance: 600
    })

    expect(scrollDown.action).toBe('scroll')
    expect(scrollDown.success).toBe(true)
    expect(scrollDown.message).toContain('Scrolled page down')

    const scrollTop = await agentManager.scrollPage({
      tabId: tab.tabId,
      direction: 'top'
    })
    expect(scrollTop.action).toBe('scroll')
    expect(scrollTop.success).toBe(true)
  })

  it('fills non-sensitive text fields and dispatches input/change events without submitting form', async () => {
    const tab = await tabManager.createTab({ url: 'https://example.org/dashboard' })

    const fillResult = await agentManager.fillField({
      tabId: tab.tabId,
      target: {
        id: 'input-query'
      },
      value: 'electron security'
    })

    expect(fillResult.action).toBe('fillField')
    expect(fillResult.success).toBe(true)
    expect(fillResult.message).toContain('no implicit submission')
  })

  it('selects option from select element safely', async () => {
    const tab = await tabManager.createTab({ url: 'https://example.org/dashboard' })

    const result = await agentManager.selectOption({
      tabId: tab.tabId,
      target: {
        id: 'theme-select'
      },
      optionValue: 'dark_mode'
    })

    expect(result.action).toBe('selectOption')
    expect(result.success).toBe(true)
  })
})
