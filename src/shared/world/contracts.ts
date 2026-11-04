/**
 * HELIOXEN AI — Step 38: World Monitor Contracts, Coordinate Validation, Gazetteer,
 * URL Sanitization, Deterministic Deduplication, Story Clustering, and Marker Aggregation.
 */

import { z } from 'zod'
import {
  ArticleGeographicAssociation,
  DEFAULT_WORLD_MONITOR_PREFERENCES,
  DEFAULT_WORLD_MONITOR_PROFILE_ID,
  GazetteerLocationEntry,
  GeographicAssociationType,
  GeographicCoordinates,
  GeographicRegionId,
  LocationSearchResult,
  MapMarkerItem,
  MapProviderConfig,
  NewsCategory,
  NewsStoryCluster,
  NormalizedNewsArticle
} from './types'

export const WorldMonitorProfileIdSchema = z
  .string()
  .trim()
  .min(1, 'Profile ID cannot be empty')
  .max(80, 'Profile ID exceeds maximum length')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Profile ID contains invalid characters')
  .default(DEFAULT_WORLD_MONITOR_PROFILE_ID)

export const GeographicCoordinatesSchema = z
  .object({
    latitude: z
      .number()
      .finite('Latitude must be a finite number')
      .min(-90, 'Latitude must be >= -90')
      .max(90, 'Latitude must be <= 90'),
    longitude: z
      .number()
      .finite('Longitude must be a finite number')
      .min(-180, 'Longitude must be >= -180')
      .max(180, 'Longitude must be <= 180')
  })
  .strict()

export const GeographicRegionIdSchema = z.enum([
  'global',
  'north_america',
  'south_america',
  'europe',
  'middle_east_north_africa',
  'sub_saharan_africa',
  'south_central_asia',
  'east_southeast_asia',
  'oceania',
  'polar_maritime'
])

export const NewsCategorySchema = z.enum([
  'world',
  'technology',
  'science',
  'economy',
  'environment',
  'policy',
  'general'
])

export const WorldMonitorFilterQuerySchema = z
  .object({
    profileId: WorldMonitorProfileIdSchema.optional(),
    searchQuery: z.string().trim().max(240).optional(),
    category: z
      .enum(['all', 'world', 'technology', 'science', 'economy', 'environment', 'policy', 'general'])
      .default('all'),
    sourceId: z.string().trim().min(1).max(120).default('all'),
    regionId: z
      .enum([
        'all',
        'global',
        'north_america',
        'south_america',
        'europe',
        'middle_east_north_africa',
        'sub_saharan_africa',
        'south_central_asia',
        'east_southeast_asia',
        'oceania',
        'polar_maritime'
      ])
      .default('all'),
    timeRange: z.enum(['all', '24h', '7d', '30d']).default('all'),
    geographicMode: z
      .enum(['all_articles', 'map_plottable_only', 'unresolved_only'])
      .default('all_articles'),
    clusterId: z.string().trim().max(120).optional(),
    bookmarkedOnly: z.boolean().default(false),
    sortBy: z.enum(['published_desc', 'retrieved_desc', 'source_asc']).default('published_desc'),
    page: z.number().int().min(1).max(500).default(1),
    pageSize: z.number().int().min(1).max(100).default(25)
  })
  .strict()

export const WorldMonitorRefreshRequestSchema = z
  .object({
    profileId: WorldMonitorProfileIdSchema.optional(),
    sourceIds: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    searchQuery: z.string().trim().max(200).optional(),
    forceRefresh: z.boolean().default(false)
  })
  .strict()

export const LocationSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(160),
    limit: z.number().int().min(1).max(25).default(10)
  })
  .strict()

export const ToggleArticleBookmarkRequestSchema = z
  .object({
    profileId: WorldMonitorProfileIdSchema.optional(),
    articleId: z.string().trim().min(1).max(160),
    bookmarked: z.boolean()
  })
  .strict()

export const OpenArticleSourceUrlRequestSchema = z
  .object({
    articleId: z.string().trim().min(1).max(160).optional(),
    url: z.string().trim().min(1).max(2048)
  })
  .strict()

