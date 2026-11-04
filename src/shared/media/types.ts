/**
 * HELIOXEN AI — Step 36: Media Gallery and Media Asset Management
 * Shared domain types for media assets, collections, import workflows,
 * thumbnail derivatives, previews, duplicate detection, and deletion semantics.
 */

export const MEDIA_LIBRARY_SCHEMA_VERSION = 1
export const DEFAULT_MEDIA_PROFILE_ID = 'default-profile'

export type MediaAssetType = 'image' | 'video' | 'audio'

export type MediaStorageMode = 'managed_copy' | 'external_reference'

export type MediaAssetSourceType =
  | 'user_file_import'
  | 'saved_capture'
  | 'saved_attachment'
  | 'saved_browser_screenshot'
  | 'ai_generated_image'
  | 'exported_diagram'

export type MediaAssetLifecycleStatus =
  | 'importing'
  | 'available'
  | 'unavailable'
  | 'failed'
  | 'pending_deletion'

export type MediaThumbnailStatus =
  | 'ready'
  | 'placeholder_only'
  | 'failed'
  | 'not_applicable'

export type DuplicateHandlingPolicy = 'skip_and_return_existing' | 'allow_duplicate'

export type MediaSortField = 'importedAt' | 'displayName' | 'fileSizeBytes' | 'mediaType'
export type MediaSortOrder = 'asc' | 'desc'

export interface MediaLibraryLimits {
  readonly maxSingleFileSizeBytes: number
  readonly maxBatchFileCount: number
  readonly maxBatchTotalBytes: number
  readonly maxImageDimensionPx: number
  readonly maxImagePixelCount: number
  readonly maxThumbnailEdgePx: number
  readonly maxPreviewPayloadBytes: number
  readonly maxConcurrentJobs: number
  readonly maxTagsPerAsset: number
  readonly maxCollectionsPerProfile: number
}

export const DEFAULT_MEDIA_LIBRARY_LIMITS: MediaLibraryLimits = {
  maxSingleFileSizeBytes: 50 * 1024 * 1024, // 50 MB per media file
  maxBatchFileCount: 25,
  maxBatchTotalBytes: 200 * 1024 * 1024, // 200 MB per batch
  maxImageDimensionPx: 8192, // 8K max width/height
  maxImagePixelCount: 33554432, // ~33.5 MP max decoded pixel bound
  maxThumbnailEdgePx: 320,
  maxPreviewPayloadBytes: 50 * 1024 * 1024,
  maxConcurrentJobs: 4,
  maxTagsPerAsset: 20,
  maxCollectionsPerProfile: 100
}

export interface MediaAssetRecord {
  readonly id: string
  readonly profileId: string
  readonly displayName: string
  readonly description: string
  readonly originalFileName: string
  readonly mediaType: MediaAssetType
  readonly mimeType: string
  readonly extension: string
  readonly storageMode: MediaStorageMode
  /** Internal storage token/filename or validated external reference token */
  readonly storageReference: string
  readonly contentHashSha256: string
  readonly fileSizeBytes: number
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
  readonly thumbnailStatus: MediaThumbnailStatus
  readonly thumbnailReference: string | null
  readonly thumbnailWidth: number | null
  readonly thumbnailHeight: number | null
  readonly favorite: boolean
  readonly tags: readonly string[]
  readonly collectionIds: readonly string[]
  readonly sourceType: MediaAssetSourceType
  readonly sourceReference: string | null
  readonly status: MediaAssetLifecycleStatus
  readonly unavailableReason: string | null
  readonly exifStrippedForPrivacy: boolean
  readonly createdAt: number
  readonly updatedAt: number
  readonly importedAt: number
  readonly schemaVersion: number
}

export interface MediaCollectionRecord {
  readonly id: string
  readonly profileId: string
  readonly name: string
  readonly description: string
  readonly assetCount: number
  readonly createdAt: number
  readonly updatedAt: number
  readonly schemaVersion: number
}

// ============================================================================
// IMPORT, PREVIEW, ORGANIZATION & DELETION REQUEST/RESPONSE CONTRACTS
// ============================================================================

export interface ImportMediaFileItem {
  readonly filePath: string
  readonly displayName?: string
  readonly tags?: readonly string[]
  readonly collectionIds?: readonly string[]
  readonly favorite?: boolean
}

export interface ImportMediaBatchRequest {
  readonly profileId?: string
  readonly items: readonly ImportMediaFileItem[]
  readonly storageMode?: MediaStorageMode
  readonly sourceType?: MediaAssetSourceType
  readonly sourceReference?: string
  readonly duplicatePolicy?: DuplicateHandlingPolicy
}

