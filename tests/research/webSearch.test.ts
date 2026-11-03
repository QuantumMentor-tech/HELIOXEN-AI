/**
 * HELIOXEN AI — Step 32: Web Search Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  WebSearchService,
  MockSearchAdapter,
  normalizeSearchUrl
} from '../../src/main/research/WebSearchService'
import { ResearchSearchQuery } from '../../src/shared/research/types'

describe('Step 32: Web Search Service', () => {
  describe('normalizeSearchUrl', () => {
    it('strips tracking parameters while preserving semantic query parameters', () => {
      const raw = 'https://example.com/article?utm_source=twitter&utm_medium=social&topic=physics&fbclid=12345'
      const normalized = normalizeSearchUrl(raw)
      expect(normalized).toBe('https://example.com/article?topic=physics')
    })

    it('normalizes default http and https ports and root trailing slashes', () => {
      expect(normalizeSearchUrl('http://example.com:80/')).toBe('http://example.com')
      expect(normalizeSearchUrl('https://example.com:443/')).toBe('https://example.com')
      expect(normalizeSearchUrl('https://example.com:8080/path/')).toBe('https://example.com:8080/path/')
    })
  })

  describe('WebSearchService execution', () => {
    it('executes search query with MockSearchAdapter and bounds result counts', async () => {
      const service = new WebSearchService()
      const mockAdapter = new MockSearchAdapter()
      service.registerAdapter(mockAdapter)
      service.setActiveAdapter('mock-search')

      const query: ResearchSearchQuery = {
        query: 'quantum computing advances',
        maxResults: 3
      }

      const response = await service.search(query)

      expect(response.query).toBe('quantum computing advances')
      expect(response.providerId).toBe('mock-search')
      expect(response.results.length).toBe(3)
      expect(response.totalCount).toBe(3)
      expect(response.results[0].rank).toBe(1)
      expect(response.results[0].url).toContain('https://example.org/research/article-1')
      expect(response.results[0].domain).toBe('example.org')
    })

    it('deduplicates search results with identical normalized URLs', async () => {
      const service = new WebSearchService()
      const mockAdapter = new MockSearchAdapter()

      mockAdapter.setMockResults('ai models', [
        {
          id: 'res_1',
          providerId: 'mock-search',
          query: 'ai models',
          title: 'Top AI Models',
          url: 'https://example.com/models?utm_source=email',
          snippet: 'Overview of models',
          domain: 'example.com',
          retrievalTimestamp: Date.now(),
          rank: 1
        },
        {
          id: 'res_2',
          providerId: 'mock-search',
          query: 'ai models',
          title: 'Duplicate AI Models link',
          url: 'https://example.com/models?utm_medium=social',
          snippet: 'Duplicate article',
          domain: 'example.com',
          retrievalTimestamp: Date.now(),
          rank: 2
        },
        {
          id: 'res_3',
          providerId: 'mock-search',
          query: 'ai models',
          title: 'Different Model Article',
          url: 'https://example.com/different-article',
          snippet: 'Unique article',
          domain: 'example.com',
          retrievalTimestamp: Date.now(),
          rank: 3
        }
      ])

      service.registerAdapter(mockAdapter)
      service.setActiveAdapter('mock-search')

      const response = await service.search({ query: 'ai models', maxResults: 10 })
      expect(response.results.length).toBe(2)
      expect(response.results[0].url).toBe('https://example.com/models')
      expect(response.results[1].url).toBe('https://example.com/different-article')
    })

    it('filters results by requested domain filter', async () => {
      const service = new WebSearchService()
      const mockAdapter = new MockSearchAdapter()

      mockAdapter.setMockResults('science news', [
        {
          id: 'res_1',
          providerId: 'mock-search',
          query: 'science news',
          title: 'Nature News',
          url: 'https://www.nature.com/articles/123',
          snippet: 'Nature science update',
          domain: 'www.nature.com',
          retrievalTimestamp: Date.now(),
          rank: 1
        },
        {
          id: 'res_2',
          providerId: 'mock-search',
          query: 'science news',
          title: 'Blog News',
          url: 'https://untrusted-blog.org/news',
          snippet: 'Blog update',
          domain: 'untrusted-blog.org',
          retrievalTimestamp: Date.now(),
          rank: 2
        }
      ])

      service.registerAdapter(mockAdapter)
      service.setActiveAdapter('mock-search')

      const response = await service.search({
        query: 'science news',
        domainFilter: ['nature.com']
      })

      expect(response.results.length).toBe(1)
      expect(response.results[0].domain).toBe('www.nature.com')
    })

    it('rejects cancellation signal properly without returning partial data', async () => {
      const service = new WebSearchService()
      const controller = new AbortController()
      controller.abort()

      await expect(
        service.search({ query: 'test query' }, { signal: controller.signal })
      ).rejects.toThrow(/cancelled/i)
    })

    it('rejects invalid, empty, or oversized queries', async () => {
      const service = new WebSearchService()

      await expect(service.search({ query: '' })).rejects.toThrow()
      await expect(service.search({ query: 'a'.repeat(501) })).rejects.toThrow()
    })
  })
})

