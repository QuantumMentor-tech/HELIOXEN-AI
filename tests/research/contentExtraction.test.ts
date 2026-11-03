/**
 * HELIOXEN AI — Step 32: Webpage Content Extraction Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { WebPageExtractor } from '../../src/main/research/WebPageExtractor'
import { BrowserTabManager, BrowserViewAdapter } from '../../src/main/browser/BrowserTabManager'
import { BrowserSessionManager, BrowserSessionAdapter } from '../../src/main/browser/BrowserSessionManager'

describe('Step 32: Webpage Content Extractor', () => {
  const createMockEnvironment = (evalResult?: any) => {
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
          executeJavaScript: vi.fn().mockResolvedValue(
            evalResult ?? {
              title: 'Mock Article Title',
              author: 'Jane Doe',
              text: 'This is the main article content discussing breakthroughs in quantum physics. Paragraph two contains detailed experimental evidence.',
              headings: [
                { level: 1, text: 'Quantum Physics Breakthrough' },
                { level: 2, text: 'Experimental Setup' }
              ],
              links: [
                { text: 'Source Paper', url: 'https://arxiv.org/abs/2401.12345' }
              ]
            }
          ),
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
    const extractor = new WebPageExtractor(tabManager)
    return { sessionManager, tabManager, extractor }
  }

  it('normalizes whitespace in extracted text', () => {
    const { extractor } = createMockEnvironment()
    const raw = '  Multiple   spaces    and \r\n\r\n\r\n\r\n excessive blank lines.  '
    const normalized = extractor.normalizeExtractedText(raw)
    expect(normalized).toBe('Multiple spaces and\n\nexcessive blank lines.')
  })

  it('extracts structured content, headings, and validated links from an open tab', async () => {
    const { tabManager, extractor } = createMockEnvironment()
    const tab = await tabManager.createTab({ url: 'https://example.com/quantum' })

    const result = await extractor.extractTabContent({
      tabId: tab.tabId,
      maxChars: 5000
    })

    expect(result.id).toMatch(/^src_/)
    expect(result.sourceUrl).toBe('https://example.com/quantum')
    expect(result.domain).toBe('example.com')
    expect(result.title).toBe('Mock Article Title')
    expect(result.author).toBe('Jane Doe')
    expect(result.headings.length).toBe(2)
    expect(result.headings[0].text).toBe('Quantum Physics Breakthrough')
    expect(result.links.length).toBe(1)
    expect(result.links[0].url).toBe('https://arxiv.org/abs/2401.12345')
    expect(result.status).toBe('completed')
    expect(result.isTruncated).toBe(false)
    expect(result.charCount).toBeGreaterThan(0)
  })

  it('truncates content exceeding maximum character limit and marks status partial', async () => {
    const longText = 'A'.repeat(500)
    const { tabManager, extractor } = createMockEnvironment({
      title: 'Long Article',
      text: longText,
      headings: [],
      links: []
    })

    const tab = await tabManager.createTab({ url: 'https://example.com/long' })
    const result = await extractor.extractTabContent({
      tabId: tab.tabId,
      maxChars: 150
    })

    expect(result.charCount).toBe(150)
    expect(result.isTruncated).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.warnings.some((w) => w.includes('truncated'))).toBe(true)
  })

  it('handles cancellation signal before and during extraction', async () => {
    const { tabManager, extractor } = createMockEnvironment()
    const tab = await tabManager.createTab({ url: 'https://example.com' })

    const controller = new AbortController()
    controller.abort()

    await expect(
      extractor.extractTabContent({ tabId: tab.tabId }, controller.signal)
    ).rejects.toThrow(/cancelled/i)
  })

  it('rejects extraction from a non-existent tab', async () => {
    const { extractor } = createMockEnvironment()

    await expect(
      extractor.extractTabContent({ tabId: 'tab_non_existent' })
    ).rejects.toThrow(/does not exist/i)
  })
})

