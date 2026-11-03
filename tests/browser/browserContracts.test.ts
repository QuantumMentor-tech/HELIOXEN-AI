/**
 * HELIOXEN AI — Step 31: Browser Contracts & Zod Schemas Tests
 */

import { describe, it, expect } from 'vitest'
import {
  ValidBrowserUrlSchema,
  BrowserSessionConfigSchema,
  BrowserSessionMetadataSchema,
  BrowserTabStateSchema,
  CreateSessionRequestSchema,
  CreateTabRequestSchema,
  NavigateTabRequestSchema,
  SwitchTabRequestSchema,
  CloseTabRequestSchema,
  TabActionRequestSchema,
  ClearSessionDataRequestSchema,
  BrowserViewBoundsSchema,
  SetBrowserViewBoundsRequestSchema,
  BrowserOperationResultSchema
} from '../../src/shared/browser/contracts'

describe('Step 31: Browser Service Contracts & Validation', () => {
  describe('ValidBrowserUrlSchema', () => {
    it('accepts valid HTTP and HTTPS URLs', () => {
      expect(ValidBrowserUrlSchema.safeParse('https://example.com').success).toBe(true)
      expect(ValidBrowserUrlSchema.safeParse('https://sub.domain.org/path?q=1&v=2#hash').success).toBe(true)
      expect(ValidBrowserUrlSchema.safeParse('http://localhost:3000').success).toBe(true)
    })

    it('rejects non-HTTP/HTTPS schemes', () => {
      expect(ValidBrowserUrlSchema.safeParse('file:///C:/passwords.txt').success).toBe(false)
      expect(ValidBrowserUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
      expect(ValidBrowserUrlSchema.safeParse('data:text/html,test').success).toBe(false)
      expect(ValidBrowserUrlSchema.safeParse('ftp://ftp.test.com').success).toBe(false)
      expect(ValidBrowserUrlSchema.safeParse('chrome://settings').success).toBe(false)
    })

    it('rejects URLs with embedded credentials', () => {
      expect(ValidBrowserUrlSchema.safeParse('https://admin:pass@example.com').success).toBe(false)
      expect(ValidBrowserUrlSchema.safeParse('http://user@example.com').success).toBe(false)
    })

    it('rejects empty or excessively long URLs', () => {
      expect(ValidBrowserUrlSchema.safeParse('').success).toBe(false)
      expect(ValidBrowserUrlSchema.safeParse('https://' + 'a'.repeat(2050)).success).toBe(false)
    })
  })

  describe('Session Schemas', () => {
    it('validates BrowserSessionConfigSchema and enforces .strict()', () => {
      const valid = { sessionId: 'session_1', persist: true, userAgent: 'CustomAgent' }
      expect(BrowserSessionConfigSchema.safeParse(valid).success).toBe(true)

      const withExtra = { sessionId: 'session_1', unknownField: 123 }
      expect(BrowserSessionConfigSchema.safeParse(withExtra).success).toBe(false)
    })

    it('validates CreateSessionRequestSchema', () => {
      expect(CreateSessionRequestSchema.safeParse({}).success).toBe(true)
      expect(CreateSessionRequestSchema.safeParse({ sessionId: 'test', persist: false }).success).toBe(true)
      expect(CreateSessionRequestSchema.safeParse({ sessionId: '' }).success).toBe(false)
    })

    it('validates ClearSessionDataRequestSchema', () => {
      const valid = { sessionId: 'test-session', storages: ['cookies', 'cache'] }
      expect(ClearSessionDataRequestSchema.safeParse(valid).success).toBe(true)

      const invalidStorage = { sessionId: 'test', storages: ['unsupported_storage'] }
      expect(ClearSessionDataRequestSchema.safeParse(invalidStorage).success).toBe(false)
    })
  })

  describe('Tab Schemas', () => {
    it('validates CreateTabRequestSchema', () => {
      expect(CreateTabRequestSchema.safeParse({}).success).toBe(true)
      expect(
        CreateTabRequestSchema.safeParse({
          sessionId: 'ses_1',
          url: 'https://example.com',
          activate: true
        }).success
      ).toBe(true)

      // Invalid URL
      expect(
        CreateTabRequestSchema.safeParse({
          url: 'javascript:void(0)'
        }).success
      ).toBe(false)
    })

    it('validates NavigateTabRequestSchema and rejects unknown fields', () => {
      expect(
        NavigateTabRequestSchema.safeParse({
          tabId: 'tab_1',
          url: 'https://github.com'
        }).success
      ).toBe(true)

      expect(
        NavigateTabRequestSchema.safeParse({
          tabId: 'tab_1',
          url: 'https://github.com',
          extraPayload: true
        }).success
      ).toBe(false)
    })

    it('validates SwitchTabRequestSchema and CloseTabRequestSchema', () => {
      expect(SwitchTabRequestSchema.safeParse({ tabId: 'tab_123' }).success).toBe(true)
      expect(SwitchTabRequestSchema.safeParse({ tabId: '' }).success).toBe(false)

      expect(CloseTabRequestSchema.safeParse({ tabId: 'tab_123' }).success).toBe(true)
      expect(CloseTabRequestSchema.safeParse({ tabId: '' }).success).toBe(false)
    })

    it('validates TabActionRequestSchema', () => {
      expect(TabActionRequestSchema.safeParse({ tabId: 'tab_abc' }).success).toBe(true)
      expect(TabActionRequestSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('Bounds and State Schemas', () => {
    it('validates BrowserViewBoundsSchema and SetBrowserViewBoundsRequestSchema', () => {
      const validBounds = { x: 0, y: 50, width: 800, height: 600 }
      expect(BrowserViewBoundsSchema.safeParse(validBounds).success).toBe(true)

      const negativeBounds = { x: -10, y: 0, width: 800, height: 600 }
      expect(BrowserViewBoundsSchema.safeParse(negativeBounds).success).toBe(false)

      expect(
        SetBrowserViewBoundsRequestSchema.safeParse({
          bounds: validBounds
        }).success
      ).toBe(true)
    })

    it('validates BrowserTabStateSchema', () => {
      const validState = {
        tabId: 'tab_1',
        sessionId: 'session_default',
        url: 'https://example.com',
        title: 'Example Domain',
        loading: false,
        status: 'loaded',
        canGoBack: false,
        canGoForward: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      expect(BrowserTabStateSchema.safeParse(validState).success).toBe(true)

      // Invalid status
      expect(
        BrowserTabStateSchema.safeParse({
          ...validState,
          status: 'unknown_status'
        }).success
      ).toBe(false)
    })

    it('validates BrowserOperationResultSchema', () => {
      expect(
        BrowserOperationResultSchema.safeParse({
          success: true,
          tabId: 'tab_1'
        }).success
      ).toBe(true)

      expect(
        BrowserOperationResultSchema.safeParse({
          success: false,
          message: 'Failed to navigate'
        }).success
      ).toBe(true)
    })
  })
})