export const WorldMonitorPreferencesSchema = z
  .object({
    defaultProjection: z.enum(['globe_3d', 'flat_map_2d']).default(
      DEFAULT_WORLD_MONITOR_PREFERENCES.defaultProjection
    ),
    defaultCenter: GeographicCoordinatesSchema.default(
      DEFAULT_WORLD_MONITOR_PREFERENCES.defaultCenter
    ),
    defaultZoom: z
      .number()
      .min(0.5)
      .max(12)
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.defaultZoom),
    autoRotateGlobe: z
      .boolean()
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.autoRotateGlobe),
    autoCenterOnArticleSelect: z
      .boolean()
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.autoCenterOnArticleSelect),
    enableStoryClustering: z
      .boolean()
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.enableStoryClustering),
    enableMapMarkerClustering: z
      .boolean()
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.enableMapMarkerClustering),
    preferredRegionId: z
      .enum([
        'all',
        'global',
        'north_america',
        'south_america',
        'europe',
        'middle_east_north_africa',
        'sub_saharan_africa',
        'south_central_asia',
        'east_southeast_asia',
        'oceania',
        'polar_maritime'
      ])
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.preferredRegionId),
    preferredCategory: z
      .enum(['all', 'world', 'technology', 'science', 'economy', 'environment', 'policy', 'general'])
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.preferredCategory),
    preferredTimeRange: z
      .enum(['all', '24h', '7d', '30d'])
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.preferredTimeRange),
    refreshIntervalMinutes: z
      .number()
      .int()
      .min(5)
      .max(240)
      .default(DEFAULT_WORLD_MONITOR_PREFERENCES.refreshIntervalMinutes)
  })
  .strict()

// ============================================================================
// 1. DEFAULT MAP PROVIDER & MACRO REGIONS
// ============================================================================

export const DEFAULT_MAP_PROVIDER_CONFIG: MapProviderConfig = {
  providerId: 'helioxen-natural-earth-vector',
  displayName: 'HELIOXEN Vector Basemap (Natural Earth 1:110m Public Domain)',
  licenseName: 'Public Domain (Natural Earth)',
  attributionText:
    'Map geometry © Natural Earth (Public Domain) • News metadata attributed to respective publishers',
  attributionUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  requiresApiKey: false,
  isConfigured: true,
  supportsGlobe3D: true,
  supportsFlatMap2D: true,
  offlineCapable: true,
  tilePolicyNote:
    'Uses local public-domain Natural Earth vector land/graticule geometry; performs zero unauthorized bulk tile scraping from community OpenStreetMap tile servers.'
}

export const WORLD_MONITOR_MACRO_REGIONS: readonly {
  id: GeographicRegionId
  label: string
  center: GeographicCoordinates
  zoom: number
}[] = [
  { id: 'global', label: 'Global Extent', center: { latitude: 20, longitude: 0 }, zoom: 1.5 },
  {
    id: 'north_america',
    label: 'North America',
    center: { latitude: 40, longitude: -98 },
    zoom: 3.0
  },
  {
    id: 'south_america',
    label: 'South America',
    center: { latitude: -15, longitude: -60 },
    zoom: 3.0
  },
  { id: 'europe', label: 'Europe', center: { latitude: 50, longitude: 12 }, zoom: 3.5 },
  {
    id: 'middle_east_north_africa',
    label: 'Middle East & North Africa',
    center: { latitude: 27, longitude: 30 },
    zoom: 3.2
  },
  {
    id: 'sub_saharan_africa',
    label: 'Sub-Saharan Africa',
    center: { latitude: -2, longitude: 22 },
    zoom: 3.0
  },
  {
    id: 'south_central_asia',
    label: 'South & Central Asia',
    center: { latitude: 26, longitude: 76 },
    zoom: 3.2
  },
  {
    id: 'east_southeast_asia',
    label: 'East & Southeast Asia',
    center: { latitude: 25, longitude: 118 },
    zoom: 3.0
  },
  { id: 'oceania', label: 'Oceania', center: { latitude: -25, longitude: 138 }, zoom: 3.2 },
  {
    id: 'polar_maritime',
    label: 'Polar & Maritime',
    center: { latitude: 68, longitude: -20 },
    zoom: 2.5
  }
] as const

// ============================================================================
// 2. COORDINATE & URL VALIDATION
// ============================================================================

/**
 * Strictly validates latitude [-90, 90] and longitude [-180, 180].
 * Rejects NaN, Infinity, strings, swapped lat/lon out of bounds, or nullisland coercion.
 */
export function validateGeographicCoordinates(
  rawLat: unknown,
  rawLon: unknown
): { valid: boolean; coordinates: GeographicCoordinates | null; error?: string } {
  if (typeof rawLat !== 'number' || typeof rawLon !== 'number') {
    return {
      valid: false,
      coordinates: null,
      error: 'Coordinates must be explicit numeric latitude and longitude values.'
    }
  }
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return {
      valid: false,
      coordinates: null,
      error: 'Coordinates must be finite numbers.'
    }
  }
  if (rawLat < -90 || rawLat > 90) {
    return {
      valid: false,
      coordinates: null,
      error: `Latitude ${rawLat} is out of valid range [-90, 90]. Check whether latitude and longitude were swapped.`
    }
  }
  if (rawLon < -180 || rawLon > 180) {
    return {
      valid: false,
      coordinates: null,
      error: `Longitude ${rawLon} is out of valid range [-180, 180].`
    }
  }

  return {
    valid: true,
    coordinates: {
      latitude: Number(rawLat.toFixed(5)),
      longitude: Number(rawLon.toFixed(5))
    }
  }
}

/**
 * Validates and normalizes an external news article URL.
 * Enforces https: or http: schemes and blocks local/private network targets or script URIs.
 */
