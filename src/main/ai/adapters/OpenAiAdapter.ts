import OpenAI from 'openai'
import {
  AiProviderAdapter,
  AiGenerationRequest,
  AiGenerationResponse,
  AiStreamChunk,
  AiMessage,
  AiProviderImageGenerationRequest,
  AiProviderImageGenerationResponse
} from '../../../shared/ai/types'
import { AiProviderException } from '../errors'

const APPROVED_OPENAI_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini'
])

const APPROVED_OPENAI_IMAGE_MODELS = new Set([
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare'
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

  private prepareOpenAiMessages(request: AiGenerationRequest): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return request.messages.map((m: AiMessage, index: number) => {
      const isLastUserMsg = index === request.messages.length - 1 && m.role === 'user'

      let messageText = m.content
      const docContext = m.documentContext || (isLastUserMsg ? request.documentContext : undefined)
      if (docContext && docContext.length > 0) {
        const docBlocks = docContext
          .map((doc) => `[DOCUMENT ATTACHMENT: ${doc.filename}]\n${doc.text}\n[/DOCUMENT ATTACHMENT]`)
          .join('\n\n')
        messageText = `${docBlocks}\n\n${messageText}`
      }

      const imageAtt = m.imageAttachment || (isLastUserMsg ? request.imageAttachment : undefined)

      if (imageAtt && m.role === 'user') {
        const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: 'text', text: messageText },
          {
            type: 'image_url',
            image_url: {
              url: imageAtt.dataUrl
            }
          }
        ]
        return {
          role: 'user',
          content: contentParts
        }
      }

      if (m.role === 'system') {
        return { role: 'system', content: messageText }
      } else if (m.role === 'assistant') {
        return { role: 'assistant', content: messageText }
      } else {
        return { role: 'user', content: messageText }
      }
    })
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
          messages: this.prepareOpenAiMessages(request),
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
          messages: this.prepareOpenAiMessages(request),
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

  public async generateImage(
    request: AiProviderImageGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<AiProviderImageGenerationResponse> {
    if (signal?.aborted) {
      throw new AiProviderException({
        code: 'CANCELLED',
        provider: this.providerId,
        message: 'Image generation cancelled before dispatch'
      })
    }

    if (!APPROVED_OPENAI_IMAGE_MODELS.has(request.model)) {
      throw new AiProviderException({
        code: 'INVALID_MODEL',
        provider: this.providerId,
        message: `Model '${request.model}' is not an approved OpenAI image generation model.`
      })
    }

    const client = this.getClient(apiKey)
    const outputFormat: 'png' | 'jpeg' | 'webp' =
      request.outputFormat === 'image/jpeg'
        ? 'jpeg'
        : request.outputFormat === 'image/webp'
          ? 'webp'
          : 'png'

    const size: '1024x1024' | '1536x1024' | '1024x1536' =
      request.resolution === '1536x1024' || request.aspectRatio === '3:2' || request.aspectRatio === '16:9'
        ? '1536x1024'
        : request.resolution === '1024x1536' || request.aspectRatio === '2:3' || request.aspectRatio === '9:16'
          ? '1024x1536'
          : '1024x1024'

    try {
      const res = await client.images.generate(
        {
          model: request.model,
          prompt: request.prompt,
          n: request.numberOfImages ?? 1,
          size,
          quality: request.quality ?? 'auto',
          output_format: outputFormat,
          background: request.background ?? 'auto'
        },
        { signal }
      )

      if (signal?.aborted) {
        throw new AiProviderException({
          code: 'CANCELLED',
          provider: this.providerId,
          message: 'Image generation cancelled during execution'
        })
      }

      const items = (res.data ?? [])
        .filter((img) => Boolean(img.b64_json))
        .map((img) => ({
          mimeType: (request.outputFormat ?? 'image/png') as
            | 'image/png'
            | 'image/jpeg'
            | 'image/webp',
          base64Data: img.b64_json!,
          revisedPrompt: img.revised_prompt
        }))

      if (items.length === 0) {
        throw new AiProviderException({
          code: 'PROVIDER_ERROR',
          provider: this.providerId,
          message: 'OpenAI image generation returned no image data.'
        })
      }

      return {
        id: `openai-img-${res.created || Date.now()}`,
        provider: this.providerId,
        model: request.model,
        images: items,
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
