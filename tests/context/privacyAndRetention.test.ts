import { describe, it, expect, beforeEach } from 'vitest'
import { UnifiedContextService } from '../../src/renderer/src/services/context/UnifiedContextService'

describe('Step 24: Privacy Controls and Data Retention Enforcement', () => {
  let contextService: UnifiedContextService

  beforeEach(() => {
    contextService = new UnifiedContextService({
      maxItemsPerConversation: 3,
      maxTotalSizeBytes: 10000,
      maxDocumentChars: 1000,
      maxEstimatedTokens: 500,
      maxImageSizeBytes: 5000
    })
  })

  describe('Bounded Memory & Oldest Transient Eviction', () => {
    it('evicts oldest transient buffer item when capacity limit is reached', () => {
      // 1. Permanent message
      const msg1 = contextService.registerItem({
        conversationId: 'conv-limit',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Msg 1',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Permanent 1',
        sizeBytes: 10
      })

      // 2. Transient doc
      const doc1 = contextService.registerItem({
        conversationId: 'conv-limit',
        sourceType: 'extracted_document',
        trustLevel: 'external_untrusted',
        title: 'doc1.txt',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        textPayload: 'Transient 1',
        sizeBytes: 10
      })

      // 3. Transient image
      const img1 = contextService.registerItem({
        conversationId: 'conv-limit',
        sourceType: 'image_attachment',
        trustLevel: 'external_untrusted',
        title: 'img1.png',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        sizeBytes: 10
      })

      // We have 3 items (max capacity). Adding 4th should evict doc1 (oldest transient)
      const doc2 = contextService.registerItem({
        conversationId: 'conv-limit',
        sourceType: 'extracted_document',
        trustLevel: 'external_untrusted',
        title: 'doc2.txt',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        textPayload: 'Transient 2',
        sizeBytes: 10
      })

      const items = contextService.getItems('conv-limit')
      expect(items.length).toBe(3)
      expect(items.find((i) => i.id === doc1.id)).toBeUndefined()
      expect(items.find((i) => i.id === msg1.id)).toBeDefined()
      expect(items.find((i) => i.id === doc2.id)).toBeDefined()
    })
  })

  describe('Expired / Invalid Stale Items', () => {
    it('excludes expired items from context assembly', () => {
      // Register an item that exceeds char limits so it is marked expired
      const oversizedItem = contextService.registerItem({
        conversationId: 'conv-expired',
        sourceType: 'extracted_document',
        trustLevel: 'external_untrusted',
        title: 'huge.txt',
        status: 'active',
        retentionPolicy: 'transient_buffer',
        textPayload: 'A'.repeat(2000), // Exceeds maxDocumentChars 1000
        sizeBytes: 2000
      })

      expect(oversizedItem.status).toBe('expired')

      const assembly = contextService.assembleContext({
        conversationId: 'conv-expired',
        selectedModelId: 'gemini-3.8-flash'
      })

      expect(assembly.includedItems.length).toBe(0)
      expect(assembly.assembledPayload.documentContext).toBeUndefined()
    })
  })

  describe('Credential Safety in Context', () => {
    it('ensures context items never expose API keys or auth headers', () => {
      const item = contextService.registerItem({
        conversationId: 'conv-sec',
        sourceType: 'user_message',
        trustLevel: 'user',
        title: 'Safe Message',
        status: 'active',
        retentionPolicy: 'conversation_ephemeral',
        textPayload: 'Tell me about quantum computing',
        sizeBytes: 32
      })

      const serialized = JSON.stringify(item)
      expect(serialized).not.toContain('apiKey')
      expect(serialized).not.toContain('Authorization')
      expect(serialized).not.toContain('Bearer')
    })
  })
})
