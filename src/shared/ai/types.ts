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
}
