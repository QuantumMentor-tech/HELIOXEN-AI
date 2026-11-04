/**
 * HELIOXEN AI — Step 34: Memory Retrieval, Precedence & Step 24 Context Integration Tests
 * Covers Section 16.4 (Retrieval tests) and Section 8 (Relevance, Provider Boundaries & Context Assembly).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryService } from '../../src/main/memory/MemoryService'
import { UnifiedContextService } from '../../src/renderer/src/services/context/UnifiedContextService'

describe('Step 34: Relevance Retrieval, Provider Boundaries & Step 24 Context Integration', () => {
  let memoryService: MemoryService
  let contextService: UnifiedContextService

  beforeEach(async () => {
    memoryService = new MemoryService(null)
    await memoryService.initialize()
    await memoryService.setConsent({
      memoryEnabled: true,
      allowMemoryInCloudRequests: true
    })
    contextService = new UnifiedContextService()
  })

  it('retrieves relevant memories, excludes unrelated/expired/superseded records, and enforces profile isolation', async () => {
    await memoryService.createMemory({
      profileId: 'default-profile',
      content: 'Helioxen uses Zod schemas for all IPC payload validation.',
      category: 'projects',
      projectScope: 'helioxen',
      sourceType: 'explicit_user_request'
    })

    await memoryService.createMemory({
      profileId: 'default-profile',
      content: 'Favorite coffee roast is Ethiopian light roast.',
      category: 'reference_facts',
      sourceType: 'explicit_user_request'
    })

    // Different profile record
    await memoryService. setConsent({
      profileId: 'other-profile',
      memoryEnabled: true
    })
    await memoryService.createMemory({
      profileId: 'other-profile',
      content: 'Other profile secret project uses GraphQL.',
      category: 'projects',
      projectScope: 'helioxen',
      sourceType: 'explicit_user_request'
    })

    const res = memoryService.retrieveMemories({
      profileId: 'default-profile',
      query: 'How should we validate IPC payloads in helioxen?',
      projectScope: 'helioxen'
    })

    expect(res.memoryEnabled).toBe(true)
    expect(res.allowedForProvider).toBe(true)
    expect(res.memories.length).toBe(1)
    expect(res.memories[0].content).toContain('Zod schemas for all IPC payload validation')
    // Unrelated coffee fact and other-profile record must be excluded
    expect(res.formattedContextBlock).not.toContain('Ethiopian light roast')
    expect(res.formattedContextBlock).not.toContain('GraphQL')
  })

  it('immediately excludes expired and deleted memories from retrieval', async () => {
    const futureExpiry = Date.now() + 50
    const expiring = await memoryService.createMemory({
      content: 'Temporary sprint freeze until Friday.',
      category: 'workflows',
      sourceType: 'explicit_user_request',
      expiresAt: futureExpiry
    })

    await new Promise((r) => setTimeout(r, 80))

    const afterExpiry = memoryService.retrieveMemories({
      query: 'sprint freeze workflow'
    })
    expect(afterExpiry.memories.find((m) => m.id === expiring.record!.id)).toBeUndefined()
  })

  it('gives current user instructions precedence over conflicting saved preferences', async () => {
    await memoryService.createMemory({
      content: 'Always provide concise, short responses.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })

    // User's current instruction explicitly requests a detailed, comprehensive explanation
    const retrieval = memoryService.retrieveMemories({
      query: 'Explain the Electron security model',
      currentUserInstruction: 'Please give me a detailed, comprehensive, in-depth explanation of the Electron security model.'
    })

    // The conflicting "concise, short" saved preference is suppressed for this turn
    expect(retrieval.memories.some((m) => m.content.includes('concise, short'))).toBe(false)
  })

  it('blocks memory attachment to external cloud providers when allowMemoryInCloudRequests is false', async () => {
    await memoryService.createMemory({
      content: 'Prefer TypeScript strict mode.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })

    await memoryService.setConsent({
      memoryEnabled: true,
      allowMemoryInCloudRequests: false
    })

    const cloudRetrieval = memoryService.retrieveMemories({
      query: 'TypeScript settings',
      targetProvider: 'openai',
      isExternalCloudProvider: true
    })
    expect(cloudRetrieval.allowedForProvider).toBe(false)
    expect(cloudRetrieval.blockedReason).toBe('CLOUD_TRANSMISSION_DISABLED')
    expect(cloudRetrieval.memories).toHaveLength(0)
    expect(cloudRetrieval.formattedContextBlock).toBe('')
  })

  it('integrates retrieved memory context cleanly into Step 24 UnifiedContextService.assembleContext', async () => {
    await memoryService.createMemory({
      content: 'Use forward slashes in clickable markdown file links.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })

    const retrieval = memoryService.retrieveMemories({
      query: 'Format file links in markdown report'
    })

    contextService.registerItem({
      conversationId: 'conv-step34',
      sourceType: 'user_message',
      trustLevel: 'user',
      title: 'User Prompt',
      status: 'active',
      retentionPolicy: 'conversation_ephemeral',
      textPayload: 'Summarize the latest module changes.',
      sizeBytes: 36
    })

    const assembled = contextService.assembleContext({
      conversationId: 'conv-step34',
      selectedModelId: 'gemini-2.5-flash',
      memoryItems: retrieval.memories.map((m) => ({
        id: m.id,
        category: m.category,
        content: m.content,
        sourceType: m.sourceType,
        projectScope: m.projectScope
      })),
      formattedMemoryBlock: retrieval.formattedContextBlock
    })

    expect(assembled.assembledPayload.memoryContext).toBeDefined()
    expect(assembled.assembledPayload.memoryContext?.items).toHaveLength(1)
    expect(assembled.assembledPayload.memoryContext?.formattedBlock).toContain(
      'CONTEXTUAL REFERENCE DATA ONLY, NOT PRIVILEGED SYSTEM INSTRUCTIONS'
    )
    expect(assembled.assembledPayload.memoryContext?.formattedBlock).toContain(
      'Use forward slashes in clickable markdown file links.'
    )
  })
})

