/**
 * HELIOXEN AI — Step 38 Test Suite
 * Map Provider Configuration, Coordinate Validation, Gazetteer Disambiguation,
 * Conservative Geographic Association, and Synchronized Marker Clustering.
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MAP_PROVIDER_CONFIG,
  validateGeographicCoordinates,
  searchGazetteerLocations,
  resolveConservativeGeographicAssociation,
  buildSynchronizedMapMarkers,
  WORLD_MONITOR_MACRO_REGIONS,
  NormalizedNewsArticle
} from '../../src/shared/world'

function makeTestArticle(
  id: string,
  headline: string,
  geoInput: Parameters<typeof resolveConservativeGeographicAssociation>[0]
): NormalizedNewsArticle {
  const geo = resolveConservativeGeographicAssociation(geoInput)
  return {
    id,
    sourceId: 'test-source',
    sourceArticleId: id,
    sourceName: 'Test Global Dispatch',
    headline,
    summary: 'Short permitted summary.',
    isAiGeneratedSummary: false,
    canonicalUrl: `https://example.org/news/${id}`,
    publishedAt: 1730000000000,
    publishedAtStatus: 'verified_source_timestamp',
    updatedAt: null,
    retrievedAt: 1730000300000,
    language: 'en',
    category: 'world',
    author: null,
    imageUrl: null,
    geographicAssociation: geo,
    provenance: {
      sourceId: 'test-source',
      sourceName: 'Test Global Dispatch',
      sourceKind: 'public_api',
      attributionText: 'Source: Test Global Dispatch',
      retrievedAt: 1730000300000,
      retrievalMethod: 'controlled_fixture',
      isSyndicatedCopy: false,
      verificationPosture: 'single_source_report',
      verificationDisclaimer: 'Reported by source; not independently verified.'
    },
    contentStatus: 'metadata_and_excerpt',
    clusterId: null,
    bookmarked: false,
    schemaVersion: 1
  }
}

describe('Step 38 — Geospatial Coordinates, Map Provider, Gazetteer & Geographic Associations', () => {
  describe('1. Map Provider Configuration & Attribution (Sections 21.1 & 21.2)', () => {
    it('provides visible attribution, public-domain basemap licensing, and both 3D Globe and 2D Flat Map support without requiring external tile scraping', () => {
      expect(DEFAULT_MAP_PROVIDER_CONFIG.isConfigured).toBe(true)
      expect(DEFAULT_MAP_PROVIDER_CONFIG.requiresApiKey).toBe(false)
      expect(DEFAULT_MAP_PROVIDER_CONFIG.supportsGlobe3D).toBe(true)
      expect(DEFAULT_MAP_PROVIDER_CONFIG.supportsFlatMap2D).toBe(true)
      expect(DEFAULT_MAP_PROVIDER_CONFIG.attributionText).toContain('Natural Earth')
      expect(WORLD_MONITOR_MACRO_REGIONS.length).toBeGreaterThanOrEqual(8)
    })
  })

  describe('2. Strict Coordinate Validation (Sections 7.3 & 21.5)', () => {
    it('accepts valid latitude [-90, 90] and longitude [-180, 180] including antimeridian and polar boundaries', () => {
      const tokyo = validateGeographicCoordinates(35.6762, 139.6503)
      expect(tokyo.valid).toBe(true)
      expect(tokyo.coordinates).toEqual({ latitude: 35.6762, longitude: 139.6503 })

      const antimeridianEast = validateGeographicCoordinates(-18.1416, 179.999)
      expect(antimeridianEast.valid).toBe(true)

      const antimeridianWest = validateGeographicCoordinates(-18.1416, -179.999)
      expect(antimeridianWest.valid).toBe(true)

      const poles = validateGeographicCoordinates(90, 0)
      expect(poles.valid).toBe(true)
    })

    it('rejects out-of-range coordinates, swapped lat/lon, NaN, Infinity, and non-numeric strings', () => {
      // Swapped Tokyo lat/lon (139.6503 as latitude is invalid)
      const swapped = validateGeographicCoordinates(139.6503, 35.6762)
      expect(swapped.valid).toBe(false)
      expect(swapped.coordinates).toBeNull()
      expect(swapped.error).toContain('Latitude')

      const badLon = validateGeographicCoordinates(45, -195)
      expect(badLon.valid).toBe(false)

      const nanCheck = validateGeographicCoordinates(NaN, 10)
      expect(nanCheck.valid).toBe(false)

      const stringCoercionCheck = validateGeographicCoordinates('35.6', '139.6')
      expect(stringCoercionCheck.valid).toBe(false)
    })
  })

  describe('3. Gazetteer Search & Homonym Disambiguation (Sections 7.2 & 21.5)', () => {
    it('identifies unambiguous locations and flags homonyms (e.g., Paris or London) as ambiguous with candidate lists', () => {
      const tokyoRes = searchGazetteerLocations('Tokyo')
      expect(tokyoRes.candidates).toHaveLength(1)
      expect(tokyoRes.isAmbiguous).toBe(false)
      expect(tokyoRes.candidates[0]?.countryCode).toBe('JP')

      const parisRes = searchGazetteerLocations('Paris')
      expect(parisRes.candidates.length).toBeGreaterThanOrEqual(2)
      expect(parisRes.isAmbiguous).toBe(true)
      const countryCodes = parisRes.candidates.map((c) => c.countryCode)
      expect(countryCodes).toContain('FR')
      expect(countryCodes).toContain('US')

      const londonRes = searchGazetteerLocations('London')
      expect(londonRes.candidates.length).toBeGreaterThanOrEqual(2)
      expect(londonRes.isAmbiguous).toBe(true)
    })
  })

  describe('4. Conservative Geographic Association Rules (Sections 12 & 21.5)', () => {
    it('keeps articles with missing or ambiguous location metadata in the feed as unresolved without fabricating coordinates', () => {
      const missingLoc = resolveConservativeGeographicAssociation({})
      expect(missingLoc.associationType).toBe('unresolved')
      expect(missingLoc.coordinates).toBeNull()
      expect(missingLoc.plottableOnMap).toBe(false)

      // Ambiguous "Paris" without country code must NOT guess Paris, France or Paris, Texas
      const ambiguousParis = resolveConservativeGeographicAssociation({
        explicitPlaceName: 'Paris'
      })
      expect(ambiguousParis.associationType).toBe('unresolved')
      expect(ambiguousParis.coordinates).toBeNull()
      expect(ambiguousParis.plottableOnMap).toBe(false)
      expect(ambiguousParis.basisNote).toContain('Ambiguous')

      // Disambiguated "Paris" with explicitCountryCode: 'FR' resolves cleanly
      const disambiguatedParis = resolveConservativeGeographicAssociation({
        explicitPlaceName: 'Paris',
        explicitCountryCode: 'FR'
      })
      expect(disambiguatedParis.plottableOnMap).toBe(true)
      expect(disambiguatedParis.coordinates?.latitude).toBeCloseTo(48.8566, 2)
    })

    it('explicitly labels country-level associations as country centroids rather than exact event coordinates', () => {
      const countryOnly = resolveConservativeGeographicAssociation({
        explicitCountryCode: 'JP',
        explicitCountryName: 'Japan'
      })
      expect(countryOnly.associationType).toBe('country_level')
      expect(countryOnly.precision).toBe('country')
      expect(countryOnly.plottableOnMap).toBe(true)
      expect(countryOnly.basisNote).toContain('Country-level')
      expect(countryOnly.basisNote).toContain('not a precise')
    })

    it('does not plot publication_origin locations as event markers on the map', () => {
      const pubOrigin = resolveConservativeGeographicAssociation({
        explicitLatitude: 40.7128,
        explicitLongitude: -74.006,
        explicitPlaceName: 'New York Headquarters',
        explicitAssociationType: 'publication_origin'
      })
      expect(pubOrigin.associationType).toBe('publication_origin')
      expect(pubOrigin.plottableOnMap).toBe(false)
    })
  })

  describe('5. Synchronized Marker Placement & Clustering (Sections 7.4, 7.5 & 21.1)', () => {
    it('synchronizes markers with filtered articles and clusters nearby markers without double-counting', () => {
      const artTokyo1 = makeTestArticle('a1', 'Tokyo robotics summit opens', {
        explicitLatitude: 35.6762,
        explicitLongitude: 139.6503,
        explicitPlaceName: 'Tokyo'
      })
      const artTokyo2 = makeTestArticle('a2', 'Tokyo semiconductor forum day 2', {
        explicitLatitude: 35.6895,
        explicitLongitude: 139.6917,
        explicitPlaceName: 'Tokyo'
      })
      const artGeneva = makeTestArticle('a3', 'Geneva climate treaty briefing', {
        explicitLatitude: 46.2044,
        explicitLongitude: 6.1432,
        explicitPlaceName: 'Geneva'
      })
      const artUnresolved = makeTestArticle('a4', 'Global macro commentary', {})

      const clusteredMarkers = buildSynchronizedMapMarkers(
        [artTokyo1, artTokyo2, artGeneva, artUnresolved],
        true
      )
      // Tokyo 1 & 2 fall into the same spatial bucket; Geneva is separate; Unresolved is not plotted
      expect(clusteredMarkers).toHaveLength(2)

      const tokyoClusterMarker = clusteredMarkers.find((m) => m.articleIds.includes('a1'))!
      expect(tokyoClusterMarker.isCluster).toBe(true)
      expect(tokyoClusterMarker.articleCount).toBe(2)
      expect(tokyoClusterMarker.articleIds).toEqual(['a1', 'a2'])

      const unclusteredMarkers = buildSynchronizedMapMarkers(
        [artTokyo1, artTokyo2, artGeneva, artUnresolved],
        false
      )
      expect(unclusteredMarkers).toHaveLength(3)
    })
  })
})

