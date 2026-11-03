/**
 * HELIOXEN AI — Step 32: Research Collection and Citation Validation Tests
 */

import { describe, it, expect } from 'vitest'
import { ResearchCollectionManager } from '../../src/main/research/ResearchCollectionManager'
import {
  ResearchSearchResult,
  ResearchSourceRecord,
  BrowserScreenshotRecord
} from '../../src/shared/research/types'

describe('Step 32: Research Collection & Citations', () => {
  it('initializes and manages task-scoped research collections', () => {
    const manager = new ResearchCollectionManager()
    const convId = 'conv_research_1'

    const coll = manager.getOrCreateCollection(convId, 'task_100')
    expect(coll.conversationId).toBe(convId)
    expect(coll.activeTaskId).toBe('task_100')
    expect(coll.searchResults).toHaveLength(0)
    expect(coll.sources).toHaveLength(0)
    expect(coll.screenshots).toHaveLength(0)
    expect(coll.citations).toHaveLength(0)
  })

  it('adds search results with automatic deduplication by normalized URL', () => {
    const manager = new ResearchCollectionManager()
    const convId = 'conv_dedup_test'

    const results: ResearchSearchResult[] = [
      {
        id: 'res_1',
        providerId: 'mock-search',
        query: 'fusion energy',
        title: 'Fusion Progress',
        url: 'https://example.com/fusion?utm_source=twitter',
        snippet: 'Recent progress in fusion.',
        domain: 'example.com',
        retrievalTimestamp: Date.now(),
        rank: 1
      },
      {
        id: 'res_2',
        providerId: 'mock-search',
        query: 'fusion energy',
        title: 'Duplicate Fusion Link',
        url: 'https://example.com/fusion',
        snippet: 'Same URL without tracking.',
        domain: 'example.com',
        retrievalTimestamp: Date.now(),
        rank: 2
      }
    ]

    manager.addSearchResults(convId, 'fusion energy', results)
    const coll = manager.getOrCreateCollection(convId)

    // Deduplication should have preserved only one entry
    expect(coll.searchResults.length).toBe(1)
    expect(coll.queries).toContain('fusion energy')
  })

  it('toggles source inclusion for active AI context', () => {
    const manager = new ResearchCollectionManager()
    const convId = 'conv_toggle_test'

    const source: ResearchSourceRecord = {
      id: 'src_test_1',
      sourceUrl: 'https://example.com/article',
      title: 'Article 1',
      domain: 'example.com',
      extractedText: 'Valuable research content on AI safety.',
      headings: [],
      links: [],
      retrievalTimestamp: Date.now(),
      extractionTimestamp: Date.now(),
      extractor: 'test-extractor',
      status: 'completed',
      isTruncated: false,
      charCount: 39,
      wordCount: 6,
      warnings: [],
      includedInContext: true
    }

    manager.addSourceRecord(convId, source)

    // Exclude
    const updated1 = manager.setSourceInclusion(convId, 'src_test_1', false)
    expect(updated1.includedInContext).toBe(false)

    // Formatted context should be empty when source is excluded
    const formattedExcluded = manager.formatResearchContext(convId)
    expect(formattedExcluded).toBe('')

    // Re-include
    const updated2 = manager.setSourceInclusion(convId, 'src_test_1', true)
    expect(updated2.includedInContext).toBe(true)

    // Formatted context should now contain the source
    const formattedIncluded = manager.formatResearchContext(convId)
    expect(formattedIncluded).toContain('[SOURCE: src_test_1]')
    expect(formattedIncluded).toContain('UNTRUSTED WEB CONTENT')
    expect(formattedIncluded).toContain('Valuable research content on AI safety.')
  })

  it('validates citations against genuine sources and identifies unverified references', () => {
    const manager = new ResearchCollectionManager()
    const convId = 'conv_citations_test'

    const source: ResearchSourceRecord = {
      id: 'src_genuine_1',
      sourceUrl: 'https://scientific-journal.org/paper-42',
      canonicalUrl: 'https://scientific-journal.org/paper-42',
      title: 'Groundbreaking Study',
      domain: 'scientific-journal.org',
      extractedText: 'Evidence confirms quantum advantage.',
      headings: [],
      links: [],
      retrievalTimestamp: Date.now(),
      extractionTimestamp: Date.now(),
      extractor: 'test-extractor',
      status: 'completed',
      isTruncated: false,
      charCount: 36,
      wordCount: 4,
      warnings: [],
      includedInContext: true
    }

    manager.addSourceRecord(convId, source)

    // Validate a valid citation by sourceId
    const citations = manager.validateCitations({
      conversationId: convId,
      citations: [
        {
          sourceId: 'src_genuine_1',
          claimText: 'Quantum advantage was demonstrated'
        },
        {
          sourceUrl: 'https://scientific-journal.org/paper-42',
          claimText: 'Matches via source URL'
        },
        {
          sourceUrl: 'https://fabricated-hallucination.com/fake-paper',
          claimText: 'AI hallucinated URL'
        }
      ]
    })

    expect(citations.length).toBe(3)

    // Citation 1: Matched by sourceId
    expect(citations[0].isVerified).toBe(true)
    expect(citations[0].resolvedSourceTitle).toBe('Groundbreaking Study')

    // Citation 2: Matched by sourceUrl
    expect(citations[1].isVerified).toBe(true)
    expect(citations[1].resolvedUrl).toBe('https://scientific-journal.org/paper-42')

    // Citation 3: Fabricated / Unresolved
    expect(citations[2].isVerified).toBe(false)
    expect(citations[2].notes).toContain('Unresolved citation')
  })

  it('manages collection lifecycle: get, clear, and screenshot discard', () => {
    const manager = new ResearchCollectionManager()
    const convId = 'conv_mgmt_test'

    const screenshot: BrowserScreenshotRecord = {
      id: 'scr_test_1',
      tabId: 'tab_1',
      sessionId: 'session_1',
      pageUrl: 'https://example.com',
      pageTitle: 'Example',
      captureTimestamp: Date.now(),
      width: 800,
      height: 600,
      mimeType: 'image/jpeg',
      sizeBytes: 500,
      dataUrl: 'data:image/jpeg;base64,DATA',
      isDiscarded: false
    }

    manager.addScreenshotRecord(convId, screenshot)

    // Discard screenshot through collection manager
    const discardRes = manager.manageCollection({
      conversationId: convId,
      action: 'discard_screenshot',
      screenshotId: 'scr_test_1'
    })
    expect(discardRes.success).toBe(true)

    const coll = manager.getOrCreateCollection(convId)
    expect(coll.screenshots[0].isDiscarded).toBe(true)
    expect(coll.screenshots[0].dataUrl).toBe('')

    // Clear collection
    const clearRes = manager.manageCollection({
      conversationId: convId,
      action: 'clear'
    })
    expect(clearRes.success).toBe(true)

    const newColl = manager.getOrCreateCollection(convId)
    expect(newColl.screenshots.length).toBe(0)
  })
})

