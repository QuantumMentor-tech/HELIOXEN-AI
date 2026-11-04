/**
 * HELIOXEN AI — Step 38: World Monitor Service
 * Main-process geospatial and news-intelligence orchestration service.
 * Enforces source attribution, timestamp distinction, coordinate validation,
 * deterministic deduplication and story clustering, cache retention policies,
 * partial-failure resilience, and safe external source navigation.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  buildDeterministicStoryClusters,
  buildSynchronizedMapMarkers,
  deduplicateSourceArticles,
  DEFAULT_MAP_PROVIDER_CONFIG,
  DEFAULT_WORLD_MONITOR_PREFERENCES,
  DEFAULT_WORLD_MONITOR_PROFILE_ID,
  FeedFreshnessState,
  GeographicAssociationType,
  LocationSearchRequestSchema,
  LocationSearchResult,
  MapProviderConfig,
  NewsCategory,
  NewsSourceDescriptor,
  NewsSourceHealthStatus,
  NewsStoryCluster,
  NormalizedNewsArticle,
  OpenArticleSourceUrlRequestSchema,
  parseConservativeSourceTimestamp,
  resolveConservativeGeographicAssociation,
  searchGazetteerLocations,
  ToggleArticleBookmarkRequestSchema,
  validateAndNormalizeNewsUrl,
  WORLD_MONITOR_MACRO_REGIONS,
  WORLD_MONITOR_SCHEMA_VERSION,
  WorldMonitorFilterQuery,
  WorldMonitorFilterQuerySchema,
  WorldMonitorOverviewSnapshot,
  WorldMonitorPreferences,
  WorldMonitorPreferencesSchema,
  WorldMonitorProfileIdSchema,
  WorldMonitorQueryResult,
  WorldMonitorRefreshRequestSchema,
  WorldMonitorRefreshResult
} from '../../shared/world'

export interface RawAdapterNewsItem {
  readonly sourceArticleId?: string | null
  readonly sourceName?: string | null
  readonly headline: string
  readonly summary?: string | null
  readonly url: string
  readonly publishedAt?: string | number | null
  readonly updatedAt?: string | number | null
  readonly language?: string | null
  readonly category?: NewsCategory
  readonly author?: string | null
  readonly imageUrl?: string | null
  readonly latitude?: number
  readonly longitude?: number
  readonly placeName?: string | null
  readonly countryCode?: string | null
  readonly countryName?: string | null
  readonly associationType?: GeographicAssociationType
  readonly isSyndicatedCopy?: boolean
  readonly syndicationOriginName?: string
  readonly retrievalMethod?: 'live_network' | 'local_cache' | 'controlled_fixture'
}

export interface WorldNewsSourceAdapter {
  readonly descriptor: Omit<
    NewsSourceDescriptor,
    'status' | 'lastAttemptAt' | 'lastSuccessAt' | 'lastErrorMessage' | 'consecutiveFailures'
  >
  fetchArticles(options: {
    searchQuery?: string
    maxRecords?: number
    signal?: AbortSignal
  }): Promise<RawAdapterNewsItem[]>
}

// ============================================================================
// 1. BUILT-IN AUTHORIZED NEWS SOURCE ADAPTERS
// ============================================================================

/**
 * Adapter 1: GDELT DOC 2.0 Public API Adapter (https://api.gdeltproject.org/api/v2/doc/doc)
 * Official public dataset API for global news metadata discovery.
 */
export class GdeltDocPublicApiAdapter implements WorldNewsSourceAdapter {
  public readonly descriptor = {
    sourceId: 'gdelt-doc-v2',
    displayName: 'GDELT Project DOC 2.0 Global Metadata Index',
    kind: 'public_api' as const,
    homepageUrl: 'https://www.gdeltproject.org/',
    endpointUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
    attributionRequirement:
      'Index metadata courtesy of The GDELT Project; individual articles remain copyright of their respective publishers.',
    licenseAndTermsSummary:
      'Open public metadata citation index (headlines, URLs, source domains, publication dates). Full article text is never stored.',
    maxRetentionHours: 24,
    minRefreshIntervalMs: 60_000,
    allowsExcerptStorage: false,
    allowsFullTextStorage: false as const,
    enabled: true
  }

