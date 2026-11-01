import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ProviderService } from '../../src/main/ai/ProviderService'
import {
  CredentialStorageService,
  EncryptionProvider
} from '../../src/main/security/credentialStorage'
import { AiProviderAdapter } from '../../src/shared/ai/types'
import { AiProviderException } from '../../src/main/ai/errors'

describe('ProviderService (AI Provider Coordination & Vault Integration)', () => {
  let testStoragePath: string
  let mockEncryptionProvider: EncryptionProvider
  let storage: CredentialStorageService
  let service: ProviderService
  let mockGeminiAdapter: AiProviderAdapter

  beforeEach(() => {
    testStoragePath = join(
      tmpdir(),
      `helioxen-ai-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`
    )

    mockEncryptionProvider = {
      isEncryptionAvailable: () => true,
      encryptString: (plainText: string) =>
        Buffer.from(`CIPHER_${Buffer.from(plainText, 'utf8').toString('base64')}`, 'utf8'),
      decryptString: (encrypted: Buffer) => {
        const raw = encrypted.toString('utf8').replace('CIPHER_', '')
        return Buffer.from(raw, 'base64').toString('utf8')
      }
    }

    storage = new CredentialStorageService(testStoragePath, mockEncryptionProvider)

    mockGeminiAdapter = {
      providerId: 'google-gemini',
      defaultModel: 'gemini-3.8-flash',
      generateText: vi.fn().mockResolvedValue({
        id: 'test-gen-id',
        provider: 'google-gemini',
        model: 'gemini-3.8-flash',
        text: 'Generated mock response',
        timestamp: Date.now()
      }),
      streamText: vi.fn().mockImplementation(async (_req, _key, onChunk) => {
        onChunk({
          id: 'chunk-1',
          provider: 'google-gemini',
          model: 'gemini-3.8-flash',
          textDelta: 'Streamed response',
          isDone: true
        })
        return {
          id: 'test-stream-id',
          provider: 'google-gemini',
          model: 'gemini-3.8-flash',
          text: 'Streamed response',
          timestamp: Date.now()
        }
      })
    }

    const adaptersMap = new Map<any, any>([['google-gemini', mockGeminiAdapter]])
    service = new ProviderService(storage, adaptersMap)
  })

  afterEach(async () => {
    try {
      await fs.unlink(testStoragePath)
    } catch {
      // Ignore cleanup error
    }
  })

  it('fails with MISSING_CREDENTIAL when requesting generation without a configured key', async () => {
    await expect(
      service.generateText({
        provider: 'google-gemini',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow(AiProviderException)

    try {
      await service.generateText({
        provider: 'google-gemini',
        messages: [{ role: 'user', content: 'hello' }]
      })
    } catch (err) {
      expect((err as AiProviderException).code).toBe('MISSING_CREDENTIAL')
    }
  })

  it('retrieves key from DPAPI storage and dispatches text generation', async () => {
    // 1. Store key securely
    await service.setCredential('google-gemini', 'sk-gemini-test-secret-123')

    // 2. Generate text
    const response = await service.generateText({
      provider: 'google-gemini',
      messages: [{ role: 'user', content: 'test prompt' }]
    })

    expect(response.text).toBe('Generated mock response')
    expect(mockGeminiAdapter.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google-gemini' }),
      'sk-gemini-test-secret-123',
      undefined
    )
  })

  it('streams text chunks using retrieved secret', async () => {
    await service.setCredential('google-gemini', 'sk-stream-secret')

    const receivedChunks: any[] = []
    const response = await service.streamText(
      {
        provider: 'google-gemini',
        messages: [{ role: 'user', content: 'stream' }],
        stream: true
      },
      (chunk) => receivedChunks.push(chunk)
    )

    expect(receivedChunks.length).toBe(1)
    expect(receivedChunks[0].textDelta).toBe('Streamed response')
    expect(response.text).toBe('Streamed response')
  })

  it('returns credential configuration status with ZERO secret leakage', async () => {
    await service.setCredential('google-gemini', 'gemini-super-secret-key', 'Gemini Prod')

    const statusMap = await service.getCredentialStatus()

    expect(statusMap['google-gemini'].configured).toBe(true)
    expect(statusMap['google-gemini'].label).toBe('Gemini Prod')
    expect(statusMap['openai'].configured).toBe(false)

    // Verify no secret or ciphertext field exists on the status objects
    expect((statusMap['google-gemini'] as any).apiKey).toBeUndefined()
    expect((statusMap['google-gemini'] as any).secret).toBeUndefined()
    expect((statusMap['google-gemini'] as any).ciphertext).toBeUndefined()
  })

  it('deletes stored credential and updates status', async () => {
    await service.setCredential('google-gemini', 'to-be-deleted-key')
    expect((await service.getCredentialStatus())['google-gemini'].configured).toBe(true)

    const deleted = await service.deleteCredential('google-gemini')
    expect(deleted).toBe(true)
    expect((await service.getCredentialStatus())['google-gemini'].configured).toBe(false)
  })

  it('performs user-initiated connection test and measures latency', async () => {
    await service.setCredential('google-gemini', 'valid-test-key')

    const result = await service.testConnection('google-gemini')
    expect(result.success).toBe(true)
    expect(result.provider).toBe('google-gemini')
    expect(result.model).toBe('gemini-3.8-flash')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('rejects cross-provider model mismatches in generateText before making network calls', async () => {
    await service.setCredential('google-gemini', 'valid-test-key')

    // Requesting OpenAI model 'gpt-4o-mini' under Google Gemini provider
    await expect(
      service.generateText({
        provider: 'google-gemini',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }]
      })
    ).rejects.toThrow(AiProviderException)

    try {
      await service.generateText({
        provider: 'google-gemini',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }]
      })
    } catch (err) {
      expect((err as AiProviderException).code).toBe('INVALID_MODEL')
      expect((err as AiProviderException).message).toContain("does not belong to provider 'google-gemini'")
    }

    // Verify adapter was NEVER called
    expect(mockGeminiAdapter.generateText).not.toHaveBeenCalled()
  })

  it('returns authoritative model catalog via getModelCatalog', () => {
    const catalog = service.getModelCatalog()
    expect(catalog.length).toBe(2)
    const gemini = catalog.find((p) => p.id === 'google-gemini')
    expect(gemini?.models.length).toBeGreaterThan(0)
    expect(gemini?.models[0].capabilities).toBeDefined()
  })

  it('executes same-provider fallback when primary model hits RATE_LIMIT_EXCEEDED', async () => {
    await service.setCredential('google-gemini', 'sk-test-gemini-key')

    let callCount = 0
    mockGeminiAdapter.generateText = vi.fn().mockImplementation(async (req) => {
      callCount++
      if (req.model === 'gemini-4-argon') {
        throw new AiProviderException({
          code: 'RATE_LIMIT_EXCEEDED',
          provider: 'google-gemini',
          message: 'Model quota exceeded for gemini-4-argon'
        })
      }
      return {
        id: 'fallback-res-id',
        provider: 'google-gemini',
        model: req.model,
        text: 'Fallback succeeded',
        timestamp: Date.now()
      }
    })

    const response = await service.generateText({
      provider: 'google-gemini',
      model: 'gemini-4-argon',
      messages: [{ role: 'user', content: 'test fallback' }]
    })

    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(response.text).toBe('Fallback succeeded')
    expect(response.model).not.toBe('gemini-4-argon')
  })

  it('does NOT fallback during streamText if at least one token chunk was already emitted', async () => {
    await service.setCredential('google-gemini', 'sk-test-gemini-key')

    let streamAttempts = 0
    mockGeminiAdapter.streamText = vi.fn().mockImplementation(async (req, _key, onChunk) => {
      streamAttempts++
      // Emit a chunk before failing
      onChunk({
        id: 'partial-chunk-1',
        provider: 'google-gemini',
        model: req.model,
        textDelta: 'Partial output started...',
        isDone: false
      })
      throw new AiProviderException({
        code: 'NETWORK_ERROR',
        provider: 'google-gemini',
        message: 'Socket reset mid-stream'
      })
    })

    const chunks: string[] = []
    await expect(
      service.streamText(
        {
          provider: 'google-gemini',
          model: 'gemini-4-argon',
          messages: [{ role: 'user', content: 'test stream' }],
          stream: true
        },
        (chunk) => chunks.push(chunk.textDelta)
      )
    ).rejects.toThrow(AiProviderException)

    // Verify stream was NOT retried on a second model because partial output was already emitted!
    expect(streamAttempts).toBe(1)
    expect(chunks).toEqual(['Partial output started...'])
  })

  it('reports evidence-based provider health via getHealthStatus', async () => {
    await service.setCredential('google-gemini', 'sk-test-gemini-key')

    const initialHealth = await service.getHealthStatus()
    expect(initialHealth['google-gemini'].status).toBe('unknown')

    // Execute successful generation
    await service.generateText({
      provider: 'google-gemini',
      messages: [{ role: 'user', content: 'hi' }]
    })

    const updatedHealth = await service.getHealthStatus()
    expect(updatedHealth['google-gemini'].status).toBe('healthy')
    expect(updatedHealth['google-gemini'].consecutiveFailures).toBe(0)
  })
})
