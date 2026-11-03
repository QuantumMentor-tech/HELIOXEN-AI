/**
 * HELIOXEN AI — Step 32: Web Search Service
 * Modular, source-attributed web search service with URL normalization,
 * deduplication, and strict protocol validation.
 */

import {
  ResearchSearchQuery,
  ResearchSearchResult,
  ResearchSearchResponse
} from '../../shared/research/types'
import { ResearchSearchQuerySchema } from '../../shared/research/contracts'
import { NavigationPolicy } from '../browser/NavigationPolicy'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

export interface SearchProviderAdapter {
  readonly providerId: string
  search(query: ResearchSearchQuery, signal?: AbortSignal): Promise<ResearchSearchResponse>
}

/**
 * Normalizes URLs for deduplication:
 * - strips standard tracking parameters (utm_*, fbclid, gclid)
 * - removes default ports (:80 for http, :443 for https)
 * - removes trailing slash for root paths
 */
export function normalizeSearchUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    // Strip tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
    for (const p of trackingParams) {
      url.searchParams.delete(p)
    }

    // Default port removal
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = ''
    }

    // Clean trailing slash if path is only '/' and no search/hash
    let res = url.toString()
    if (res.endsWith('/') && url.pathname === '/' && !url.search && !url.hash) {
      res = res.slice(0, -1)
    }
    return res
  } catch {
    return rawUrl
  }
}

/**
 * Mock search adapter for testing, offline execution, and local development.
 */
export class MockSearchAdapter implements SearchProviderAdapter {
  public readonly providerId = 'mock-search'
  private mockResults: Map<string, ResearchSearchResult[]> = new Map()

  public setMockResults(query: string, results: ResearchSearchResult[]): void {
    this.mockResults.set(query.toLowerCase().trim(), results)
  }

  public async search(query: ResearchSearchQuery, signal?: AbortSignal): Promise<ResearchSearchResponse> {
    if (signal?.aborted) {
      throw new IpcException('OPERATION_UNAVAILABLE', 'Search was cancelled before dispatch')
    }

    const key = query.query.toLowerCase().trim()
    const canned = this.mockResults.get(key)
    const now = Date.now()

    if (canned) {
      return {
        query: query.query,
        providerId: this.providerId,
        results: canned.slice(0, query.maxResults || 5),
        totalCount: canned.length,
        retrievalTimestamp: now
      }
    }

    // Generate deterministic default mock results
    const count = Math.min(query.maxResults || 5, 5)
    const results: ResearchSearchResult[] = []

    for (let i = 1; i <= count; i++) {
      results.push({
        id: `res_mock_${now}_${i}`,
        providerId: this.providerId,
        query: query.query,
        title: `Search Result ${i} for "${query.query}"`,
        url: `https://example.org/research/article-${i}?q=${encodeURIComponent(query.query)}`,
        snippet: `Authoritative evidence summary and analysis for topic: ${query.query}. Documented in section ${i}.`,
        domain: 'example.org',
        retrievalTimestamp: now,
        rank: i
      })
    }

    return {
      query: query.query,
      providerId: this.providerId,
      results,
      totalCount: results.length,
      retrievalTimestamp: now
    }
  }
}

/**
 * Privacy-friendly DuckDuckGo search adapter (zero credentials, public API).
 */
export class DuckDuckGoSearchAdapter implements SearchProviderAdapter {
  public readonly providerId = 'duckduckgo'

