/**
 * HELIOXEN AI — Step 38: World Monitor, Interactive Globe, Geographic Maps, and News Intelligence
 * Shared domain types for geospatial projections, coordinate validation, gazetteer lookup,
 * news source adapters, article normalization, story clustering, freshness/caching,
 * and factual integrity boundaries.
 */

export const WORLD_MONITOR_SCHEMA_VERSION = 1
export const DEFAULT_WORLD_MONITOR_PROFILE_ID = 'default-profile'

// ============================================================================
// 1. GEOGRAPHIC, PROJECTION & GAZETTEER TYPES
// ============================================================================

export type MapProjectionMode = 'globe_3d' | 'flat_map_2d'

export type GeographicRegionId =
  | 'global'
  | 'north_america'
  | 'south_america'
  | 'europe'
  | 'middle_east_north_africa'
  | 'sub_saharan_africa'
  | 'south_central_asia'
  | 'east_southeast_asia'
  | 'oceania'
  | 'polar_maritime'

export interface GeographicCoordinates {
  /** Latitude in decimal degrees [-90, 90] */
  readonly latitude: number
  /** Longitude in decimal degrees [-180, 180] */
  readonly longitude: number
}

export interface GeographicBoundingBox {
  readonly minLatitude: number
  readonly maxLatitude: number
  readonly minLongitude: number
  readonly maxLongitude: number
}

export type GeographicAssociationType =
  | 'event_location'
  | 'mentioned_location'
  | 'country_level'
  | 'region_level'
  | 'publication_origin'
  | 'unresolved'

export type GeographicPrecisionLevel = 'city_or_point' | 'country' | 'macro_region' | 'none'

export interface ArticleGeographicAssociation {
  readonly associationType: GeographicAssociationType
  readonly precision: GeographicPrecisionLevel
  readonly placeName: string | null
  readonly countryCode: string | null
  readonly countryName: string | null
  readonly regionId: GeographicRegionId
  /** Validated coordinates only when associationType and precision justify map plotting */
  readonly coordinates: GeographicCoordinates | null
  /** Explicit human-readable explanation of why/how this location is associated */
  readonly basisNote: string
  /** Whether this association is suitable for plotting as a map marker */
  readonly plottableOnMap: boolean
}

export interface GazetteerLocationEntry {
  readonly id: string
  readonly name: string
  readonly aliases: readonly string[]
  readonly kind: 'city' | 'country' | 'region' | 'point_of_interest'
  readonly countryCode: string | null
  readonly countryName: string | null
  readonly regionId: GeographicRegionId
  readonly coordinates: GeographicCoordinates
  readonly zoomLevel: number
}

export interface LocationSearchResult {
  readonly query: string
  readonly candidates: readonly GazetteerLocationEntry[]
  readonly isAmbiguous: boolean
}

// ============================================================================
// 2. MAP PROVIDER, ATTRIBUTION & CAMERA STATE
// ============================================================================

export interface MapProviderConfig {
  readonly providerId: 'helioxen-natural-earth-vector' | 'custom-tile-provider'
  readonly displayName: string
  readonly licenseName: string
  readonly attributionText: string
  readonly attributionUrl: string
  readonly requiresApiKey: boolean
  readonly isConfigured: boolean
  readonly supportsGlobe3D: boolean
  readonly supportsFlatMap2D: boolean
  readonly offlineCapable: boolean
  readonly tilePolicyNote: string
}

export interface MapCameraViewport {
  readonly projection: MapProjectionMode
  readonly center: GeographicCoordinates
  readonly zoom: number
  readonly autoRotateGlobe: boolean
}

export interface MapMarkerItem {
  readonly markerId: string
  readonly coordinates: GeographicCoordinates
  readonly label: string
  readonly associationType: GeographicAssociationType
  readonly precision: GeographicPrecisionLevel
  readonly regionId: GeographicRegionId
  readonly articleIds: readonly string[]
  readonly clusterId: string | null
  readonly isCluster: boolean
  readonly articleCount: number
  readonly primaryHeadline: string
  readonly primarySourceName: string
  readonly latestPublishedAt: number | null
}

// ============================================================================
// 3. NEWS SOURCES, ARTICLES, PROVENANCE & CLUSTERING
// ============================================================================

export type NewsCategory =
  | 'world'
  | 'technology'
  | 'science'
  | 'economy'
  | 'environment'
  | 'policy'
  | 'general'

export type NewsSourceKind = 'public_api' | 'authorized_rss_atom' | 'curated_reference_feed'

export type NewsSourceHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'rate_limited' | 'unconfigured'

export interface NewsSourceDescriptor {
  readonly sourceId: string
  readonly displayName: string
  readonly kind: NewsSourceKind
  readonly homepageUrl: string
  readonly endpointUrl: string
  readonly attributionRequirement: string
  readonly licenseAndTermsSummary: string
  readonly maxRetentionHours: number
  readonly minRefreshIntervalMs: number
  readonly allowsExcerptStorage: boolean
  readonly allowsFullTextStorage: false
  readonly enabled: boolean
  readonly status: NewsSourceHealthStatus
  readonly lastAttemptAt: number | null
  readonly lastSuccessAt: number | null
  readonly lastErrorMessage: string | null
  readonly consecutiveFailures: number
}

export type ArticleVerificationPosture =
  | 'single_source_report'
  | 'multi_source_reported_unverified'
  | 'official_release_reported'

export type ArticleContentStatus = 'headline_only' | 'metadata_and_excerpt' | 'incomplete_metadata'

