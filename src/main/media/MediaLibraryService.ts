/**
 * HELIOXEN AI — Step 36: Media Gallery and Media Asset Management Service
 * Main-process local-first media asset management: layered import validation,
 * managed-copy & external-reference storage, bounded thumbnail generation & caching,
 * collections/tags/favorites, duplicate detection, and safe removal/deletion semantics.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  BulkMediaAssetOperationRequest,
  BulkMediaAssetOperationRequestSchema,
  BulkMediaAssetOperationResult,
  CreateMediaCollectionRequest,
  CreateMediaCollectionRequestSchema,
  DEFAULT_MEDIA_LIBRARY_LIMITS,
  DEFAULT_MEDIA_PROFILE_ID,
  DeleteManagedMediaAssetPermanentlyRequest,
  DeleteManagedMediaAssetPermanentlyRequestSchema,
  DeleteManagedMediaAssetResult,
  DeleteMediaCollectionRequest,
  DeleteMediaCollectionRequestSchema,
  ImportMediaBatchRequest,
  ImportMediaBatchRequestSchema,
  ImportMediaBatchResult,
  ImportMediaItemOutcome,
  inspectMediaFileBuffer,
  inspectMediaMetadataSafety,
  ListMediaAssetsRequest,
  ListMediaAssetsRequestSchema,
  ListMediaAssetsResult,
  MEDIA_LIBRARY_SCHEMA_VERSION,
  MediaAssetPreviewDescriptor,
  MediaAssetRecord,
  MediaCollectionRecord,
  MediaLibraryLimits,
  MediaLibraryOverviewSnapshot,
  MediaProfileIdSchema,
  MediaThumbnailStatus,
  ModifyCollectionMembershipRequest,
  ModifyCollectionMembershipRequestSchema,
  RelinkExternalMediaAssetRequest,
  RelinkExternalMediaAssetRequestSchema,
  RemoveMediaAssetFromLibraryRequest,
  RemoveMediaAssetFromLibraryRequestSchema,
  RemoveMediaAssetResult,
  SaveCapturedMediaRequest,
  SaveCapturedMediaRequestSchema,
  UpdateMediaAssetMetadataRequest,
  UpdateMediaAssetMetadataRequestSchema,
  UpdateMediaCollectionRequest,
  UpdateMediaCollectionRequestSchema
} from '../../shared/media'

interface ProfileMediaData {
  assets: MediaAssetRecord[]
  collections: MediaCollectionRecord[]
  /** Internal map from assetId to validated external file path (never exposed as asset ID) */
  externalPaths: Record<string, string>
}

interface PersistedMediaStore {
  schemaVersion: number
  updatedAt: number
  profiles: Record<string, ProfileMediaData>
}

