/**
 * HELIOXEN AI — Step 37: VisualHub, Mermaid Visualization, and AI Image Generation
 * Shared domain types for Diagram Studio (Mermaid visualization, validation, templates,
 * safe SVG rendering, document persistence, and exports) and Image Studio (capability-aware
 * AI provider image generation, progress lifecycle, cancellation, temporary preview,
 * and explicit saving to the Step 36 Media Gallery).
 */

import { AiProviderId } from '../ai/types'
import { MediaAssetRecord } from '../media/types'

export const VISUALHUB_SCHEMA_VERSION = 1
export const DEFAULT_VISUALHUB_PROFILE_ID = 'default-profile'

// ============================================================================
// 1. MERMAID DIAGRAM STUDIO TYPES
// ============================================================================

export type SupportedMermaidDiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'erDiagram'
  | 'gantt'
  | 'mindmap'

export type DiagramRenderStatus = 'idle' | 'validating' | 'rendering' | 'valid' | 'invalid' | 'error'

export type DiagramExportFormat = 'mmd' | 'svg' | 'png'

export interface MermaidSecurityConfig {
  readonly securityLevel: 'strict'
  readonly startOnLoad: false
  readonly maxTextSize: number
  readonly maxEdges: number
  readonly maxNodes: number
  readonly renderTimeoutMs: number
  readonly allowClickEvents: false
  readonly allowExternalLinks: false
  readonly allowInitDirectiveOverrides: false
}

export const DEFAULT_MERMAID_SECURITY_CONFIG: MermaidSecurityConfig = {
  securityLevel: 'strict',
  startOnLoad: false,
  maxTextSize: 50000,
  maxEdges: 250,
  maxNodes: 150,
  renderTimeoutMs: 5000,
  allowClickEvents: false,
  allowExternalLinks: false,
  allowInitDirectiveOverrides: false
}

export interface MermaidDiagramTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly diagramType: SupportedMermaidDiagramType
  readonly category: 'architecture' | 'workflow' | 'data' | 'planning'
  readonly source: string
}

export interface MermaidValidationDiagnostic {
  readonly line?: number
  readonly code:
    | 'EMPTY_SOURCE'
    | 'SOURCE_TOO_LARGE'
    | 'UNSUPPORTED_DIAGRAM_TYPE'
    | 'PROHIBITED_DIRECTIVE_OVERRIDE'
    | 'PROHIBITED_SCRIPT_OR_HTML'
    | 'PROHIBITED_CLICK_OR_LINK'
    | 'EXCESSIVE_NODE_COUNT'
    | 'EXCESSIVE_EDGE_COUNT'
    | 'SYNTAX_ERROR'
    | 'PRIVACY_POLICY_VIOLATION'
  readonly message: string
}

export interface MermaidRenderResult {
  readonly valid: boolean
  readonly diagramType: SupportedMermaidDiagramType | null
  readonly svgMarkup: string | null
  readonly width: number | null
  readonly height: number | null
  readonly nodeCount: number
  readonly edgeCount: number
  readonly diagnostics: readonly MermaidValidationDiagnostic[]
  readonly securityConfigApplied: MermaidSecurityConfig
  readonly renderedAt: number
}

export interface DiagramDocumentRecord {
  readonly id: string
  readonly profileId: string
  readonly title: string
  readonly description: string
  readonly diagramType: SupportedMermaidDiagramType
  readonly source: string
  readonly tags: readonly string[]
  readonly createdAt: number
  readonly updatedAt: number
  readonly schemaVersion: number
}

export interface SaveDiagramDocumentRequest {
  readonly profileId?: string
  readonly id?: string
  readonly title: string
  readonly description?: string
  readonly source: string
  readonly tags?: readonly string[]
}

export interface ListDiagramDocumentsRequest {
  readonly profileId?: string
  readonly query?: string
  readonly diagramType?: SupportedMermaidDiagramType | 'all'
  readonly limit?: number
}

export interface DeleteDiagramDocumentRequest {
  readonly profileId?: string
  readonly id: string
}

export interface ExportDiagramRequest {
  readonly profileId?: string
  readonly source: string
  readonly format: DiagramExportFormat
  readonly suggestedFileName?: string
  readonly targetFilePath?: string
  readonly overwriteExisting?: boolean
  readonly width?: number
  readonly height?: number
  readonly scale?: number
}

export interface ExportDiagramResult {
  readonly exported: boolean
  readonly format: DiagramExportFormat
  readonly filePath: string | null
  readonly byteSize: number
  readonly diagramType: SupportedMermaidDiagramType | null
  readonly errorCode?: string
  readonly errorMessage?: string
}

// ============================================================================
// 2. AI IMAGE GENERATION & CAPABILITY PROFILES
// ============================================================================

export type ImageGenerationAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'
export type ImageGenerationResolution = '1K' | '2K' | '4K' | '1024x1024' | '1536x1024' | '1024x1536'
export type ImageGenerationQuality = 'auto' | 'low' | 'medium' | 'high'
export type ImageGenerationOutputFormat = 'image/png' | 'image/jpeg' | 'image/webp'
export type ImageGenerationBackground = 'auto' | 'opaque' | 'transparent'