export function validateAndNormalizeNewsUrl(rawUrl: unknown): {
  valid: boolean
  canonicalUrl: string | null
  error?: string
} {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, canonicalUrl: null, error: 'Article URL is missing or empty.' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { valid: false, canonicalUrl: null, error: 'Malformed article URL.' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      valid: false,
      canonicalUrl: null,
      error: `Unsupported URL scheme "${parsed.protocol}". Only HTTPS/HTTP news links are permitted.`
    }
  }

  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  ) {
    return {
      valid: false,
      canonicalUrl: null,
      error: 'Local, loopback, or private-network URLs are prohibited in news records.'
    }
  }

  // Strip common tracking query parameters while preserving canonical article identifiers
  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'mc_cid',
    'mc_eid'
  ]
  for (const param of trackingParams) {
    parsed.searchParams.delete(param)
  }
  parsed.hash = ''

  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = ''
  }

  return {
    valid: true,
    canonicalUrl: parsed.toString()
  }
}

/**
 * Conservatively parses a source timestamp without substituting retrieval time for publication time.
 */
export function parseConservativeSourceTimestamp(
  rawTimestamp: unknown,
  nowMs: number = Date.now()
): { timestamp: number | null; status: 'verified_source_timestamp' | 'missing_from_source' } {
  if (rawTimestamp === null || rawTimestamp === undefined || rawTimestamp === '') {
    return { timestamp: null, status: 'missing_from_source' }
  }

  let parsedMs: number = NaN
  if (typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)) {
    // Support seconds or milliseconds
    parsedMs = rawTimestamp < 1e11 ? rawTimestamp * 1000 : rawTimestamp
  } else if (typeof rawTimestamp === 'string') {
    const trimmed = rawTimestamp.trim()
    // Support GDELT YYYYMMDDHHMMSS format (e.g., "20261104T120000Z" or "20261104120000")
    const gdeltMatch = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/i.exec(trimmed)
    if (gdeltMatch) {
      const iso = `${gdeltMatch[1]}-${gdeltMatch[2]}-${gdeltMatch[3]}T${gdeltMatch[4]}:${gdeltMatch[5]}:${gdeltMatch[6]}Z`
      parsedMs = Date.parse(iso)
    } else {
      parsedMs = Date.parse(trimmed)
    }
  }

  // Reject impossible dates (before 1990 or more than 24h in the future)
  const minValidMs = Date.UTC(1990, 0, 1)
  const maxValidMs = nowMs + 24 * 60 * 60 * 1000
  if (!Number.isFinite(parsedMs) || parsedMs < minValidMs || parsedMs > maxValidMs) {
    return { timestamp: null, status: 'missing_from_source' }
  }

  return {
    timestamp: Math.round(parsedMs),
    status: 'verified_source_timestamp'
  }
}

// ============================================================================
// 3. BUILT-IN GAZETTEER & CONSERVATIVE GEOGRAPHIC ASSOCIATION
// ============================================================================

