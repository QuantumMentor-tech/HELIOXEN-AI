import React, { useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import {
  Globe,
  Map as MapIcon,
  RefreshCw,
  Search,
  MapPin,
  ExternalLink,
  Bookmark,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Info,
  Clock,
  ShieldAlert,
  Loader2
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import {
  FeedFreshnessState,
  GazetteerLocationEntry,
  GeographicCoordinates,
  GeographicRegionId,
  MapMarkerItem,
  MapProjectionMode,
  NewsCategory,
  NewsGeographicFilterMode,
  NewsSortOrder,
  NewsTimeRangeFilter,
  NormalizedNewsArticle,
  WorldMonitorOverviewSnapshot
} from '../../../../shared/world/types'

function formatTimestamp(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return 'Not provided by source'
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return 'Unknown timestamp'
  }
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

export const WorldMonitorPanel: React.FC = () => {
  const [overview, setOverview] = useState<WorldMonitorOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Map & Projection State
  const [projection, setProjection] = useState<MapProjectionMode>('globe_3d')
  const [cameraCenter, setCameraCenter] = useState<GeographicCoordinates>({
    latitude: 20,
    longitude: 0
  })
  const [zoom, setZoom] = useState<number>(1.5)
  const [autoRotateGlobe, setAutoRotateGlobe] = useState<boolean>(false)
  const [webglFailed, setWebglFailed] = useState<boolean>(false)

  // Location Search State
  const [locationQuery, setLocationQuery] = useState<string>('')
  const [locationCandidates, setLocationCandidates] = useState<readonly GazetteerLocationEntry[]>([])
  const [locationAmbiguous, setLocationAmbiguous] = useState<boolean>(false)

  // News Feed Filters & Selection State
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<NewsCategory | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<GeographicRegionId | 'all'>('all')
  const [timeRangeFilter, setTimeRangeFilter] = useState<NewsTimeRangeFilter>('all')
  const [geoModeFilter, setGeoModeFilter] = useState<NewsGeographicFilterMode>('all_articles')
  const [bookmarkedOnly, setBookmarkedOnly] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<NewsSortOrder>('published_desc')
  const [activeClusterId, setActiveClusterId] = useState<string | undefined>(undefined)

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  const globeContainerRef = useRef<HTMLDivElement>(null)

  // Debounce news search input (Section 10.4 & 20)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadWorkspaceData = useCallback(async () => {
    if (!window.helioxen?.world) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const snap = await window.helioxen.world.getOverview(undefined, {
        searchQuery: debouncedSearch || undefined,
        category: categoryFilter,
        sourceId: sourceFilter,
        regionId: regionFilter,
        timeRange: timeRangeFilter,
        geographicMode: geoModeFilter,
        clusterId: activeClusterId,
        bookmarkedOnly,
        sortBy,
        page: 1,
        pageSize: 30
      })
      setOverview(snap)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load World Monitor data')
    } finally {
      setLoading(false)
    }
  }, [
    debouncedSearch,
    categoryFilter,
    sourceFilter,
    regionFilter,
    timeRangeFilter,
    geoModeFilter,
    activeClusterId,
    bookmarkedOnly,
    sortBy
  ])

  useEffect(() => {
    void loadWorkspaceData()
  }, [loadWorkspaceData])

  // Three.js 3D Globe Renderer with WebGL context loss fallback to 2D Map
  useEffect(() => {
    if (projection !== 'globe_3d' || webglFailed || !globeContainerRef.current) {
      return undefined
    }

    const container = globeContainerRef.current
    let renderer: THREE.WebGLRenderer | null = null
    let animationId: number | null = null
    let isDisposed = false

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    try {
      const width = container.clientWidth || 540
      const height = 340

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
      camera.position.z = Math.max(2.3, 4.8 - zoom * 0.55)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x050912, 1)
      container.appendChild(renderer.domElement)

      const onContextLost = (e: Event) => {
        e.preventDefault()
        if (animationId) cancelAnimationFrame(animationId)
        setWebglFailed(true)
        setProjection('flat_map_2d')
      }
      renderer.domElement.addEventListener('webglcontextlost', onContextLost)

      const globeGroup = new THREE.Group()
      scene.add(globeGroup)

      // Base Earth sphere & latitude/longitude graticule wireframe
      const sphereGeo = new THREE.SphereGeometry(1.35, 36, 24)
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x0b1528,
        transparent: true,
        opacity: 0.92
      })
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x1e3a5f,
        wireframe: true,
        transparent: true,
        opacity: 0.45
      })
      globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat))
      globeGroup.add(new THREE.Mesh(sphereGeo, wireMat))

      // Equator & Prime Meridian orientation rings
      const equatorGeo = new THREE.RingGeometry(1.355, 1.365, 64)
      const equatorMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
      })
      const equatorMesh = new THREE.Mesh(equatorGeo, equatorMat)
      equatorMesh.rotation.x = Math.PI / 2
      globeGroup.add(equatorMesh)

      // Plot validated map markers on the 3D sphere
      const markers = overview?.queryResult.markers ?? []
      markers.forEach((m) => {
        const pos = latLonToVector3(m.coordinates.latitude, m.coordinates.longitude, 1.38)
        const isSelected = m.markerId === selectedMarkerId || m.articleIds.includes(selectedArticleId ?? '')
        const markerGeo = new THREE.SphereGeometry(isSelected ? 0.045 : 0.03, 12, 12)
        const markerMat = new THREE.MeshBasicMaterial({
          color: isSelected
            ? 0x22d3ee
            : m.precision === 'country'
              ? 0xf59e0b
              : 0x38bdf8
        })
        const markerMesh = new THREE.Mesh(markerGeo, markerMat)
        markerMesh.position.copy(pos)
        globeGroup.add(markerMesh)
      })

      // Orient globe to cameraCenter
      globeGroup.rotation.x = (cameraCenter.latitude * Math.PI) / 180
      globeGroup.rotation.y = (-cameraCenter.longitude * Math.PI) / 180

      const animate = () => {
        if (isDisposed) return
        if (autoRotateGlobe) {
          globeGroup.rotation.y += 0.0025
        }
        renderer?.render(scene, camera)
        animationId = requestAnimationFrame(animate)
      }
      animate()

      return () => {
        isDisposed = true
        if (animationId) cancelAnimationFrame(animationId)
        renderer?.domElement.removeEventListener('webglcontextlost', onContextLost)
        sphereGeo.dispose()
        sphereMat.dispose()
        wireMat.dispose()
        equatorGeo.dispose()
        equatorMat.dispose()
        renderer?.dispose()
      }
    } catch {
      setWebglFailed(true)
      setProjection('flat_map_2d')
      return undefined
    }
  }, [
    projection,
    webglFailed,
    cameraCenter,
    zoom,
    autoRotateGlobe,
    overview?.queryResult.markers,
    selectedMarkerId,
    selectedArticleId
  ])

  const handleRefreshFeed = async () => {
    if (!window.helioxen?.world) return
    try {
      setRefreshing(true)
      setErrorMessage(null)
      const res = await window.helioxen.world.refreshFeed({
        searchQuery: debouncedSearch || undefined,
        forceRefresh: true
      })
      if (res.warnings.length > 0) {
        setStatusMessage(
          `Refreshed feed (${res.totalArticles} articles). Partial source notice: ${res.warnings.join(' | ')}`
        )
      } else {
        setStatusMessage(
          `Refreshed news intelligence feed (${res.totalArticles} total articles, ${res.newArticlesCount} new).`
        )
      }
      await loadWorkspaceData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Feed refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const handleLocationSearch = async () => {
    if (!window.helioxen?.world || !locationQuery.trim()) {
      setLocationCandidates([])
      setLocationAmbiguous(false)
      return
    }
    try {
      const res = await window.helioxen.world.searchLocations({
        query: locationQuery.trim(),
        limit: 8
      })
      setLocationCandidates(res.candidates)
      setLocationAmbiguous(res.isAmbiguous)
      if (res.candidates.length === 1) {
        const only = res.candidates[0]
        setCameraCenter(only.coordinates)
        setZoom(only.zoomLevel)
        setStatusMessage(`Centered map on ${only.name} (${only.coordinates.latitude}°, ${only.coordinates.longitude}°).`)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Location search failed')
    }
  }

  const handleSelectLocationCandidate = (entry: GazetteerLocationEntry) => {
    setCameraCenter(entry.coordinates)
    setZoom(entry.zoomLevel)
    setLocationCandidates([])
    setLocationAmbiguous(false)
    setStatusMessage(
      `Centered map on ${entry.name} (${entry.kind === 'country' ? 'Country-level extent' : 'Point location'}).`
    )
  }

  const handleResetGlobalView = () => {
    setCameraCenter({ latitude: 20, longitude: 0 })
    setZoom(1.5)
    setSelectedMarkerId(null)
    setSelectedArticleId(null)
    setActiveClusterId(undefined)
    setRegionFilter('all')
  }

  const handleSelectMarker = (marker: MapMarkerItem) => {
    setSelectedMarkerId(marker.markerId)
    setSelectedArticleId(marker.articleIds[0] ?? null)
    setCameraCenter(marker.coordinates)
  }

  const handleSelectArticle = (article: NormalizedNewsArticle) => {
    setSelectedArticleId(article.id)
    if (
      article.geographicAssociation.plottableOnMap &&
      article.geographicAssociation.coordinates &&
      (overview?.preferences.autoCenterOnArticleSelect ?? true)
    ) {
      setCameraCenter(article.geographicAssociation.coordinates)
      setZoom(article.geographicAssociation.precision === 'country' ? 3.2 : 4.5)
      const matchingMarker = overview?.queryResult.markers.find((m) =>
        m.articleIds.includes(article.id)
      )
      setSelectedMarkerId(matchingMarker?.markerId ?? null)
    } else {
      setSelectedMarkerId(null)
    }
  }

  const handleToggleBookmark = async (article: NormalizedNewsArticle) => {
    if (!window.helioxen?.world) return
    try {
      await window.helioxen.world.toggleBookmark({
        articleId: article.id,
        bookmarked: !article.bookmarked
      })
      await loadWorkspaceData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update bookmark')
    }
  }

  const handleOpenOriginalSource = async (article: NormalizedNewsArticle) => {
    if (!window.helioxen?.world) return
    try {
      setErrorMessage(null)
      await window.helioxen.world.openSourceUrl({
        articleId: article.id,
        url: article.canonicalUrl
      })
      setStatusMessage(`Opened original source (${article.sourceName}) in default browser.`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Blocked unsafe or invalid source URL')
    }
  }

  const renderFreshnessBadge = (state: FeedFreshnessState) => {
    switch (state) {
      case 'live_fresh':
        return (
          <Badge variant="nominal" size="sm" isDot>
            LIVE / FRESH
          </Badge>
        )
      case 'cached_recent':
        return (
          <Badge variant="info" size="sm" isDot>
            RECENT CACHE
          </Badge>
        )
      case 'cached_stale':
        return (
          <Badge variant="warning" size="sm" isDot>
            STALE CACHE
          </Badge>
        )
      case 'partial_failure':
        return (
          <Badge variant="warning" size="sm" isDot>
            PARTIAL SOURCE AVAILABILITY
          </Badge>
        )
      case 'offline_cached':
        return (
          <Badge variant="danger" size="sm" isDot>
            OFFLINE • CACHED DATA
          </Badge>
        )
      default:
        return (
          <Badge variant="neutral" size="sm">
            NO CACHED ARTICLES
          </Badge>
        )
    }
  }

  const selectedArticle =
    overview?.queryResult.articles.find((a) => a.id === selectedArticleId) ?? null

  if (loading && !overview) {
    return (
      <Card variant="panel" border="panel" padding="lg">
        <div className="flex items-center space-x-3 text-xs text-hx-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin text-hx-cyan" />
          <span>Initializing World Monitor Geospatial &amp; News Intelligence Workspace...</span>
        </div>
      </Card>
    )
  }

  const markers = overview?.queryResult.markers ?? []
  const articles = overview?.queryResult.articles ?? []

  return (
    <div className="space-y-5 animate-hx-fade-in">
      {/* Top World Monitor Header & Projection Switcher */}
      <Card variant="panel" border="glow" padding="md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-hx-md bg-hx-space border border-hx-border-glow flex items-center justify-center text-hx-cyan shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-display font-semibold text-hx-text-primary">
                  World Monitor — Interactive Globe, Geographic Maps &amp; News Intelligence
                </h2>
                {overview && renderFreshnessBadge(overview.queryResult.freshnessState)}
              </div>
              <p className="text-xs text-hx-text-secondary mt-0.5">
                Explore global regions, inspect validated geographic associations, and browse source-attributed reports without fabricated coordinates or unverified claims.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant={projection === 'globe_3d' ? 'primary' : 'secondary'}
              size="sm"
              disabled={webglFailed}
              onClick={() => setProjection('globe_3d')}
              leftIcon={<Globe className="w-3.5 h-3.5" />}
            >
              3D Globe
            </Button>
            <Button
              variant={projection === 'flat_map_2d' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjection('flat_map_2d')}
              leftIcon={<MapIcon className="w-3.5 h-3.5" />}
            >
              2D Flat Map
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetGlobalView}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset Global View
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={refreshing}
              onClick={() => void handleRefreshFeed()}
              leftIcon={
                refreshing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )
              }
            >
              {refreshing ? 'Refreshing...' : 'Refresh Feeds'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Alerts & Status Notifications */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between px-4 py-2.5 rounded-hx-md bg-hx-danger/10 border border-hx-danger/40 text-xs text-hx-danger"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-hx-text-secondary hover:text-hx-text-primary ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-hx-md bg-hx-cyan/10 border border-hx-border-glow text-xs text-hx-cyan">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-hx-text-secondary hover:text-hx-text-primary ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Workspace: Left Geospatial View + Right News Intelligence Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Globe / Flat Map, Location Gazetteer Search & Selected Story Geographic Context */}
        <div className="lg:col-span-6 space-y-4">
          <Card variant="panel" border="panel" padding="md" className="space-y-3">
            {/* Map Controls & Gazetteer Location Search */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLocationSearch()
                  }}
                  placeholder="Search gazetteer location (e.g., Tokyo, Paris, Geneva)..."
                  className="flex-1 px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleLocationSearch()}
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                >
                  Locate
                </Button>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.8, Number((z - 0.5).toFixed(1))))}
                  title="Zoom Out"
                  className="p-1.5 rounded bg-hx-space border border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-hx-text-secondary px-1.5">
                  {zoom.toFixed(1)}x
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(8, Number((z + 0.5).toFixed(1))))}
                  title="Zoom In"
                  className="p-1.5 rounded bg-hx-space border border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {projection === 'globe_3d' && (
                  <label className="flex items-center space-x-1 text-[11px] text-hx-text-secondary ml-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRotateGlobe}
                      onChange={(e) => setAutoRotateGlobe(e.target.checked)}
                      className="rounded border-hx-border-panel bg-hx-space text-hx-cyan"
                    />
                    <span>Rotate</span>
                  </label>
                )}
              </div>
            </div>

            {/* Disambiguation Candidate List when multiple places share the same name */}
            {locationCandidates.length > 1 && (
              <div className="p-2.5 rounded bg-hx-space border border-hx-border-glow space-y-1.5">
                <div className="text-[11px] font-semibold text-hx-warning">
                  {locationAmbiguous
                    ? `Multiple geographic matches found for "${locationQuery}". Select the intended location:`
                    : 'Matching Gazetteer Locations:'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {locationCandidates.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleSelectLocationCandidate(cand)}
                      className="px-2 py-1 rounded text-[11px] bg-hx-panel border border-hx-border-panel text-hx-text-primary hover:border-hx-cyan"
                    >
                      {cand.name} ({cand.kind})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Macro-Region Quick Orientation Bar */}
            <div className="flex flex-wrap gap-1">
              {overview?.regions.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => {
                    setCameraCenter(reg.center)
                    setZoom(reg.zoom)
                    setRegionFilter(reg.id === 'global' ? 'all' : reg.id)
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    (regionFilter === reg.id || (reg.id === 'global' && regionFilter === 'all'))
                      ? 'bg-hx-cyan/15 border-hx-cyan text-hx-cyan'
                      : 'bg-hx-space border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary'
                  }`}
                >
                  {reg.label}
                </button>
              ))}
            </div>

            {/* Interactive 3D Globe or 2D Equirectangular Vector Map Viewport */}
            <div className="relative rounded-hx-md overflow-hidden border border-hx-border-panel bg-[#050912]">
              {projection === 'globe_3d' && !webglFailed ? (
                <div
                  ref={globeContainerRef}
                  aria-label="Interactive 3D World Globe"
                  className="w-full h-[340px] flex items-center justify-center"
                />
              ) : (
                <svg
                  viewBox="0 0 720 360"
                  role="img"
                  aria-label="2D Equirectangular World Map"
                  className="w-full h-[340px] bg-[#050912]"
                >
                  {/* Latitude / Longitude Graticule Lines */}
                  {[-60, -30, 0, 30, 60].map((lat) => {
                    const y = ((90 - lat) / 180) * 360
                    return (
                      <line
                        key={`lat-${lat}`}
                        x1={0}
                        y1={y}
                        x2={720}
                        y2={y}
                        stroke={lat === 0 ? '#22d3ee' : '#1e293b'}
                        strokeWidth={lat === 0 ? 1 : 0.6}
                        strokeDasharray={lat === 0 ? undefined : '4 4'}
                      />
                    )
                  })}
                  {[-120, -60, 0, 60, 120].map((lon) => {
                    const x = ((lon + 180) / 360) * 720
                    return (
                      <line
                        key={`lon-${lon}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={360}
                        stroke={lon === 0 ? '#22d3ee' : '#1e293b'}
                        strokeWidth={lon === 0 ? 1 : 0.6}
                        strokeDasharray={lon === 0 ? undefined : '4 4'}
                      />
                    )
                  })}

                  {/* Simplified Continental Landmass Outlines (Natural Earth Public Domain 1:110m reference) */}
                  <g fill="#0f213c" stroke="#1e3a5f" strokeWidth="1">
                    {/* North America */}
                    <polygon points="45,45 175,40 220,115 170,155 110,140 55,90" />
                    {/* South America */}
                    <polygon points="185,175 255,195 240,305 200,320 175,235" />
                    {/* Europe */}
                    <polygon points="335,55 430,50 445,105 345,112" />
                    {/* Africa */}
                    <polygon points="330,125 435,130 450,245 395,290 335,205" />
                    {/* Asia */}
                    <polygon points="445,50 645,55 660,165 565,185 450,135" />
                    {/* Oceania / Australia */}
                    <polygon points="565,225 655,225 665,290 575,290" />
                  </g>

                  {/* Camera Focus Reticle */}
                  <circle
                    cx={((cameraCenter.longitude + 180) / 360) * 720}
                    cy={((90 - cameraCenter.latitude) / 180) * 360}
                    r={14}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />

                  {/* Validated Plottable Article Markers */}
                  {markers.map((marker) => {
                    const cx = ((marker.coordinates.longitude + 180) / 360) * 720
                    const cy = ((90 - marker.coordinates.latitude) / 180) * 360
                    const isSelected =
                      marker.markerId === selectedMarkerId ||
                      marker.articleIds.includes(selectedArticleId ?? '')
                    return (
                      <g
                        key={marker.markerId}
                        onClick={() => handleSelectMarker(marker)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={marker.isCluster ? 9 : isSelected ? 7 : 5.5}
                          fill={
                            isSelected
                              ? '#22d3ee'
                              : marker.precision === 'country'
                                ? '#f59e0b'
                                : '#38bdf8'
                          }
                          stroke="#050912"
                          strokeWidth="1.5"
                        />
                        {marker.isCluster && (
                          <text
                            x={cx}
                            y={cy + 3}
                            textAnchor="middle"
                            fill="#050912"
                            fontSize="9"
                            fontWeight="bold"
                          >
                            {marker.articleCount}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              )}

              {/* Visible Map Attribution Footer (Mandatory per Section 6.2 & 6.3) */}
              <div className="px-3 py-1.5 bg-hx-panel/90 border-t border-hx-border-panel flex flex-wrap items-center justify-between text-[10px] text-hx-text-secondary">
                <span>
                  {overview?.mapProvider.attributionText}
                </span>
                <span className="font-mono">
                  Center: {cameraCenter.latitude.toFixed(2)}°, {cameraCenter.longitude.toFixed(2)}° • Plotted Markers: {markers.length}
                </span>
              </div>
            </div>

            {/* Accessible Keyboard Marker Selector & Legend */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-hx-text-secondary">
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-hx-cyan inline-block" />
                    <span>Point / City Association</span>
                  </span>
                  <span className="inline-flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-hx-warning inline-block" />
                    <span>Country-Level Centroid (Not exact incident)</span>
                  </span>
                </div>
                <span>{markers.length} Active Map Marker(s)</span>
              </div>

              {markers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {markers.map((m) => (
                    <button
                      key={m.markerId}
                      type="button"
                      onClick={() => handleSelectMarker(m)}
                      className={`px-2 py-1 rounded text-[11px] border flex items-center space-x-1 ${
                        m.markerId === selectedMarkerId
                          ? 'bg-hx-cyan/15 border-hx-cyan text-hx-cyan'
                          : 'bg-hx-space border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary'
                      }`}
                    >
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>
                        {m.label} ({m.articleCount})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Source Health & Coverage Limitations Card */}
          <Card variant="panel" border="panel" padding="md" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-text-primary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-hx-cyan" />
                Authorized News Sources &amp; Retention Policy
              </h3>
              <span className="text-[10px] font-mono text-hx-text-muted">
                Last Sync: {formatTimestamp(overview?.queryResult.lastSuccessfulRefreshAt ?? null)}
              </span>
            </div>

            <div className="space-y-2">
              {overview?.sources.map((src) => (
                <div
                  key={src.sourceId}
                  className="p-2.5 rounded bg-hx-space border border-hx-border-panel flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-hx-text-primary flex items-center space-x-2">
                      <span>{src.displayName}</span>
                      <Badge
                        variant={
                          src.status === 'healthy'
                            ? 'nominal'
                            : src.status === 'rate_limited'
                              ? 'warning'
                              : 'danger'
                        }
                        size="sm"
                      >
                        {src.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-hx-text-secondary mt-0.5">
                      {src.attributionRequirement} • Max Cache Retention: {src.maxRetentionHours}h
                    </p>
                    {src.lastErrorMessage && (
                      <p className="text-[11px] text-hx-warning mt-0.5">
                        Last issue: {src.lastErrorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Searchable, Filterable News Intelligence Feed & Story Detail Inspector */}
        <div className="lg:col-span-6 space-y-4">
          <Card variant="panel" border="panel" padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-cyan">
                News Intelligence Feed &amp; Filters
              </h3>
              <Badge variant="info" size="sm">
                {overview?.queryResult.totalMatchingCount ?? 0} Matching Report(s)
              </Badge>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search headlines, sources, or places..."
                  className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as NewsCategory | 'all')}
                aria-label="Filter by News Category"
                className="px-2 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
              >
                <option value="all">All Categories</option>
                <option value="world">World</option>
                <option value="environment">Environment &amp; Earth</option>
                <option value="science">Science</option>
                <option value="technology">Technology</option>
                <option value="economy">Economy</option>
                <option value="policy">Policy</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                aria-label="Filter by News Source"
                className="px-2 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
              >
                <option value="all">All Sources</option>
                {overview?.sources.map((s) => (
                  <option key={s.sourceId} value={s.sourceId}>
                    {s.displayName}
                  </option>
                ))}
              </select>

              <select
                value={timeRangeFilter}
                onChange={(e) => setTimeRangeFilter(e.target.value as NewsTimeRangeFilter)}
                aria-label="Filter by Time Range"
                className="px-2 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
              >
                <option value="all">Any Time</option>
                <option value="24h">Past 24 Hours</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
              </select>

              <select
                value={geoModeFilter}
                onChange={(e) => setGeoModeFilter(e.target.value as NewsGeographicFilterMode)}
                aria-label="Filter by Geographic Association"
                className="px-2 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
              >
                <option value="all_articles">All Reports (Plotted &amp; Unresolved)</option>
                <option value="map_plottable_only">Map-Plotted Reports Only</option>
                <option value="unresolved_only">Unresolved Location Only</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-1.5 text-[11px] text-hx-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookmarkedOnly}
                    onChange={(e) => setBookmarkedOnly(e.target.checked)}
                    className="rounded border-hx-border-panel bg-hx-space text-hx-cyan"
                  />
                  <span>Saved Bookmarks Only</span>
                </label>

                {activeClusterId && (
                  <button
                    type="button"
                    onClick={() => setActiveClusterId(undefined)}
                    className="text-[11px] text-hx-cyan underline"
                  >
                    Clear Story Cluster Filter
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-hx-text-secondary">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as NewsSortOrder)}
                  className="px-2 py-1 rounded bg-hx-space border border-hx-border-panel text-[11px] text-hx-text-primary"
                >
                  <option value="published_desc">Published Time (Newest)</option>
                  <option value="retrieved_desc">Retrieved Time (Newest)</option>
                  <option value="source_asc">Source Name (A–Z)</option>
                </select>
              </div>
            </div>

            {/* Article List */}
            {articles.length === 0 ? (
              <div className="py-12 text-center space-y-2 rounded bg-hx-space border border-hx-border-panel p-6">
                <Info className="w-7 h-7 text-hx-text-muted mx-auto" />
                <p className="text-xs font-semibold text-hx-text-primary">
                  No News Articles Match Current View
                </p>
                <p className="text-[11px] text-hx-text-secondary max-w-md mx-auto">
                  Click &ldquo;Refresh Feeds&rdquo; to retrieve current reports from authorized sources, or clear active search and geographic filters. World Monitor never fabricates placeholder articles when a feed is empty.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
                {articles.map((article) => {
                  const isSelected = article.id === selectedArticleId
                  const cluster = article.clusterId
                    ? overview?.queryResult.clusters.find((c) => c.clusterId === article.clusterId)
                    : undefined

                  return (
                    <article
                      key={article.id}
                      onClick={() => handleSelectArticle(article)}
                      className={`p-3 rounded-hx-md border transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-hx-hover border-hx-cyan shadow-hx-glow-cyan-sm'
                          : 'bg-hx-space border-hx-border-panel hover:border-hx-border-glow'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-1.5">
                          <Badge variant="info" size="sm">
                            {article.sourceName}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {article.category.toUpperCase()}
                          </Badge>
                          {article.geographicAssociation.plottableOnMap ? (
                            <Badge
                              variant={
                                article.geographicAssociation.precision === 'country'
                                  ? 'warning'
                                  : 'nominal'
                              }
                              size="sm"
                            >
                              {article.geographicAssociation.precision === 'country'
                                ? `Country: ${article.geographicAssociation.placeName}`
                                : `Mapped: ${article.geographicAssociation.placeName}`}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Location Unresolved
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleToggleBookmark(article)
                            }}
                            title={article.bookmarked ? 'Remove Bookmark' : 'Bookmark Reference'}
                            className={`p-1 rounded ${
                              article.bookmarked ? 'text-hx-cyan' : 'text-hx-text-muted hover:text-hx-text-primary'
                            }`}
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleOpenOriginalSource(article)
                            }}
                            title="Open Original Publisher Article in External Browser"
                            className="p-1 rounded text-hx-text-secondary hover:text-hx-cyan"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-hx-text-primary leading-snug">
                        {article.headline}
                      </h4>

                      {article.summary && (
                        <p className="text-[11px] text-hx-text-secondary line-clamp-2">
                          {article.isAiGeneratedSummary ? '[AI Summary] ' : ''}
                          {article.summary}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-hx-text-muted pt-1">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Published: {formatTimestamp(article.publishedAt)} • Retrieved:{' '}
                            {formatTimestamp(article.retrievedAt)}
                          </span>
                        </span>

                        {cluster && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveClusterId(
                                activeClusterId === cluster.clusterId ? undefined : cluster.clusterId
                              )
                            }}
                            className="text-hx-cyan underline font-medium"
                          >
                            Story Group ({cluster.memberArticleIds.length} reports across{' '}
                            {cluster.distinctSourceNames.length} source(s))
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Selected Article Provenance, Geographic Basis & Factual Integrity Inspector */}
          {selectedArticle && (
            <Card variant="panel" border="glow" padding="md" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-cyan flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Report Provenance &amp; Geographic Integrity Inspector
                </h4>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleOpenOriginalSource(selectedArticle)}
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Open Source
                </Button>
              </div>

              <div className="text-xs font-semibold text-hx-text-primary">
                {selectedArticle.headline}
              </div>

              <div className="p-2.5 rounded bg-hx-space border border-hx-border-panel space-y-1 text-[11px] text-hx-text-secondary">
                <div>
                  <strong className="text-hx-text-primary">Publisher / Source:</strong>{' '}
                  {selectedArticle.sourceName} ({selectedArticle.provenance.attributionText})
                </div>
                <div>
                  <strong className="text-hx-text-primary">Publication Timestamp:</strong>{' '}
                  {formatTimestamp(selectedArticle.publishedAt)} (
                  {selectedArticle.publishedAtStatus === 'verified_source_timestamp'
                    ? 'Supplied by source'
                    : 'Not supplied by source; retrieval time is never substituted'}
                  )
                </div>
                <div>
                  <strong className="text-hx-text-primary">Retrieved by HELIOXEN:</strong>{' '}
                  {formatTimestamp(selectedArticle.retrievedAt)}
                </div>
                <div>
                  <strong className="text-hx-text-primary">Geographic Association Basis:</strong>{' '}
                  {selectedArticle.geographicAssociation.basisNote}
                </div>
                <div className="text-hx-warning pt-1">
                  <strong>Factual Integrity Notice:</strong>{' '}
                  {selectedArticle.provenance.verificationDisclaimer}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