  public async fetchArticles(options: {
    searchQuery?: string
    maxRecords?: number
    signal?: AbortSignal
  }): Promise<RawAdapterNewsItem[]> {
    const queryTerm = options.searchQuery?.trim() || 'sourcelang:eng'
    const maxRecords = Math.min(options.maxRecords ?? 25, 50)
    const url = `${this.descriptor.endpointUrl}?query=${encodeURIComponent(queryTerm)}&mode=ArtList&maxrecords=${maxRecords}&format=json`

    const response = await fetch(url, {
      method: 'GET',
      signal: options.signal ?? AbortSignal.timeout(8000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HELIOXEN-Desktop-WorldMonitor/1.0'
      }
    })

    if (response.status === 429) {
      throw new Error('RATE_LIMITED: GDELT DOC 2.0 API rate limit reached.')
    }
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: GDELT DOC API returned status ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('json')) {
      throw new Error('UNSUPPORTED_CONTENT_TYPE: Expected JSON response from GDELT DOC API.')
    }

    const text = await response.text()
    if (text.length > 2 * 1024 * 1024) {
      throw new Error('RESPONSE_TOO_LARGE: GDELT response exceeded 2 MB limit.')
    }

    const parsed = JSON.parse(text) as {
      articles?: Array<{
        url?: string
        title?: string
        seendate?: string
        domain?: string
        language?: string
        sourcecountry?: string
        socialimage?: string
      }>
    }

    const rawArticles = Array.isArray(parsed?.articles) ? parsed.articles : []
    return rawArticles
      .filter((a) => Boolean(a?.url && a?.title))
      .map((a) => ({
        sourceArticleId: a.url ?? null,
        sourceName: a.domain || 'GDELT Indexed Publisher',
        headline: String(a.title ?? '').trim(),
        summary: null,
        url: String(a.url ?? '').trim(),
        publishedAt: a.seendate ?? null,
        language: a.language || 'en',
        category: 'world' as const,
        countryName: a.sourcecountry || null,
        associationType: a.sourcecountry ? ('country_level' as const) : ('unresolved' as const),
        retrievalMethod: 'live_network' as const
      }))
  }
}

/**
 * Adapter 2: NASA Earth Observatory Authorized Public Atom/RSS Feed Adapter
 * Public-domain science & Earth observation dispatch feed with structured coordinates.
 */
export class NasaEarthObservatoryFeedAdapter implements WorldNewsSourceAdapter {
  public readonly descriptor = {
    sourceId: 'nasa-earth-observatory-rss',
    displayName: 'NASA Earth Observatory Natural Event & Science Feed',
    kind: 'authorized_rss_atom' as const,
    homepageUrl: 'https://earthobservatory.nasa.gov/',
    endpointUrl: 'https://earthobservatory.nasa.gov/feeds/earth-observatory.rss',
    attributionRequirement: 'Source: NASA Earth Observatory (Public Domain US Government Work).',
    licenseAndTermsSummary:
      'NASA public-domain syndication feed; headlines, short summaries, and geospatial coordinates permitted with NASA attribution.',
    maxRetentionHours: 72,
    minRefreshIntervalMs: 60_000,
    allowsExcerptStorage: true,
    allowsFullTextStorage: false as const,
    enabled: true
  }

  public async fetchArticles(options: {
    searchQuery?: string
    maxRecords?: number
    signal?: AbortSignal
  }): Promise<RawAdapterNewsItem[]> {
    const response = await fetch(this.descriptor.endpointUrl, {
      method: 'GET',
      signal: options.signal ?? AbortSignal.timeout(8000),
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'HELIOXEN-Desktop-WorldMonitor/1.0'
      }
    })