export const BUILTIN_GAZETTEER_LOCATIONS: readonly GazetteerLocationEntry[] = [
  // Cities & Major Hubs (including intentional homonyms like Paris, London, Cairo, Springfield for ambiguity testing)
  {
    id: 'loc_city_new_york_us',
    name: 'New York City',
    aliases: ['new york', 'nyc', 'manhattan'],
    kind: 'city',
    countryCode: 'US',
    countryName: 'United States',
    regionId: 'north_america',
    coordinates: { latitude: 40.7128, longitude: -74.006 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_washington_dc_us',
    name: 'Washington, D.C.',
    aliases: ['washington dc', 'washington, d.c.'],
    kind: 'city',
    countryCode: 'US',
    countryName: 'United States',
    regionId: 'north_america',
    coordinates: { latitude: 38.9072, longitude: -77.0369 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_san_francisco_us',
    name: 'San Francisco',
    aliases: ['san francisco', 'silicon valley'],
    kind: 'city',
    countryCode: 'US',
    countryName: 'United States',
    regionId: 'north_america',
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_london_gb',
    name: 'London, United Kingdom',
    aliases: ['london', 'london, uk'],
    kind: 'city',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    regionId: 'europe',
    coordinates: { latitude: 51.5074, longitude: -0.1278 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_london_ca',
    name: 'London, Ontario, Canada',
    aliases: ['london', 'london ontario'],
    kind: 'city',
    countryCode: 'CA',
    countryName: 'Canada',
    regionId: 'north_america',
    coordinates: { latitude: 42.9849, longitude: -81.2453 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_paris_fr',
    name: 'Paris, France',
    aliases: ['paris', 'paris, france'],
    kind: 'city',
    countryCode: 'FR',
    countryName: 'France',
    regionId: 'europe',
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_paris_tx_us',
    name: 'Paris, Texas, United States',
    aliases: ['paris', 'paris texas'],
    kind: 'city',
    countryCode: 'US',
    countryName: 'United States',
    regionId: 'north_america',
    coordinates: { latitude: 33.6609, longitude: -95.5555 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_brussels_be',
    name: 'Brussels',
    aliases: ['brussels'],
    kind: 'city',
    countryCode: 'BE',
    countryName: 'Belgium',
    regionId: 'europe',
    coordinates: { latitude: 50.8503, longitude: 4.3517 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_geneva_ch',
    name: 'Geneva',
    aliases: ['geneva'],
    kind: 'city',
    countryCode: 'CH',
    countryName: 'Switzerland',
    regionId: 'europe',
    coordinates: { latitude: 46.2044, longitude: 6.1432 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_berlin_de',
    name: 'Berlin',
    aliases: ['berlin'],
    kind: 'city',
    countryCode: 'DE',
    countryName: 'Germany',
    regionId: 'europe',
    coordinates: { latitude: 52.52, longitude: 13.405 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_kyiv_ua',
    name: 'Kyiv',
    aliases: ['kyiv', 'kiev'],
    kind: 'city',
    countryCode: 'UA',
    countryName: 'Ukraine',
    regionId: 'europe',
    coordinates: { latitude: 50.4501, longitude: 30.5234 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_cairo_eg',
    name: 'Cairo, Egypt',
    aliases: ['cairo', 'cairo, egypt'],
    kind: 'city',
    countryCode: 'EG',
    countryName: 'Egypt',
    regionId: 'middle_east_north_africa',
    coordinates: { latitude: 30.0444, longitude: 31.2357 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_dubai_ae',
    name: 'Dubai',
    aliases: ['dubai'],
    kind: 'city',
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    regionId: 'middle_east_north_africa',
    coordinates: { latitude: 25.2048, longitude: 55.2708 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_nairobi_ke',
    name: 'Nairobi',
    aliases: ['nairobi'],
    kind: 'city',
    countryCode: 'KE',
    countryName: 'Kenya',
    regionId: 'sub_saharan_africa',
    coordinates: { latitude: -1.2921, longitude: 36.8219 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_new_delhi_in',
    name: 'New Delhi',
    aliases: ['new delhi', 'delhi'],
    kind: 'city',
    countryCode: 'IN',
    countryName: 'India',
    regionId: 'south_central_asia',
    coordinates: { latitude: 28.6139, longitude: 77.209 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_islamabad_pk',
    name: 'Islamabad',
    aliases: ['islamabad'],
    kind: 'city',
    countryCode: 'PK',
    countryName: 'Pakistan',
    regionId: 'south_central_asia',
    coordinates: { latitude: 33.6844, longitude: 73.0479 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_tokyo_jp',
    name: 'Tokyo',
    aliases: ['tokyo'],
    kind: 'city',
    countryCode: 'JP',
    countryName: 'Japan',
    regionId: 'east_southeast_asia',
    coordinates: { latitude: 35.6762, longitude: 139.6503 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_seoul_kr',
    name: 'Seoul',
    aliases: ['seoul'],
    kind: 'city',
    countryCode: 'KR',
    countryName: 'South Korea',
    regionId: 'east_southeast_asia',
    coordinates: { latitude: 37.5665, longitude: 126.978 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_singapore_sg',
    name: 'Singapore',
    aliases: ['singapore'],
    kind: 'city',
    countryCode: 'SG',
    countryName: 'Singapore',
    regionId: 'east_southeast_asia',
    coordinates: { latitude: 1.3521, longitude: 103.8198 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_beijing_cn',
    name: 'Beijing',
    aliases: ['beijing'],
    kind: 'city',
    countryCode: 'CN',
    countryName: 'China',
    regionId: 'east_southeast_asia',
    coordinates: { latitude: 39.9042, longitude: 116.4074 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_sydney_au',
    name: 'Sydney',
    aliases: ['sydney'],
    kind: 'city',
    countryCode: 'AU',
    countryName: 'Australia',
    regionId: 'oceania',
    coordinates: { latitude: -33.8688, longitude: 151.2093 },
    zoomLevel: 6
  },
  {
    id: 'loc_city_suva_fj',
    name: 'Suva, Fiji (Antimeridian Pacific)',
    aliases: ['suva', 'fiji'],
    kind: 'city',
    countryCode: 'FJ',
    countryName: 'Fiji',
    regionId: 'oceania',
    coordinates: { latitude: -18.1416, longitude: 178.4419 },
    zoomLevel: 5
  },
  {
    id: 'loc_city_sao_paulo_br',
    name: 'São Paulo',
    aliases: ['sao paulo', 'são paulo'],
    kind: 'city',
    countryCode: 'BR',
    countryName: 'Brazil',
    regionId: 'south_america',
    coordinates: { latitude: -23.5505, longitude: -46.6333 },
    zoomLevel: 6
  },
  // Countries (Country centroids — explicitly labeled as country-level, NEVER misrepresented as exact city/incident points)
  {
    id: 'loc_country_us',
    name: 'United States',
    aliases: ['united states', 'usa', 'u.s.'],
    kind: 'country',
    countryCode: 'US',
    countryName: 'United States',
    regionId: 'north_america',
    coordinates: { latitude: 39.8283, longitude: -98.5795 },
    zoomLevel: 3.5
  },
  {
    id: 'loc_country_gb',
    name: 'United Kingdom',
    aliases: ['united kingdom', 'uk', 'britain'],
    kind: 'country',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    regionId: 'europe',
    coordinates: { latitude: 54.7024, longitude: -3.2766 },
    zoomLevel: 4.5
  },
  {
    id: 'loc_country_de',
    name: 'Germany',
    aliases: ['germany'],
    kind: 'country',
    countryCode: 'DE',
    countryName: 'Germany',
    regionId: 'europe',
    coordinates: { latitude: 51.1657, longitude: 10.4515 },
    zoomLevel: 4.5
  },
  {
    id: 'loc_country_fr',
    name: 'France',
    aliases: ['france'],
    kind: 'country',
    countryCode: 'FR',
    countryName: 'France',
    regionId: 'europe',
    coordinates: { latitude: 46.2276, longitude: 2.2137 },
    zoomLevel: 4.5
  },
  {
    id: 'loc_country_jp',
    name: 'Japan',
    aliases: ['japan'],
    kind: 'country',
    countryCode: 'JP',
    countryName: 'Japan',
    regionId: 'east_southeast_asia',
    coordinates: { latitude: 36.2048, longitude: 138.2529 },
    zoomLevel: 4.5
  },
  {
    id: 'loc_country_in',
    name: 'India',
    aliases: ['india'],
    kind: 'country',
    countryCode: 'IN',
    countryName: 'India',
    regionId: 'south_central_asia',
    coordinates: { latitude: 20.5937, longitude: 78.9629 },
    zoomLevel: 4.0
  },
  {
    id: 'loc_country_pk',
    name: 'Pakistan',
    aliases: ['pakistan'],
    kind: 'country',
    countryCode: 'PK',
    countryName: 'Pakistan',
    regionId: 'south_central_asia',
    coordinates: { latitude: 30.3753, longitude: 69.3451 },
    zoomLevel: 4.5
  },
  {
    id: 'loc_country_br',
    name: 'Brazil',
    aliases: ['brazil'],
    kind: 'country',
    countryCode: 'BR',
    countryName: 'Brazil',
    regionId: 'south_america',
    coordinates: { latitude: -14.235, longitude: -51.9253 },
    zoomLevel: 3.5
  },
  {
    id: 'loc_country_au',
    name: 'Australia',
    aliases: ['australia'],
    kind: 'country',
    countryCode: 'AU',
    countryName: 'Australia',
    regionId: 'oceania',
    coordinates: { latitude: -25.2744, longitude: 133.7751 },
    zoomLevel: 3.5
  }
] as const

/**
 * Searches the local gazetteer and returns all matching candidates.
 * If multiple distinct places match the same query (e.g., "London" or "Paris"),
 * marks `isAmbiguous: true` so the UI presents candidates instead of guessing.
 */
export function searchGazetteerLocations(
  rawQuery: string,
  limit: number = 10
): LocationSearchResult {
  const q = rawQuery.trim().toLowerCase()
  if (!q) {
    return { query: rawQuery, candidates: [], isAmbiguous: false }
  }

  const exactMatches: GazetteerLocationEntry[] = []
  const partialMatches: GazetteerLocationEntry[] = []

  for (const entry of BUILTIN_GAZETTEER_LOCATIONS) {
    const nameLower = entry.name.toLowerCase()
    const isExact =
      nameLower === q || entry.aliases.some((alias) => alias.toLowerCase() === q)
    if (isExact) {
      exactMatches.push(entry)
    } else if (
      nameLower.includes(q) ||
      entry.aliases.some((alias) => alias.toLowerCase().includes(q)) ||
      (entry.countryName && entry.countryName.toLowerCase().includes(q))
    ) {
      partialMatches.push(entry)
    }
  }

  const combined = [...exactMatches, ...partialMatches].slice(0, limit)
  const isAmbiguous = exactMatches.length > 1 || (exactMatches.length === 0 && combined.length > 1)

  return {
    query: rawQuery.trim(),
    candidates: combined,
    isAmbiguous
  }
}

/**
 * Resolves a conservative `ArticleGeographicAssociation` from structured source metadata.
 * NEVER fabricates coordinates from headlines when structured geographic evidence is absent or ambiguous.
 */
export function resolveConservativeGeographicAssociation(input: {
  explicitLatitude?: unknown
  explicitLongitude?: unknown
  explicitPlaceName?: string | null
  explicitCountryCode?: string | null
  explicitCountryName?: string | null
  explicitAssociationType?: GeographicAssociationType
}): ArticleGeographicAssociation {
  // Case 1: Explicit coordinates supplied by the structured source
  if (input.explicitLatitude !== undefined && input.explicitLongitude !== undefined) {
    const coordCheck = validateGeographicCoordinates(
      input.explicitLatitude,
      input.explicitLongitude
    )
    if (coordCheck.valid && coordCheck.coordinates) {
      const assocType = input.explicitAssociationType ?? 'event_location'
      const isCountryLevel = assocType === 'country_level'
      const isPubOrigin = assocType === 'publication_origin'
      return {
        associationType: assocType,
        precision: isCountryLevel ? 'country' : 'city_or_point',
        placeName: input.explicitPlaceName?.trim() || null,
        countryCode: input.explicitCountryCode?.trim().toUpperCase() || null,
        countryName: input.explicitCountryName?.trim() || null,
        regionId: inferMacroRegionFromCoordinates(coordCheck.coordinates),
        coordinates: coordCheck.coordinates,
        basisNote: isCountryLevel
          ? `Country-level geographic association (${input.explicitCountryName || input.explicitPlaceName || 'country centroid'}); not a precise incident coordinate.`
          : isPubOrigin
            ? `Location of reporting publication (${input.explicitPlaceName || 'publisher'}); not plotted as an event marker.`
            : `Structured geographic coordinates supplied by source (${input.explicitPlaceName || 'verified point'}).`,
        plottableOnMap: !isPubOrigin
      }
    }
  }

  // Case 2: Structured place name supplied by source metadata
  if (input.explicitPlaceName && input.explicitPlaceName.trim()) {
    const search = searchGazetteerLocations(input.explicitPlaceName.trim(), 5)
    // Only resolve to coordinates if unambiguous OR disambiguated by explicitCountryCode
    let matched: GazetteerLocationEntry | undefined
    if (search.candidates.length === 1) {
      matched = search.candidates[0]
    } else if (search.candidates.length > 1 && input.explicitCountryCode) {
      const cc = input.explicitCountryCode.trim().toUpperCase()
      const filtered = search.candidates.filter((c) => c.countryCode === cc)
      if (filtered.length === 1) {
        matched = filtered[0]
      }
    }

    if (matched) {
      const isCountry = matched.kind === 'country'
      const assocType: GeographicAssociationType =
        input.explicitAssociationType ?? (isCountry ? 'country_level' : 'mentioned_location')
      return {
        associationType: assocType,
        precision: isCountry ? 'country' : 'city_or_point',
        placeName: matched.name,
        countryCode: matched.countryCode,
        countryName: matched.countryName,
        regionId: matched.regionId,
        coordinates: matched.coordinates,
        basisNote: isCountry
          ? `Country-level association (${matched.name}). Displayed at country centroid; does not represent a specific street or city incident.`
          : `Resolved from structured source location tag "${input.explicitPlaceName.trim()}" (${matched.name}).`,
        plottableOnMap: assocType !== 'publication_origin'
      }
    }

    // Ambiguous place name (e.g., "Paris" or "London" without country disambiguation)
    if (search.isAmbiguous) {
      return {
        associationType: 'unresolved',
        precision: 'none',
        placeName: input.explicitPlaceName.trim(),
        countryCode: input.explicitCountryCode?.trim().toUpperCase() || null,
        countryName: input.explicitCountryName?.trim() || null,
        regionId: 'global',
        coordinates: null,
        basisNote: `Ambiguous location reference "${input.explicitPlaceName.trim()}" matches multiple places; kept in feed without plotting an arbitrary marker.`,
        plottableOnMap: false
      }
    }
  }

  // Case 3: Structured country code or country name only
  if (input.explicitCountryCode || input.explicitCountryName) {
    const cc = input.explicitCountryCode?.trim().toUpperCase()
    const cn = input.explicitCountryName?.trim().toLowerCase()
    const countryEntry = BUILTIN_GAZETTEER_LOCATIONS.find(
      (loc) =>
        loc.kind === 'country' &&
        ((cc && loc.countryCode === cc) || (cn && loc.name.toLowerCase() === cn))
    )
    if (countryEntry) {
      return {
        associationType: 'country_level',
        precision: 'country',
        placeName: countryEntry.name,
        countryCode: countryEntry.countryCode,
        countryName: countryEntry.countryName,
        regionId: countryEntry.regionId,
        coordinates: countryEntry.coordinates,
        basisNote: `Country-level association (${countryEntry.name}); represents national scope and is not a precise incident point.`,
        plottableOnMap: true
      }
    }
  }

  // Default: Unresolved location — article remains visible in the news feed without a map marker
  return {
    associationType: 'unresolved',
    precision: 'none',
    placeName: null,
    countryCode: null,
    countryName: null,
    regionId: 'global',
    coordinates: null,
    basisNote: 'No unambiguous geographic coordinates or structured location metadata supplied by source.',
    plottableOnMap: false
  }
}

export function inferMacroRegionFromCoordinates(
  coords: GeographicCoordinates
): GeographicRegionId {
  const { latitude: lat, longitude: lon } = coords
  if (lat > 66 || lat < -60) return 'polar_maritime'
  if (lon >= -170 && lon <= -30) {
    return lat >= 12 ? 'north_america' : 'south_america'
  }
  if (lon > -30 && lon <= 60) {
    if (lat >= 35) return 'europe'
    if (lat >= 15) return 'middle_east_north_africa'
    return 'sub_saharan_africa'
  }
  if (lon > 60 && lon <= 95 && lat >= 5 && lat <= 45) {
    return 'south_central_asia'
  }
  if (lon > 95 && lon <= 180 && lat >= -12) {
    return 'east_southeast_asia'
  }
  if (lon > 110 && lat < -12) {
    return 'oceania'
  }
  return 'global'
}

// ============================================================================
// 4. DETERMINISTIC DEDUPLICATION, STORY CLUSTERING & MARKER CLUSTERING
// ============================================================================

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'over',
  'after',
  'before',
  'under',
  'about',
  'amid',
  'says',
  'report',
  'reports',
  'news',
  'update',
  'global',
  'world',
  'new'
])

export function extractSignificantHeadlineTokens(headline: string): string[] {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
}

/**
 * Deduplicates exact repeats from the SAME source (by sourceArticleId or identical canonicalUrl)
 * while strictly preserving articles from DIFFERENT sources so distinct publisher attributions are never erased.
 */
export function deduplicateSourceArticles(articles: readonly NormalizedNewsArticle[]): {
  deduplicated: NormalizedNewsArticle[]
  removedDuplicateCount: number
} {
  const seenSameSourceKeys = new Set<string>()
  const deduplicated: NormalizedNewsArticle[] = []
  let removedDuplicateCount = 0

  for (const article of articles) {
    const sameSourceUrlKey = `${article.sourceId}::url::${article.canonicalUrl}`
    const sameSourceIdKey = article.sourceArticleId
      ? `${article.sourceId}::id::${article.sourceArticleId}`
      : null

    if (
      seenSameSourceKeys.has(sameSourceUrlKey) ||
      (sameSourceIdKey && seenSameSourceKeys.has(sameSourceIdKey))
    ) {
      removedDuplicateCount++
      continue
    }

    seenSameSourceKeys.add(sameSourceUrlKey)
    if (sameSourceIdKey) {
      seenSameSourceKeys.add(sameSourceIdKey)
    }
    deduplicated.push(article)
  }

  return { deduplicated, removedDuplicateCount }
}

/**
 * Groups related reports across sources into deterministic `NewsStoryCluster` objects
 * without deleting or merging the underlying source records and without claiming verification.
 */
export function buildDeterministicStoryClusters(
  articles: readonly NormalizedNewsArticle[],
  nowMs: number = Date.now()
): {
  articlesWithClusterIds: NormalizedNewsArticle[]
  clusters: NewsStoryCluster[]
} {
  if (articles.length === 0) {
    return { articlesWithClusterIds: [], clusters: [] }
  }

  const tokenSets = articles.map((a) => new Set(extractSignificantHeadlineTokens(a.headline)))
  const assignedClusterByIndex = new Map<number, string>()
  const clusters: NewsStoryCluster[] = []

  for (let i = 0; i < articles.length; i++) {
    if (assignedClusterByIndex.has(i)) continue

    const baseArticle = articles[i]
    const baseTokens = tokenSets[i]
    const memberIndices: number[] = [i]
    let matchedByUrl = false

    for (let j = i + 1; j < articles.length; j++) {
      if (assignedClusterByIndex.has(j)) continue
      const candidate = articles[j]

      if (candidate.canonicalUrl === baseArticle.canonicalUrl) {
        memberIndices.push(j)
        matchedByUrl = true
        continue
      }

      // Check temporal proximity (within 72 hours if both have timestamps)
      if (
        baseArticle.publishedAt !== null &&
        candidate.publishedAt !== null &&
        Math.abs(baseArticle.publishedAt - candidate.publishedAt) > 72 * 3600 * 1000
      ) {
        continue
      }

      const candTokens = tokenSets[j]
      if (baseTokens.size < 2 || candTokens.size < 2) continue

      let sharedCount = 0
      for (const tok of baseTokens) {
        if (candTokens.has(tok)) sharedCount++
      }
      const minSize = Math.min(baseTokens.size, candTokens.size)
      const overlapRatio = sharedCount / minSize

      if (sharedCount >= 2 && overlapRatio >= 0.5) {
        memberIndices.push(j)
      }
    }

    if (memberIndices.length >= 2) {
      const clusterId = `cluster_${baseArticle.id}`
      const memberArticles = memberIndices.map((idx) => articles[idx])
      for (const idx of memberIndices) {
        assignedClusterByIndex.set(idx, clusterId)
      }

      const distinctSources = Array.from(new Set(memberArticles.map((m) => m.sourceName)))
      const hasSyndicatedDuplicates = memberArticles.some(
        (m, mIdx) =>
          m.provenance.isSyndicatedCopy || (mIdx > 0 && m.canonicalUrl === baseArticle.canonicalUrl)
      )

      clusters.push({
        clusterId,
        normalizedTopicLabel: baseArticle.headline.slice(0, 110),
        memberArticleIds: memberArticles.map((m) => m.id),
        distinctSourceNames: distinctSources,
        hasSyndicatedDuplicates,
        primaryArticleId: baseArticle.id,
        createdAt: nowMs,
        updatedAt: nowMs,
        groupingMethod: matchedByUrl
          ? 'canonical_url_match'
          : 'deterministic_headline_token_overlap',
        corroborationNote:
          hasSyndicatedDuplicates || distinctSources.length <= 1
            ? 'Grouped reports include syndicated or same-origin coverage; multiple entries do not constitute independent verification and are not confirmed fact.'
            : `Grouped across ${distinctSources.length} reporting sources (${distinctSources.join(', ')}) by headline topic similarity. Appearance in multiple sources indicates shared coverage, not confirmed fact.`
      })
    }
  }

  const articlesWithClusterIds = articles.map((art, idx) => {
    const cId = assignedClusterByIndex.get(idx) ?? null
    const cluster = cId ? clusters.find((c) => c.clusterId === cId) : undefined
    const posture =
      cluster && cluster.distinctSourceNames.length > 1 && !cluster.hasSyndicatedDuplicates
        ? 'multi_source_reported_unverified'
        : art.provenance.verificationPosture

    return {
      ...art,
      clusterId: cId,
      provenance: {
        ...art.provenance,
        verificationPosture: posture
      }
    }
  })

  return { articlesWithClusterIds, clusters }
}

/**
 * Builds map markers from filtered articles that have valid, plottable coordinates.
 * Supports spatial proximity aggregation when `enableClustering` is true so dense regions remain readable
 * without double-counting articles.
 */
export function buildSynchronizedMapMarkers(
  filteredArticles: readonly NormalizedNewsArticle[],
  enableClustering: boolean = true
): MapMarkerItem[] {
  const plottable = filteredArticles.filter(
    (a) =>
      a.geographicAssociation.plottableOnMap &&
      a.geographicAssociation.coordinates !== null
  )

  if (plottable.length === 0) return []

  if (!enableClustering) {
    return plottable.map((article) => ({
      markerId: `marker_${article.id}`,
      coordinates: article.geographicAssociation.coordinates!,
      label: article.geographicAssociation.placeName || article.sourceName,
      associationType: article.geographicAssociation.associationType,
      precision: article.geographicAssociation.precision,
      regionId: article.geographicAssociation.regionId,
      articleIds: [article.id],
      clusterId: article.clusterId,
      isCluster: false,
      articleCount: 1,
      primaryHeadline: article.headline,
      primarySourceName: article.sourceName,
      latestPublishedAt: article.publishedAt
    }))
  }

  // Group articles within ~1.5 degrees lat/lon bucket to avoid overlapping markers
  const buckets = new Map<string, NormalizedNewsArticle[]>()
  for (const article of plottable) {
    const coords = article.geographicAssociation.coordinates!
    const latBucket = Math.round(coords.latitude / 1.5) * 1.5
    const lonBucket = Math.round(coords.longitude / 1.5) * 1.5
    const key = `${latBucket.toFixed(1)}:${lonBucket.toFixed(1)}`
    const list = buckets.get(key) ?? []
    list.push(article)
    buckets.set(key, list)
  }

  const markers: MapMarkerItem[] = []
  for (const [, group] of buckets.entries()) {
    const primary = group[0]
    const coords = primary.geographicAssociation.coordinates!
    const uniqueArticleIds = Array.from(new Set(group.map((g) => g.id)))
    const latestPublishedAt = group.reduce<number | null>((acc, item) => {
      if (item.publishedAt === null) return acc
      return acc === null ? item.publishedAt : Math.max(acc, item.publishedAt)
    }, null)

    markers.push({
      markerId:
        uniqueArticleIds.length === 1
          ? `marker_${primary.id}`
          : `marker_cluster_${primary.id}`,
      coordinates: coords,
      label:
        primary.geographicAssociation.placeName ||
        primary.geographicAssociation.countryName ||
        'Geographic Marker',
      associationType: primary.geographicAssociation.associationType,
      precision: primary.geographicAssociation.precision,
      regionId: primary.geographicAssociation.regionId,
      articleIds: uniqueArticleIds,
      clusterId: primary.clusterId,
      isCluster: uniqueArticleIds.length > 1,
      articleCount: uniqueArticleIds.length,
      primaryHeadline: primary.headline,
      primarySourceName: primary.sourceName,
      latestPublishedAt
    })
  }

  return markers
}