export interface NewsArticleProvenance {
  readonly sourceId: string
  readonly sourceName: string
  readonly sourceKind: NewsSourceKind
  readonly attributionText: string
  readonly retrievedAt: number
  readonly retrievalMethod: 'live_network' | 'local_cache' | 'controlled_fixture'
  readonly isSyndicatedCopy: boolean
  readonly syndicationOriginName?: string
  readonly verificationPosture: ArticleVerificationPosture
  readonly verificationDisclaimer: string
}

export interface NormalizedNewsArticle {
  readonly id: string
  readonly sourceId: string
  readonly sourceArticleId: string | null
  readonly sourceName: string
  readonly headline: string
  readonly summary: string | null
  readonly isAiGeneratedSummary: boolean
  readonly canonicalUrl: string
  /** Source-reported publication timestamp (ms epoch) or null if source omitted/malformed */
  readonly publishedAt: number | null
  readonly publishedAtStatus: 'verified_source_timestamp' | 'missing_from_source'
  /** Source update timestamp when provided */
  readonly updatedAt: number | null
  /** Timestamp when HELIOXEN retrieved the record */
  readonly retrievedAt: number
  readonly language: string
  readonly category: NewsCategory
  readonly author: string | null
  readonly imageUrl: string | null
  readonly geographicAssociation: ArticleGeographicAssociation
  readonly provenance: NewsArticleProvenance
  readonly contentStatus: ArticleContentStatus
  readonly clusterId: string | null
  readonly bookmarked: boolean
  readonly schemaVersion: number
}

export interface NewsStoryCluster {
  readonly clusterId: string
  readonly normalizedTopicLabel: string
  readonly memberArticleIds: readonly string[]
  readonly distinctSourceNames: readonly string[]
  readonly hasSyndicatedDuplicates: boolean
  readonly primaryArticleId: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly groupingMethod: 'deterministic_headline_token_overlap' | 'canonical_url_match'
  readonly corroborationNote: string
}

// ============================================================================
// 4. SEARCH, FILTERING, FRESHNESS & WORKSPACE SNAPSHOT
// ============================================================================

export type NewsTimeRangeFilter = 'all' | '24h' | '7d' | '30d'
export type NewsSortOrder = 'published_desc' | 'retrieved_desc' | 'source_asc'
export type NewsGeographicFilterMode = 'all_articles' | 'map_plottable_only' | 'unresolved_only'

export interface WorldMonitorFilterQuery {
  readonly profileId?: string
  readonly searchQuery?: string
  readonly category?: NewsCategory | 'all'
  readonly sourceId?: string | 'all'
  readonly regionId?: GeographicRegionId | 'all'
  readonly timeRange?: NewsTimeRangeFilter
  readonly geographicMode?: NewsGeographicFilterMode
  readonly clusterId?: string
  readonly bookmarkedOnly?: boolean
  readonly sortBy?: NewsSortOrder
  readonly page?: number
  readonly pageSize?: number
}

export type FeedFreshnessState = 'live_fresh' | 'cached_recent' | 'cached_stale' | 'partial_failure' | 'offline_cached' | 'empty'

export interface WorldMonitorRefreshResult {
  readonly refreshedAt: number
  readonly freshnessState: FeedFreshnessState
  readonly totalArticles: number
  readonly newArticlesCount: number
  readonly deduplicatedCount: number
  readonly clusterCount: number
  readonly sourceStatuses: readonly NewsSourceDescriptor[]
  readonly warnings: readonly string[]
}

export interface WorldMonitorPreferences {
  readonly defaultProjection: MapProjectionMode
  readonly defaultCenter: GeographicCoordinates
  readonly defaultZoom: number
  readonly autoRotateGlobe: boolean
  readonly autoCenterOnArticleSelect: boolean
  readonly enableStoryClustering: boolean
  readonly enableMapMarkerClustering: boolean
  readonly preferredRegionId: GeographicRegionId | 'all'
  readonly preferredCategory: NewsCategory | 'all'
  readonly preferredTimeRange: NewsTimeRangeFilter
  readonly refreshIntervalMinutes: number
}

export const DEFAULT_WORLD_MONITOR_PREFERENCES: WorldMonitorPreferences = {
  defaultProjection: 'globe_3d',
  defaultCenter: { latitude: 20, longitude: 0 },
  defaultZoom: 1.5,
  autoRotateGlobe: false,
  autoCenterOnArticleSelect: true,
  enableStoryClustering: true,
  enableMapMarkerClustering: true,
  preferredRegionId: 'all',
  preferredCategory: 'all',
  preferredTimeRange: 'all',
  refreshIntervalMinutes: 15
}

export interface WorldMonitorQueryResult {
  readonly articles: readonly NormalizedNewsArticle[]
  readonly totalMatchingCount: number
  readonly page: number
  readonly pageSize: number
  readonly hasMore: boolean
  readonly clusters: readonly NewsStoryCluster[]
  readonly markers: readonly MapMarkerItem[]
  readonly freshnessState: FeedFreshnessState
  readonly lastSuccessfulRefreshAt: number | null
}

export interface WorldMonitorOverviewSnapshot {
  readonly profileId: string
  readonly mapProvider: MapProviderConfig
  readonly sources: readonly NewsSourceDescriptor[]
  readonly queryResult: WorldMonitorQueryResult
  readonly regions: readonly {
    id: GeographicRegionId
    label: string
    center: GeographicCoordinates
    zoom: number
  }[]
  readonly preferences: WorldMonitorPreferences
}

