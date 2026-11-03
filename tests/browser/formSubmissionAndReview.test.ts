/**
 * HELIOXEN AI — Step 33: Form Review, Sensitive Field Protection, and Gated Submission Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserAgentManager } from '../../src/main/browser/BrowserAgentManager'
import { BrowserTabManager, BrowserViewAdapter } from '../../src/main/browser/BrowserTabManager'
import { BrowserSessionManager, BrowserSessionAdapter } from '../../src/main/browser/BrowserSessionManager'

describe('Step 33: Form Review and Submission Gating', () => {
  let sessionManager: BrowserSessionManager
  let tabManager: BrowserTabManager
  let agentManager: BrowserAgentManager
  let mockWebContents: any

  const defaultMockElements = [
    {
      elementId: 'el_pwd',
      role: 'input' as const,
      type: 'password',
      tagName: 'input',
      name: 'password',
      label: 'Password',
      disabled: false,
      isSensitive: true,
      locator: {
        role: 'input' as const,
        id: 'user-password'
      }
    },
    {
      elementId: 'el_card',
      role: 'input' as const,
      type: 'text',
      tagName: 'input',
      name: 'credit_card_num',
      label: 'Credit Card Number',
      disabled: false,
      isSensitive: true,
      locator: {
        role: 'input' as const,
        nameAttr: 'credit_card_num'
      }
    },
    {
      elementId: 'el_address',
      role: 'input' as const,
      type: 'text',
      tagName: 'input',
      name: 'shipping_address',
      label: 'Shipping Address',
      disabled: false,
      isSensitive: false,
      locator: {
        role: 'input' as const,
        nameAttr: 'shipping_address'
      }
    }
  ]

  const defaultMockForms = [
    {
      formId: 'checkout-form',
      action: 'https://payment.gateway.org/process',
      method: 'POST',
      fields: [
        {
          fieldId: 'f1',
          role: 'input',
          type: 'text',
          name: 'shipping_address',
          label: 'Shipping Address',
          currentValue: '123 Main St',
          isSensitive: false,
          required: true
        },
        {
          fieldId: 'f2',
          role: 'input',
          type: 'password',
          name: 'cvv',
          label: 'CVV Code',
          currentValue: '',
          isSensitive: true,
          required: true
        }
      ],
      submitButtonName: 'Pay Now'
    },
    {
      formId: 'order-form',
      action: 'https://shop.example.org/complete',
      method: 'POST',
      fields: [
        {
          fieldId: 'notes',
          role: 'input',
          type: 'text',
          name: 'order_notes',
          label: 'Notes',
          currentValue: 'Leave at front porch',
          isSensitive: false,
          required: false
        }
      ],
      submitButtonName: 'Confirm Order'
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
      getURL: vi.fn().mockReturnValue('https://shop.example.org/checkout'),
      getTitle: vi.fn().mockReturnValue('Checkout Page'),
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

  it('detects sensitive password and credit card fields and automatically blocks automated filling', async () => {
    const tab = await tabManager.createTab({ url: 'https://shop.example.org/checkout' })

    await expect(
      agentManager.fillField({
        tabId: tab.tabId,
        target: { id: 'user-password' },
        value: 'SecretPass123!'
      })
    ).rejects.toThrow(/Automated entry into sensitive fields/i)
  })

  it('blocks automated filling of fields with credit card or cvv keywords in name or label', async () => {
    const tab = await tabManager.createTab({ url: 'https://shop.example.org/checkout' })

    await expect(
      agentManager.fillField({
        tabId: tab.tabId,
        target: { nameAttr: 'credit_card_num' },
        value: '4111222233334444'
      })
    ).rejects.toThrow(/Automated entry into sensitive fields/i)
  })

  it('generates a FormReviewSummary with a single-use confirmation token and flags consequential POST actions', async () => {
    const tab = await tabManager.createTab({ url: 'https://shop.example.org/checkout' })

    const review = await agentManager.reviewForm({
      tabId: tab.tabId,
      formId: 'checkout-form',
      proposedValues: {
        shipping_address: '456 Oak Avenue'
      }
    })

    expect(review).toBeDefined()
    expect(review.reviewId).toBeDefined()
    expect(review.formId).toBe('checkout-form')
    expect(review.confirmationToken).toBeDefined()
    expect(review.isConsequential).toBe(true)
    expect(review.fieldsToSubmit.shipping_address).toBe('456 Oak Avenue')
    // Sensitive field must be redacted in review
    expect(review.fieldsToSubmit.cvv).toBe('[REDACTED SENSITIVE FIELD]')
  })

  it('rejects form submission if confirmationToken is missing, expired, or invalid', async () => {
    const tab = await tabManager.createTab({ url: 'https://shop.example.org/checkout' })

    await expect(
      agentManager.submitForm({
        tabId: tab.tabId,
        formId: 'checkout-form',
        confirmationToken: 'invalid_token_1234567890'
      })
    ).rejects.toThrow(/Invalid or expired confirmation token/i)
  })

  it('submits form successfully when valid token is supplied, and consumes token (replay prevention)', async () => {
    const tab = await tabManager.createTab({ url: 'https://shop.example.org/checkout' })

    const review = await agentManager.reviewForm({
      tabId: tab.tabId,
      formId: 'order-form'
    })

    // Submit using the single-use token
    const result = await agentManager.submitForm({
      tabId: tab.tabId,
      formId: 'order-form',
      confirmationToken: review.confirmationToken
    })

    expect(result.action).toBe('submitForm')
    expect(result.success).toBe(true)

    // Second submission with same token must fail (replay attack defense)
    await expect(
      agentManager.submitForm({
        tabId: tab.tabId,
        formId: 'order-form',
        confirmationToken: review.confirmationToken
      })
    ).rejects.toThrow(/Invalid or expired confirmation token/i)
  })

  it('rejects form submission if the destination origin changed since review', async () => {
    const tab = await tabManager.createTab({ url: 'https://shop.example.org/checkout' })

    const review = await agentManager.reviewForm({
      tabId: tab.tabId,
      formId: 'order-form'
    })

    // Navigate the tab to a different origin after review
    await tabManager.navigateTab({
      tabId: tab.tabId,
      url: 'https://phishing.example.com/login'
    })

    await expect(
      agentManager.submitForm({
        tabId: tab.tabId,
        formId: 'order-form',
        confirmationToken: review.confirmationToken
      })
    ).rejects.toThrow(/Destination origin changed/i)
  })
})
