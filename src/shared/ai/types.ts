/**
 * Authoritative types and schemas for HELIOXEN AI Provider Infrastructure.
 * Governs communication across Main, Preload, and Renderer processes.
 */

export type AiProviderId = 'google-gemini' | 'openai'

export type MessageRole = 'system' | 'user' | 'assistant'

export interface AiImageAttachment {
  readonly mimeType: string
  readonly dataUrl: string
}

export interface AiDocumentContext {
  readonly filename: string
  readonly text: string
  readonly pageCount?: number
}

export interface AiMessage {
  role: MessageRole
  content: string
  imageAttachment?: AiImageAttachment
  documentContext?: AiDocumentContext[]
}

export interface AiTokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AiGenerationRequest {
  provider?: AiProviderId
  model?: string
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  taskType?: 'conversation' | 'fast-response' | 'complex-reasoning' | 'structured-extraction'
  imageAttachment?: AiImageAttachment
  documentContext?: AiDocumentContext[]
}

export interface AiGenerationResponse {
  id: string
  provider: AiProviderId
  model: string
  text: string
  finishReason?: string
  usage?: AiTokenUsage
  timestamp: number
}

export interface AiStreamChunk {
  id: string
  provider: AiProviderId
  model: string
  textDelta: string
  isDone: boolean
  finishReason?: string
  usage?: AiTokenUsage
}

export interface ProviderCredentialStatus {
  provider: AiProviderId
  configured: boolean
  label?: string
  updatedAt?: number
}

export interface ProviderTestResult {
  provider: AiProviderId
  success: boolean
  model: string
  latencyMs: number
  errorMessage?: string
}

export interface AiProviderImageGenerationRequest {
  provider: AiProviderId
  model: string
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'
  resolution?: '1K' | '2K' | '4K' | '1024x1024' | '1536x1024' | '1024x1536'
  quality?: 'auto' | 'low' | 'medium' | 'high'
  outputFormat?: 'image/png' | 'image/jpeg' | 'image/webp'
  background?: 'auto' | 'opaque' | 'transparent'
  numberOfImages?: number
  referenceImages?: ReadonlyArray<{
    readonly mimeType: string
    readonly base64Data: string
  }>
}

export interface AiProviderGeneratedImageItem {
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  readonly base64Data: string
  readonly width?: number
  readonly height?: number
  readonly revisedPrompt?: string
}

export interface AiProviderImageGenerationResponse {
  readonly id: string
  readonly provider: AiProviderId
  readonly model: string
  readonly images: readonly AiProviderGeneratedImageItem[]
  readonly timestamp: number
}

export interface AiProviderAdapter {
  readonly providerId: AiProviderId
  readonly defaultModel: string
  generateText(
    request: AiGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse>
  streamText(
    request: AiGenerationRequest,
    apiKey: string,
    onChunk: (chunk: AiStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse>
  generateImage?(
    request: AiProviderImageGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<AiProviderImageGenerationResponse>
}
