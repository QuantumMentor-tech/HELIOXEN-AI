import { describe, it, expect, vi } from 'vitest'
import { GeminiAdapter } from '../../src/main/ai/adapters/GeminiAdapter'
import { AiGenerationRequest, AiStreamChunk } from '../../src/shared/ai/types'
import { AiProviderException } from '../../src/main/ai/errors'

describe('GeminiAdapter (Google Gemini AI Provider Integration)', () => {
  it('generates text successfully using mocked Google GenAI client', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Hello, this is Gemini 3.8 Flash responding.',
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 10,
            totalTokenCount: 25
          }
        })
      }
    }

    const adapter = new GeminiAdapter(() => mockClient as any)
    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      model: 'gemini-3.8-flash',
      messages: [{ role: 'user', content: 'Introduce yourself' }],
      temperature: 0.7
    }

    const response = await adapter.generateText(request, 'test-api-key')

    expect(response.provider).toBe('google-gemini')
    expect(response.model).toBe('gemini-3.8-flash')
    expect(response.text).toBe('Hello, this is Gemini 3.8 Flash responding.')
    expect(response.usage?.totalTokens).toBe(25)
    expect(mockClient.models.generateContent).toHaveBeenCalledOnce()
  })

  it('streams text chunks incrementally and signals completion', async () => {
    async function* mockStreamGenerator() {
      yield { text: 'Helioxen ' }
      yield { text: 'orbital ' }
      yield { text: 'intelligence.' }
    }

    const mockClient = {
      models: {
        generateContentStream: vi.fn().mockResolvedValue(mockStreamGenerator())
      }
    }

    const adapter = new GeminiAdapter(() => mockClient as any)
    const chunks: AiStreamChunk[] = []

    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      model: 'gemini-3.8-flash',
      messages: [{ role: 'user', content: 'Stream test' }],
      stream: true
    }

    const finalResponse = await adapter.streamText(
      request,
      'test-api-key',
      (chunk) => chunks.push(chunk)
    )

    expect(chunks.length).toBe(4) // 3 delta chunks + 1 final done chunk
    expect(chunks[0].textDelta).toBe('Helioxen ')
    expect(chunks[1].textDelta).toBe('orbital ')
    expect(chunks[2].textDelta).toBe('intelligence.')
    expect(chunks[3].isDone).toBe(true)
    expect(finalResponse.text).toBe('Helioxen orbital intelligence.')
  })

  it('rejects legacy/deprecated models per gemini-api-dev specification', async () => {
    const adapter = new GeminiAdapter()
    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'test' }]
    }

    await expect(adapter.generateText(request, 'key')).rejects.toThrow(AiProviderException)
    await expect(adapter.generateText(request, 'key')).rejects.toThrow(/legacy\/deprecated/)
  })

  it('rejects unrecognized model identifiers', async () => {
    const adapter = new GeminiAdapter()
    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      model: 'gemini-unrecognized-model-v99',
      messages: [{ role: 'user', content: 'test' }]
    }

    await expect(adapter.generateText(request, 'key')).rejects.toThrow(/not recognized/)
  })

  it('honors AbortSignal and aborts execution', async () => {
    const adapter = new GeminiAdapter()
    const controller = new AbortController()
    controller.abort()

    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      messages: [{ role: 'user', content: 'test' }]
    }

    await expect(adapter.generateText(request, 'key', controller.signal)).rejects.toThrow(
      /cancelled/
    )
  })

  it('normalizes 401/403 authentication failures', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 401,
          message: 'API_KEY_INVALID: User API key is not valid'
        })
      }
    }

    const adapter = new GeminiAdapter(() => mockClient as any)
    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      messages: [{ role: 'user', content: 'test' }]
    }

    try {
      await adapter.generateText(request, 'bad-key')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderException)
      const ex = err as AiProviderException
      expect(ex.code).toBe('AUTHENTICATION_FAILED')
      expect(ex.retryable).toBe(false)
    }
  })

  it('normalizes 429 quota exhaustion errors', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 429,
          message: 'RESOURCE_EXHAUSTED: Rate limit reached'
        })
      }
    }

    const adapter = new GeminiAdapter(() => mockClient as any)
    const request: AiGenerationRequest = {
      provider: 'google-gemini',
      messages: [{ role: 'user', content: 'test' }]
    }

    try {
      await adapter.generateText(request, 'key')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderException)
      const ex = err as AiProviderException
      expect(ex.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(ex.retryable).toBe(true)
    }
  })
})
