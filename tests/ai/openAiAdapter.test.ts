import { describe, it, expect, vi } from 'vitest'
import { OpenAiAdapter } from '../../src/main/ai/adapters/OpenAiAdapter'
import { AiGenerationRequest, AiStreamChunk } from '../../src/shared/ai/types'
import { AiProviderException } from '../../src/main/ai/errors'

describe('OpenAiAdapter (OpenAI AI Provider Integration)', () => {
  it('generates text successfully using mocked OpenAI client', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'chatcmpl-12345',
            choices: [
              {
                message: { content: 'This is gpt-4o-mini responding.' },
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 12,
              completion_tokens: 8,
              total_tokens: 20
            }
          })
        }
      }
    }

    const adapter = new OpenAiAdapter(() => mockClient as any)
    const request: AiGenerationRequest = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }]
    }

    const response = await adapter.generateText(request, 'test-sk-key')

    expect(response.provider).toBe('openai')
    expect(response.model).toBe('gpt-4o-mini')
    expect(response.text).toBe('This is gpt-4o-mini responding.')
    expect(response.usage?.totalTokens).toBe(20)
    expect(mockClient.chat.completions.create).toHaveBeenCalledOnce()
  })

  it('streams text chunks incrementally and handles completion', async () => {
    async function* mockStreamGenerator() {
      yield { choices: [{ delta: { content: 'Stonic ' } }] }
      yield { choices: [{ delta: { content: 'intelligence.' } }] }
    }

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockStreamGenerator())
        }
      }
    }

    const adapter = new OpenAiAdapter(() => mockClient as any)
    const chunks: AiStreamChunk[] = []

    const request: AiGenerationRequest = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Stream' }],
      stream: true
    }

    const finalResponse = await adapter.streamText(
      request,
      'test-sk-key',
      (chunk) => chunks.push(chunk)
    )

    expect(chunks.length).toBe(3) // 2 delta chunks + 1 final done chunk
    expect(chunks[0].textDelta).toBe('Stonic ')
    expect(chunks[1].textDelta).toBe('intelligence.')
    expect(chunks[2].isDone).toBe(true)
    expect(finalResponse.text).toBe('Stonic intelligence.')
  })

  it('rejects unapproved models', async () => {
    const adapter = new OpenAiAdapter()
    const request: AiGenerationRequest = {
      provider: 'openai',
      model: 'unapproved-gpt-9',
      messages: [{ role: 'user', content: 'test' }]
    }

    await expect(adapter.generateText(request, 'key')).rejects.toThrow(/not recognized/)
  })

  it('normalizes 401 authentication errors', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue({
            status: 401,
            message: 'Incorrect API key provided'
          })
        }
      }
    }

    const adapter = new OpenAiAdapter(() => mockClient as any)
    const request: AiGenerationRequest = {
      provider: 'openai',
      messages: [{ role: 'user', content: 'test' }]
    }

    try {
      await adapter.generateText(request, 'bad-key')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderException)
      const ex = err as AiProviderException
      expect(ex.code).toBe('AUTHENTICATION_FAILED')
    }
  })
})
