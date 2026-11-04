/**
 * HELIOXEN AI — Step 34: Memory Consent, Opt-In & Revocation Tests
 * Covers Section 16.2 (Consent tests) and Section 14 (Consent failure & concurrency edge cases).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MemoryService } from '../../src/main/memory/MemoryService'

describe('Step 34: Memory Consent & Global Enable/Disable Controls', () => {
  let tempDir: string
  let storePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-mem-consent-'))
    storePath = path.join(tempDir, 'memory_store.json')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('defaults to memoryEnabled = false before explicit user opt-in and blocks writes/suggestions/retrievals', async () => {
    const service = new MemoryService(storePath)
    await service.initialize()

    const state = service.getStateOverview()
    expect(state.profile.consent.memoryEnabled).toBe(false)
    expect(state.profile.consent.consentedAt).toBeNull()

    await expect(
      service.createMemory({
        content: 'Prefer concise answers.',
        category: 'preferences',
        sourceType: 'explicit_user_request'
      })
    ).rejects.toThrow(/Long-term memory is currently disabled/i)

    expect(() =>
      service.proposeSuggestion({
        proposedContent: 'Prefer concise answers.',
        category: 'preferences',
        reason: 'User asked for concise output'
      })
    ).toThrow(/Memory suggestions are disabled/i)

    const retrieval = service.retrieveMemories({ query: 'concise answers' })
    expect(retrieval.memoryEnabled).toBe(false)
    expect(retrieval.allowedForProvider).toBe(false)
    expect(retrieval.blockedReason).toBe('MEMORY_DISABLED')
    expect(retrieval.memories).toHaveLength(0)
    expect(retrieval.formattedContextBlock).toBe('')
  })

  it('persists explicit opt-in across application restarts and respects subsequent disablement', async () => {
    const service = new MemoryService(storePath)
    await service.initialize()

    const enabledProfile = await service.setConsent({
      memoryEnabled: true,
      allowMemoryInCloudRequests: true,
      allowMemorySuggestions: true
    })
    expect(enabledProfile.consent.memoryEnabled).toBe(true)
    expect(enabledProfile.consent.consentedAt).toBeTypeOf('number')

    const created = await service.createMemory({
      content: 'Prefer dark-mode architectural diagrams.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })
    expect(created.success).toBe(true)

    // Simulate application restart
    const restartedService = new MemoryService(storePath)
    await restartedService.initialize()
    expect(restartedService.getProfile().consent.memoryEnabled).toBe(true)
    expect(restartedService.listMemories()).toHaveLength(1)

    // Now disable memory
    const disabledProfile = await restartedService.setConsent({
      memoryEnabled: false
    })
    expect(disabledProfile.consent.memoryEnabled).toBe(false)
    expect(disabledProfile.consent.revokedAt).toBeTypeOf('number')

    // Disabling prevents new writes and blocks retrieval for AI requests
    await expect(
      restartedService.createMemory({
        content: 'Another preference',
        category: 'preferences',
        sourceType: 'explicit_user_request'
      })
    ).rejects.toThrow(/disabled/i)

    const blockedRetrieval = restartedService.retrieveMemories({ query: 'diagrams' })
    expect(blockedRetrieval.memoryEnabled).toBe(false)
    expect(blockedRetrieval.memories).toHaveLength(0)
    expect(blockedRetrieval.formattedContextBlock).toBe('')

    // Existing memories remain available for user inspection and deletion while memory is disabled
    const storedForReview = restartedService.listMemories()
    expect(storedForReview).toHaveLength(1)
    expect(storedForReview[0].content).toContain('dark-mode architectural diagrams')

    const deleted = await restartedService.deleteMemory({ id: storedForReview[0].id })
    expect(deleted.success).toBe(true)
    expect(restartedService.listMemories()).toHaveLength(0)
  })

  it('fails closed (memoryEnabled = false) when on-disk store or consent state is corrupted', async () => {
    fs.writeFileSync(storePath, '{ invalid json corruption !!!', 'utf8')

    const service = new MemoryService(storePath)
    await service.initialize()

    const state = service.getStateOverview()
    expect(state.storageHealthy).toBe(false)
    expect(state.profile.consent.memoryEnabled).toBe(false)

    const retrieval = service.retrieveMemories({ query: 'anything' })
    expect(retrieval.memoryEnabled).toBe(false)
    expect(retrieval.memories).toHaveLength(0)
  })
})

