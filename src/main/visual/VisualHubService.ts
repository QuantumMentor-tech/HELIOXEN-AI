/**
 * HELIOXEN AI — Step 37: VisualHub Service
 * Main-process orchestration for Diagram Studio (Mermaid validation, rendering,
 * templates, local diagram persistence, and safe .mmd/.svg/.png exports) and
 * Image Studio (capability-aware AI provider image generation, progress lifecycle,
 * cancellation, temporary candidate management, and explicit saving to Step 36 Media Gallery).
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { AiProviderId } from '../../shared/ai/types'
import { inspectMediaFileBuffer } from '../../shared/media'
import { inspectMemorySafetyPolicy } from '../../shared/memory/contracts'
import {
  BUILTIN_MERMAID_TEMPLATES,
  CancelImageGenerationRequest,
  CancelImageGenerationRequestSchema,
  CancelImageGenerationResult,
  DEFAULT_MERMAID_SECURITY_CONFIG,
  DEFAULT_VISUALHUB_PREFERENCES,
  DEFAULT_VISUALHUB_PROFILE_ID,
  DeleteDiagramDocumentRequest,
  DeleteDiagramDocumentRequestSchema,
  DiagramDocumentRecord,
  DiscardGeneratedImageRequest,
  DiscardGeneratedImageRequestSchema,
  ExportDiagramRequest,
  ExportDiagramRequestSchema,
  ExportDiagramResult,
  ImageGenerationJobRecord,
  ImageGenerationRequest,
  ImageGenerationRequestSchema,
  ImageModelCapabilityDescriptor,
  ListDiagramDocumentsRequest,
  ListDiagramDocumentsRequestSchema,
  MermaidDiagramTemplate,
  MermaidRenderResult,
  MermaidSecurityConfig,
  renderBoundedPngBuffer,
  sanitizeSuggestedFileName,
  SaveDiagramDocumentRequest,
  SaveDiagramDocumentRequestSchema,
  SaveGeneratedImageToGalleryRequest,
  SaveGeneratedImageToGalleryRequestSchema,
  SaveGeneratedImageToGalleryResult,
  TemporaryGeneratedImageCandidate,
  ValidateAndRenderMermaidRequestSchema,
  validateAndRenderMermaidDiagram,
  VERIFIED_IMAGE_MODEL_CAPABILITIES,
  VISUALHUB_SCHEMA_VERSION,
  VisualHubOverviewSnapshot,
  VisualHubPreferences,
  VisualHubPreferencesSchema,
  VisualHubProfileIdSchema
} from '../../shared/visual'
import { MediaLibraryService } from '../media/MediaLibraryService'
import { ProviderService } from '../ai/ProviderService'
import { AiProviderException } from '../ai/errors'

interface ProfileVisualHubData {
  diagrams: DiagramDocumentRecord[]
  preferences: VisualHubPreferences
}

interface PersistedVisualHubStore {
  schemaVersion: number
  updatedAt: number
  profiles: Record<string, ProfileVisualHubData>
}

export interface VisualHubServiceOptions {
  readonly storageDir: string
  readonly mediaLibraryService: MediaLibraryService
  readonly providerServiceGetter: () => ProviderService
  readonly securityConfig?: MermaidSecurityConfig
  readonly nowFn?: () => number
  readonly maxTransientCandidates?: number
}

export class VisualHubService {
  private readonly baseDir: string
  private readonly exportsDir: string
  private readonly storePath: string
  private readonly mediaLibraryService: MediaLibraryService
  private readonly providerServiceGetter: () => ProviderService
  private readonly securityConfig: MermaidSecurityConfig
  private readonly nowFn: () => number
  private readonly maxTransientCandidates: number

  private store: PersistedVisualHubStore
  private activeJobs = new Map<string, ImageGenerationJobRecord>()
  private jobAbortControllers = new Map<string, AbortController>()
  private activePromptLocks = new Set<string>()
  private transientCandidates = new Map<string, TemporaryGeneratedImageCandidate>()

  constructor(options: VisualHubServiceOptions) {
    this.baseDir = path.resolve(options.storageDir, 'visual_hub')
    this.exportsDir = path.join(this.baseDir, 'exports')
    this.storePath = path.join(this.baseDir, 'visual_hub_store.json')
    this.mediaLibraryService = options.mediaLibraryService
    this.providerServiceGetter = options.providerServiceGetter
    this.securityConfig = options.securityConfig ?? DEFAULT_MERMAID_SECURITY_CONFIG
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.maxTransientCandidates = options.maxTransientCandidates ?? 25

    this.ensureDirectories()
    this.store = this.loadStoreFromDisk()
  }

  public getExportsDirectory(): string {
    return this.exportsDir
  }

  public dispose(): void {
    for (const controller of this.jobAbortControllers.values()) {
      try {
        controller.abort()
      } catch {
        // Ignore abort error
      }
    }
    this.jobAbortControllers.clear()
    this.activePromptLocks.clear()
    this.transientCandidates.clear()
    this.activeJobs.clear()
  }

  // --------------------------------------------------------------------------
  // Persistence & Profile Store
  // --------------------------------------------------------------------------

  private ensureDirectories(): void {
    for (const dir of [this.baseDir, this.exportsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  private createDefaultProfileData(): ProfileVisualHubData {
    return {
      diagrams: [],
      preferences: { ...DEFAULT_VISUALHUB_PREFERENCES }
    }
  }

  private loadStoreFromDisk(): PersistedVisualHubStore {
    try {
      this.ensureDirectories()
      if (!fs.existsSync(this.storePath)) {
        return {
          schemaVersion: VISUALHUB_SCHEMA_VERSION,
          updatedAt: this.nowFn(),
          profiles: {
            [DEFAULT_VISUALHUB_PROFILE_ID]: this.createDefaultProfileData()
          }
        }
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedVisualHubStore>
      if (!parsed || typeof parsed !== 'object' || !parsed.profiles) {
        throw new Error('Invalid VisualHub store structure')
      }

      const profiles: Record<string, ProfileVisualHubData> = {}
      for (const [profileId, data] of Object.entries(parsed.profiles)) {
        profiles[profileId] = {
          diagrams: Array.isArray(data?.diagrams) ? data.diagrams : [],
          preferences: {
            ...DEFAULT_VISUALHUB_PREFERENCES,
            ...(data?.preferences ?? {})
          }
        }
      }

      if (!profiles[DEFAULT_VISUALHUB_PROFILE_ID]) {
        profiles[DEFAULT_VISUALHUB_PROFILE_ID] = this.createDefaultProfileData()
      }

      return {
        schemaVersion: VISUALHUB_SCHEMA_VERSION,
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
        schemaVersion: VISUALHUB_SCHEMA_VERSION,
        updatedAt: this.nowFn(),
        profiles: {
          [DEFAULT_VISUALHUB_PROFILE_ID]: this.createDefaultProfileData()
        }
      }
    }
  }

  private getProfileData(rawProfileId?: string): { profileId: string; data: ProfileVisualHubData } {
    const profileId = VisualHubProfileIdSchema.parse(rawProfileId ?? DEFAULT_VISUALHUB_PROFILE_ID)
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
      fs.renameSync(tmpPath, this.storePath)
      return result
    } catch (err) {
      this.store = JSON.parse(snapshot) as PersistedVisualHubStore
      throw err
    }
  }

  // --------------------------------------------------------------------------
  // 1. DIAGRAM STUDIO: TEMPLATES, VALIDATION, RENDERING & PERSISTENCE
  // --------------------------------------------------------------------------

  public listTemplates(): readonly MermaidDiagramTemplate[] {
    return BUILTIN_MERMAID_TEMPLATES
  }

  public validateAndRenderMermaid(request: { source: string }): MermaidRenderResult {
    const parsed = ValidateAndRenderMermaidRequestSchema.parse(request)
    return validateAndRenderMermaidDiagram(parsed.source, this.securityConfig)
  }

  public saveDiagramDocument(request: SaveDiagramDocumentRequest): DiagramDocumentRecord {
    const parsed = SaveDiagramDocumentRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)

    const titleSafety = inspectMemorySafetyPolicy(parsed.title)
    if (!titleSafety.allowed) {
      throw new Error(titleSafety.reason ?? 'Diagram title violates privacy policy.')
    }
    if (parsed.description) {
      const descSafety = inspectMemorySafetyPolicy(parsed.description)
      if (!descSafety.allowed) {
        throw new Error(descSafety.reason ?? 'Diagram description violates privacy policy.')
      }
    }

    const renderRes = validateAndRenderMermaidDiagram(parsed.source, this.securityConfig)
    if (!renderRes.valid || !renderRes.diagramType) {
      const firstDiag = renderRes.diagnostics[0]?.message ?? 'Invalid Mermaid diagram syntax.'
      throw new Error(`INVALID_MERMAID_DIAGRAM: Cannot save invalid diagram (${firstDiag})`)
    }

    const now = this.nowFn()
    return this.mutateAndPersist(() => {
      if (parsed.id) {
        const existingIdx = data.diagrams.findIndex((d) => d.id === parsed.id)
        if (existingIdx !== -1) {
          const updated: DiagramDocumentRecord = {
            ...data.diagrams[existingIdx],
            title: parsed.title,
            description: parsed.description ?? data.diagrams[existingIdx].description,
            diagramType: renderRes.diagramType!,
            source: parsed.source,
            tags:
              parsed.tags !== undefined
                ? Array.from(new Set(parsed.tags))
                : data.diagrams[existingIdx].tags,
            updatedAt: now
          }
          data.diagrams[existingIdx] = updated
          return updated
        }
      }

      const record: DiagramDocumentRecord = {
        id: parsed.id ?? `diag_${crypto.randomUUID()}`,
        profileId,
        title: parsed.title,
        description: parsed.description ?? '',
        diagramType: renderRes.diagramType!,
        source: parsed.source,
        tags: Array.from(new Set(parsed.tags ?? [])),
        createdAt: now,
        updatedAt: now,
        schemaVersion: VISUALHUB_SCHEMA_VERSION
      }
      data.diagrams.unshift(record)
      return record
    })
  }

  public listDiagramDocuments(
    request: ListDiagramDocumentsRequest = {}
  ): DiagramDocumentRecord[] {
    const parsed = ListDiagramDocumentsRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const q = parsed.query?.toLowerCase().trim()

    const filtered = data.diagrams.filter((doc) => {
      if (parsed.diagramType !== 'all' && doc.diagramType !== parsed.diagramType) {
        return false
      }
      if (q) {
        const inTitle = doc.title.toLowerCase().includes(q)
        const inDesc = doc.description.toLowerCase().includes(q)
        const inTags = doc.tags.some((t) => t.toLowerCase().includes(q))
        if (!inTitle && !inDesc && !inTags) return false
      }
      return true
    })

    return filtered
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, parsed.limit)
  }

  public deleteDiagramDocument(
    request: DeleteDiagramDocumentRequest
  ): { deleted: boolean; id: string } {
    const parsed = DeleteDiagramDocumentRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.diagrams.findIndex((d) => d.id === parsed.id)
    if (idx === -1) {
      return { deleted: false, id: parsed.id }
    }
    return this.mutateAndPersist(() => {
      data.diagrams.splice(idx, 1)
      return { deleted: true, id: parsed.id }
    })
  }

  // --------------------------------------------------------------------------
  // 2. SAFE DIAGRAM EXPORT (.mmd, .svg, .png) & GALLERY EXPORT
  // --------------------------------------------------------------------------

  private isPathInsideRoot(candidatePath: string, rootDir: string): boolean {
    const resolvedCandidate = path.resolve(candidatePath)
    const resolvedRoot = path.resolve(rootDir)
    const rel = path.relative(resolvedRoot, resolvedCandidate)
    return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel))
  }

  public exportDiagram(request: ExportDiagramRequest): ExportDiagramResult {
    const parsed = ExportDiagramRequestSchema.parse(request)
    const renderRes = validateAndRenderMermaidDiagram(parsed.source, this.securityConfig)

    if (!renderRes.valid || !renderRes.diagramType || !renderRes.svgMarkup) {
      return {
        exported: false,
        format: parsed.format,
        filePath: null,
        byteSize: 0,
        diagramType: renderRes.diagramType,
        errorCode: renderRes.diagnostics[0]?.code ?? 'INVALID_DIAGRAM_SOURCE',
        errorMessage:
          renderRes.diagnostics[0]?.message ?? 'Cannot export an invalid Mermaid diagram.'
      }
    }

    const ext = `.${parsed.format}`
    const baseName = sanitizeSuggestedFileName(
      parsed.suggestedFileName || `${renderRes.diagramType}-diagram`,
      'diagram'
    )

    let targetPath: string
    if (parsed.targetFilePath) {
      const rawSegments = parsed.targetFilePath.split(/[\\/]+/)
      if (rawSegments.includes('..') || !path.isAbsolute(parsed.targetFilePath)) {
        return {
          exported: false,
          format: parsed.format,
          filePath: null,
          byteSize: 0,
          diagramType: renderRes.diagramType,
          errorCode: 'INVALID_EXPORT_PATH',
          errorMessage: 'Export destination must be a safe, explicit absolute file path without traversal segments.'
        }
      }
      targetPath = path.resolve(parsed.targetFilePath)
    } else {
      this.ensureDirectories()
      targetPath = path.join(this.exportsDir, `${baseName}-${this.nowFn()}${ext}`)
      if (!this.isPathInsideRoot(targetPath, this.exportsDir)) {
        return {
          exported: false,
          format: parsed.format,
          filePath: null,
          byteSize: 0,
          diagramType: renderRes.diagramType,
          errorCode: 'EXPORT_PATH_VIOLATION',
          errorMessage: 'Resolved export path escaped the managed exports directory.'
        }
      }
    }

    if (fs.existsSync(targetPath) && !parsed.overwriteExisting) {
      return {
        exported: false,
        format: parsed.format,
        filePath: null,
        byteSize: 0,
        diagramType: renderRes.diagramType,
        errorCode: 'FILE_EXISTS_CONFLICT',
        errorMessage: 'Target file already exists and overwriteExisting was not authorized.'
      }
    }

    try {
      const parentDir = path.dirname(targetPath)
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      let payloadBuffer: Buffer
      if (parsed.format === 'mmd') {
        payloadBuffer = Buffer.from(parsed.source, 'utf-8')
      } else if (parsed.format === 'svg') {
        payloadBuffer = Buffer.from(renderRes.svgMarkup, 'utf-8')
      } else {
        const scale = parsed.scale ?? 1
        const outW = Math.min(4096, Math.round((parsed.width ?? renderRes.width ?? 800) * scale))
        const outH = Math.min(4096, Math.round((parsed.height ?? renderRes.height ?? 480) * scale))
        payloadBuffer = renderBoundedPngBuffer(outW, outH)
      }

      if (payloadBuffer.length > 25 * 1024 * 1024) {
        return {
          exported: false,
          format: parsed.format,
          filePath: null,
          byteSize: 0,
          diagramType: renderRes.diagramType,
          errorCode: 'EXPORT_SIZE_LIMIT_EXCEEDED',
          errorMessage: 'Exported diagram output exceeds the 25 MB maximum size limit.'
        }
      }

      fs.writeFileSync(targetPath, payloadBuffer)
      const stat = fs.statSync(targetPath)

      return {
        exported: true,
        format: parsed.format,
        filePath: targetPath,
        byteSize: stat.size,
        diagramType: renderRes.diagramType
      }
    } catch (err) {
      return {
        exported: false,
        format: parsed.format,
        filePath: null,
        byteSize: 0,
        diagramType: renderRes.diagramType,
        errorCode: 'EXPORT_WRITE_FAILED',
        errorMessage: err instanceof Error ? err.message : 'Failed to write exported diagram file.'
      }
    }
  }

  public async saveDiagramPngToGallery(request: {
    profileId?: string
    source: string
    displayName: string
    tags?: readonly string[]
    favorite?: boolean
  }) {
    const renderRes = validateAndRenderMermaidDiagram(request.source, this.securityConfig)
    if (!renderRes.valid || !renderRes.diagramType) {
      throw new Error(
        renderRes.diagnostics[0]?.message ?? 'Cannot save invalid Mermaid diagram to Media Gallery.'
      )
    }

    const pngBuf = renderBoundedPngBuffer(renderRes.width ?? 800, renderRes.height ?? 480)
    const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`

    return this.mediaLibraryService.saveCapturedMedia({
      profileId: request.profileId,
      displayName: request.displayName,
      dataUrl,
      mimeType: 'image/png',
      width: renderRes.width ?? 800,
      height: renderRes.height ?? 480,
      sourceType: 'exported_diagram',
      sourceReference: `mermaid:${renderRes.diagramType}`,
      tags: request.tags ?? ['diagram', renderRes.diagramType],
      favorite: request.favorite ?? false
    })
  }

  // --------------------------------------------------------------------------
  // 3. CAPABILITY-AWARE AI IMAGE GENERATION & LIFECYCLE
  // --------------------------------------------------------------------------

  public async getEligibleImageModels(): Promise<ImageModelCapabilityDescriptor[]> {
    const providerService = this.providerServiceGetter()
    const credStatus = await providerService.getCredentialStatus()
    const healthStatus = providerService.getHealthStatus()

    const results: ImageModelCapabilityDescriptor[] = []
    for (const def of Object.values(VERIFIED_IMAGE_MODEL_CAPABILITIES)) {
      const isProviderConfigured = Boolean(credStatus[def.providerId]?.configured)
      const providerHealth = healthStatus[def.providerId]?.status ?? 'unknown'
      const isProviderHealthy =
        providerHealth === 'healthy' || providerHealth === 'unknown' || providerHealth === 'degraded'
      const isEligible = def.supportsImageGeneration && isProviderConfigured && isProviderHealthy

      let unavailabilityReason: string | undefined
      if (!isProviderConfigured) {
        unavailabilityReason = `API key for ${def.providerId === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} is not configured in Settings.`
      } else if (!isProviderHealthy) {
        unavailabilityReason = `Provider ${def.providerId} is currently ${providerHealth}.`
      }

      results.push({
        ...def,
        isProviderConfigured,
        isProviderHealthy,
        isEligible,
        unavailabilityReason
      })
    }

    return results
  }

  public async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationJobRecord> {
    const parsed = ImageGenerationRequestSchema.parse(request)
    const { profileId } = this.getProfileData(parsed.profileId)

    if (!parsed.externalTransmissionConfirmed) {
      throw new Error(
        'EXTERNAL_TRANSMISSION_CONSENT_REQUIRED: Explicit confirmation is required before sending prompts or reference images to an external AI provider.'
      )
    }

    const promptSafety = inspectMemorySafetyPolicy(parsed.prompt)
    if (!promptSafety.allowed) {
      throw new Error(
        `PRIVACY_POLICY_REJECTED: Image prompt contains restricted secret or credential patterns (${promptSafety.reason}).`
      )
    }

    // Verify model capability descriptor
    const capability = VERIFIED_IMAGE_MODEL_CAPABILITIES[parsed.modelId]
    if (!capability || capability.providerId !== parsed.providerId || !capability.supportsImageGeneration) {
      throw new Error(
        `UNSUPPORTED_IMAGE_MODEL: Model '${parsed.modelId}' is not an eligible image-generation model for provider '${parsed.providerId}'.`
      )
    }

    // Validate model-specific parameters strictly against capability metadata
    if (
      parsed.aspectRatio &&
      !capability.supportedAspectRatios.includes(parsed.aspectRatio)
    ) {
      throw new Error(
        `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' does not support aspect ratio '${parsed.aspectRatio}'.`
      )
    }

    if (
      parsed.resolution &&
      !capability.supportedResolutions.includes(parsed.resolution)
    ) {
      throw new Error(
        `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' does not support resolution '${parsed.resolution}'.`
      )
    }

    if (
      parsed.quality &&
      !capability.supportedQualities.includes(parsed.quality)
    ) {
      throw new Error(
        `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' does not support quality '${parsed.quality}'.`
      )
    }

    if (
      parsed.outputFormat &&
      !capability.supportedOutputFormats.includes(parsed.outputFormat)
    ) {
      throw new Error(
        `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' does not support output format '${parsed.outputFormat}'.`
      )
    }

    if (
      parsed.background === 'transparent' &&
      !capability.supportsTransparentBackground
    ) {
      throw new Error(
        `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' does not support transparent backgrounds.`
      )
    }

    if (
      parsed.background === 'transparent' &&
      parsed.outputFormat === 'image/jpeg'
    ) {
      throw new Error(
        'UNSUPPORTED_MODEL_OPTION: Transparent background requires image/png or image/webp output format.'
      )
    }

    if ((parsed.numberOfImages ?? 1) > capability.maxImagesPerRequest) {
      throw new Error(
        `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' supports at most ${capability.maxImagesPerRequest} image(s) per request.`
      )
    }

    // Validate reference images if provided
    const referenceImagesPayload: { mimeType: string; base64Data: string }[] = []
    if (parsed.referenceAssetIds && parsed.referenceAssetIds.length > 0) {
      if (!capability.supportsReferenceImages) {
        throw new Error(
          `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' does not support reference-image inputs.`
        )
      }
      if (parsed.referenceAssetIds.length > capability.maxReferenceImages) {
        throw new Error(
          `UNSUPPORTED_MODEL_OPTION: Model '${parsed.modelId}' supports at most ${capability.maxReferenceImages} reference images.`
        )
      }

      for (const refAssetId of parsed.referenceAssetIds) {
        const asset = this.mediaLibraryService.getAsset(refAssetId, profileId)
        if (!asset || asset.status !== 'available' || asset.mediaType !== 'image') {
          throw new Error(
            `INVALID_REFERENCE_ASSET: Reference media asset '${refAssetId}' is missing, unavailable, or not a valid image.`
          )
        }
        const preview = await this.mediaLibraryService.getAssetPreview(refAssetId, profileId)
        if (!preview.previewAvailable || !preview.previewDataUrl) {
          throw new Error(
            `INVALID_REFERENCE_ASSET: Reference media asset '${refAssetId}' bytes could not be loaded.`
          )
        }
        const commaIdx = preview.previewDataUrl.indexOf(',')
        const base64Data =
          commaIdx >= 0 ? preview.previewDataUrl.slice(commaIdx + 1) : preview.previewDataUrl
        referenceImagesPayload.push({
          mimeType: asset.mimeType,
          base64Data
        })
      }
    }

    // Prevent accidental duplicate concurrent submission of identical request
    const dedupKey = `${profileId}:${parsed.providerId}:${parsed.modelId}:${parsed.prompt.trim()}`
    if (this.activePromptLocks.has(dedupKey)) {
      throw new Error(
        'DUPLICATE_GENERATION_IN_PROGRESS: An identical image generation request is already in progress.'
      )
    }

    const jobId = `imgjob_${crypto.randomUUID()}`
    const abortController = new AbortController()
    this.jobAbortControllers.set(jobId, abortController)
    this.activePromptLocks.add(dedupKey)

    const now = this.nowFn()
    let jobRecord: ImageGenerationJobRecord = {
      jobId,
      profileId,
      providerId: parsed.providerId,
      modelId: parsed.modelId,
      promptSummary: parsed.prompt.slice(0, 140),
      state: 'preparing_request',
      statusMessage: 'Validating request and preparing provider payload...',
      candidates: [],
      retryable: false,
      cancellationStatus: 'not_requested',
      startedAt: now,
      updatedAt: now,
      completedAt: null
    }
    this.activeJobs.set(jobId, jobRecord)

    const updateJobState = (patch: Partial<ImageGenerationJobRecord>): ImageGenerationJobRecord => {
      const current = this.activeJobs.get(jobId) ?? jobRecord
      jobRecord = {
        ...current,
        ...patch,
        updatedAt: this.nowFn()
      }
      this.activeJobs.set(jobId, jobRecord)
      return jobRecord
    }

    try {
      updateJobState({
        state: 'waiting_for_provider',
        statusMessage: `Dispatching generation request to ${parsed.providerId} (${parsed.modelId})...`
      })

      const providerService = this.providerServiceGetter()
      updateJobState({
        state: 'generating',
        statusMessage: 'Generating image with provider...'
      })

      const providerRes = await providerService.generateImage(
        {
          provider: parsed.providerId,
          model: parsed.modelId,
          prompt: parsed.prompt,
          aspectRatio: parsed.aspectRatio,
          resolution: parsed.resolution,
          quality: parsed.quality,
          outputFormat: parsed.outputFormat,
          background: parsed.background,
          numberOfImages: parsed.numberOfImages ?? 1,
          referenceImages: referenceImagesPayload
        },
        abortController.signal
      )

      // Check if cancelled while awaiting response (late response after cancellation)
      if (
        abortController.signal.aborted ||
        this.activeJobs.get(jobId)?.state === 'cancel_requested' ||
        this.activeJobs.get(jobId)?.state === 'cancelled'
      ) {
        return updateJobState({
          state: 'cancelled',
          cancellationStatus: 'confirmed',
          statusMessage: 'Image generation was cancelled; late provider response was discarded.',
          candidates: [],
          completedAt: this.nowFn()
        })
      }

      updateJobState({
        state: 'receiving_result',
        statusMessage: 'Validating generated image bytes...'
      })

      if (!providerRes || !Array.isArray(providerRes.images) || providerRes.images.length === 0) {
        return updateJobState({
          state: 'failed',
          errorCode: 'EMPTY_IMAGE_OUTPUT',
          errorMessage: 'Provider returned an empty image generation response.',
          statusMessage: 'Generation failed: Empty response from provider.',
          retryable: false,
          completedAt: this.nowFn()
        })
      }

      updateJobState({
        state: 'preparing_preview',
        statusMessage: 'Verifying binary headers and preparing transient preview...'
      })

      const validatedCandidates: TemporaryGeneratedImageCandidate[] = []
      for (const imgItem of providerRes.images) {
        if (!imgItem.base64Data || typeof imgItem.base64Data !== 'string') {
          continue
        }
        const rawBytes = Buffer.from(imgItem.base64Data, 'base64')
        const ext =
          imgItem.mimeType === 'image/jpeg'
            ? '.jpg'
            : imgItem.mimeType === 'image/webp'
              ? '.webp'
              : '.png'
        const inspection = inspectMediaFileBuffer(`generated${ext}`, rawBytes)
        if (!inspection.valid || inspection.mediaType !== 'image' || !inspection.mimeType) {
          return updateJobState({
            state: 'failed',
            errorCode: inspection.errorCode ?? 'CORRUPT_GENERATED_IMAGE',
            errorMessage:
              inspection.errorMessage ??
              'Generated output failed binary media header validation and was rejected.',
            statusMessage: 'Generation failed: Provider output failed binary validation.',
            retryable: false,
            completedAt: this.nowFn()
          })
        }

        const candidateId = `cand_${crypto.randomUUID()}`
        const candidate: TemporaryGeneratedImageCandidate = {
          candidateId,
          jobId,
          providerId: parsed.providerId,
          modelId: parsed.modelId,
          promptSummary: parsed.prompt.slice(0, 200),
          mimeType: inspection.mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
          dataUrl: `data:${inspection.mimeType};base64,${rawBytes.toString('base64')}`,
          width: inspection.width ?? 1024,
          height: inspection.height ?? 1024,
          byteSize: rawBytes.length,
          aspectRatio: parsed.aspectRatio,
          resolution: parsed.resolution,
          quality: parsed.quality,
          background: parsed.background,
          referenceAssetIds: parsed.referenceAssetIds ?? [],
          createdAt: this.nowFn(),
          savedAssetId: null
        }

        this.registerTransientCandidate(candidate)
        validatedCandidates.push(candidate)
      }

      if (validatedCandidates.length === 0) {
        return updateJobState({
          state: 'failed',
          errorCode: 'INVALID_IMAGE_OUTPUT',
          errorMessage: 'No decodable, valid images were returned by the provider.',
          statusMessage: 'Generation failed: Invalid binary output.',
          retryable: false,
          completedAt: this.nowFn()
        })
      }

      return updateJobState({
        state: 'completed',
        statusMessage: `Generated ${validatedCandidates.length} image(s). Review and click "Save to Media Gallery" to persist.`,
        candidates: validatedCandidates,
        completedAt: this.nowFn()
      })
    } catch (err: unknown) {
      if (
        abortController.signal.aborted ||
        (err instanceof AiProviderException && err.code === 'CANCELLED')
      ) {
        return updateJobState({
          state: 'cancelled',
          cancellationStatus: 'confirmed',
          statusMessage: 'Image generation cancelled by user.',
          candidates: [],
          completedAt: this.nowFn()
        })
      }

      const isTimeout =
        (err instanceof AiProviderException && err.code === 'TIMEOUT') ||
        (err instanceof Error && /timeout|ETIMEDOUT/i.test(err.message))

      if (isTimeout) {
        return updateJobState({
          state: 'outcome_unknown',
          errorCode: 'TIMEOUT_OUTCOME_UNKNOWN',
          errorMessage:
            'Provider request timed out before completion could be confirmed. To avoid accidental duplicate charges, automatic retry was not performed.',
          statusMessage: 'Outcome unknown: Request timed out. Review before retrying.',
          retryable: true,
          completedAt: this.nowFn()
        })
      }

      const errorCode = err instanceof AiProviderException ? err.code : 'PROVIDER_ERROR'
      const errorMessage = err instanceof Error ? err.message : String(err)
      const retryable = err instanceof AiProviderException ? err.retryable : false

      return updateJobState({
        state: 'failed',
        errorCode,
        errorMessage,
        statusMessage: `Generation failed: ${errorMessage}`,
        retryable,
        completedAt: this.nowFn()
      })
    } finally {
      this.jobAbortControllers.delete(jobId)
      this.activePromptLocks.delete(dedupKey)
    }
  }

  private registerTransientCandidate(candidate: TemporaryGeneratedImageCandidate): void {
    // Bound transient memory usage
    while (this.transientCandidates.size >= this.maxTransientCandidates) {
      const oldestKey = this.transientCandidates.keys().next().value
      if (!oldestKey) break
      this.transientCandidates.delete(oldestKey)
    }
    this.transientCandidates.set(candidate.candidateId, candidate)
  }

  public cancelImageGeneration(
    request: CancelImageGenerationRequest
  ): CancelImageGenerationResult {
    const parsed = CancelImageGenerationRequestSchema.parse(request)
    const job = this.activeJobs.get(parsed.jobId)
    if (!job) {
      throw new Error(`Generation job '${parsed.jobId}' not found.`)
    }

    const controller = this.jobAbortControllers.get(parsed.jobId)
    if (controller) {
      controller.abort()
      this.jobAbortControllers.delete(parsed.jobId)
    }

    const updated: ImageGenerationJobRecord = {
      ...job,
      state: 'cancelled',
      cancellationStatus: 'confirmed',
      statusMessage: 'Cancellation requested and confirmed; local resources released.',
      candidates: [],
      updatedAt: this.nowFn(),
      completedAt: this.nowFn()
    }
    this.activeJobs.set(parsed.jobId, updated)

    return {
      jobId: parsed.jobId,
      state: 'cancelled',
      cancellationStatus: 'confirmed',
      message: 'Image generation operation cancelled.'
    }
  }

  // --------------------------------------------------------------------------
  // 4. EXPLICIT SAVE TO STEP 36 MEDIA GALLERY & TRANSIENT CLEANUP
  // --------------------------------------------------------------------------

  public async saveGeneratedImageToGallery(
    request: SaveGeneratedImageToGalleryRequest
  ): Promise<SaveGeneratedImageToGalleryResult> {
    const parsed = SaveGeneratedImageToGalleryRequestSchema.parse(request)
    const candidate = this.transientCandidates.get(parsed.candidateId)
    if (!candidate) {
      throw new Error(
        `CANDIDATE_NOT_FOUND: Temporary generated image '${parsed.candidateId}' is no longer in session memory or was already discarded.`
      )
    }

    const provenanceRef = `ai:${candidate.providerId}:${candidate.modelId}:job=${candidate.jobId}`
    const baseTags = new Set<string>(['ai-generated', candidate.providerId, ...(parsed.tags ?? [])])

    // Delegate storage and binary validation to Step 36 MediaLibraryService
    const savedAsset = await this.mediaLibraryService.saveCapturedMedia({
      profileId: parsed.profileId,
      displayName: parsed.displayName,
      dataUrl: candidate.dataUrl,
      mimeType: candidate.mimeType,
      width: candidate.width,
      height: candidate.height,
      sourceType: 'ai_generated_image',
      sourceReference: provenanceRef,
      tags: Array.from(baseTags),
      favorite: parsed.favorite ?? false
    })

    if (parsed.retainPromptInMetadata && candidate.promptSummary) {
      this.mediaLibraryService.updateAssetMetadata({
        profileId: parsed.profileId,
        id: savedAsset.id,
        description: `Generated by ${candidate.modelId} (${candidate.providerId}). Prompt: ${candidate.promptSummary}`
      })
    }

    const updatedCandidate: TemporaryGeneratedImageCandidate = {
      ...candidate,
      savedAssetId: savedAsset.id
    }
    this.transientCandidates.set(candidate.candidateId, updatedCandidate)

    // Also update job record candidate reference if present
    const job = this.activeJobs.get(candidate.jobId)
    if (job) {
      this.activeJobs.set(candidate.jobId, {
        ...job,
        candidates: job.candidates.map((c) =>
          c.candidateId === candidate.candidateId ? updatedCandidate : c
        )
      })
    }

    return {
      saved: true,
      candidateId: candidate.candidateId,
      asset: this.mediaLibraryService.getAsset(savedAsset.id, parsed.profileId) ?? savedAsset
    }
  }

  /**
   * Discards a transient generated candidate from VisualHub session memory.
   * NEVER deletes any asset already saved to the Step 36 Media Gallery.
   */
  public discardGeneratedCandidate(
    request: DiscardGeneratedImageRequest
  ): { discarded: boolean; candidateId: string; preservedSavedAssetId: string | null } {
    const parsed = DiscardGeneratedImageRequestSchema.parse(request)
    const existing = this.transientCandidates.get(parsed.candidateId)
    if (!existing) {
      return {
        discarded: false,
        candidateId: parsed.candidateId,
        preservedSavedAssetId: null
      }
    }

    const preservedSavedAssetId = existing.savedAssetId
    this.transientCandidates.delete(parsed.candidateId)

    const job = this.activeJobs.get(existing.jobId)
    if (job) {
      this.activeJobs.set(existing.jobId, {
        ...job,
        candidates: job.candidates.filter((c) => c.candidateId !== parsed.candidateId)
      })
    }

    return {
      discarded: true,
      candidateId: parsed.candidateId,
      preservedSavedAssetId
    }
  }

  public getPreferences(rawProfileId?: string): VisualHubPreferences {
    const { data } = this.getProfileData(rawProfileId)
    return { ...data.preferences }
  }

  public updatePreferences(
    preferences: Partial<VisualHubPreferences>,
    rawProfileId?: string
  ): VisualHubPreferences {
    const { data } = this.getProfileData(rawProfileId)
    const merged = VisualHubPreferencesSchema.parse({
      ...data.preferences,
      ...preferences
    })
    return this.mutateAndPersist(() => {
      data.preferences = merged
      return { ...data.preferences }
    })
  }

  public async getOverviewSnapshot(rawProfileId?: string): Promise<VisualHubOverviewSnapshot> {
    const { profileId, data } = this.getProfileData(rawProfileId)
    const eligibleImageModels = await this.getEligibleImageModels()
    return {
      profileId,
      templates: BUILTIN_MERMAID_TEMPLATES,
      savedDiagrams: this.listDiagramDocuments({ profileId, limit: 100 }),
      eligibleImageModels,
      activeJobs: Array.from(this.activeJobs.values())
        .filter((j) => j.profileId === profileId)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 20),
      transientCandidates: Array.from(this.transientCandidates.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      ),
      preferences: { ...data.preferences }
    }
  }
}

