import { GoogleGenAI } from '@google/genai'
import {
  AiProviderAdapter,
  AiGenerationRequest,
  AiGenerationResponse,
  AiStreamChunk,
  AiProviderImageGenerationRequest,
  AiProviderImageGenerationResponse
} from '../../../shared/ai/types'
import { AiProviderException } from '../errors'

const APPROVED_GEMINI_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-4-argon'
])

const APPROVED_GEMINI_IMAGE_MODELS = new Set([
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
  'gemini-3.1-flash-lite-image'
])

export class GeminiAdapter implements AiProviderAdapter {
  public readonly providerId = 'google-gemini' as const
  public readonly defaultModel = 'gemini-3.8-flash'
  private clientFactory?: (apiKey: string) => GoogleGenAI

  constructor(clientFactory?: (apiKey: string) => GoogleGenAI) {
    this.clientFactory = clientFactory
  }

  private getClient(apiKey: string): GoogleGenAI {
    if (this.clientFactory) {
      return this.clientFactory(apiKey)
    }
    return new GoogleGenAI({ apiKey })
  }

  private resolveModel(requestedModel?: string): string {
    if (!requestedModel) return this.defaultModel

    const lower = requestedModel.toLowerCase()
    if (lower.startsWith('gemini-1.5') || lower.startsWith('gemini-2.0') || lower.startsWith('gemini-2.5')) {
      throw new AiProviderException({
        code: 'INVALID_MODEL',
        provider: this.providerId,
        message: `Model '${requestedModel}' is legacy/deprecated. Please use '${this.defaultModel}' instead.`
      })
    }

    if (!APPROVED_GEMINI_MODELS.has(requestedModel)) {
      throw new AiProviderException({
        code: 'INVALID_MODEL',
        provider: this.providerId,
        message: `Model '${requestedModel}' is not recognized in approved Gemini models catalog.`
      })
    }

    return requestedModel
  }

