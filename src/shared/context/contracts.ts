/**
 * HELIOXEN AI — Step 24: Unified Multimodal Context Contracts & Schemas
 * Zod validation schemas, token estimation utilities, and trust boundary validators.
 */

import { z } from 'zod'
import {
  ContextSourceType,
  ContextTrustLevel,
  ContextItemStatus,
  RetentionPolicyType,
  MultimodalContextItem,
  ContextAssemblyRequest,
  ContextLimits,
  DEFAULT_CONTEXT_LIMITS
} from './types'

export const ContextSourceTypeSchema = z.enum([
  'user_message',
  'assistant_response',
  'voice_transcript',
  'image_attachment',
  'camera_capture',
  'screen_capture',
  'extracted_document',
  'long_term_memory'
])

export const ContextTrustLevelSchema = z.enum([
  'system',
  'user',
  'voice_input',
  'external_untrusted',
  'assistant'
])

export const ContextItemStatusSchema = z.enum([
  'active',
  'excluded',
  'expired',
  'cleared'
])

export const RetentionPolicyTypeSchema = z.enum([
  'transient_buffer',
  'conversation_ephemeral',
  'user_persisted'
])

export const ContextImagePayloadSchema = z.object({
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().nonnegative()
})

export const ContextDocumentMetadataSchema = z.object({
  filename: z.string().min(1),
  format: z.string().min(1),
  pageCount: z.number().int().positive().optional(),
  charCount: z.number().nonnegative(),
  isTruncated: z.boolean().optional()
})

export const MultimodalContextItemSchema = z.object({
  id: z.string().min(1, 'Item ID cannot be empty'),
  conversationId: z.string().min(1, 'Conversation ID cannot be empty'),
  activeTaskId: z.string().optional(),
  sourceType: ContextSourceTypeSchema,
  trustLevel: ContextTrustLevelSchema,
  title: z.string().min(1, 'Title cannot be empty'),
  status: ContextItemStatusSchema,
  retentionPolicy: RetentionPolicyTypeSchema,
  createdAt: z.number().positive(),
  expiresAt: z.number().positive().optional(),
  textPayload: z.string().optional(),
  imagePayload: ContextImagePayloadSchema.optional(),
  documentMetadata: ContextDocumentMetadataSchema.optional(),
  sizeBytes: z.number().nonnegative(),
  sourceRefId: z.string().optional()
})

export const ContextAssemblyRequestSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID cannot be empty'),
  activeTaskId: z.string().optional(),
  selectedModelId: z.string().min(1, 'Selected model ID cannot be empty'),
  includeSystemInstructions: z.boolean().optional().default(true),
  maxContextTokens: z.number().int().positive().optional()
})

export const PrivacyRetentionPreferencesSchema = z.object({
  clearTransientOnSessionEnd: z.boolean().default(true),
  clearAttachmentsOnConversationClose: z.boolean().default(true),
  enableSourceAttribution: z.boolean().default(true),
  warnOnExternalTransmission: z.boolean().default(true)
})

/**
 * Estimates token count from text using a conservative 1 token ≈ 4 characters heuristic.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Determines appropriate trust level based on source type.
 */
export function resolveDefaultTrustLevel(sourceType: ContextSourceType): ContextTrustLevel {
  switch (sourceType) {
    case 'user_message':
      return 'user'
    case 'voice_transcript':
      return 'voice_input'
    case 'assistant_response':
      return 'assistant'
    case 'extracted_document':
    case 'camera_capture':
    case 'screen_capture':
    case 'image_attachment':
      return 'external_untrusted'
    default:
      return 'external_untrusted'
  }
}

/**
 * Determines appropriate retention policy based on source type.
 */
export function resolveDefaultRetentionPolicy(sourceType: ContextSourceType): RetentionPolicyType {
  switch (sourceType) {
    case 'camera_capture':
    case 'screen_capture':
    case 'image_attachment':
    case 'extracted_document':
      return 'transient_buffer'
    case 'user_message':
    case 'assistant_response':
    case 'voice_transcript':
      return 'conversation_ephemeral'
    default:
      return 'transient_buffer'
  }
}

/**
 * Validates whether a context item respects documented resource limits.
 */
export function validateContextItemLimits(
  item: MultimodalContextItem,
  limits: ContextLimits = DEFAULT_CONTEXT_LIMITS
): { isValid: boolean; error?: string } {
  if (item.sizeBytes > limits.maxTotalSizeBytes) {
    return {
      isValid: false,
      error: `Context item exceeds total size limit of ${limits.maxTotalSizeBytes} bytes`
    }
  }

  if (item.imagePayload && item.imagePayload.sizeBytes > limits.maxImageSizeBytes) {
    return {
      isValid: false,
      error: `Image payload exceeds maximum limit of ${limits.maxImageSizeBytes} bytes`
    }
  }

  if (item.textPayload && item.textPayload.length > limits.maxDocumentChars) {
    return {
      isValid: false,
      error: `Text payload exceeds maximum limit of ${limits.maxDocumentChars} characters`
    }
  }

  return { isValid: true }
}