export interface ImportMediaItemOutcome {
  readonly originalFileName: string
  readonly status: 'imported' | 'duplicate_skipped' | 'failed'
  readonly asset?: MediaAssetRecord
  readonly existingAssetId?: string
  readonly errorCode?: string
  readonly errorMessage?: string
}

export interface ImportMediaBatchResult {
  readonly batchId: string
  readonly totalRequested: number
  readonly importedCount: number
  readonly duplicateSkippedCount: number
  readonly failedCount: number
  readonly outcomes: readonly ImportMediaItemOutcome[]
}

export interface SaveCapturedMediaRequest {
  readonly profileId?: string
  readonly displayName: string
  readonly dataUrl: string
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  readonly width?: number
  readonly height?: number
  readonly sourceType?:
    | 'saved_capture'
    | 'saved_browser_screenshot'
    | 'ai_generated_image'
    | 'exported_diagram'
  readonly sourceReference?: string
  readonly tags?: readonly string[]
  readonly favorite?: boolean
}

export interface ListMediaAssetsRequest {
  readonly profileId?: string
  readonly query?: string
  readonly mediaType?: MediaAssetType | 'all'
  readonly collectionId?: string
  readonly tag?: string
  readonly favoritesOnly?: boolean
  readonly includeUnavailable?: boolean
  readonly sortBy?: MediaSortField
  readonly sortOrder?: MediaSortOrder
  readonly limit?: number
  readonly offset?: number
}

export interface ListMediaAssetsResult {
  readonly assets: readonly MediaAssetRecord[]
  readonly totalCount: number
  readonly limit: number
  readonly offset: number
}

export interface UpdateMediaAssetMetadataRequest {
  readonly profileId?: string
  readonly id: string
  readonly displayName?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly favorite?: boolean
  readonly collectionIds?: readonly string[]
}

export interface RelinkExternalMediaAssetRequest {
  readonly profileId?: string
  readonly id: string
  readonly newFilePath: string
}

export interface MediaAssetPreviewDescriptor {
  readonly assetId: string
  readonly displayName: string
  readonly mediaType: MediaAssetType
  readonly mimeType: string
  readonly status: MediaAssetLifecycleStatus
  readonly previewAvailable: boolean
  readonly previewDataUrl: string | null
  readonly thumbnailDataUrl: string | null
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
  readonly fileSizeBytes: number
  readonly unavailableReason: string | null
}

export interface CreateMediaCollectionRequest {
  readonly profileId?: string
  readonly name: string
  readonly description?: string
}

export interface UpdateMediaCollectionRequest {
  readonly profileId?: string
  readonly id: string
  readonly name?: string
  readonly description?: string
}

export interface DeleteMediaCollectionRequest {
  readonly profileId?: string
  readonly id: string
}

export interface ModifyCollectionMembershipRequest {
  readonly profileId?: string
  readonly collectionId: string
  readonly assetIds: readonly string[]
  readonly action: 'add' | 'remove'
}

export interface RemoveMediaAssetFromLibraryRequest {
  readonly profileId?: string
  readonly id: string
}

export interface RemoveMediaAssetResult {
  readonly removed: boolean
  readonly id: string
  readonly storageMode: MediaStorageMode
  readonly managedCopyRemoved: boolean
  readonly originalExternalFilePreserved: boolean
}

export interface DeleteManagedMediaAssetPermanentlyRequest {
  readonly profileId?: string
  readonly id: string
  readonly confirmPermanentDelete: boolean
}

export interface DeleteManagedMediaAssetResult {
  readonly deleted: boolean
  readonly id: string
  readonly managedFileDeleted: boolean
  readonly thumbnailDeleted: boolean
}

export interface BulkMediaAssetOperationRequest {
  readonly profileId?: string
  readonly assetIds: readonly string[]
  readonly operation:
    | 'set_favorite'
    | 'clear_favorite'
    | 'add_to_collection'
    | 'remove_from_collection'
    | 'remove_from_library'
    | 'delete_managed_permanently'
  readonly collectionId?: string
  readonly confirmPermanentDelete?: boolean
}

export interface BulkMediaAssetOperationResult {
  readonly operation: BulkMediaAssetOperationRequest['operation']
  readonly succeededIds: readonly string[]
  readonly failedItems: readonly { id: string; reason: string }[]
}

export interface MediaLibraryOverviewSnapshot {
  readonly profileId: string
  readonly assets: readonly MediaAssetRecord[]
  readonly totalAssetsCount: number
  readonly collections: readonly MediaCollectionRecord[]
  readonly countsByType: {
    readonly image: number
    readonly video: number
    readonly audio: number
    readonly favorites: number
    readonly unavailable: number
  }
}