  private prepareContents(request: AiGenerationRequest): {
    contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
    systemInstruction?: string
  } {
    let systemInstruction: string | undefined
    const contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = []

    for (let i = 0; i < request.messages.length; i++) {
      const msg = request.messages[i]
      const isLastUserMsg = i === request.messages.length - 1 && msg.role === 'user'

      if (msg.role === 'system') {
        systemInstruction = systemInstruction ? `${systemInstruction}\n${msg.content}` : msg.content
      } else {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

        let messageText = msg.content
        const docContext = msg.documentContext || (isLastUserMsg ? request.documentContext : undefined)
        if (docContext && docContext.length > 0) {
          const docBlocks = docContext
            .map((doc) => `[DOCUMENT ATTACHMENT: ${doc.filename}]\n${doc.text}\n[/DOCUMENT ATTACHMENT]`)
            .join('\n\n')
          messageText = `${docBlocks}\n\n${messageText}`
        }

        parts.push({ text: messageText })

        const imageAtt = msg.imageAttachment || (isLastUserMsg ? request.imageAttachment : undefined)
        if (imageAtt) {
          const commaIdx = imageAtt.dataUrl.indexOf(',')
          const base64Data = commaIdx >= 0 ? imageAtt.dataUrl.slice(commaIdx + 1) : imageAtt.dataUrl
          parts.push({
            inlineData: {
              mimeType: imageAtt.mimeType || 'image/jpeg',
              data: base64Data
            }
          })
        }

        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts
        })
      }
    }

    // Ensure at least one content entry exists
    if (contents.length === 0 && systemInstruction) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }]
      })
    }

    return { contents, systemInstruction }
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
    const { contents, systemInstruction } = this.prepareContents(request)

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens
        }
      })

      if (signal?.aborted) {
        throw new AiProviderException({
          code: 'CANCELLED',
          provider: this.providerId,
          message: 'Request cancelled during execution'
        })
      }

      const text = response.text || ''
      const usageMetadata = (response as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata

      return {
        id: `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        provider: this.providerId,
        model,
        text,
        finishReason: 'stop',
        usage: usageMetadata ? {
          promptTokens: usageMetadata.promptTokenCount,
          completionTokens: usageMetadata.candidatesTokenCount,
          totalTokens: usageMetadata.totalTokenCount
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
    const { contents, systemInstruction } = this.prepareContents(request)
    const responseId = `gemini-stream-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    try {
      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens
        }
      })

      let fullText = ''

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new AiProviderException({
            code: 'CANCELLED',
            provider: this.providerId,
            message: 'Stream cancelled by user'
          })
        }

        const delta = chunk.text || ''
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

      // Signal completion
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

    if (!APPROVED_GEMINI_IMAGE_MODELS.has(request.model)) {
      throw new AiProviderException({
        code: 'INVALID_MODEL',
        provider: this.providerId,
        message: `Model '${request.model}' is not an approved Gemini image generation model.`
      })
    }

    const client = this.getClient(apiKey)
    const mimeType = request.outputFormat ?? 'image/png'

    try {
      const inputItems: Array<Record<string, unknown>> = [{ type: 'text', text: request.prompt }]
      if (request.referenceImages && request.referenceImages.length > 0) {
        for (const ref of request.referenceImages) {
          inputItems.push({
            type: 'image',
            mime_type: ref.mimeType,
            data: ref.base64Data
          })
        }
      }

      const anyClient = client as unknown as {
        interactions?: {
          create: (params: Record<string, unknown>) => Promise<{
            id?: string
            output_image?: { data?: string; mime_type?: string } | null
            steps?: Array<{
              type?: string
              content?: Array<{ type?: string; data?: string; mime_type?: string }>
            }>
          }>
        }
        models?: {
          generateContent?: (params: Record<string, unknown>) => Promise<{
            data?: string
          }>
        }
      }

      let base64Data: string | undefined
      let resolvedMimeType: 'image/png' | 'image/jpeg' | 'image/webp' = mimeType
      let interactionId = `gemini-img-${Date.now()}`

      if (anyClient.interactions && typeof anyClient.interactions.create === 'function') {
        const interaction = await anyClient.interactions.create({
          model: request.model,
          input: inputItems.length === 1 ? request.prompt : inputItems,
          response_format: {
            type: 'image',
            mime_type: mimeType,
            aspect_ratio: request.aspectRatio ?? '1:1',
            image_size:
              request.resolution === '1K' || request.resolution === '2K' || request.resolution === '4K'
                ? request.resolution
                : '1K'
          }
        })

        if (signal?.aborted) {
          throw new AiProviderException({
            code: 'CANCELLED',
            provider: this.providerId,
            message: 'Image generation cancelled during execution'
          })
        }

        if (interaction.id) {
          interactionId = interaction.id
        }
        if (interaction.output_image?.data) {
          base64Data = interaction.output_image.data
          if (
            interaction.output_image.mime_type === 'image/png' ||
            interaction.output_image.mime_type === 'image/jpeg' ||
            interaction.output_image.mime_type === 'image/webp'
          ) {
            resolvedMimeType = interaction.output_image.mime_type
          }
        } else if (Array.isArray(interaction.steps)) {
          for (const step of interaction.steps) {
            if (step.type === 'model_output' && Array.isArray(step.content)) {
              for (const part of step.content) {
                if (part.type === 'image' && part.data) {
                  base64Data = part.data
                  if (
                    part.mime_type === 'image/png' ||
                    part.mime_type === 'image/jpeg' ||
                    part.mime_type === 'image/webp'
                  ) {
                    resolvedMimeType = part.mime_type
                  }
                }
              }
            }
          }
        }
      } else if (anyClient.models?.generateContent) {
        const res = await anyClient.models.generateContent({
          model: request.model,
          config: {
            responseModalities: ['IMAGE']
          },
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }]
        })
        base64Data = res.data
      }

      if (!base64Data) {
        throw new AiProviderException({
          code: 'PROVIDER_ERROR',
          provider: this.providerId,
          message: 'Gemini image generation returned no image bytes.'
        })
      }

      return {
        id: interactionId,
        provider: this.providerId,
        model: request.model,
        images: [
          {
            mimeType: resolvedMimeType,
            base64Data
          }
        ],
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

    if (status === 401 || status === 403 || /API_KEY_INVALID|invalid api key|unauthenticated/i.test(msg)) {
      return new AiProviderException({
        code: 'AUTHENTICATION_FAILED',
        provider: this.providerId,
        message: 'Gemini authentication failed: Invalid or expired API key.',
        httpStatus: status || 401,
        retryable: false
      })
    }

    if (status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) {
      return new AiProviderException({
        code: 'RATE_LIMIT_EXCEEDED',
        provider: this.providerId,
        message: 'Gemini rate limit or quota exceeded. Please wait before retrying.',
        httpStatus: 429,
        retryable: true
      })
    }

    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(msg)) {
      return new AiProviderException({
        code: 'NETWORK_ERROR',
        provider: this.providerId,
        message: 'Network connection to Google Gemini API failed.',
        retryable: true
      })
    }

    return new AiProviderException({
      code: 'PROVIDER_ERROR',
      provider: this.providerId,
      message: `Gemini service error: ${msg.slice(0, 150)}`,
      httpStatus: status,
      retryable: status ? status >= 500 : false
    })
  }
}