  public async search(query: ResearchSearchQuery, signal?: AbortSignal): Promise<ResearchSearchResponse> {
    if (signal?.aborted) {
      throw new IpcException('OPERATION_UNAVAILABLE', 'Search was cancelled before dispatch')
    }

    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query.query)}&format=json&no_html=1&skip_disambig=1`
    let data: any

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: signal || AbortSignal.timeout(10000),
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`DuckDuckGo API responded with status ${response.status}`)
      }
      data = await response.json()
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        throw new IpcException('OPERATION_UNAVAILABLE', 'Web search was aborted by user or timeout')
      }
      throw new IpcException('OPERATION_UNAVAILABLE', `Search request failed: ${err?.message || 'Network error'}`)
    }

    const now = Date.now()
    const results: ResearchSearchResult[] = []
    let rank = 1

    // 1. Check Abstract
    if (data.AbstractURL && data.Heading) {
      try {
        const validatedUrl = NavigationPolicy.validateUrl(data.AbstractURL)
        results.push({
          id: `ddg_${now}_${rank}`,
          providerId: this.providerId,
          query: query.query,
          title: data.Heading,
          url: validatedUrl,
          snippet: data.AbstractText || data.Abstract || 'Overview from DuckDuckGo Instant Answers',
          domain: new URL(validatedUrl).hostname,
          retrievalTimestamp: now,
          rank: rank++
        })
      } catch {
        // Skip invalid URL
      }
    }

    // 2. Check RelatedTopics
    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (topic.FirstURL && topic.Text) {
          try {
            const validatedUrl = NavigationPolicy.validateUrl(topic.FirstURL)
            results.push({
              id: `ddg_${now}_${rank}`,
              providerId: this.providerId,
              query: query.query,
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
              url: validatedUrl,
              snippet: topic.Text,
              domain: new URL(validatedUrl).hostname,
              retrievalTimestamp: now,
              rank: rank++
            })
            if (results.length >= (query.maxResults || 5)) break
          } catch {
            // Skip invalid URL
          }
        }
      }
    }

    return {
      query: query.query,
      providerId: this.providerId,
      results,
      totalCount: results.length,
      retrievalTimestamp: now
    }
  }
}

/**
 * Authoritative WebSearchService managing search dispatch, validation, and deduplication.
 */
export class WebSearchService {
  private adapters = new Map<string, SearchProviderAdapter>()
  private activeAdapterId = 'mock-search'

  constructor() {
    this.registerAdapter(new MockSearchAdapter())
    this.registerAdapter(new DuckDuckGoSearchAdapter())
  }

  public registerAdapter(adapter: SearchProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter)
  }

  public setActiveAdapter(providerId: string): void {
    if (!this.adapters.has(providerId)) {
      throw new IpcException('VALIDATION_ERROR', `Search provider '${providerId}' is not registered`)
    }
    this.activeAdapterId = providerId
  }

  public getActiveAdapterId(): string {
    return this.activeAdapterId
  }

  public getAdapter(providerId?: string): SearchProviderAdapter {
    const id = providerId || this.activeAdapterId
    const adapter = this.adapters.get(id)
    if (!adapter) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Search provider '${id}' is not configured`)
    }
    return adapter
  }

  /**
   * Performs an authorized, validated web search.
   */
  public async search(
    rawQuery: ResearchSearchQuery,
    options: { providerId?: string; signal?: AbortSignal } = {}
  ): Promise<ResearchSearchResponse> {
    const query = ResearchSearchQuerySchema.parse(rawQuery)

    if (options.signal?.aborted) {
      throw new IpcException('OPERATION_UNAVAILABLE', 'Search cancelled before invocation')
    }

    const adapter = this.getAdapter(options.providerId)
    const rawResponse = await adapter.search(query, options.signal)

    // Deduplicate and validate results
    const deduplicatedResults: ResearchSearchResult[] = []
    const seenNormalizedUrls = new Set<string>()

    for (const res of rawResponse.results) {
      try {
        const validatedUrl = NavigationPolicy.validateUrl(res.url)
        const normalized = normalizeSearchUrl(validatedUrl)

        if (seenNormalizedUrls.has(normalized)) {
          continue
        }
        seenNormalizedUrls.add(normalized)

        // Apply domain filter if specified
        if (query.domainFilter && query.domainFilter.length > 0) {
          const host = new URL(validatedUrl).hostname.toLowerCase()
          const matches = query.domainFilter.some((df) => host.includes(df.toLowerCase()))
          if (!matches) continue
        }

        deduplicatedResults.push({
          ...res,
          url: normalized,
          domain: new URL(normalized).hostname
        })

        if (deduplicatedResults.length >= (query.maxResults || 5)) {
          break
        }
      } catch {
        // Skip results with invalid URLs or unapproved schemes
      }
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'research:webSearch',
      providerId: adapter.providerId,
      resultCount: deduplicatedResults.length
    })

    return {
      query: query.query,
      providerId: adapter.providerId,
      results: deduplicatedResults,
      totalCount: deduplicatedResults.length,
      retrievalTimestamp: rawResponse.retrievalTimestamp || Date.now(),
      warnings: rawResponse.warnings
    }
  }
}

export const webSearchService = new WebSearchService()