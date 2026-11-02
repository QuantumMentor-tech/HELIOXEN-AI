import { describe, it, expect } from 'vitest'
import {
  MultimodalContextItemSchema,
  ContextAssemblyRequestSchema,
  PrivacyRetentionPreferencesSchema,
  estimateTokenCount,
  resolveDefaultTrustLevel,
  resolveDefaultRetentionPolicy,
  validateContextItemLimits
} from '../../src/shared/context/contracts'
import { MultimodalContextItem, DEFAULT_CONTEXT_LIMITS } from '../../src/shared/context/types'

describe('Step 24: Context Contracts & Schemas', () => {
  describe('Zod Validation Schemas', () => {
    it('validates a well-formed text context item', () => {
      const item: MultimodalContextItem = {
        id: 'ctx-1',
        conversationId: 'conv-test-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'User Instruction',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        createdAt: Date.now(),
        textPayload: 'Explain orbital mechanics.',
        sizeBytes: 26
      }

      const result = MultimodalContextItemSchema.safeParse(item)
      expect(result.success).toBe(true)
    })

    it('validates a multimodal image context item', () => {
      const item: MultimodalContextItem = {
        id: 'ctx-2',
        conversationId: 'conv-test-1',
        sourceType: 'camera_capture',
        trustLevel: 'external_untrusted',
        title: 'Camera Snapshot',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        createdAt: Date.now(),
        imagePayload: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          width: 1920,
          height: 1080,
          sizeBytes: 116
        },
        sizeBytes: 116
      }

      const result = MultimodalContextItemSchema.safeParse(item)
      expect(result.success).toBe(true)
    })

    it('rejects an invalid source type', () => {
      const invalidItem = {
        id: 'ctx-invalid',
        conversationId: 'conv-test-1',
        sourceType: 'unsupported_source_type',
        trustLevel: 'user',
        title: 'Invalid',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        createdAt: Date.now(),
        sizeBytes: 10
      }

      const result = MultimodalContextItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('validates ContextAssemblyRequest schema', () => {
      const req = {
        conversationId: 'conv-test-1',
        selectedModelId: 'gemini-3.8-flash'
      }

      const result = ContextAssemblyRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeSystemInstructions).toBe(true)
      }
    })

    it('validates PrivacyRetentionPreferences defaults', () => {
      const result = PrivacyRetentionPreferencesSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.clearTransientOnSessionEnd).toBe(true)
        expect(result.data.clearAttachmentsOnConversationClose).toBe(true)
      }
    })
  })

  describe('Contract Helper Functions', () => {
    it('estimates token count using conservative 4-char rule', () => {
      expect(estimateTokenCount('')).toBe(0)
      expect(estimateTokenCount('test')).toBe(1)
      expect(estimateTokenCount('12345678')).toBe(2)
      expect(estimateTokenCount('123456789')).toBe(3)
    })

    it('resolves default trust level correctly', () => {
      expect(resolveDefaultTrustLevel('user_message')).toBe('user')
      expect(resolveDefaultTrustLevel('voice_transcript')).toBe('voice_input')
      expect(resolveDefaultTrustLevel('assistant_response')).toBe('assistant')
      expect(resolveDefaultTrustLevel('extracted_document')).toBe('external_untrusted')
      expect(resolveDefaultTrustLevel('camera_capture')).toBe('external_untrusted')
      expect(resolveDefaultTrustLevel('screen_capture')).toBe('external_untrusted')
    })

    it('resolves default retention policy correctly', () => {
      expect(resolveDefaultRetentionPolicy('camera_capture')).toBe('transient_buffer')
      expect(resolveDefaultRetentionPolicy('extracted_document')).toBe('transient_buffer')
      expect(resolveDefaultRetentionPolicy('image_attachment')).toBe('transient_buffer')
      expect(resolveDefaultRetentionPolicy('user_message')).toBe('conversation_ephemeral')
      expect(resolveDefaultRetentionPolicy('voice_transcript')).toBe('conversation_ephemeral')
    })

    it('enforces context item size and character limits', () => {
      const normalItem: MultimodalContextItem = {
        id: 'ctx-normal',
        conversationId: 'conv-test-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Normal',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        createdAt: Date.now(),
        sizeBytes: 100
      }
      expect(validateContextItemLimits(normalItem).isValid).toBe(true)

      const oversizedTotal: MultimodalContextItem = {
        ...normalItem,
        sizeBytes: 30 * 1024 * 1024 // 30 MB > 25 MB limit
      }
      expect(validateContextItemLimits(oversizedTotal).isValid).toBe(false)

      const oversizedImage: MultimodalContextItem = {
        ...normalItem,
        imagePayload: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,abc',
          sizeBytes: 5 * 1024 * 1024 // 5 MB > 4 MB limit
        }
      }
      expect(validateContextItemLimits(oversizedImage).isValid).toBe(false)
    })
  })
})
