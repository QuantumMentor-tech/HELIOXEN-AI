import { AiProviderId } from './types'
export type { AiProviderId }

export type CapabilitySupportLevel = 'supported' | 'unsupported' | 'unknown' | 'not-verified'

export interface ModelCapabilityDimensions {
  /** Core text synthesis and prompt completion */
  textGeneration: CapabilitySupportLevel
  /** Incremental streaming token delivery */
  streaming: CapabilitySupportLevel
  /** Multimodal image attachment parsing */
  imageInput: CapabilitySupportLevel
  /** Voice / raw audio waveform ingestion */
  audioInput: CapabilitySupportLevel
  /** Native speech synthesis / audio output */
  audioOutput: CapabilitySupportLevel
  /** Function calling / agent tool execution */
  toolCalling: CapabilitySupportLevel
  /** JSON schema constrained output */
  structuredOutput: CapabilitySupportLevel
}

export interface ModelCapabilityProfile {
  /** Capability documented by provider for this specific model */
  modelLevel: ModelCapabilityDimensions
  /** Actual integration status in current HELIOXEN desktop runtime */
  helioxenLevel: ModelCapabilityDimensions
  /** Maximum context window token capacity */
  contextWindow?: number
  /** Maximum generated output token limit */
  maxOutputTokens?: number
  /** Documented reasoning/latency tier */
  tier?: 'ultra-fast' | 'balanced' | 'flagship-reasoning'
}

export interface ModelDefinition {
  /** Canonical provider model identifier sent over the wire */
  id: string
  /** Provider owning this model */
  providerId: AiProviderId
  /** Human-readable display label */
  displayName: string
  /** Short capability and performance summary */
  description: string
  /** Whether this is the default model for its provider in HELIOXEN */
  isDefault: boolean
  /** Discovery provenance */
  source: 'curated' | 'discovered' | 'cached'
  /** Detailed capability profile */
  capabilities: ModelCapabilityProfile
  /** Lifecycle and deprecation status */
  status: 'active' | 'preview' | 'deprecated'
  /** Timestamp of last verification or discovery */
  lastVerified: number
}

export interface ProviderDefinition {
  id: AiProviderId
  displayName: string
  description: string
  defaultModelId: string
  models: ModelDefinition[]
  supportsDynamicDiscovery: boolean
}

export type RoutingMode = 'manual' | 'task-based'

export interface UserAiPreferences {
  activeProvider: AiProviderId
  activeModel: string
  routingMode: RoutingMode
  allowSameProviderFallback: boolean
  allowCrossProviderFallback: boolean
  temperature?: number
  maxTokens?: number
  stream: boolean
  clearTransientOnSessionEnd?: boolean
  clearAttachmentsOnConversationClose?: boolean
  enableSourceAttribution?: boolean
  warnOnExternalTransmission?: boolean
}

export const DEFAULT_AI_PREFERENCES: UserAiPreferences = {
  activeProvider: 'google-gemini',
  activeModel: 'gemini-3.8-flash',
  routingMode: 'manual',
  allowSameProviderFallback: true,
  allowCrossProviderFallback: false,
  temperature: 0.7,
  stream: true,
  clearTransientOnSessionEnd: true,
  clearAttachmentsOnConversationClose: true,
  enableSourceAttribution: true,
  warnOnExternalTransmission: true
}

/**
 * Curated, verified catalog of supported AI models.
 * Strictly verified against official provider documentation (November 1, 2026).
 */
export const CURATED_MODELS: Record<string, ModelDefinition> = {
  // --- Google Gemini Models ---
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    providerId: 'google-gemini',
    displayName: 'Gemini 3.8 Flash',
    description: 'Primary balanced model for real-time multimodal reasoning and assistant dialogue.',
    isDefault: true,
    source: 'curated',
    status: 'active',
    lastVerified: 1730480400000,
    capabilities: {
      tier: 'balanced',
      contextWindow: 1048576, // 1M tokens
      maxOutputTokens: 8192,
      modelLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'supported',
        audioInput: 'supported',
        audioOutput: 'supported',
        toolCalling: 'supported',
        structuredOutput: 'supported'
      },
      helioxenLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'unsupported', // Roadmap Phase 8
        audioInput: 'unsupported', // Roadmap Phase 7
        audioOutput: 'unsupported', // Roadmap Phase 7
        toolCalling: 'unsupported', // Roadmap Phase 9
        structuredOutput: 'supported'
      }
    }
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    providerId: 'google-gemini',
    displayName: 'Gemini 3.5 Flash-Lite',
    description: 'Fastest, lowest-latency model for rapid high-frequency conversation turns.',
    isDefault: false,
    source: 'curated',
    status: 'active',
    lastVerified: 1730480400000,
    capabilities: {
      tier: 'ultra-fast',
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      modelLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'supported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'supported',
        structuredOutput: 'supported'
      },
      helioxenLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'unsupported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'unsupported',
        structuredOutput: 'supported'
      }
    }
  },
  'gemini-4-argon': {
    id: 'gemini-4-argon',
    providerId: 'google-gemini',
    displayName: 'Gemini 4 Argon',
    description: 'Flagship deep reasoning and comprehensive code synthesis model.',
    isDefault: false,
    source: 'curated',
    status: 'active',
    lastVerified: 1730480400000,
    capabilities: {
      tier: 'flagship-reasoning',
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      modelLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'supported',
        audioInput: 'supported',
        audioOutput: 'supported',
        toolCalling: 'supported',
        structuredOutput: 'supported'
      },
      helioxenLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'unsupported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'unsupported',
        structuredOutput: 'supported'
      }
    }
  },

  // --- OpenAI Models ---
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o Mini',
    description: 'Fast, cost-efficient small model for everyday reasoning and conversation.',
    isDefault: true,
    source: 'curated',
    status: 'active',
    lastVerified: 1730480400000,
    capabilities: {
      tier: 'balanced',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      modelLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'supported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'supported',
        structuredOutput: 'supported'
      },
      helioxenLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'unsupported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'unsupported',
        structuredOutput: 'supported'
      }
    }
  },
  'gpt-4o': {
    id: 'gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    description: 'High-intelligence flagship omni model for complex reasoning and tasks.',
    isDefault: false,
    source: 'curated',
    status: 'active',
    lastVerified: 1730480400000,
    capabilities: {
      tier: 'flagship-reasoning',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      modelLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'supported',
        audioInput: 'supported',
        audioOutput: 'supported',
        toolCalling: 'supported',
        structuredOutput: 'supported'
      },
      helioxenLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'unsupported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'unsupported',
        structuredOutput: 'supported'
      }
    }
  }
}

export const CURATED_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'google-gemini',
    displayName: 'Google Gemini',
    description: 'Primary AI Assistant provider powered by Gemini models and the @google/genai SDK.',
    defaultModelId: 'gemini-3.8-flash',
    supportsDynamicDiscovery: true,
    models: [
      CURATED_MODELS['gemini-3.8-flash'],
      CURATED_MODELS['gemini-3.5-flash-lite'],
      CURATED_MODELS['gemini-4-argon']
    ]
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'Secondary reasoning provider powered by GPT-4o models and the official openai SDK.',
    defaultModelId: 'gpt-4o-mini',
    supportsDynamicDiscovery: true,
    models: [
      CURATED_MODELS['gpt-4o-mini'],
      CURATED_MODELS['gpt-4o']
    ]
  }
]

export function getModelDefinition(providerId: AiProviderId, modelId: string): ModelDefinition | undefined {
  const model = CURATED_MODELS[modelId]
  if (model && model.providerId === providerId) {
    return model
  }
  return undefined
}