    if (response.status === 429) {
      throw new Error('RATE_LIMITED: NASA RSS feed rate limit reached.')
    }
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: NASA feed returned status ${response.status}`)
    }

    const xml = await response.text()
    if (xml.length > 2 * 1024 * 1024) {
      throw new Error('RESPONSE_TOO_LARGE: RSS feed exceeded 2 MB safety bound.')
    }

    return parseSafeRssItems(xml, 'NASA Earth Observatory', 'environment').slice(
      0,
      options.maxRecords ?? 20
    )
  }
}

/**
 * Safely parses RSS `<item>` or Atom `<entry>` blocks without executing XML entities or scripts.
 */
export function parseSafeRssItems(
  xmlText: string,
  defaultSourceName: string,
  defaultCategory: NewsCategory = 'world'
): RawAdapterNewsItem[] {
  const items: RawAdapterNewsItem[] = []
  const itemRegex = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
  let match: RegExpExecArray | null

  const extractTag = (block: string, tag: string): string | null => {
    const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)
    if (!m || !m[1]) return null
    return m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1]
    const title = extractTag(block, 'title')
    let link = extractTag(block, 'link')
    if (!link) {
      const hrefMatch = /<link\b[^>]*href=["']([^"']+)["']/i.exec(block)
      if (hrefMatch) link = hrefMatch[1]
    }
    if (!title || !link) continue

    const description = extractTag(block, 'description') || extractTag(block, 'summary')
    const pubDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated')
    const guid = extractTag(block, 'guid') || extractTag(block, 'id') || link

    // Optional GeoRSS point <georss:point>lat lon</georss:point>
    let latitude: number | undefined
    let longitude: number | undefined
    const geoPoint = extractTag(block, 'georss:point')
    if (geoPoint) {
      const parts = geoPoint.split(/\s+/).map(Number)
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        latitude = parts[0]
        longitude = parts[1]
      }
    }

    items.push({
      sourceArticleId: guid,
      sourceName: defaultSourceName,
      headline: title.slice(0, 300),
      summary: description ? description.slice(0, 420) : null,
      url: link,
      publishedAt: pubDate,
      language: 'en',
      category: defaultCategory,
      latitude,
      longitude,
      associationType:
        latitude !== undefined && longitude !== undefined ? 'event_location' : 'unresolved',
      retrievalMethod: 'live_network'
    })
  }

  return items
}

// ============================================================================
// 2. PERSISTED STORE & WORLD MONITOR SERVICE
// ============================================================================

interface SourceRuntimeState {
  status: NewsSourceHealthStatus
  lastAttemptAt: number | null
  lastSuccessAt: number | null
  lastErrorMessage: string | null
  consecutiveFailures: number
  enabled: boolean
}

interface ProfileWorldMonitorData {
  articles: NormalizedNewsArticle[]
  preferences: WorldMonitorPreferences
  lastSuccessfulRefreshAt: number | null
  sourceStates: Record<string, SourceRuntimeState>
}

interface PersistedWorldMonitorStore {
  schemaVersion: number
  updatedAt: number
  profiles: Record<string, ProfileWorldMonitorData>
}

export interface WorldMonitorServiceOptions {
  readonly storageDir: string
  readonly adapters?: readonly WorldNewsSourceAdapter[]
  readonly openExternalUrlFn?: (url: string) => Promise<void>
  readonly nowFn?: () => number
  readonly maxStoredArticlesPerProfile?: number
}

export class WorldMonitorService {
  private readonly baseDir: string
  private readonly storePath: string
  private readonly adapters = new Map<string, WorldNewsSourceAdapter>()
  private readonly openExternalUrlFn: (url: string) => Promise<void>
  private readonly nowFn: () => number
  private readonly maxStoredArticlesPerProfile: number
  private readonly activeRefreshLocks = new Set<string>()
  private store: PersistedWorldMonitorStore

  constructor(options: WorldMonitorServiceOptions) {
    this.baseDir = path.resolve(options.storageDir, 'world_monitor')
    this.storePath = path.join(this.baseDir, 'world_monitor_store.json')
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.maxStoredArticlesPerProfile = options.maxStoredArticlesPerProfile ?? 250
    this.openExternalUrlFn =
      options.openExternalUrlFn ??
      (async () => {
        // Default safe no-op when outside Electron shell
      })

    const initialAdapters = options.adapters ?? [
      new GdeltDocPublicApiAdapter(),
      new NasaEarthObservatoryFeedAdapter()
    ]
    for (const adapter of initialAdapters) {
      this.adapters.set(adapter.descriptor.sourceId, adapter)
    }

    this.ensureDirectories()
    this.store = this.loadStoreFromDisk()
    this.pruneExpiredCachedArticles()
  }

  public dispose(): void {
    this.activeRefreshLocks.clear()
  }

  public registerSourceAdapter(adapter: WorldNewsSourceAdapter): void {
    this.adapters.set(adapter.descriptor.sourceId, adapter)
  }

  // --------------------------------------------------------------------------
  // Persistence & Migration Resilience
  // --------------------------------------------------------------------------

  private ensureDirectories(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true })
    }
  }

  private createDefaultProfileData(): ProfileWorldMonitorData {
    return {
      articles: [],
      preferences: { ...DEFAULT_WORLD_MONITOR_PREFERENCES },
      lastSuccessfulRefreshAt: null,
      sourceStates: {}
    }
  }

  private loadStoreFromDisk(): PersistedWorldMonitorStore {
    try {
      this.ensureDirectories()
      if (!fs.existsSync(this.storePath)) {
        return {
          schemaVersion: WORLD_MONITOR_SCHEMA_VERSION,
          updatedAt: this.nowFn(),
          profiles: {
            [DEFAULT_WORLD_MONITOR_PROFILE_ID]: this.createDefaultProfileData()
          }
        }
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedWorldMonitorStore>
      if (!parsed || typeof parsed !== 'object' || !parsed.profiles) {
        throw new Error('Malformed World Monitor store JSON')
      }

      const profiles: Record<string, ProfileWorldMonitorData> = {}
      for (const [profileId, data] of Object.entries(parsed.profiles)) {
        const validArticles: NormalizedNewsArticle[] = []
        if (Array.isArray(data?.articles)) {
          for (const candidate of data.articles) {
            if (
              candidate &&
              typeof candidate === 'object' &&
              typeof candidate.id === 'string' &&
              typeof candidate.headline === 'string' &&
              typeof candidate.canonicalUrl === 'string' &&
              validateAndNormalizeNewsUrl(candidate.canonicalUrl).valid
            ) {
              validArticles.push(candidate)
            }
          }
        }

        profiles[profileId] = {
          articles: validArticles,
          preferences: {
            ...DEFAULT_WORLD_MONITOR_PREFERENCES,
            ...(data?.preferences ?? {})
          },
          lastSuccessfulRefreshAt:
            typeof data?.lastSuccessfulRefreshAt === 'number'
              ? data.lastSuccessfulRefreshAt
              : null,
          sourceStates:
            data?.sourceStates && typeof data.sourceStates === 'object'
              ? data.sourceStates
              : {}
        }
      }

      if (!profiles[DEFAULT_WORLD_MONITOR_PROFILE_ID]) {
        profiles[DEFAULT_WORLD_MONITOR_PROFILE_ID] = this.createDefaultProfileData()
      }

      return {
        schemaVersion: WORLD_MONITOR_SCHEMA_VERSION,
        updatedAt: parsed.updatedAt ?? this.nowFn(),
        profiles
      }
    } catch {
      try {
        if (fs.existsSync(this.storePath)) {
          const backupPath = `${this.storePath}.corrupt.${this.nowFn()}.json`
          fs.renameSync(this.storePath, backupPath)
        }
      } catch {
        // Ignore backup rename failure
      }
      return {
        schemaVersion: WORLD_MONITOR_SCHEMA_VERSION,
        updatedAt: this.nowFn(),
        profiles: {
          [DEFAULT_WORLD_MONITOR_PROFILE_ID]: this.createDefaultProfileData()
        }
      }
    }
  }

  private getProfileData(rawProfileId?: string): {
    profileId: string
    data: ProfileWorldMonitorData
  } {
    const profileId = WorldMonitorProfileIdSchema.parse(
      rawProfileId ?? DEFAULT_WORLD_MONITOR_PROFILE_ID
    )
    if (!this.store.profiles[profileId]) {
      this.store.profiles[profileId] = this.createDefaultProfileData()
    }
    return { profileId, data: this.store.profiles[profileId] }
  }

  private mutateAndPersist<T>(mutator: () => T): T {
    const snapshot = JSON.stringify(this.store)
    try {
      const result = mutator()
      this.store.updatedAt = this.nowFn()
      this.ensureDirectories()
      const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf-8')
      try {
        fs.renameSync(tmpPath, this.storePath)
      } catch {
        try {
          fs.copyFileSync(tmpPath, this.storePath)
          fs.unlinkSync(tmpPath)
        } catch {
          fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8')
        }
      }
      return result
    } catch (err) {
      this.store = JSON.parse(snapshot) as PersistedWorldMonitorStore
      throw err
    }
  }

  /**
   * Enforces each source's `maxRetentionHours` policy on cached articles.
   * For bookmarked articles past the cache window, strips any cached summary excerpt
   * while preserving the user's bookmark reference (headline, source attribution, canonical link).
   */
  public pruneExpiredCachedArticles(rawProfileId?: string): number {
    const now = this.nowFn()
    let prunedCount = 0

    const targetProfiles = rawProfileId
      ? [this.getProfileData(rawProfileId)]
      : Object.keys(this.store.profiles).map((id) => this.getProfileData(id))

    this.mutateAndPersist(() => {
      for (const { data } of targetProfiles) {
        const retained: NormalizedNewsArticle[] = []
        for (const article of data.articles) {
          const adapter = this.adapters.get(article.sourceId)
          const maxRetentionHours = adapter?.descriptor.maxRetentionHours ?? 48
          const ageMs = now - article.retrievedAt
          const expired = ageMs > maxRetentionHours * 3600 * 1000

          if (!expired) {
            retained.push(article)
          } else if (article.bookmarked) {
            // Preserve user bookmark reference metadata only, stripping cached summary
            retained.push({
              ...article,
              summary: null,
              contentStatus: 'headline_only'
            })
          } else {
            prunedCount++
          }
        }
        data.articles = retained
      }
    })

    return prunedCount
  }

  // --------------------------------------------------------------------------
  // Normalization & Ingestion
  // --------------------------------------------------------------------------

  public normalizeAdapterItem(
    sourceDescriptor: WorldNewsSourceAdapter['descriptor'],
    raw: RawAdapterNewsItem,
    retrievedAt: number = this.nowFn()
  ): NormalizedNewsArticle | null {
    const headline = typeof raw.headline === 'string' ? raw.headline.trim() : ''
    if (!headline) return null

    const urlCheck = validateAndNormalizeNewsUrl(raw.url)
    if (!urlCheck.valid || !urlCheck.canonicalUrl) {
      return null
    }

    const pubTime = parseConservativeSourceTimestamp(raw.publishedAt, retrievedAt)
    const updTime = parseConservativeSourceTimestamp(raw.updatedAt, retrievedAt)

    const geoAssoc = resolveConservativeGeographicAssociation({
      explicitLatitude: raw.latitude,
      explicitLongitude: raw.longitude,
      explicitPlaceName: raw.placeName,
      explicitCountryCode: raw.countryCode,
      explicitCountryName: raw.countryName,
      explicitAssociationType: raw.associationType
    })

    const allowedSummary =
      sourceDescriptor.allowsExcerptStorage && typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim().slice(0, 420)
        : null

    const sourceName =
      typeof raw.sourceName === 'string' && raw.sourceName.trim()
        ? raw.sourceName.trim().slice(0, 120)
        : sourceDescriptor.displayName

    const stableHash = crypto
      .createHash('sha256')
      .update(`${sourceDescriptor.sourceId}::${raw.sourceArticleId || urlCheck.canonicalUrl}`)
      .digest('hex')
      .slice(0, 16)

    const isSyndicated = Boolean(raw.isSyndicatedCopy)
    const contentStatus =
      pubTime.status === 'missing_from_source'
        ? 'incomplete_metadata'
        : allowedSummary
          ? 'metadata_and_excerpt'
          : 'headline_only'

    return {
      id: `art_${stableHash}`,
      sourceId: sourceDescriptor.sourceId,
      sourceArticleId: raw.sourceArticleId ? String(raw.sourceArticleId).slice(0, 200) : null,
      sourceName,
      headline: headline.slice(0, 300),
      summary: allowedSummary,
      isAiGeneratedSummary: false,
      canonicalUrl: urlCheck.canonicalUrl,
      publishedAt: pubTime.timestamp,
      publishedAtStatus: pubTime.status,
      updatedAt: updTime.timestamp,
      retrievedAt,
      language: typeof raw.language === 'string' && raw.language.trim() ? raw.language.trim() : 'en',
      category: raw.category ?? 'world',
      author: typeof raw.author === 'string' && raw.author.trim() ? raw.author.trim().slice(0, 120) : null,
      imageUrl:
        typeof raw.imageUrl === 'string' && validateAndNormalizeNewsUrl(raw.imageUrl).valid
          ? validateAndNormalizeNewsUrl(raw.imageUrl).canonicalUrl
          : null,
      geographicAssociation: geoAssoc,
      provenance: {
        sourceId: sourceDescriptor.sourceId,
        sourceName,
        sourceKind: sourceDescriptor.kind,
        attributionText: sourceDescriptor.attributionRequirement,
        retrievedAt,
        retrievalMethod: raw.retrievalMethod ?? 'live_network',
        isSyndicatedCopy: isSyndicated,
        syndicationOriginName: raw.syndicationOriginName,
        verificationPosture: 'single_source_report',
        verificationDisclaimer:
          'Reported by source; HELIOXEN does not independently verify underlying factual claims.'
      },
      contentStatus,
      clusterId: null,
      bookmarked: false,
      schemaVersion: WORLD_MONITOR_SCHEMA_VERSION
    }
  }

  /**
   * Refreshes configured news sources while respecting rate limits, partial failures,
   * deduplication, and cache retention policies. Never fabricates synthetic articles on failure.
   */
  public async refreshNewsFeed(
    request: {
      profileId?: string
      sourceIds?: string[]
      searchQuery?: string
      forceRefresh?: boolean
    } = {}
  ): Promise<WorldMonitorRefreshResult> {
    const parsed = WorldMonitorRefreshRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)
    const lockKey = `${profileId}::${parsed.searchQuery ?? ''}`

    if (this.activeRefreshLocks.has(lockKey)) {
      throw new Error('REFRESH_IN_PROGRESS: A feed refresh for this query is already running.')
    }

    this.activeRefreshLocks.add(lockKey)
    const now = this.nowFn()
    const warnings: string[] = []
    let newArticlesCount = 0
    let deduplicatedCount = 0
    let anySucceeded = false
    let anyFailed = false

    try {
      const targetAdapters = Array.from(this.adapters.values()).filter((adapter) => {
        const state = data.sourceStates[adapter.descriptor.sourceId]
        const isEnabled = state?.enabled ?? adapter.descriptor.enabled
        if (!isEnabled) return false
        if (parsed.sourceIds && parsed.sourceIds.length > 0) {
          return parsed.sourceIds.includes(adapter.descriptor.sourceId)
        }
        return true
      })

      const newlyNormalized: NormalizedNewsArticle[] = []

      for (const adapter of targetAdapters) {
        const sourceId = adapter.descriptor.sourceId
        const prevState: SourceRuntimeState = data.sourceStates[sourceId] ?? {
          status: 'healthy',
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastErrorMessage: null,
          consecutiveFailures: 0,
          enabled: adapter.descriptor.enabled
        }

        // Enforce minimum refresh interval per source unless forceRefresh is within safe bounds
        if (
          !parsed.forceRefresh &&
          prevState.lastSuccessAt !== null &&
          now - prevState.lastSuccessAt < adapter.descriptor.minRefreshIntervalMs
        ) {
          anySucceeded = true
          continue
        }

        try {
          const rawItems = await adapter.fetchArticles({
            searchQuery: parsed.searchQuery,
            maxRecords: 25
          })

          for (const item of rawItems) {
            const norm = this.normalizeAdapterItem(adapter.descriptor, item, now)
            if (norm) {
              newlyNormalized.push(norm)
            }
          }

          data.sourceStates[sourceId] = {
            ...prevState,
            status: 'healthy',
            lastAttemptAt: now,
            lastSuccessAt: now,
            lastErrorMessage: null,
            consecutiveFailures: 0
          }
          anySucceeded = true
        } catch (err) {
          anyFailed = true
          const msg = err instanceof Error ? err.message : String(err)
          const isRateLimit = /RATE_LIMITED|429/i.test(msg)
          data.sourceStates[sourceId] = {
            ...prevState,
            status: isRateLimit ? 'rate_limited' : 'unavailable',
            lastAttemptAt: now,
            lastErrorMessage: msg,
            consecutiveFailures: prevState.consecutiveFailures + 1
          }
          warnings.push(`${adapter.descriptor.displayName}: ${msg}`)
        }
      }

      this.mutateAndPersist(() => {
        if (newlyNormalized.length > 0) {
          // Preserve bookmark flags from existing articles
          const bookmarkedIds = new Set(
            data.articles.filter((a) => a.bookmarked).map((a) => a.id)
          )
          const mergedRaw = [...newlyNormalized, ...data.articles].map((art) => ({
            ...art,
            bookmarked: bookmarkedIds.has(art.id) || art.bookmarked
          }))

          const dedup = deduplicateSourceArticles(mergedRaw)
          deduplicatedCount = dedup.removedDuplicateCount

          const existingIds = new Set(data.articles.map((a) => a.id))
          newArticlesCount = dedup.deduplicated.filter((a) => !existingIds.has(a.id)).length

          const clustered = buildDeterministicStoryClusters(
            dedup.deduplicated.slice(0, this.maxStoredArticlesPerProfile),
            now
          )
          data.articles = clustered.articlesWithClusterIds
        }

        if (anySucceeded) {
          data.lastSuccessfulRefreshAt = now
        }
      })

      this.pruneExpiredCachedArticles(profileId)

      const freshnessState = this.computeFreshnessState(data, anyFailed, anySucceeded)
      const clusterCount = new Set(
        data.articles.map((a) => a.clusterId).filter(Boolean)
      ).size

      return {
        refreshedAt: now,
        freshnessState,
        totalArticles: data.articles.length,
        newArticlesCount,
        deduplicatedCount,
        clusterCount,
        sourceStatuses: this.getSourcesStatus(profileId),
        warnings
      }
    } finally {
      this.activeRefreshLocks.delete(lockKey)
    }
  }

  /**
   * Ingests controlled, source-attributed news records (used for deterministic testing or user-imported feeds).
   */
  public ingestNormalizedRecords(
    sourceId: string,
    rawItems: readonly RawAdapterNewsItem[],
    rawProfileId?: string
  ): { ingestedCount: number; deduplicatedCount: number; totalArticles: number } {
    const { profileId, data } = this.getProfileData(rawProfileId)
    const adapter = this.adapters.get(sourceId)
    if (!adapter) {
      throw new Error(`UNKNOWN_NEWS_SOURCE: Source '${sourceId}' is not registered.`)
    }

    const now = this.nowFn()
    const normalizedBatch: NormalizedNewsArticle[] = []
    for (const raw of rawItems) {
      const norm = this.normalizeAdapterItem(adapter.descriptor, raw, now)
      if (norm) normalizedBatch.push(norm)
    }

    let deduplicatedCount = 0
    this.mutateAndPersist(() => {
      const combined = [...normalizedBatch, ...data.articles]
      const dedup = deduplicateSourceArticles(combined)
      deduplicatedCount = dedup.removedDuplicateCount
      const clustered = buildDeterministicStoryClusters(
        dedup.deduplicated.slice(0, this.maxStoredArticlesPerProfile),
        now
      )
      data.articles = clustered.articlesWithClusterIds
      data.lastSuccessfulRefreshAt = now
      data.sourceStates[sourceId] = {
        status: 'healthy',
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastErrorMessage: null,
        consecutiveFailures: 0,
        enabled: true
      }
    })

    this.pruneExpiredCachedArticles(profileId)

    return {
      ingestedCount: normalizedBatch.length,
      deduplicatedCount,
      totalArticles: data.articles.length
    }
  }

  // --------------------------------------------------------------------------
  // Querying, Filtering, Sorting & Geographic Marker Synchronization
  // --------------------------------------------------------------------------

  private computeFreshnessState(
    data: ProfileWorldMonitorData,
    hadRecentFailure: boolean = false,
    hadRecentSuccess: boolean = false
  ): FeedFreshnessState {
    if (data.articles.length === 0) {
      return hadRecentFailure ? 'partial_failure' : 'empty'
    }
    if (hadRecentFailure && hadRecentSuccess) {
      return 'partial_failure'
    }
    const states = Object.values(data.sourceStates)
    if (states.length > 0 && states.every((s) => s.status === 'unavailable')) {
      return 'offline_cached'
    }
    if (states.some((s) => s.status === 'unavailable' || s.status === 'rate_limited')) {
      return 'partial_failure'
    }
    if (!data.lastSuccessfulRefreshAt) {
      return 'cached_stale'
    }
    const ageMs = this.nowFn() - data.lastSuccessfulRefreshAt
    if (ageMs <= 5 * 60 * 1000) return 'live_fresh'
    if (ageMs <= 60 * 60 * 1000) return 'cached_recent'
    return 'cached_stale'
  }

  public queryFeedAndMarkers(rawQuery: WorldMonitorFilterQuery = {}): WorldMonitorQueryResult {
    const parsed = WorldMonitorFilterQuerySchema.parse(rawQuery)
    const { data } = this.getProfileData(parsed.profileId)
    const now = this.nowFn()
    const searchLower = parsed.searchQuery?.toLowerCase().trim()

    const timeThresholdMs =
      parsed.timeRange === '24h'
        ? now - 24 * 3600 * 1000
        : parsed.timeRange === '7d'
          ? now - 7 * 24 * 3600 * 1000
          : parsed.timeRange === '30d'
            ? now - 30 * 24 * 3600 * 1000
            : null

    const filtered = data.articles.filter((article) => {
      if (parsed.category !== 'all' && article.category !== parsed.category) {
        return false
      }
      if (parsed.sourceId !== 'all' && article.sourceId !== parsed.sourceId) {
        return false
      }
      if (
        parsed.regionId !== 'all' &&
        article.geographicAssociation.regionId !== parsed.regionId
      ) {
        return false
      }
      if (parsed.clusterId && article.clusterId !== parsed.clusterId) {
        return false
      }
      if (parsed.bookmarkedOnly && !article.bookmarked) {
        return false
      }
      if (parsed.geographicMode === 'map_plottable_only') {
        if (
          !article.geographicAssociation.plottableOnMap ||
          !article.geographicAssociation.coordinates
        ) {
          return false
        }
      } else if (parsed.geographicMode === 'unresolved_only') {
        if (article.geographicAssociation.plottableOnMap) {
          return false
        }
      }
      if (timeThresholdMs !== null) {
        const effectiveTs = article.publishedAt ?? article.retrievedAt
        if (effectiveTs < timeThresholdMs) return false
      }
      if (searchLower) {
        const inHeadline = article.headline.toLowerCase().includes(searchLower)
        const inSummary = article.summary?.toLowerCase().includes(searchLower) ?? false
        const inSource = article.sourceName.toLowerCase().includes(searchLower)
        const inPlace =
          article.geographicAssociation.placeName?.toLowerCase().includes(searchLower) ?? false
        const inCountry =
          article.geographicAssociation.countryName?.toLowerCase().includes(searchLower) ?? false
        if (!inHeadline && !inSummary && !inSource && !inPlace && !inCountry) {
          return false
        }
      }
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      if (parsed.sortBy === 'source_asc') {
        return a.sourceName.localeCompare(b.sourceName)
      }
      if (parsed.sortBy === 'retrieved_desc') {
        return b.retrievedAt - a.retrievedAt
      }
      // Default: published_desc (articles with verified source timestamps first, then by retrievedAt)
      if (a.publishedAt !== null && b.publishedAt !== null) {
        return b.publishedAt - a.publishedAt
      }
      if (a.publishedAt !== null) return -1
      if (b.publishedAt !== null) return 1
      return b.retrievedAt - a.retrievedAt
    })

    const clusteredResult = data.preferences.enableStoryClustering
      ? buildDeterministicStoryClusters(sorted, now)
      : { articlesWithClusterIds: sorted.map((a) => ({ ...a, clusterId: null })), clusters: [] }

    const markers = buildSynchronizedMapMarkers(
      clusteredResult.articlesWithClusterIds,
      data.preferences.enableMapMarkerClustering
    )

    const startIdx = (parsed.page - 1) * parsed.pageSize
    const pagedArticles = clusteredResult.articlesWithClusterIds.slice(
      startIdx,
      startIdx + parsed.pageSize
    )

    return {
      articles: pagedArticles,
      totalMatchingCount: clusteredResult.articlesWithClusterIds.length,
      page: parsed.page,
      pageSize: parsed.pageSize,
      hasMore: startIdx + parsed.pageSize < clusteredResult.articlesWithClusterIds.length,
      clusters: clusteredResult.clusters,
      markers,
      freshnessState: this.computeFreshnessState(data),
      lastSuccessfulRefreshAt: data.lastSuccessfulRefreshAt
    }
  }

  public searchLocations(request: { query: string; limit?: number }): LocationSearchResult {
    const parsed = LocationSearchRequestSchema.parse(request)
    return searchGazetteerLocations(parsed.query, parsed.limit)
  }

  public toggleArticleBookmark(request: {
    profileId?: string
    articleId: string
    bookmarked: boolean
  }): NormalizedNewsArticle {
    const parsed = ToggleArticleBookmarkRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.articles.findIndex((a) => a.id === parsed.articleId)
    if (idx === -1) {
      throw new Error(`ARTICLE_NOT_FOUND: Article '${parsed.articleId}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const updated: NormalizedNewsArticle = {
        ...data.articles[idx],
        bookmarked: parsed.bookmarked
      }
      data.articles[idx] = updated
      return updated
    })
  }

  public async openArticleSourceUrl(request: {
    articleId?: string
    url: string
  }): Promise<{ opened: boolean; canonicalUrl: string }> {
    const parsed = OpenArticleSourceUrlRequestSchema.parse(request)
    const check = validateAndNormalizeNewsUrl(parsed.url)
    if (!check.valid || !check.canonicalUrl) {
      throw new Error(`UNSAFE_SOURCE_URL: ${check.error ?? 'Blocked invalid external URL.'}`)
    }

    await this.openExternalUrlFn(check.canonicalUrl)
    return {
      opened: true,
      canonicalUrl: check.canonicalUrl
    }
  }

  public getSourcesStatus(rawProfileId?: string): NewsSourceDescriptor[] {
    const { data } = this.getProfileData(rawProfileId)
    const list: NewsSourceDescriptor[] = []

    for (const adapter of this.adapters.values()) {
      const state = data.sourceStates[adapter.descriptor.sourceId]
      list.push({
        ...adapter.descriptor,
        enabled: state?.enabled ?? adapter.descriptor.enabled,
        status: state?.status ?? 'healthy',
        lastAttemptAt: state?.lastAttemptAt ?? null,
        lastSuccessAt: state?.lastSuccessAt ?? null,
        lastErrorMessage: state?.lastErrorMessage ?? null,
        consecutiveFailures: state?.consecutiveFailures ?? 0
      })
    }

    return list
  }

  public getMapProviderConfig(): MapProviderConfig {
    return DEFAULT_MAP_PROVIDER_CONFIG
  }

  public getPreferences(rawProfileId?: string): WorldMonitorPreferences {
    const { data } = this.getProfileData(rawProfileId)
    return { ...data.preferences }
  }

  public updatePreferences(
    patch: Partial<WorldMonitorPreferences>,
    rawProfileId?: string
  ): WorldMonitorPreferences {
    const { data } = this.getProfileData(rawProfileId)
    const merged = WorldMonitorPreferencesSchema.parse({
      ...data.preferences,
      ...patch
    })
    return this.mutateAndPersist(() => {
      data.preferences = merged
      return { ...data.preferences }
    })
  }

  public getOverviewSnapshot(
    rawProfileId?: string,
    filterQuery?: WorldMonitorFilterQuery
  ): WorldMonitorOverviewSnapshot {
    const { profileId, data } = this.getProfileData(rawProfileId)
    const queryResult = this.queryFeedAndMarkers({
      ...filterQuery,
      profileId
    })

    return {
      profileId,
      mapProvider: DEFAULT_MAP_PROVIDER_CONFIG,
      sources: this.getSourcesStatus(profileId),
      queryResult,
      regions: WORLD_MONITOR_MACRO_REGIONS,
      preferences: { ...data.preferences }
    }
  }
}
