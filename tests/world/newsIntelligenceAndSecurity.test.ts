/**
 * HELIOXEN AI — Step 38 Test Suite
 * News Source Adapters, Timestamp & URL Validation, Deduplication, Story Clustering,
 * Factual Integrity, Cache Retention, Partial Failures, Security & Full 20-Step E2E Verification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  parseSafeRssItems,
  RawAdapterNewsItem,
  WorldMonitorService,
  WorldNewsSourceAdapter
} from '../../src/main/world'
import {
  parseConservativeSourceTimestamp,
  validateAndNormalizeNewsUrl
} from '../../src/shared/world'

function createControllableAdapter(options: {
  sourceId: string
  displayName: string
  maxRetentionHours?: number
  allowsExcerptStorage?: boolean
  fetchImpl: () => Promise<RawAdapterNewsItem[]>
}): WorldNewsSourceAdapter {
  return {
    descriptor: {
      sourceId: options.sourceId,
      displayName: options.displayName,
      kind: 'public_api',
      homepageUrl: `https://${options.sourceId}.example.org`,
      endpointUrl: `https://${options.sourceId}.example.org/feed`,
      attributionRequirement: `Source: ${options.displayName}`,
      licenseAndTermsSummary: 'Authorized metadata feed.',
      maxRetentionHours: options.maxRetentionHours ?? 24,
      minRefreshIntervalMs: 1000,
      allowsExcerptStorage: options.allowsExcerptStorage ?? true,
      allowsFullTextStorage: false,
      enabled: true
    },
    fetchArticles: async () => options.fetchImpl()
  }
}

describe('Step 38 — News Intelligence, Factual Integrity, Security & E2E Verification', () => {
  let tempDir: string
  let currentTimeMs: number
  let openedUrls: string[]

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step38-world-'))
    currentTimeMs = Date.parse('2026-11-04T12:00:00Z') // Fixed deterministic epoch
    openedUrls = []
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore Windows cleanup errors
    }
  })

  describe('1. Conservative Timestamp & URL Validation (Sections 9.3, 14, 19.2 & 21.3)', () => {
    it('never substitutes retrieval time when source publication timestamp is missing or malformed', () => {
      const missing = parseConservativeSourceTimestamp(null, currentTimeMs)
      expect(missing.timestamp).toBeNull()
      expect(missing.status).toBe('missing_from_source')

      const malformed = parseConservativeSourceTimestamp('not-a-valid-date-string', currentTimeMs)
      expect(malformed.timestamp).toBeNull()
      expect(malformed.status).toBe('missing_from_source')

      const gdeltCompact = parseConservativeSourceTimestamp('20261104T103000Z', currentTimeMs)
      expect(gdeltCompact.status).toBe('verified_source_timestamp')
      expect(gdeltCompact.timestamp).toBe(Date.parse('2026-11-04T10:30:00Z'))
    })

    it('blocks unsafe URL schemes (javascript:, file:, data:) and private/loopback SSRF URLs', () => {
      expect(validateAndNormalizeNewsUrl('javascript:alert(1)').valid).toBe(false)
      expect(validateAndNormalizeNewsUrl('file:///C:/Windows/System32/cmd.exe').valid).toBe(false)
      expect(validateAndNormalizeNewsUrl('data:text/html,<script>alert(1)</script>').valid).toBe(
        false
      )
      expect(validateAndNormalizeNewsUrl('http://127.0.0.1:8080/internal').valid).toBe(false)
      expect(validateAndNormalizeNewsUrl('https://localhost/admin').valid).toBe(false)
      expect(validateAndNormalizeNewsUrl('http://192.168.1.10/router').valid).toBe(false)
      expect(validateAndNormalizeNewsUrl('http://169.254.169.254/latest/meta-data/').valid).toBe(
        false
      )

      const validClean = validateAndNormalizeNewsUrl(
        'https://earthobservatory.nasa.gov/images/150001/aurora?utm_source=rss&fbclid=123#section'
      )
      expect(validClean.valid).toBe(true)
      expect(validClean.canonicalUrl).toBe(
        'https://earthobservatory.nasa.gov/images/150001/aurora'
      )
    })

    it('parses RSS/Atom XML safely and strips embedded HTML/script tags from summaries', () => {
      const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:georss="http://www.georss.org/georss">
          <channel>
            <item>
              <title><![CDATA[Volcanic Activity Observed Near Reykjavik]]></title>
              <link>https://earthobservatory.nasa.gov/images/volcano-1</link>
              <description><![CDATA[<script>evil()</script><p>Satellite thermal anomaly detected.</p>]]></description>
              <pubDate>Wed, 04 Nov 2026 08:00:00 GMT</pubDate>
              <georss:point>64.1466 -21.9426</georss:point>
            </item>
          </channel>
        </rss>`

      const items = parseSafeRssItems(sampleRss, 'NASA Earth Observatory', 'environment')
      expect(items).toHaveLength(1)
      expect(items[0]?.headline).toBe('Volcanic Activity Observed Near Reykjavik')
      expect(items[0]?.summary).not.toContain('<script>')
      expect(items[0]?.latitude).toBeCloseTo(64.1466, 3)
      expect(items[0]?.longitude).toBeCloseTo(-21.9426, 3)
    })
  })

  describe('2. Deduplication, Story Clustering & Factual Integrity (Sections 11, 13 & 21.6)', () => {
    it('suppresses exact duplicates from the same source while preserving distinct publishers in story clusters without claiming verification', async () => {
      const wireServiceAdapter = createControllableAdapter({
        sourceId: 'global-wire',
        displayName: 'Global Science Wire',
        fetchImpl: async () => [
          {
            sourceArticleId: 'gw-101',
            sourceName: 'Global Science Wire',
            headline: 'European Space Agency Launches Quantum Communications Satellite from Geneva Briefing',
            summary: 'Initial mission report.',
            url: 'https://wire.example.org/articles/quantum-sat-launch',
            publishedAt: currentTimeMs - 3600_000,
            placeName: 'Geneva',
            countryCode: 'CH',
            category: 'science'
          },
          // Duplicate entry from the exact same source
          {
            sourceArticleId: 'gw-101',
            sourceName: 'Global Science Wire',
            headline: 'European Space Agency Launches Quantum Communications Satellite from Geneva Briefing',
            summary: 'Duplicate page entry.',
            url: 'https://wire.example.org/articles/quantum-sat-launch?utm_source=feed',
            publishedAt: currentTimeMs - 3600_000,
            placeName: 'Geneva',
            countryCode: 'CH',
            category: 'science'
          }
        ]
      })

      const secondPubAdapter = createControllableAdapter({
        sourceId: 'euro-tech-journal',
        displayName: 'European Tech Journal',
        fetchImpl: async () => [
          {
            sourceArticleId: 'etj-555',
            sourceName: 'European Tech Journal',
            headline: 'European Space Agency Launches New Quantum Communications Satellite Mission',
            summary: 'Independent coverage from Brussels and Geneva correspondents.',
            url: 'https://eurotech.example.org/news/esa-quantum-satellite',
            publishedAt: currentTimeMs - 1800_000,
            placeName: 'Geneva',
            countryCode: 'CH',
            category: 'science'
          }
        ]
      })

      const service = new WorldMonitorService({
        storageDir: tempDir,
        adapters: [wireServiceAdapter, secondPubAdapter],
        nowFn: () => currentTimeMs
      })

      const refreshRes = await service.refreshNewsFeed({ forceRefresh: true })
      expect(refreshRes.deduplicatedCount).toBe(1)
      expect(refreshRes.totalArticles).toBe(2)
      expect(refreshRes.clusterCount).toBe(1)

      const queryRes = service.queryFeedAndMarkers({})
      expect(queryRes.articles).toHaveLength(2)
      expect(queryRes.clusters).toHaveLength(1)

      const cluster = queryRes.clusters[0]!
      expect(cluster.distinctSourceNames).toEqual([
        'European Tech Journal',
        'Global Science Wire'
      ])
      // Factual integrity: cluster corroboration note must explicitly state that shared coverage is NOT confirmed fact
      expect(cluster.corroborationNote).toContain('not confirmed fact')

      service.dispose()
    })
  })

  describe('3. Partial Source Failures, Rate Limits & Cache Retention Policy (Sections 8.4, 15 & 16)', () => {
    it('preserves valid cached articles when one source fails or hits rate limits, and prunes expired cache entries while preserving bookmark references', async () => {
      let sourceBFailing = false
      const sourceA = createControllableAdapter({
        sourceId: 'source-a',
        displayName: 'Source A (24h Retention)',
        maxRetentionHours: 24,
        allowsExcerptStorage: true,
        fetchImpl: async () => [
          {
            sourceArticleId: 'a-1',
            headline: 'Tokyo Clean Energy Grid Expansion Announced',
            summary: 'Permitted excerpt from Source A.',
            url: 'https://source-a.example.org/tokyo-grid',
            publishedAt: currentTimeMs - 7200_000,
            placeName: 'Tokyo',
            countryCode: 'JP',
            category: 'economy'
          }
        ]
      })

      const sourceB = createControllableAdapter({
        sourceId: 'source-b',
        displayName: 'Source B (Rate Limited)',
        maxRetentionHours: 24,
        fetchImpl: async () => {
          if (sourceBFailing) {
            throw new Error('RATE_LIMITED: HTTP 429 quota exceeded')
          }
          return [
            {
              sourceArticleId: 'b-1',
              headline: 'Nairobi Regional Trade Corridor Agreement Signed',
              summary: 'Report from Nairobi.',
              url: 'https://source-b.example.org/nairobi-trade',
              publishedAt: currentTimeMs - 3600_000,
              placeName: 'Nairobi',
              countryCode: 'KE',
              category: 'economy'
            }
          ]
        }
      })

      const service = new WorldMonitorService({
        storageDir: tempDir,
        adapters: [sourceA, sourceB],
        nowFn: () => currentTimeMs
      })

      // Initial successful refresh of both sources
      const firstRefresh = await service.refreshNewsFeed({ forceRefresh: true })
      expect(firstRefresh.totalArticles).toBe(2)
      expect(firstRefresh.freshnessState).toBe('live_fresh')

      // Bookmark Tokyo article
      const articlesBefore = service.queryFeedAndMarkers({}).articles
      const tokyoArt = articlesBefore.find((a) => a.headline.includes('Tokyo'))!
      service.toggleArticleBookmark({ articleId: tokyoArt.id, bookmarked: true })

      // Advance clock by 2 hours and make Source B fail with 429
      currentTimeMs += 2 * 3600 * 1000
      sourceBFailing = true

      const partialRefresh = await service.refreshNewsFeed({ forceRefresh: true })
      expect(partialRefresh.freshnessState).toBe('partial_failure')
      expect(partialRefresh.warnings.some((w) => w.includes('RATE_LIMITED'))).toBe(true)
      // Previously cached articles remain available
      expect(partialRefresh.totalArticles).toBe(2)

      // Advance clock past the 24-hour maxRetentionHours window (30 hours later)
      currentTimeMs += 30 * 3600 * 1000
      const prunedCount = service.pruneExpiredCachedArticles()
      // Unbookmarked Nairobi article is pruned; bookmarked Tokyo article is retained as headline_only reference without cached summary
      expect(prunedCount).toBe(1)

      const remaining = service.queryFeedAndMarkers({}).articles
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.id).toBe(tokyoArt.id)
      expect(remaining[0]?.bookmarked).toBe(true)
      expect(remaining[0]?.summary).toBeNull()
      expect(remaining[0]?.contentStatus).toBe('headline_only')

      service.dispose()
    })
  })

  describe('4. Full 20-Step End-to-End World Monitor Verification (Section 25)', () => {
    it('executes the complete Step 38 end-to-end journey across Globe/Map navigation, News ingestion, Filtering, Marker synchronization, and Security gates', async () => {
      const service = new WorldMonitorService({
        storageDir: tempDir,
        adapters: [],
        openExternalUrlFn: async (url) => {
          openedUrls.push(url)
        },
        nowFn: () => currentTimeMs
      })

      // Register controlled fixture adapter
      const fixtureAdapter = createControllableAdapter({
        sourceId: 'controlled-global-feed',
        displayName: 'Controlled Global Intelligence Feed',
        fetchImpl: async () => [
          {
            sourceArticleId: 'e2e-1',
            sourceName: 'Pacific Maritime Dispatch',
            headline: 'Suva Pacific Subsea Cable Maintenance Completed',
            summary: 'Scheduled maintenance completed near Suva.',
            url: 'https://pacific.example.org/suva-cable',
            publishedAt: currentTimeMs - 1800_000,
            placeName: 'Suva, Fiji (Antimeridian Pacific)',
            countryCode: 'FJ',
            category: 'technology',
            retrievalMethod: 'controlled_fixture'
          },
          {
            sourceArticleId: 'e2e-2',
            sourceName: 'Continental Policy Review',
            headline: 'Ambiguous Paris Municipal Budget Discussion',
            summary: 'Mentions Paris without specifying France or Texas.',
            url: 'https://policy.example.org/paris-discussion',
            publishedAt: null, // Missing publication timestamp test
            placeName: 'Paris', // Ambiguous homonym
            category: 'policy',
            retrievalMethod: 'controlled_fixture'
          },
          {
            sourceArticleId: 'e2e-3',
            sourceName: 'National Economic Monitor',
            headline: 'Japan Semiconductor Export Figures Released',
            summary: 'Country-level economic report.',
            url: 'https://econ.example.org/japan-exports',
            publishedAt: currentTimeMs - 3600_000,
            countryCode: 'JP',
            countryName: 'Japan',
            category: 'economy',
            retrievalMethod: 'controlled_fixture'
          }
        ]
      })
      service.registerSourceAdapter(fixtureAdapter)

      // 1-6. Refresh feed and inspect overview snapshot, map attribution, and timestamp separation
      await service.refreshNewsFeed({ forceRefresh: true })
      const overview = service.getOverviewSnapshot()
      expect(overview.mapProvider.attributionText).toContain('Natural Earth')
      expect(overview.queryResult.totalMatchingCount).toBe(3)

      // Verify missing publication timestamp is NOT replaced with retrieval timestamp
      const parisArt = overview.queryResult.articles.find((a) =>
        a.headline.includes('Ambiguous Paris')
      )!
      expect(parisArt.publishedAt).toBeNull()
      expect(parisArt.publishedAtStatus).toBe('missing_from_source')
      expect(parisArt.retrievedAt).toBe(currentTimeMs)

      // 7-9. Verify geographic plotting: Suva (city) and Japan (country_level) are plotted; Ambiguous Paris is NOT plotted
      expect(overview.queryResult.markers).toHaveLength(2)
      expect(parisArt.geographicAssociation.plottableOnMap).toBe(false)
      expect(parisArt.geographicAssociation.associationType).toBe('unresolved')

      const japanArt = overview.queryResult.articles.find((a) =>
        a.headline.includes('Japan Semiconductor')
      )!
      expect(japanArt.geographicAssociation.associationType).toBe('country_level')
      expect(japanArt.geographicAssociation.precision).toBe('country')

      // 10-11. Filter by category and geographic mode
      const techOnly = service.queryFeedAndMarkers({ category: 'technology' })
      expect(techOnly.totalMatchingCount).toBe(1)
      expect(techOnly.articles[0]?.headline).toContain('Suva')

      const unresolvedOnly = service.queryFeedAndMarkers({
        geographicMode: 'unresolved_only'
      })
      expect(unresolvedOnly.totalMatchingCount).toBe(1)
      expect(unresolvedOnly.articles[0]?.id).toBe(parisArt.id)

      // 17. Test external navigation security: valid HTTPS opens; unsafe javascript: or file: is blocked
      const openOk = await service.openArticleSourceUrl({
        articleId: japanArt.id,
        url: japanArt.canonicalUrl
      })
      expect(openOk.opened).toBe(true)
      expect(openedUrls).toEqual(['https://econ.example.org/japan-exports'])

      await expect(
        service.openArticleSourceUrl({
          url: 'javascript:alert(document.cookie)'
        })
      ).rejects.toThrow(/UNSAFE_SOURCE_URL/)

      await expect(
        service.openArticleSourceUrl({
          url: 'file:///C:/Windows/win.ini'
        })
      ).rejects.toThrow(/UNSAFE_SOURCE_URL/)

      service.dispose()
    })
  })
})