export interface ImageModelCapabilityDescriptor {
  readonly modelId: string
  readonly providerId: AiProviderId
  readonly displayName: string
  readonly description: string
  readonly supportsImageGeneration: boolean
  readonly supportsImageEditing: boolean
  readonly supportsReferenceImages: boolean
  readonly maxReferenceImages: number
  readonly supportedAspectRatios: readonly ImageGenerationAspectRatio[]
  readonly supportedResolutions: readonly ImageGenerationResolution[]
  readonly supportedQualities: readonly ImageGenerationQuality[]
  readonly supportedOutputFormats: readonly ImageGenerationOutputFormat[]
  readonly supportsTransparentBackground: boolean
  readonly maxImagesPerRequest: number
  readonly supportsCancellation: boolean
  readonly isProviderConfigured: boolean
  readonly isProviderHealthy: boolean
  readonly isEligible: boolean
  readonly unavailabilityReason?: string
}

export type ImageGenerationJobState =
  | 'preparing_request'
  | 'waiting_for_provider'
  | 'generating'
  | 'receiving_result'
  | 'preparing_preview'
  | 'completed'
  | 'failed'
  | 'cancel_requested'
  | 'cancelled'
  | 'outcome_unknown'

export interface ImageGenerationRequest {
  readonly profileId?: string
  readonly providerId: AiProviderId
  readonly modelId: string
  readonly prompt: string
  readonly aspectRatio?: ImageGenerationAspectRatio
  readonly resolution?: ImageGenerationResolution
  readonly quality?: ImageGenerationQuality
  readonly outputFormat?: ImageGenerationOutputFormat
  readonly background?: ImageGenerationBackground
  readonly numberOfImages?: number
  /** Optional explicitly selected Media Gallery asset IDs for reference-image workflows */
  readonly referenceAssetIds?: readonly string[]
  /** Explicit user acknowledgment that prompt and any selected reference images will be sent externally */
  readonly externalTransmissionConfirmed: boolean
}

export interface TemporaryGeneratedImageCandidate {
  readonly candidateId: string
  readonly jobId: string
  readonly providerId: AiProviderId
  readonly modelId: string
  readonly promptSummary: string
  readonly mimeType: ImageGenerationOutputFormat
  readonly dataUrl: string
  readonly width: number
  readonly height: number
  readonly byteSize: number
  readonly aspectRatio?: ImageGenerationAspectRatio
  readonly resolution?: ImageGenerationResolution
  readonly quality?: ImageGenerationQuality
  readonly background?: ImageGenerationBackground
  readonly referenceAssetIds: readonly string[]
  readonly createdAt: number
  readonly savedAssetId: string | null
}

export interface ImageGenerationJobRecord {
  readonly jobId: string
  readonly profileId: string
  readonly providerId: AiProviderId
  readonly modelId: string
  readonly promptSummary: string
  readonly state: ImageGenerationJobState
  readonly statusMessage: string
  readonly candidates: readonly TemporaryGeneratedImageCandidate[]
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly retryable: boolean
  readonly cancellationStatus?: 'not_requested' | 'requested' | 'accepted' | 'confirmed'
  readonly startedAt: number
  readonly updatedAt: number
  readonly completedAt: number | null
}

export interface CancelImageGenerationRequest {
  readonly jobId: string
}

export interface CancelImageGenerationResult {
  readonly jobId: string
  readonly state: ImageGenerationJobState
  readonly cancellationStatus: 'requested' | 'accepted' | 'confirmed'
  readonly message: string
}

export interface SaveGeneratedImageToGalleryRequest {
  readonly profileId?: string
  readonly candidateId: string
  readonly displayName: string
  readonly tags?: readonly string[]
  readonly favorite?: boolean
  readonly retainPromptInMetadata?: boolean
}

export interface SaveGeneratedImageToGalleryResult {
  readonly saved: boolean
  readonly candidateId: string
  readonly asset: MediaAssetRecord
}

export interface DiscardGeneratedImageRequest {
  readonly candidateId: string
}

export interface VisualHubPreferences {
  readonly preferredProviderId: AiProviderId
  readonly preferredModelId: string
  readonly defaultAspectRatio: ImageGenerationAspectRatio
  readonly defaultOutputFormat: ImageGenerationOutputFormat
  readonly defaultQuality: ImageGenerationQuality
  readonly retainPromptInSavedMetadata: boolean
  readonly autoPreviewMermaid: boolean
}

export const DEFAULT_VISUALHUB_PREFERENCES: VisualHubPreferences = {
  preferredProviderId: 'google-gemini',
  preferredModelId: 'gemini-nano-banana-2.1',
  defaultAspectRatio: '1:1',
  defaultOutputFormat: 'image/png',
  defaultQuality: 'auto',
  retainPromptInSavedMetadata: false,
  autoPreviewMermaid: true
}

export interface VisualHubOverviewSnapshot {
  readonly profileId: string
  readonly templates: readonly MermaidDiagramTemplate[]
  readonly savedDiagrams: readonly DiagramDocumentRecord[]
  readonly eligibleImageModels: readonly ImageModelCapabilityDescriptor[]
  readonly activeJobs: readonly ImageGenerationJobRecord[]
  readonly transientCandidates: readonly TemporaryGeneratedImageCandidate[]
  readonly preferences: VisualHubPreferences
}

