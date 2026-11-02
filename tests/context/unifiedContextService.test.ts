import { describe, it, expect, beforeEach } from 'vitest'
import { UnifiedContextService } from '../../src/renderer/src/services/context/UnifiedContextService'

describe('Step 24: UnifiedContextService', () => {
  let contextService: UnifiedContextService

  beforeEach(() => {
    contextService = new UnifiedContextService()
  })

  describe('Registration and Modality Support', () => {
    it('registers text messages, transcripts, images, and documents cleanly', () => {
      const textItem = contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'User Prompt',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Hello HELIOXEN',
        sizeBytes: 14
      })

      const docItem = contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'extracted_document',
        trustLevel: 'external_untrusted',
        title: 'report.pdf',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        textPayload: 'Extracted PDF text content',
        documentMetadata: {
          filename: 'report.pdf',
          format: 'pdf',
          pageCount: 3,
          charCount: 26
        },
        sizeBytes: 26
      })

      const imageItem = contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'camera_capture',
        trustLevel: 'external_untrusted',
        title: 'Camera Snapshot',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        imagePayload: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,sample',
          sizeBytes: 500
        },
        sizeBytes: 500
      })

      const items = contextService.getItems('conv-1')
      expect(items.length).toBe(3)
      expect(items.map((i) => i.id)).toEqual([textItem.id, docItem.id, imageItem.id])
    })
  })

  describe('Conversation Isolation', () => {
    it('strictly isolates context items between distinct conversations', () => {
      contextService.registerItem({
        conversationId: 'conv-A',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Secret A',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Confidential text for Thread A',
        sizeBytes: 30
      })

      contextService.registerItem({
        conversationId: 'conv-B',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Secret B',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Confidential text for Thread B',
        sizeBytes: 30
      })

      const itemsA = contextService.getItems('conv-A')
      const itemsB = contextService.getItems('conv-B')

      expect(itemsA.length).toBe(1)
      expect(itemsA[0].textPayload).toBe('Confidential text for Thread A')

      expect(itemsB.length).toBe(1)
      expect(itemsB[0].textPayload).toBe('Confidential text for Thread B')

      const assemblyA = contextService.assembleContext({
        conversationId: 'conv-A',
        selectedModelId: 'gemini-3.8-flash'
      })
      expect(assemblyA.includedItems.length).toBe(1)
      expect(assemblyA.includedItems[0].textPayload).toBe('Confidential text for Thread A')
    })
  })

  describe('Inclusion and Exclusion Toggling', () => {
    it('excludes toggled items from context assembly', () => {
      const item1 = contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Included Message',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Included',
        sizeBytes: 8
      })

      const item2 = contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'extracted_document',
        trustLevel: 'external_untrusted',
        title: 'Excluded Doc',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        textPayload: 'Excluded document text',
        sizeBytes: 22
      })

      // Toggle item2 to excluded
      contextService.toggleItemInclusion('conv-1', item2.id, false)
      expect(contextService.getItems('conv-1').find((i) => i.id === item2.id)?.status).toBe('excluded')

      const assembly = contextService.assembleContext({
        conversationId: 'conv-1',
        selectedModelId: 'gemini-3.8-flash'
      })

      expect(assembly.includedItems.map((i) => i.id)).toEqual([item1.id])
      expect(assembly.excludedItems.map((i) => i.id)).toEqual([item2.id])
      expect(assembly.assembledPayload.documentContext).toBeUndefined()
    })
  })

  describe('Capability-Aware Assembly & Omission', () => {
    it('omits visual items with warnings when model lacks vision support', () => {
      contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'image_attachment',
        trustLevel: 'external_untrusted',
        title: 'chart.png',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        imagePayload: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,chartdata',
          sizeBytes: 400
        },
        sizeBytes: 400
      })

      // Use a model that does not have imageInput supported (or fake non-vision model)
      const assembly = contextService.assembleContext({
        conversationId: 'conv-1',
        selectedModelId: 'non-vision-model'
      })

      expect(assembly.includedItems.length).toBe(0)
      expect(assembly.omittedItems.length).toBe(1)
      expect(assembly.omittedItems[0].reason).toContain('does not support image input')
      expect(assembly.hasMultimodalImage).toBe(false)
      expect(assembly.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Transient Context Clearing & Retention', () => {
    it('clears transient buffers while preserving conversation messages', () => {
      contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'User Message',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Persistent conversation text',
        sizeBytes: 30
      })

      contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'camera_capture',
        trustLevel: 'external_untrusted',
        title: 'Camera Snapshot',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        imagePayload: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,transientdata',
          sizeBytes: 1024
        },
        sizeBytes: 1024
      })

      const cleanup = contextService.clearTransientContext('conv-1')
      expect(cleanup.clearedCount).toBe(1)
      expect(cleanup.freedBytes).toBe(1024)

      const remaining = contextService.getItems('conv-1')
      expect(remaining.length).toBe(1)
      expect(remaining[0].sourceType).toBe('user_message')
    })

    it('clears all context on thread reset', () => {
      contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Msg 1',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Test',
        sizeBytes: 4
      })

      contextService.clearConversation('conv-1')
      expect(contextService.getItems('conv-1').length).toBe(0)
    })
  })

  describe('Context Summary', () => {
    it('computes accurate summary statistics for active context', () => {
      contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Message',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Hello',
        sizeBytes: 10
      })

      contextService.registerItem({
        conversationId: 'conv-1',
        sourceType: 'extracted_document',
        trustLevel: 'external_untrusted',
        title: 'doc.txt',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        textPayload: 'Doc Content',
        sizeBytes: 200
      })

      const summary = contextService.getContextSummary('conv-1')
      expect(summary.totalItems).toBe(2)
      expect(summary.activeItems).toBe(2)
      expect(summary.transientBytes).toBe(200)
    })
  })
})
