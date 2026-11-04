import React, { useEffect, useState, useCallback } from 'react'
import {
  Image,
  Film,
  Music,
  FolderPlus,
  Star,
  Trash2,
  Eye,
  Upload,
  RefreshCw,
  Search,
  Edit3,
  X,
  AlertTriangle,
  CheckSquare
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import {
  MediaAssetPreviewDescriptor,
  MediaAssetRecord,
  MediaAssetType,
  MediaCollectionRecord,
  MediaLibraryOverviewSnapshot,
  MediaSortField,
  MediaStorageMode
} from '../../../../shared/media/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const MediaGalleryPanel: React.FC = () => {
  const [overview, setOverview] = useState<MediaLibraryOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Filtering & sorting state
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<MediaAssetType | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
  const [sortBy, setSortBy] = useState<MediaSortField>('importedAt')
  const [importStorageMode, setImportStorageMode] = useState<MediaStorageMode>('managed_copy')

  // Collections creation state
  const [newCollectionName, setNewCollectionName] = useState('')

  // Selection & bulk operations
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])

  // Active preview modal & metadata editing state
  const [activePreview, setActivePreview] = useState<MediaAssetPreviewDescriptor | null>(null)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editTagsInput, setEditTagsInput] = useState('')

  const refreshGallery = useCallback(async () => {
    if (!window.helioxen?.media) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setErrorMessage(null)
      const snap = await window.helioxen.media.getOverview()
      setOverview(snap)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load Media Gallery')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshGallery()
  }, [refreshGallery])

  const handleImportViaDialog = async () => {
    if (!window.helioxen?.media) return
    try {
      setErrorMessage(null)
      const res = await window.helioxen.media.selectAndImportDialog({
        storageMode: importStorageMode,
        collectionId: selectedCollectionId || undefined
      })
      if (!res) return
      setStatusMessage(
        `Import finished: ${res.importedCount} imported, ${res.duplicateSkippedCount} duplicate(s) skipped, ${res.failedCount} failed.`
      )
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Media import failed')
    }
  }

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.helioxen?.media || !newCollectionName.trim()) return
    try {
      setErrorMessage(null)
      await window.helioxen.media.createCollection({
        name: newCollectionName.trim()
      })
      setNewCollectionName('')
      setStatusMessage('Media collection created.')
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create collection')
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    if (!window.helioxen?.media) return
    try {
      await window.helioxen.media.deleteCollection({ id: collectionId })
      if (selectedCollectionId === collectionId) {
        setSelectedCollectionId('')
      }
      setStatusMessage('Collection removed (member media assets were preserved).')
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete collection')
    }
  }

  const handleToggleFavorite = async (asset: MediaAssetRecord) => {
    if (!window.helioxen?.media) return
    try {
      await window.helioxen.media.updateMetadata({
        id: asset.id,
        favorite: !asset.favorite
      })
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update favorite status')
    }
  }

  const handleOpenPreview = async (asset: MediaAssetRecord) => {
    if (!window.helioxen?.media) return
    try {
      setErrorMessage(null)
      const preview = await window.helioxen.media.getPreview(asset.id)
      setActivePreview(preview)
      setEditingAssetId(asset.id)
      setEditDisplayName(asset.displayName)
      setEditTagsInput(asset.tags.join(', '))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to open media preview')
    }
  }

  const handleClosePreview = () => {
    setActivePreview(null)
    setEditingAssetId(null)
  }

  const handleSaveAssetMetadata = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.helioxen?.media || !editingAssetId || !editDisplayName.trim()) return
    try {
      const tags = editTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      await window.helioxen.media.updateMetadata({
        id: editingAssetId,
        displayName: editDisplayName.trim(),
        tags
      })
      setStatusMessage('Asset display name and tags updated.')
      await refreshGallery()
      if (activePreview && activePreview.assetId === editingAssetId) {
        const refreshedPreview = await window.helioxen.media.getPreview(editingAssetId)
        setActivePreview(refreshedPreview)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update asset metadata')
    }
  }

  const handleRemoveFromLibrary = async (asset: MediaAssetRecord) => {
    if (!window.helioxen?.media) return
    try {
      await window.helioxen.media.removeFromLibrary({ id: asset.id })
      if (activePreview?.assetId === asset.id) {
        handleClosePreview()
      }
      setSelectedAssetIds((prev) => prev.filter((id) => id !== asset.id))
      setStatusMessage(
        asset.storageMode === 'external_reference'
          ? `Removed "${asset.displayName}" from library (external file preserved).`
          : `Removed "${asset.displayName}" from library.`
      )
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove asset from library')
    }
  }

  const handlePermanentDeleteManaged = async (asset: MediaAssetRecord) => {
    if (!window.helioxen?.media) return
    try {
      await window.helioxen.media.deleteManagedPermanently({
        id: asset.id,
        confirmPermanentDelete: true
      })
      if (activePreview?.assetId === asset.id) {
        handleClosePreview()
      }
      setSelectedAssetIds((prev) => prev.filter((id) => id !== asset.id))
      setStatusMessage(`Permanently deleted managed copy of "${asset.displayName}".`)
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to permanently delete managed asset')
    }
  }

  const handleToggleSelectAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleBulkFavorite = async () => {
    if (!window.helioxen?.media || selectedAssetIds.length === 0) return
    try {
      await window.helioxen.media.bulkOperation({
        assetIds: selectedAssetIds,
        operation: 'set_favorite'
      })
      setSelectedAssetIds([])
      await refreshGallery()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Bulk operation failed')
    }
  }

  const allAssets = overview?.assets ?? []
  const collections: readonly MediaCollectionRecord[] = overview?.collections ?? []

  const filteredAssets = allAssets
    .filter((asset) => {
      if (typeFilter !== 'all' && asset.mediaType !== typeFilter) return false
      if (favoritesOnly && !asset.favorite) return false
      if (selectedCollectionId && !asset.collectionIds.includes(selectedCollectionId)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const inName = asset.displayName.toLowerCase().includes(q)
        const inOrig = asset.originalFileName.toLowerCase().includes(q)
        const inTags = asset.tags.some((t) => t.toLowerCase().includes(q))
        if (!inName && !inOrig && !inTags) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'displayName') return a.displayName.localeCompare(b.displayName)
      if (sortBy === 'fileSizeBytes') return b.fileSizeBytes - a.fileSizeBytes
      if (sortBy === 'mediaType') return a.mediaType.localeCompare(b.mediaType)
      return b.importedAt - a.importedAt
    })

  return (
    <div className="space-y-5" data-testid="media-gallery-panel">
      {/* Header & Import Controls */}
      <Card variant="panel" border="glow" padding="md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-display font-semibold text-hx-cyan flex items-center gap-2">
              <Image className="w-4 h-4" />
              Media Gallery &amp; Secure Asset Library
            </h3>
            <p className="text-xs text-hx-text-secondary">
              Local-first media management with magic-byte validation, SHA-256 duplicate detection, and distinct removal vs permanent deletion semantics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Import Storage Mode"
              value={importStorageMode}
              onChange={(e) => setImportStorageMode(e.target.value as MediaStorageMode)}
              className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
            >
              <option value="managed_copy">Import Mode: Managed Copy</option>
              <option value="external_reference">Import Mode: External Reference</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => void handleImportViaDialog()}
            >
              Import Media Files
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => void refreshGallery()}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-hx-border-subtle">
          <Badge variant="info" size="sm">
            Total: {overview?.totalAssetsCount ?? 0}
          </Badge>
          <Badge variant="neutral" size="sm">
            Images: {overview?.countsByType.image ?? 0}
          </Badge>
          <Badge variant="neutral" size="sm">
            Videos: {overview?.countsByType.video ?? 0}
          </Badge>
          <Badge variant="neutral" size="sm">
            Audio: {overview?.countsByType.audio ?? 0}
          </Badge>
          <Badge variant="nominal" size="sm">
            Favorites: {overview?.countsByType.favorites ?? 0}
          </Badge>
          {(overview?.countsByType.unavailable ?? 0) > 0 && (
            <Badge variant="warning" size="sm">
              Unavailable: {overview?.countsByType.unavailable}
            </Badge>
          )}
        </div>
      </Card>

      {errorMessage && (
        <div
          role="alert"
          className="px-3 py-2 rounded border border-hx-danger/50 bg-hx-danger/10 text-xs text-hx-danger flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[11px] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="px-3 py-2 rounded border border-hx-cyan/40 bg-hx-cyan/10 text-xs text-hx-cyan flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search, Filter, Sort & Collections Bar */}
      <Card variant="default" border="subtle" padding="md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 text-hx-text-muted absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search by display name, filename, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
            />
          </div>

          <select
            aria-label="Filter by Collection"
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
          >
            <option value="">All Collections</option>
            {collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name} ({col.assetCount})
              </option>
            ))}
          </select>

          <select
            aria-label="Sort Media Assets"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as MediaSortField)}
            className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
          >
            <option value="importedAt">Sort: Recently Imported</option>
            <option value="displayName">Sort: Display Name</option>
            <option value="fileSizeBytes">Sort: File Size</option>
            <option value="mediaType">Sort: Media Type</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'image', 'video', 'audio'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded text-xs font-mono uppercase ${
                  typeFilter === t
                    ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/50'
                    : 'text-hx-text-muted hover:text-hx-text-primary'
                }`}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 ${
                favoritesOnly
                  ? 'bg-hx-warning/20 text-hx-warning border border-hx-warning/50'
                  : 'text-hx-text-muted hover:text-hx-text-primary'
              }`}
            >
              <Star className="w-3 h-3" />
              Favorites Only
            </button>
          </div>

          <form onSubmit={(e) => void handleCreateCollection(e)} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="New collection..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="px-2 py-1 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              leftIcon={<FolderPlus className="w-3.5 h-3.5" />}
            >
              Add Collection
            </Button>
            {selectedCollectionId && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleDeleteCollection(selectedCollectionId)}
              >
                Delete Collection
              </Button>
            )}
          </form>
        </div>

        {selectedAssetIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-hx-border-subtle flex items-center justify-between">
            <span className="text-xs text-hx-cyan font-mono">
              {selectedAssetIds.length} asset(s) selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void handleBulkFavorite()}>
                Favorite Selected
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedAssetIds([])}>
                Clear Selection
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Media Preview & Metadata Inspector Modal/Card */}
      {activePreview && (
        <Card variant="panel" border="glow" padding="md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-display font-semibold text-hx-cyan">
                Preview: {activePreview.displayName}
              </h4>
              <Badge variant="info" size="sm">
                {activePreview.mimeType}
              </Badge>
            </div>
            <button
              type="button"
              aria-label="Close media preview"
              onClick={handleClosePreview}
              className="text-hx-text-muted hover:text-hx-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-hx-space/80 rounded border border-hx-border-subtle p-4 flex items-center justify-center min-h-[220px]">
              {!activePreview.previewAvailable || !activePreview.previewDataUrl ? (
                <div className="text-center space-y-1">
                  <AlertTriangle className="w-6 h-6 text-hx-warning mx-auto" />
                  <p className="text-xs text-hx-warning">
                    Preview unavailable ({activePreview.unavailableReason || 'Missing source file'})
                  </p>
                </div>
              ) : activePreview.mediaType === 'image' ? (
                <img
                  src={activePreview.previewDataUrl}
                  alt={activePreview.displayName}
                  className="max-h-[340px] max-w-full object-contain rounded"
                />
              ) : activePreview.mediaType === 'video' ? (
                <video
                  src={activePreview.previewDataUrl}
                  controls
                  preload="metadata"
                  className="max-h-[340px] max-w-full rounded"
                />
              ) : (
                <audio
                  src={activePreview.previewDataUrl}
                  controls
                  preload="metadata"
                  className="w-full"
                />
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs space-y-1 bg-hx-surface/50 p-3 rounded border border-hx-border-subtle">
                <p className="text-hx-text-secondary">
                  <strong className="text-hx-text-primary">Size:</strong>{' '}
                  {formatBytes(activePreview.fileSizeBytes)}
                </p>
                {activePreview.width && activePreview.height && (
                  <p className="text-hx-text-secondary">
                    <strong className="text-hx-text-primary">Dimensions:</strong>{' '}
                    {activePreview.width} &times; {activePreview.height} px
                  </p>
                )}
                {activePreview.durationSeconds !== null && (
                  <p className="text-hx-text-secondary">
                    <strong className="text-hx-text-primary">Duration:</strong>{' '}
                    {activePreview.durationSeconds}s
                  </p>
                )}
                <p className="text-[11px] text-hx-text-muted">
                  EXIF GPS/Device Scrubbed: Verified
                </p>
              </div>

              <form onSubmit={(e) => void handleSaveAssetMetadata(e)} className="space-y-2">
                <label className="block text-[11px] text-hx-text-secondary">
                  Display Name (Preserves Asset ID &amp; File)
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full mt-1 px-2 py-1 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                  />
                </label>
                <label className="block text-[11px] text-hx-text-secondary">
                  Tags (comma-separated)
                  <input
                    type="text"
                    value={editTagsInput}
                    onChange={(e) => setEditTagsInput(e.target.value)}
                    className="w-full mt-1 px-2 py-1 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                  />
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                >
                  Save Metadata
                </Button>
              </form>
            </div>
          </div>
        </Card>
      )}

      {/* Asset Grid */}
      <Card variant="default" border="subtle" padding="md">
        {loading ? (
          <p className="text-xs text-hx-text-secondary">Loading media assets...</p>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Image className="w-8 h-8 text-hx-text-muted mx-auto" />
            <p className="text-xs font-semibold text-hx-text-primary">
              No media assets match the current view
            </p>
            <p className="text-[11px] text-hx-text-muted">
              Import user-selected images, videos, or audio files to build your local Media Gallery.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="p-3 rounded bg-hx-space/60 border border-hx-border-subtle flex flex-col justify-between gap-2"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`Select ${asset.displayName}`}
                        checked={selectedAssetIds.includes(asset.id)}
                        onChange={() => handleToggleSelectAsset(asset.id)}
                      />
                      {asset.mediaType === 'image' ? (
                        <Image className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
                      ) : asset.mediaType === 'video' ? (
                        <Film className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
                      ) : (
                        <Music className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-hx-text-primary truncate">
                        {asset.displayName}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label={asset.favorite ? 'Remove from favorites' : 'Add to favorites'}
                      onClick={() => void handleToggleFavorite(asset)}
                      className={asset.favorite ? 'text-hx-warning' : 'text-hx-text-muted'}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Badge
                      variant={asset.status === 'available' ? 'nominal' : 'warning'}
                      size="sm"
                    >
                      {asset.status.toUpperCase()}
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {asset.extension.toUpperCase()}
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {asset.storageMode === 'managed_copy' ? 'MANAGED' : 'EXTERNAL REF'}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-hx-text-muted">
                    {formatBytes(asset.fileSizeBytes)}
                    {asset.width && asset.height ? ` • ${asset.width}×${asset.height}` : ''}
                    {asset.durationSeconds !== null ? ` • ${asset.durationSeconds}s` : ''}
                  </p>

                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-hx-surface text-hx-text-secondary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-hx-border-subtle/50">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Eye className="w-3 h-3" />}
                    onClick={() => void handleOpenPreview(asset)}
                  >
                    Preview
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Remove entry from library (preserves external files)"
                      onClick={() => void handleRemoveFromLibrary(asset)}
                      className="text-[11px] text-hx-text-secondary hover:text-hx-warning px-1.5 py-0.5 rounded border border-hx-border-subtle"
                    >
                      Remove
                    </button>
                    {asset.storageMode === 'managed_copy' && (
                      <button
                        type="button"
                        aria-label={`Permanently delete managed copy of ${asset.displayName}`}
                        title="Permanently delete managed copy"
                        onClick={() => void handlePermanentDeleteManaged(asset)}
                        className="text-hx-text-muted hover:text-hx-danger p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

