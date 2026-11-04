/**
 * HELIOXEN AI — Step 24: Unified Multimodal Context Types
 * Unified, source-aware context item contracts, trust classifications, and retention policies.
 */

export type ContextSourceType =
  | 'user_message'
  | 'assistant_response'
  | 'voice_transcript'
  | 'image_attachment'
  | 'camera_capture'
  | 'screen_capture'
  | 'extracted_document'
  | 'long_term_memory'

export type ContextTrustLevel =
  | 'system'
  | 'user'
  | 'voice_input'
  | 'external_untrusted'
  | 'assistant'

export type ContextItemStatus =
  | 'active'
  | 'excluded'
  | 'expired'
  | 'cleared'

export type RetentionPolicyType =
  | 'transient_buffer'        // Volatile in-memory only; cleared on session end, cancel, or clear transient
  | 'conversation_ephemeral' // Retained for duration of active conversation thread
  | 'user_persisted'          // Explicitly saved by user (if supported)

export interface ContextImagePayload {
  mimeType: string
  dataUrl: string
  width?: number
  height?: number
  sizeBytes: number
}

export interface ContextDocumentMetadata {
  filename: string
  format: string
  pageCount?: number
  charCount: number
  isTruncated?: boolean
}

export interface MultimodalContextItem {
  id: string
  conversationId: string
  activeTaskId?: string
  sourceType: ContextSourceType
  trustLevel: ContextTrustLevel
  title: string
  status: ContextItemStatus
  retentionPolicy: RetentionPolicyType
  createdAt: number
  expiresAt?: number
  textPayload?: string
  imagePayload?: ContextImagePayload
  documentMetadata?: ContextDocumentMetadata
  sizeBytes: number
  sourceRefId?: string
}

export interface ContextLimits {
  maxItemsPerConversation: number
  maxTotalSizeBytes: number
  maxDocumentChars: number
  maxEstimatedTokens: number
  maxImageSizeBytes: number
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxItemsPerConversation: 50,
  maxTotalSizeBytes: 25 * 1024 * 1024, // 25 MB
  maxDocumentChars: 100000,
  maxEstimatedTokens: 32000,
  maxImageSizeBytes: 4 * 1024 * 1024 // 4 MB
}

export interface AssembledMemoryContextItem {
  id: string
  category: string
  content: string
  sourceType: string
  projectScope?: string
}

export interface ContextAssemblyRequest {
  conversationId: string
  activeTaskId?: string
  selectedModelId: string
  includeSystemInstructions?: boolean
  maxContextTokens?: number
  /** Optional retrieved long-term memories (only attached when memoryEnabled is verified true) */
  memoryItems?: AssembledMemoryContextItem[]
  /** Optional formatted contextual memory block */
  formattedMemoryBlock?: string
}

export interface AssembledMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AssembledPayload {
  messages: AssembledMessage[]
  imageAttachment?: {
    mimeType: string
    dataUrl: string
  }
  documentContext?: Array<{
    filename: string
    text: string
    pageCount?: number
  }>
  memoryContext?: {
    items: AssembledMemoryContextItem[]
    formattedBlock: string
  }
}

export interface OmittedContextItem {
  itemId: string
  title: string
  reason: string
}

export interface ContextAssemblyResult {
  conversationId: string
  includedItems: MultimodalContextItem[]
  excludedItems: MultimodalContextItem[]
  omittedItems: OmittedContextItem[]
  totalSizeBytes: number
  estimatedTokenCount: number
  hasMultimodalImage: boolean
  assembledPayload: AssembledPayload
  warnings: string[]
}

export interface ContextSourceSummary {
  sourceType: ContextSourceType
  count: number
  totalBytes: number
}

export interface ContextSummary {
  conversationId: string
  totalItems: number
  activeItems: number
  excludedItems: number
  sources: ContextSourceSummary[]
  transientBytes: number
}

export interface PrivacyRetentionPreferences {
  clearTransientOnSessionEnd: boolean
  clearAttachmentsOnConversationClose: boolean
  enableSourceAttribution: boolean
  warnOnExternalTransmission: boolean
}

export const DEFAULT_PRIVACY_RETENTION_PREFERENCES: PrivacyRetentionPreferences = {
  clearTransientOnSessionEnd: true,
  clearAttachmentsOnConversationClose: true,
  enableSourceAttribution: true,
  warnOnExternalTransmission: true
}
