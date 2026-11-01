import OpenAI from 'openai'
import {
  AiProviderAdapter,
  AiGenerationRequest,
  AiGenerationResponse,
  AiStreamChunk,
  AiMessage
} from '../../../shared/ai/types'
import { AiProviderException } from '../errors'

const APPROVED_OPENAI_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini'
])

export class OpenAiAdapter implements AiProviderAdapter {
  public readonly providerId = 'openai' as const
  public readonly defaultModel = 'gpt-4o-mini'
  private clientFactory?: (apiKey: string) => OpenAI

  constructor(clientFactory?: (apiKey: string) => OpenAI) {
    this.clientFactory = clientFactory
  }

  private getClient(apiKey: string): OpenAI {
    if (this.clientFactory) {
      return this.clientFactory(apiKey)
    }
    return new OpenAI({ apiKey })
  }

  private resolveModel(requestedModel?: string): string {
    if (!requestedModel) return this.defaultModel

    if (!APPROVED_OPENAI_MODELS.has(requestedModel)) {
      throw new AiProviderException({
        code: 'INVALID_MODEL',
        provider: this.providerId,
        message: `Model '${requestedModel}' is not recognized in approved OpenAI models catalog.`
      })
    }

    return requestedModel
  }

  public async generateText(
    request: AiGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse> {
    if (signal?.aborted) {
      throw new AiProviderException({
        code: 'CANCELLED',
        provider: this.providerId,
        message: 'Request was cancelled before dispatch'
      })
    }

    const model = this.resolveModel(request.model)
    const client = this.getClient(apiKey)

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages: request.messages.map((m: AiMessage) => ({
            role: m.role,
            content: m.content
          })),
          temperature: request.temperature,
          max_tokens: request.maxTokens
        },
        { signal }
      )

      const choice = completion.choices[0]
      const text = choice?.message?.content || ''

      return {
        id: completion.id || `openai-${Date.now()}`,
        provider: this.providerId,
        model,
        text,
        finishReason: choice?.finish_reason || 'stop',
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : undefined,
        timestamp: Date.now()
      }
    } catch (err: unknown) {
      if (err instanceof AiProviderException) throw err
      throw this.normalizeError(err)
    }
  }

  public async streamText(
    request: AiGenerationRequest,
    apiKey: string,
    onChunk: (chunk: AiStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse> {
    if (signal?.aborted) {
      throw new AiProviderException({
        code: 'CANCELLED',
        provider: this.providerId,
        message: 'Stream cancelled before dispatch'
      })
    }

    const model = this.resolveModel(request.model)
    const client = this.getClient(apiKey)
    const responseId = `openai-stream-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    try {
      const stream = await client.chat.completions.create(
        {
          model,
          messages: request.messages.map((m: AiMessage) => ({
            role: m.role,
            content: m.content
          })),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true
        },
        { signal }
      )

      let fullText = ''

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new AiProviderException({
            code: 'CANCELLED',
            provider: this.providerId,
            message: 'Stream cancelled by user'
          })
        }

        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          fullText += delta
          onChunk({
            id: responseId,
            provider: this.providerId,
            model,
            textDelta: delta,
            isDone: false
          })
        }
      }

      onChunk({
        id: responseId,
        provider: this.providerId,
        model,
        textDelta: '',
        isDone: true,
        finishReason: 'stop'
      })

      return {
        id: responseId,
        provider: this.providerId,
        model,
        text: fullText,
        finishReason: 'stop',
        timestamp: Date.now()
      }
    } catch (err: unknown) {
      if (err instanceof AiProviderException) throw err
      throw this.normalizeError(err)
    }
  }

  private normalizeError(err: unknown): AiProviderException {
    const errorStr = String(err)
    const errObj = err as { status?: number; statusCode?: number; message?: string }
    const status = errObj?.status || errObj?.statusCode
    const msg = errObj?.message || errorStr

    if (status === 401 || /incorrect api key|invalid_api_key/i.test(msg)) {
      return new AiProviderException({
        code: 'AUTHENTICATION_FAILED',
        provider: this.providerId,
        message: 'OpenAI authentication failed: Invalid or expired API key.',
        httpStatus: 401,
        retryable: false
      })
    }

    if (status === 429 || /rate limit|insufficient_quota/i.test(msg)) {
      return new AiProviderException({
        code: 'RATE_LIMIT_EXCEEDED',
        provider: this.providerId,
        message: 'OpenAI rate limit or quota exceeded. Please check your account quota.',
        httpStatus: 429,
        retryable: true
      })
    }

    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(msg)) {
      return new AiProviderException({
        code: 'NETWORK_ERROR',
        provider: this.providerId,
        message: 'Network connection to OpenAI API failed.',
        retryable: true
      })
    }

    return new AiProviderException({
      code: 'PROVIDER_ERROR',
      provider: this.providerId,
      message: `OpenAI service error: ${msg.slice(0, 150)}`,
      httpStatus: status,
      retryable: status ? status >= 500 : false
    })
  }
}