export function computeBoundedThumbnailDimensions(
  width: number | null,
  height: number | null,
  maxEdgePx: number = DEFAULT_MEDIA_LIBRARY_LIMITS.maxThumbnailEdgePx
): { width: number; height: number } | null {
  if (!width || !height || width <= 0 || height <= 0) {
    return null
  }
  if (width <= maxEdgePx && height <= maxEdgePx) {
    return { width, height }
  }
  const scale = Math.min(maxEdgePx / width, maxEdgePx / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

export interface MediaLibraryServiceOptions {
  readonly storageDir: string
  readonly limits?: Partial<MediaLibraryLimits>
  readonly nowFn?: () => number
}

export class MediaLibraryService {
  private readonly baseDir: string
  private readonly assetsDir: string
  private readonly thumbnailsDir: string
  private readonly storePath: string
  private readonly limits: MediaLibraryLimits
  private readonly nowFn: () => number

  private store: PersistedMediaStore
  private thumbnailMemoryCache = new Map<string, string>()
  private inFlightThumbnails = new Map<string, Promise<string | null>>()
  private simulateDiskWriteFailure = false
  private simulateThumbnailFailure = false

  constructor(options: MediaLibraryServiceOptions) {
    this.baseDir = path.resolve(options.storageDir, 'media_library')
    this.assetsDir = path.join(this.baseDir, 'assets')
    this.thumbnailsDir = path.join(this.baseDir, 'thumbnails')
    this.storePath = path.join(this.baseDir, 'media_store.json')
    this.limits = { ...DEFAULT_MEDIA_LIBRARY_LIMITS, ...(options.limits ?? {}) }
    this.nowFn = options.nowFn ?? (() => Date.now())

    this.ensureDirectories()
    this.store = this.loadStoreFromDisk()
  }

  public getManagedAssetsDirectory(): string {
    return this.assetsDir
  }

  public getThumbnailsDirectory(): string {
    return this.thumbnailsDir
  }

  public setSimulateDiskWriteFailure(enabled: boolean): void {
    this.simulateDiskWriteFailure = enabled
  }

  public setSimulateThumbnailFailure(enabled: boolean): void {
    this.simulateThumbnailFailure = enabled
  }

  public dispose(): void {
    this.thumbnailMemoryCache.clear()
    this.inFlightThumbnails.clear()
  }

  // --------------------------------------------------------------------------
  // Persistence & Storage Integrity
  // --------------------------------------------------------------------------

  private ensureDirectories(): void {
    for (const dir of [this.baseDir, this.assetsDir, this.thumbnailsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  private createDefaultProfileData(): ProfileMediaData {
    return {
      assets: [],
      collections: [],
      externalPaths: {}
    }
  }

  private loadStoreFromDisk(): PersistedMediaStore {
    try {
      this.ensureDirectories()
      if (!fs.existsSync(this.storePath)) {
        return {
          schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION,
          updatedAt: this.nowFn(),
          profiles: {
            [DEFAULT_MEDIA_PROFILE_ID]: this.createDefaultProfileData()
          }
        }
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedMediaStore>
      if (!parsed || typeof parsed !== 'object' || !parsed.profiles) {
        throw new Error('Invalid media store structure')
      }

      const profiles: Record<string, ProfileMediaData> = {}
      for (const [profileId, data] of Object.entries(parsed.profiles)) {
        profiles[profileId] = {
          assets: Array.isArray(data?.assets) ? data.assets : [],
          collections: Array.isArray(data?.collections) ? data.collections : [],
          externalPaths:
            data?.externalPaths && typeof data.externalPaths === 'object'
              ? data.externalPaths
              : {}
        }
      }

      if (!profiles[DEFAULT_MEDIA_PROFILE_ID]) {
        profiles[DEFAULT_MEDIA_PROFILE_ID] = this.createDefaultProfileData()
      }

      for (const profileData of Object.values(profiles)) {
        this.recalculateCollectionCounts(profileData)
      }

      return {
        schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION,
        updatedAt: parsed.updatedAt ?? this.nowFn(),
        profiles
      }
    } catch {
      try {
        if (fs.existsSync(this.storePath)) {
          const corruptBackup = `${this.storePath}.corrupt.${this.nowFn()}.json`
          fs.renameSync(this.storePath, corruptBackup)
        }
      } catch {
        // Ignore backup rename failure
      }
      return {
        schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION,
        updatedAt: this.nowFn(),
        profiles: {
          [DEFAULT_MEDIA_PROFILE_ID]: this.createDefaultProfileData()
        }
      }
    }
  }

  private getProfileData(rawProfileId?: string): { profileId: string; data: ProfileMediaData } {
    const profileId = MediaProfileIdSchema.parse(rawProfileId ?? DEFAULT_MEDIA_PROFILE_ID)
    if (!this.store.profiles[profileId]) {
      this.store.profiles[profileId] = this.createDefaultProfileData()
    }
    return { profileId, data: this.store.profiles[profileId] }
  }

  private mutateAndPersist<T>(mutator: () => T): T {
    const snapshot = JSON.stringify(this.store)
    try {
      const result = mutator()
      if (this.simulateDiskWriteFailure) {
        throw new Error('DISK_WRITE_FAILED: Simulated media store disk write failure')
      }

      this.store.updatedAt = this.nowFn()
      this.ensureDirectories()
      const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf-8')
      fs.renameSync(tmpPath, this.storePath)
      return result
    } catch (err) {
      this.store = JSON.parse(snapshot) as PersistedMediaStore
      throw err
    }
  }

  private isPathInsideRoot(candidatePath: string, rootDir: string): boolean {
    const resolvedCandidate = path.resolve(candidatePath)
    const resolvedRoot = path.resolve(rootDir)
    const rel = path.relative(resolvedRoot, resolvedCandidate)
    return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel))
  }

  private validateIncomingSourceFilePath(rawFilePath: string): {
    valid: boolean
    resolvedPath?: string
    errorCode?: string
    errorMessage?: string
  } {
    if (!rawFilePath || typeof rawFilePath !== 'string' || rawFilePath.includes('\0')) {
      return {
        valid: false,
        errorCode: 'INVALID_SOURCE_PATH',
        errorMessage: 'Source file path is empty or contains null bytes.'
      }
    }

    // Reject path traversal segments in the raw input
    const normalizedSegments = rawFilePath.split(/[\\/]+/)
    if (normalizedSegments.includes('..')) {
      return {
        valid: false,
        errorCode: 'PATH_TRAVERSAL_BLOCKED',
        errorMessage: 'Path traversal segments ("..") are not permitted in media import paths.'
      }
    }

    if (/^(https?|ftp|file|javascript|data):/i.test(rawFilePath.trim())) {
      return {
        valid: false,
        errorCode: 'REMOTE_URL_PROHIBITED',
        errorMessage: 'Remote URLs or URI schemes cannot be imported directly as local media files.'
      }
    }

    if (!path.isAbsolute(rawFilePath)) {
      return {
        valid: false,
        errorCode: 'RELATIVE_PATH_REJECTED',
        errorMessage: 'Media import requires an explicit absolute file path.'
      }
    }

    const resolvedPath = path.resolve(rawFilePath)
    if (!fs.existsSync(resolvedPath)) {
      return {
        valid: false,
        errorCode: 'SOURCE_FILE_MISSING',
        errorMessage: 'Selected media file does not exist or disappeared before import.'
      }
    }

    const stat = fs.lstatSync(resolvedPath)
    if (stat.isSymbolicLink()) {
      return {
        valid: false,
        errorCode: 'SYMLINK_REJECTED',
        errorMessage: 'Symbolic links cannot be imported directly into the Media Gallery.'
      }
    }
    if (!stat.isFile()) {
      return {
        valid: false,
        errorCode: 'NOT_A_REGULAR_FILE',
        errorMessage: 'Selected path is not a regular file (directories cannot be imported directly).'
      }
    }

    return { valid: true, resolvedPath }
  }

  // --------------------------------------------------------------------------
  // 1. IMPORT WORKFLOW (FILES & SAVED CAPTURES)
  // --------------------------------------------------------------------------

  public async importBatch(request: ImportMediaBatchRequest): Promise<ImportMediaBatchResult> {
    const parsed = ImportMediaBatchRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)
    const storageMode = parsed.storageMode ?? 'managed_copy'
    const sourceType = parsed.sourceType ?? 'user_file_import'
    const duplicatePolicy = parsed.duplicatePolicy ?? 'skip_and_return_existing'

    const outcomes: ImportMediaItemOutcome[] = []
    let importedCount = 0
    let duplicateSkippedCount = 0
    let failedCount = 0
    let cumulativeBatchBytes = 0

    for (const item of parsed.items) {
      const originalFileName = path.basename(item.filePath || 'unknown')
      const pathCheck = this.validateIncomingSourceFilePath(item.filePath)
      if (!pathCheck.valid || !pathCheck.resolvedPath) {
        failedCount++
        outcomes.push({
          originalFileName,
          status: 'failed',
          errorCode: pathCheck.errorCode,
          errorMessage: pathCheck.errorMessage
        })
        continue
      }

      const resolvedSourcePath = pathCheck.resolvedPath
      let fileBuffer: Buffer
      try {
        const stat = fs.statSync(resolvedSourcePath)
        if (stat.size === 0) {
          failedCount++
          outcomes.push({
            originalFileName,
            status: 'failed',
            errorCode: 'EMPTY_FILE',
            errorMessage: 'Media file is 0 bytes.'
          })
          continue
        }
        if (stat.size > this.limits.maxSingleFileSizeBytes) {
          failedCount++
          outcomes.push({
            originalFileName,
            status: 'failed',
            errorCode: 'FILE_TOO_LARGE',
            errorMessage: `File size (${stat.size} bytes) exceeds limit (${this.limits.maxSingleFileSizeBytes} bytes).`
          })
          continue
        }
        if (cumulativeBatchBytes + stat.size > this.limits.maxBatchTotalBytes) {
          failedCount++
          outcomes.push({
            originalFileName,
            status: 'failed',
            errorCode: 'BATCH_BYTE_LIMIT_EXCEEDED',
            errorMessage: 'Import batch total byte limit exceeded.'
          })
          continue
        }
        fileBuffer = fs.readFileSync(resolvedSourcePath)
        cumulativeBatchBytes += fileBuffer.length
      } catch (err) {
        failedCount++
        outcomes.push({
          originalFileName,
          status: 'failed',
          errorCode: 'FILE_READ_FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unable to read source file.'
        })
        continue
      }

      const inspection = inspectMediaFileBuffer(originalFileName, fileBuffer, this.limits)
      if (!inspection.valid || !inspection.mediaType || !inspection.mimeType || !inspection.normalizedExtension) {
        failedCount++
        outcomes.push({
          originalFileName,
          status: 'failed',
          errorCode: inspection.errorCode,
          errorMessage: inspection.errorMessage
        })
        continue
      }

      const defaultDisplayName =
        item.displayName?.trim() ||
        originalFileName.replace(/\.[^/.]+$/, '').trim() ||
        originalFileName

      const safety = inspectMediaMetadataSafety('Media display name', defaultDisplayName)
      if (!safety.allowed) {
        failedCount++
        outcomes.push({
          originalFileName,
          status: 'failed',
          errorCode: 'PRIVACY_POLICY_REJECTED',
          errorMessage: safety.reason
        })
        continue
      }

      const contentHashSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')

      // Check duplicate candidate in same profile
      if (duplicatePolicy === 'skip_and_return_existing') {
        const existingAsset = data.assets.find(
          (a) => a.contentHashSha256 === contentHashSha256 && a.status !== 'pending_deletion'
        )
        if (existingAsset) {
          duplicateSkippedCount++
          outcomes.push({
            originalFileName,
            status: 'duplicate_skipped',
            asset: existingAsset,
            existingAssetId: existingAsset.id
          })
          continue
        }
      }

      const assetId = `media_${crypto.randomUUID()}`
      const ext = inspection.normalizedExtension
      const managedFileName = `${assetId}${ext}`
      const managedDestPath = path.join(this.assetsDir, managedFileName)
      let writtenManagedFile = false
      let writtenThumbnailFile: string | null = null

      try {
        if (storageMode === 'managed_copy') {
          this.ensureDirectories()
          fs.writeFileSync(managedDestPath, fileBuffer)
          const verifyStat = fs.statSync(managedDestPath)
          if (verifyStat.size !== fileBuffer.length) {
            throw new Error('Managed copy verification failed: incomplete write.')
          }
          writtenManagedFile = true
        }

        // Generate bounded thumbnail for images
        let thumbnailStatus: MediaThumbnailStatus =
          inspection.mediaType === 'image' ? 'ready' : 'placeholder_only'
        let thumbnailReference: string | null = null
        let thumbnailWidth: number | null = null
        let thumbnailHeight: number | null = null

        if (inspection.mediaType === 'image') {
          if (this.simulateThumbnailFailure) {
            thumbnailStatus = 'failed'
          } else {
            const thumbDims = computeBoundedThumbnailDimensions(
              inspection.width ?? null,
              inspection.height ?? null,
              this.limits.maxThumbnailEdgePx
            )
            const thumbFileName = `${assetId}.thumb`
            const thumbPath = path.join(this.thumbnailsDir, thumbFileName)
            const dataUrl = `data:${inspection.mimeType};base64,${fileBuffer.toString('base64')}`
            fs.writeFileSync(thumbPath, dataUrl, 'utf-8')
            writtenThumbnailFile = thumbPath
            thumbnailReference = thumbFileName
            thumbnailWidth = thumbDims?.width ?? inspection.width ?? null
            thumbnailHeight = thumbDims?.height ?? inspection.height ?? null
            this.thumbnailMemoryCache.set(`${assetId}_${contentHashSha256}`, dataUrl)
          }
        }

        const now = this.nowFn()
        const validCollectionIds = (item.collectionIds ?? []).filter((cid) =>
          data.collections.some((c) => c.id === cid)
        )

        const assetRecord: MediaAssetRecord = {
          id: assetId,
          profileId,
          displayName: defaultDisplayName,
          description: '',
          originalFileName,
          mediaType: inspection.mediaType,
          mimeType: inspection.mimeType,
          extension: ext,
          storageMode,
          storageReference: storageMode === 'managed_copy' ? managedFileName : `extref_${assetId}`,
          contentHashSha256,
          fileSizeBytes: fileBuffer.length,
          width: inspection.width ?? null,
          height: inspection.height ?? null,
          durationSeconds: inspection.durationSeconds ?? null,
          thumbnailStatus,
          thumbnailReference,
          thumbnailWidth,
          thumbnailHeight,
          favorite: item.favorite ?? false,
          tags: Array.from(new Set(item.tags ?? [])),
          collectionIds: Array.from(new Set(validCollectionIds)),
          sourceType,
          sourceReference: parsed.sourceReference ?? null,
          status: 'available',
          unavailableReason: null,
          exifStrippedForPrivacy: true,
          createdAt: now,
          updatedAt: now,
          importedAt: now,
          schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION
        }

        this.mutateAndPersist(() => {
          data.assets.unshift(assetRecord)
          if (storageMode === 'external_reference') {
            data.externalPaths[assetId] = resolvedSourcePath
          }
          this.recalculateCollectionCounts(data)
        })

        importedCount++
        outcomes.push({
          originalFileName,
          status: 'imported',
          asset: assetRecord
        })
      } catch (err) {
        // Clean up any partial managed copy or thumbnail on failure
        if (writtenManagedFile && fs.existsSync(managedDestPath)) {
          try {
            fs.unlinkSync(managedDestPath)
          } catch {
            // Ignore cleanup failure
          }
        }
        if (writtenThumbnailFile && fs.existsSync(writtenThumbnailFile)) {
          try {
            fs.unlinkSync(writtenThumbnailFile)
          } catch {
            // Ignore cleanup failure
          }
        }
        failedCount++
        outcomes.push({
          originalFileName,
          status: 'failed',
          errorCode: 'IMPORT_COMMIT_FAILED',
          errorMessage: err instanceof Error ? err.message : 'Failed to commit imported media asset.'
        })
      }
    }

    return {
      batchId: `batch_${crypto.randomUUID()}`,
      totalRequested: parsed.items.length,
      importedCount,
      duplicateSkippedCount,
      failedCount,
      outcomes
    }
  }

  /**
   * Saves an explicitly user-approved captured still image (Step 22) or browser screenshot (Step 32)
   * into the Media Gallery as a managed asset.
   */
  public async saveCapturedMedia(request: SaveCapturedMediaRequest): Promise<MediaAssetRecord> {
    const parsed = SaveCapturedMediaRequestSchema.parse(request)
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
      parsed.dataUrl.trim()
    )
    if (!match) {
      throw new Error('Invalid image data URL provided for capture save.')
    }

    const buffer = Buffer.from(match[2], 'base64')
    const ext =
      parsed.mimeType === 'image/png'
        ? '.png'
        : parsed.mimeType === 'image/jpeg'
          ? '.jpg'
          : '.webp'
    const syntheticName = `${parsed.displayName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'capture'}${ext}`

    const tmpCapturePath = path.join(
      this.baseDir,
      `stage_${process.pid}_${crypto.randomBytes(4).toString('hex')}${ext}`
    )
    try {
      fs.writeFileSync(tmpCapturePath, buffer)
      const batchRes = await this.importBatch({
        profileId: parsed.profileId,
        items: [
          {
            filePath: tmpCapturePath,
            displayName: parsed.displayName,
            tags: parsed.tags,
            favorite: parsed.favorite
          }
        ],
        storageMode: 'managed_copy',
        sourceType: parsed.sourceType,
        sourceReference: parsed.sourceReference,
        duplicatePolicy: 'allow_duplicate'
      })

      const outcome = batchRes.outcomes[0]
      if (!outcome || outcome.status !== 'imported' || !outcome.asset) {
        throw new Error(outcome?.errorMessage || 'Failed to save captured image to Media Gallery.')
      }
      return outcome.asset
    } finally {
      if (fs.existsSync(tmpCapturePath)) {
        try {
          fs.unlinkSync(tmpCapturePath)
        } catch {
          // Ignore stage file cleanup failure
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. ASSET AVAILABILITY VERIFICATION, THUMBNAILS & PREVIEWS
  // --------------------------------------------------------------------------

  private resolveUnderlyingFilePath(asset: MediaAssetRecord, data: ProfileMediaData): string | null {
    if (asset.storageMode === 'managed_copy') {
      const candidate = path.join(this.assetsDir, asset.storageReference)
      if (!this.isPathInsideRoot(candidate, this.assetsDir)) {
        return null
      }
      return candidate
    }
    const extPath = data.externalPaths[asset.id]
    return extPath ? path.resolve(extPath) : null
  }

  private verifyAndRefreshAssetAvailability(
    asset: MediaAssetRecord,
    data: ProfileMediaData
  ): MediaAssetRecord {
    const filePath = this.resolveUnderlyingFilePath(asset, data)
    const exists = Boolean(filePath && fs.existsSync(filePath))

    if (!exists && asset.status === 'available') {
      const updated: MediaAssetRecord = {
        ...asset,
        status: 'unavailable',
        unavailableReason:
          asset.storageMode === 'external_reference'
            ? 'MISSING_EXTERNAL_SOURCE_FILE'
            : 'MISSING_MANAGED_ASSET_FILE',
        updatedAt: this.nowFn()
      }
      const idx = data.assets.findIndex((a) => a.id === asset.id)
      if (idx !== -1) {
        this.mutateAndPersist(() => {
          data.assets[idx] = updated
        })
      }
      return updated
    }

    if (exists && asset.status === 'unavailable') {
      const restored: MediaAssetRecord = {
        ...asset,
        status: 'available',
        unavailableReason: null,
        updatedAt: this.nowFn()
      }
      const idx = data.assets.findIndex((a) => a.id === asset.id)
      if (idx !== -1) {
        this.mutateAndPersist(() => {
          data.assets[idx] = restored
        })
      }
      return restored
    }

    return asset
  }

  public async getOrGenerateThumbnailDataUrl(
    id: string,
    rawProfileId?: string
  ): Promise<string | null> {
    const { data } = this.getProfileData(rawProfileId)
    const idx = data.assets.findIndex((a) => a.id === id)
    if (idx === -1) return null

    const asset = this.verifyAndRefreshAssetAvailability(data.assets[idx], data)
    if (asset.mediaType !== 'image' || asset.status !== 'available') {
      return null
    }

    const cacheKey = `${asset.id}_${asset.contentHashSha256}`
    const cached = this.thumbnailMemoryCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const existingPromise = this.inFlightThumbnails.get(cacheKey)
    if (existingPromise) {
      return existingPromise
    }

    const jobPromise = (async (): Promise<string | null> => {
      try {
        if (this.simulateThumbnailFailure) {
          throw new Error('Simulated thumbnail failure')
        }
        if (asset.thumbnailReference) {
          const thumbPath = path.join(this.thumbnailsDir, asset.thumbnailReference)
          if (this.isPathInsideRoot(thumbPath, this.thumbnailsDir) && fs.existsSync(thumbPath)) {
            const rawThumb = fs.readFileSync(thumbPath, 'utf-8')
            this.thumbnailMemoryCache.set(cacheKey, rawThumb)
            return rawThumb
          }
        }

        const underlyingPath = this.resolveUnderlyingFilePath(asset, data)
        if (!underlyingPath || !fs.existsSync(underlyingPath)) {
          return null
        }

        const buf = fs.readFileSync(underlyingPath)
        const dataUrl = `data:${asset.mimeType};base64,${buf.toString('base64')}`
        const thumbFileName = `${asset.id}.thumb`
        const thumbPath = path.join(this.thumbnailsDir, thumbFileName)
        fs.writeFileSync(thumbPath, dataUrl, 'utf-8')
        this.thumbnailMemoryCache.set(cacheKey, dataUrl)

        const currentIdx = data.assets.findIndex((a) => a.id === id)
        if (currentIdx !== -1) {
          const dims = computeBoundedThumbnailDimensions(
            asset.width,
            asset.height,
            this.limits.maxThumbnailEdgePx
          )
          this.mutateAndPersist(() => {
            data.assets[currentIdx] = {
              ...data.assets[currentIdx],
              thumbnailStatus: 'ready',
              thumbnailReference: thumbFileName,
              thumbnailWidth: dims?.width ?? asset.width,
              thumbnailHeight: dims?.height ?? asset.height
            }
          })
        }
        return dataUrl
      } catch {
        const currentIdx = data.assets.findIndex((a) => a.id === id)
        if (currentIdx !== -1) {
          this.mutateAndPersist(() => {
            data.assets[currentIdx] = {
              ...data.assets[currentIdx],
              thumbnailStatus: 'failed'
            }
          })
        }
        return null
      } finally {
        this.inFlightThumbnails.delete(cacheKey)
      }
    })()

    this.inFlightThumbnails.set(cacheKey, jobPromise)
    return jobPromise
  }

  public async getAssetPreview(
    id: string,
    rawProfileId?: string
  ): Promise<MediaAssetPreviewDescriptor> {
    const { data } = this.getProfileData(rawProfileId)
    const idx = data.assets.findIndex((a) => a.id === id)
    if (idx === -1) {
      throw new Error(`Media asset '${id}' not found.`)
    }

    const asset = this.verifyAndRefreshAssetAvailability(data.assets[idx], data)
    if (asset.status !== 'available') {
      return {
        assetId: asset.id,
        displayName: asset.displayName,
        mediaType: asset.mediaType,
        mimeType: asset.mimeType,
        status: asset.status,
        previewAvailable: false,
        previewDataUrl: null,
        thumbnailDataUrl: null,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        fileSizeBytes: asset.fileSizeBytes,
        unavailableReason: asset.unavailableReason ?? 'ASSET_UNAVAILABLE'
      }
    }

    const filePath = this.resolveUnderlyingFilePath(asset, data)
    if (!filePath || !fs.existsSync(filePath)) {
      return {
        assetId: asset.id,
        displayName: asset.displayName,
        mediaType: asset.mediaType,
        mimeType: asset.mimeType,
        status: 'unavailable',
        previewAvailable: false,
        previewDataUrl: null,
        thumbnailDataUrl: null,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        fileSizeBytes: asset.fileSizeBytes,
        unavailableReason: 'MISSING_SOURCE_FILE'
      }
    }

    const buf = fs.readFileSync(filePath)
    if (buf.length > this.limits.maxPreviewPayloadBytes) {
      return {
        assetId: asset.id,
        displayName: asset.displayName,
        mediaType: asset.mediaType,
        mimeType: asset.mimeType,
        status: asset.status,
        previewAvailable: false,
        previewDataUrl: null,
        thumbnailDataUrl: null,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        fileSizeBytes: asset.fileSizeBytes,
        unavailableReason: 'PREVIEW_PAYLOAD_TOO_LARGE'
      }
    }

    const previewDataUrl = `data:${asset.mimeType};base64,${buf.toString('base64')}`
    const thumbnailDataUrl =
      asset.mediaType === 'image'
        ? await this.getOrGenerateThumbnailDataUrl(asset.id, asset.profileId)
        : null

    return {
      assetId: asset.id,
      displayName: asset.displayName,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      status: asset.status,
      previewAvailable: true,
      previewDataUrl,
      thumbnailDataUrl,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.durationSeconds,
      fileSizeBytes: asset.fileSizeBytes,
      unavailableReason: null
    }
  }

  // --------------------------------------------------------------------------
  // 3. SEARCH, FILTERING, SORTING, METADATA EDITING & RELINKING
  // --------------------------------------------------------------------------

  public getAsset(id: string, rawProfileId?: string): MediaAssetRecord | null {
    const { data } = this.getProfileData(rawProfileId)
    const asset = data.assets.find((a) => a.id === id)
    if (!asset) return null
    return this.verifyAndRefreshAssetAvailability(asset, data)
  }

  public listAssets(request: ListMediaAssetsRequest = {}): ListMediaAssetsResult {
    const parsed = ListMediaAssetsRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const q = parsed.query?.toLowerCase().trim()

    const refreshed = data.assets.map((a) => this.verifyAndRefreshAssetAvailability(a, data))

    const filtered = refreshed.filter((asset) => {
      if (!parsed.includeUnavailable && asset.status !== 'available') return false
      if (parsed.mediaType !== 'all' && asset.mediaType !== parsed.mediaType) return false
      if (parsed.favoritesOnly && !asset.favorite) return false
      if (parsed.collectionId && !asset.collectionIds.includes(parsed.collectionId)) return false
      if (parsed.tag && !asset.tags.some((t) => t.toLowerCase() === parsed.tag!.toLowerCase())) {
        return false
      }
      if (q) {
        const inName = asset.displayName.toLowerCase().includes(q)
        const inOrig = asset.originalFileName.toLowerCase().includes(q)
        const inDesc = asset.description.toLowerCase().includes(q)
        const inTags = asset.tags.some((t) => t.toLowerCase().includes(q))
        if (!inName && !inOrig && !inDesc && !inTags) return false
      }
      return true
    })

    const dir = parsed.sortOrder === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      if (parsed.sortBy === 'displayName') {
        const cmp = a.displayName.localeCompare(b.displayName)
        if (cmp !== 0) return cmp * dir
      } else if (parsed.sortBy === 'fileSizeBytes') {
        if (a.fileSizeBytes !== b.fileSizeBytes) {
          return (a.fileSizeBytes - b.fileSizeBytes) * dir
        }
      } else if (parsed.sortBy === 'mediaType') {
        const cmp = a.mediaType.localeCompare(b.mediaType)
        if (cmp !== 0) return cmp * dir
      } else {
        if (a.importedAt !== b.importedAt) {
          return (a.importedAt - b.importedAt) * dir
        }
      }
      return a.id.localeCompare(b.id)
    })

    return {
      assets: filtered.slice(parsed.offset, parsed.offset + parsed.limit),
      totalCount: filtered.length,
      limit: parsed.limit,
      offset: parsed.offset
    }
  }

  public updateAssetMetadata(request: UpdateMediaAssetMetadataRequest): MediaAssetRecord {
    const parsed = UpdateMediaAssetMetadataRequestSchema.parse(request)
    const safety = inspectMediaMetadataSafety(
      'Media metadata',
      parsed.displayName,
      parsed.description
    )
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.assets.findIndex((a) => a.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Media asset '${parsed.id}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const current = data.assets[idx]
      const nextCollections =
        parsed.collectionIds !== undefined
          ? Array.from(
              new Set(
                parsed.collectionIds.filter((cid) =>
                  data.collections.some((c) => c.id === cid)
                )
              )
            )
          : current.collectionIds

      const updated: MediaAssetRecord = {
        ...current,
        displayName: parsed.displayName ?? current.displayName,
        description: parsed.description ?? current.description,
        tags: parsed.tags !== undefined ? Array.from(new Set(parsed.tags)) : current.tags,
        favorite: parsed.favorite ?? current.favorite,
        collectionIds: nextCollections,
        updatedAt: this.nowFn()
      }
      data.assets[idx] = updated
      this.recalculateCollectionCounts(data)
      return updated
    })
  }

  public relinkExternalAsset(request: RelinkExternalMediaAssetRequest): MediaAssetRecord {
    const parsed = RelinkExternalMediaAssetRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.assets.findIndex((a) => a.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Media asset '${parsed.id}' not found.`)
    }

    const current = data.assets[idx]
    if (current.storageMode !== 'external_reference') {
      throw new Error('Only external_reference assets can be relinked to a new external file path.')
    }

    const pathCheck = this.validateIncomingSourceFilePath(parsed.newFilePath)
    if (!pathCheck.valid || !pathCheck.resolvedPath) {
      throw new Error(pathCheck.errorMessage || 'Invalid relink file path.')
    }

    const buf = fs.readFileSync(pathCheck.resolvedPath)
    const inspection = inspectMediaFileBuffer(
      path.basename(pathCheck.resolvedPath),
      buf,
      this.limits
    )
    if (!inspection.valid || inspection.mediaType !== current.mediaType) {
      throw new Error(
        inspection.errorMessage || 'Relinked file format does not match the asset media type.'
      )
    }

    const newHash = crypto.createHash('sha256').update(buf).digest('hex')
    // Invalidate old thumbnail cache entry
    this.thumbnailMemoryCache.delete(`${current.id}_${current.contentHashSha256}`)

    return this.mutateAndPersist(() => {
      data.externalPaths[current.id] = pathCheck.resolvedPath!
      const updated: MediaAssetRecord = {
        ...current,
        contentHashSha256: newHash,
        fileSizeBytes: buf.length,
        width: inspection.width ?? current.width,
        height: inspection.height ?? current.height,
        durationSeconds: inspection.durationSeconds ?? current.durationSeconds,
        status: 'available',
        unavailableReason: null,
        updatedAt: this.nowFn()
      }
      data.assets[idx] = updated
      return updated
    })
  }

  // --------------------------------------------------------------------------
  // 4. COLLECTIONS & ORGANIZATION
  // --------------------------------------------------------------------------

  private recalculateCollectionCounts(data: ProfileMediaData): void {
    data.collections = data.collections.map((col) => {
      const count = data.assets.filter((a) => a.collectionIds.includes(col.id)).length
      return { ...col, assetCount: count }
    })
  }

  public createCollection(request: CreateMediaCollectionRequest): MediaCollectionRecord {
    const parsed = CreateMediaCollectionRequestSchema.parse(request)
    const safety = inspectMediaMetadataSafety(
      'Collection',
      parsed.name,
      parsed.description
    )
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { profileId, data } = this.getProfileData(parsed.profileId)
    if (data.collections.length >= this.limits.maxCollectionsPerProfile) {
      throw new Error(`Maximum number of collections (${this.limits.maxCollectionsPerProfile}) reached.`)
    }

    const duplicateName = data.collections.find(
      (c) => c.name.toLowerCase() === parsed.name.toLowerCase()
    )
    if (duplicateName) {
      throw new Error(`A collection named "${parsed.name}" already exists.`)
    }

    const now = this.nowFn()
    const collection: MediaCollectionRecord = {
      id: `col_${crypto.randomUUID()}`,
      profileId,
      name: parsed.name,
      description: parsed.description ?? '',
      assetCount: 0,
      createdAt: now,
      updatedAt: now,
      schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION
    }

    return this.mutateAndPersist(() => {
      data.collections.push(collection)
      return collection
    })
  }

  public listCollections(rawProfileId?: string): MediaCollectionRecord[] {
    const { data } = this.getProfileData(rawProfileId)
    this.recalculateCollectionCounts(data)
    return [...data.collections].sort((a, b) => a.name.localeCompare(b.name))
  }

  public updateCollection(request: UpdateMediaCollectionRequest): MediaCollectionRecord {
    const parsed = UpdateMediaCollectionRequestSchema.parse(request)
    const safety = inspectMediaMetadataSafety(
      'Collection',
      parsed.name,
      parsed.description
    )
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.collections.findIndex((c) => c.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Collection '${parsed.id}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const current = data.collections[idx]
      const updated: MediaCollectionRecord = {
        ...current,
        name: parsed.name ?? current.name,
        description: parsed.description ?? current.description,
        updatedAt: this.nowFn()
      }
      data.collections[idx] = updated
      return updated
    })
  }

  /**
   * Deletes a collection while preserving all member assets and their underlying media files.
   */
  public deleteCollection(request: DeleteMediaCollectionRequest): { deleted: boolean; id: string } {
    const parsed = DeleteMediaCollectionRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.collections.findIndex((c) => c.id === parsed.id)
    if (idx === -1) {
      return { deleted: false, id: parsed.id }
    }

    return this.mutateAndPersist(() => {
      data.collections.splice(idx, 1)
      data.assets = data.assets.map((asset) =>
        asset.collectionIds.includes(parsed.id)
          ? {
              ...asset,
              collectionIds: asset.collectionIds.filter((cid) => cid !== parsed.id),
              updatedAt: this.nowFn()
            }
          : asset
      )
      return { deleted: true, id: parsed.id }
    })
  }

  public modifyCollectionMembership(
    request: ModifyCollectionMembershipRequest
  ): MediaCollectionRecord {
    const parsed = ModifyCollectionMembershipRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const colIdx = data.collections.findIndex((c) => c.id === parsed.collectionId)
    if (colIdx === -1) {
      throw new Error(`Collection '${parsed.collectionId}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const targetSet = new Set(parsed.assetIds)
      data.assets = data.assets.map((asset) => {
        if (!targetSet.has(asset.id)) return asset
        const nextIds =
          parsed.action === 'add'
            ? Array.from(new Set([...asset.collectionIds, parsed.collectionId]))
            : asset.collectionIds.filter((cid) => cid !== parsed.collectionId)
        return {
          ...asset,
          collectionIds: nextIds,
          updatedAt: this.nowFn()
        }
      })
      this.recalculateCollectionCounts(data)
      return data.collections[colIdx]
    })
  }

  // --------------------------------------------------------------------------
  // 5. DISTINCT REMOVAL VS PERMANENT DELETION SEMANTICS & BULK OPERATIONS
  // --------------------------------------------------------------------------

  private cleanupThumbnailFiles(asset: MediaAssetRecord): boolean {
    this.thumbnailMemoryCache.delete(`${asset.id}_${asset.contentHashSha256}`)
    if (!asset.thumbnailReference) return false
    const thumbPath = path.join(this.thumbnailsDir, asset.thumbnailReference)
    if (this.isPathInsideRoot(thumbPath, this.thumbnailsDir) && fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath)
      return true
    }
    return false
  }

  /**
   * Removes an asset entry from the Media Gallery.
   * - For external_reference assets: removes the metadata entry and thumbnail derivative,
   *   and NEVER deletes or modifies the user's external source file.
   * - For managed_copy assets: removes the metadata entry, thumbnail derivative, and internal managed copy.
   */
  public removeAssetFromLibrary(
    request: RemoveMediaAssetFromLibraryRequest
  ): RemoveMediaAssetResult {
    const parsed = RemoveMediaAssetFromLibraryRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.assets.findIndex((a) => a.id === parsed.id)
    if (idx === -1) {
      return {
        removed: false,
        id: parsed.id,
        storageMode: 'managed_copy',
        managedCopyRemoved: false,
        originalExternalFilePreserved: true
      }
    }

    const asset = data.assets[idx]
    return this.mutateAndPersist(() => {
      let managedCopyRemoved = false
      if (asset.storageMode === 'managed_copy') {
        const managedPath = path.join(this.assetsDir, asset.storageReference)
        if (this.isPathInsideRoot(managedPath, this.assetsDir) && fs.existsSync(managedPath)) {
          fs.unlinkSync(managedPath)
          managedCopyRemoved = true
        }
      }
      this.cleanupThumbnailFiles(asset)
      delete data.externalPaths[asset.id]
      data.assets.splice(idx, 1)
      this.recalculateCollectionCounts(data)

      return {
        removed: true,
        id: asset.id,
        storageMode: asset.storageMode,
        managedCopyRemoved,
        originalExternalFilePreserved: true
      }
    })
  }

  /**
   * Permanently deletes an application-managed asset file under explicit user confirmation.
   * Strictly prohibited from deleting external user files outside the managed assets directory.
   */
  public deleteManagedAssetPermanently(
    request: DeleteManagedMediaAssetPermanentlyRequest
  ): DeleteManagedMediaAssetResult {
    const parsed = DeleteManagedMediaAssetPermanentlyRequestSchema.parse(request)
    if (!parsed.confirmPermanentDelete) {
      throw new Error(
        'CONFIRMATION_REQUIRED: Permanent deletion of a managed media asset requires explicit user confirmation.'
      )
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.assets.findIndex((a) => a.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Media asset '${parsed.id}' not found.`)
    }

    const asset = data.assets[idx]
    if (asset.storageMode !== 'managed_copy') {
      throw new Error(
        'EXTERNAL_SOURCE_DELETION_PROHIBITED: Cannot permanently delete an external_reference file; use removeAssetFromLibrary to unlink it safely without deleting the original file.'
      )
    }

    const managedPath = path.join(this.assetsDir, asset.storageReference)
    if (!this.isPathInsideRoot(managedPath, this.assetsDir)) {
      throw new Error(
        'SECURITY_BOUNDARY_VIOLATION: Refusing to delete file outside the managed media storage directory.'
      )
    }

    return this.mutateAndPersist(() => {
      let managedFileDeleted = false
      if (fs.existsSync(managedPath)) {
        fs.unlinkSync(managedPath)
        managedFileDeleted = true
      }
      const thumbnailDeleted = this.cleanupThumbnailFiles(asset)
      data.assets.splice(idx, 1)
      this.recalculateCollectionCounts(data)

      return {
        deleted: true,
        id: asset.id,
        managedFileDeleted,
        thumbnailDeleted
      }
    })
  }

  public executeBulkOperation(
    request: BulkMediaAssetOperationRequest
  ): BulkMediaAssetOperationResult {
    const parsed = BulkMediaAssetOperationRequestSchema.parse(request)
    const succeededIds: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    for (const assetId of parsed.assetIds) {
      try {
        if (parsed.operation === 'set_favorite') {
          this.updateAssetMetadata({
            profileId: parsed.profileId,
            id: assetId,
            favorite: true
          })
          succeededIds.push(assetId)
        } else if (parsed.operation === 'clear_favorite') {
          this.updateAssetMetadata({
            profileId: parsed.profileId,
            id: assetId,
            favorite: false
          })
          succeededIds.push(assetId)
        } else if (parsed.operation === 'add_to_collection') {
          if (!parsed.collectionId) {
            throw new Error('collectionId is required for add_to_collection')
          }
          this.modifyCollectionMembership({
            profileId: parsed.profileId,
            collectionId: parsed.collectionId,
            assetIds: [assetId],
            action: 'add'
          })
          succeededIds.push(assetId)
        } else if (parsed.operation === 'remove_from_collection') {
          if (!parsed.collectionId) {
            throw new Error('collectionId is required for remove_from_collection')
          }
          this.modifyCollectionMembership({
            profileId: parsed.profileId,
            collectionId: parsed.collectionId,
            assetIds: [assetId],
            action: 'remove'
          })
          succeededIds.push(assetId)
        } else if (parsed.operation === 'remove_from_library') {
          const res = this.removeAssetFromLibrary({
            profileId: parsed.profileId,
            id: assetId
          })
          if (!res.removed) {
            throw new Error('Asset not found')
          }
          succeededIds.push(assetId)
        } else if (parsed.operation === 'delete_managed_permanently') {
          this.deleteManagedAssetPermanently({
            profileId: parsed.profileId,
            id: assetId,
            confirmPermanentDelete: Boolean(parsed.confirmPermanentDelete)
          })
          succeededIds.push(assetId)
        }
      } catch (err) {
        failedItems.push({
          id: assetId,
          reason: err instanceof Error ? err.message : 'Bulk operation failed'
        })
      }
    }

    return {
      operation: parsed.operation,
      succeededIds,
      failedItems
    }
  }

  /**
   * Reconciles orphaned thumbnail files on disk that do not correspond to any tracked asset.
   */
  public reconcileOrphanedFiles(): { orphanedThumbnailsRemoved: number } {
    this.ensureDirectories()
    const validThumbNames = new Set<string>()
    for (const profileData of Object.values(this.store.profiles)) {
      for (const asset of profileData.assets) {
        if (asset.thumbnailReference) {
          validThumbNames.add(asset.thumbnailReference)
        }
      }
    }

    let orphanedThumbnailsRemoved = 0
    for (const entry of fs.readdirSync(this.thumbnailsDir)) {
      if (!validThumbNames.has(entry)) {
        const fullPath = path.join(this.thumbnailsDir, entry)
        if (this.isPathInsideRoot(fullPath, this.thumbnailsDir)) {
          try {
            fs.unlinkSync(fullPath)
            orphanedThumbnailsRemoved++
          } catch {
            // Ignore unlink error
          }
        }
      }
    }
    return { orphanedThumbnailsRemoved }
  }

  public getOverviewSnapshot(rawProfileId?: string): MediaLibraryOverviewSnapshot {
    const { profileId, data } = this.getProfileData(rawProfileId)
    const assets = this.listAssets({ profileId, includeUnavailable: true, limit: 200 }).assets
    return {
      profileId,
      assets,
      totalAssetsCount: data.assets.length,
      collections: this.listCollections(profileId),
      countsByType: {
        image: data.assets.filter((a) => a.mediaType === 'image').length,
        video: data.assets.filter((a) => a.mediaType === 'video').length,
        audio: data.assets.filter((a) => a.mediaType === 'audio').length,
        favorites: data.assets.filter((a) => a.favorite).length,
        unavailable: data.assets.filter((a) => a.status === 'unavailable').length
      }
    }
  }
}

