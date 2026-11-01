import { AiProviderId } from './types'
import { ModelCapabilityDimensions, RoutingMode } from './models'

export type AiTaskType =
  | 'conversation'
  | 'fast-response'
  | 'complex-reasoning'
  | 'structured-extraction'

export interface TaskRequirement {
  type: AiTaskType
  displayName: string
  description: string
  requiredCapabilities: Array<keyof ModelCapabilityDimensions>
  preferredTier?: 'ultra-fast' | 'balanced' | 'flagship-reasoning'
}

export type { RoutingMode }

export type ProviderHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'rate-limited'
  | 'auth-failed'
  | 'unavailable'
  | 'unknown'

export interface ProviderHealthRecord {
  provider: AiProviderId
  status: ProviderHealthStatus
  lastSuccessTimestamp?: number
  lastFailureTimestamp?: number
  lastErrorMessage?: string
  consecutiveFailures: number
  rateLimitResetTimestamp?: number
  cooldownUntilTimestamp?: number
}

export interface EligibilityResult {
  isEligible: boolean
  rejectionReason?:
    | 'MISSING_CAPABILITY'
    | 'HELIOXEN_RUNTIME_UNSUPPORTED'
    | 'MISSING_CREDENTIAL'
    | 'PROVIDER_UNHEALTHY'
    | 'MODEL_UNREGISTERED'
    | 'EXCLUDED_BY_POLICY'
  details?: string
}

export interface FallbackCandidate {
  provider: AiProviderId
  model: string
  reason: string
}

export interface RoutingDecision {
  selectedProvider: AiProviderId
  selectedModel: string
  taskType: AiTaskType
  strategy: 'explicit-user-preference' | 'task-based-tier' | 'fallback'
  reason: string
  fallbackCandidates: FallbackCandidate[]
  correlationId: string
  timestamp: number
}

export const TASK_DEFINITIONS: Record<AiTaskType, TaskRequirement> = {
  conversation: {
    type: 'conversation',
    displayName: 'General Dialogue',
    description: 'Interactive conversation, general Q&A, and conversational assistance.',
    requiredCapabilities: ['textGeneration'],
    preferredTier: 'balanced'
  },
  'fast-response': {
    type: 'fast-response',
    displayName: 'Fast Response',
    description: 'Rapid turnaround low-latency interactive completions and quick answers.',
    requiredCapabilities: ['textGeneration'],
    preferredTier: 'ultra-fast'
  },
  'complex-reasoning': {
    type: 'complex-reasoning',
    displayName: 'Complex Reasoning',
    description: 'Multi-step analytical synthesis, architectural code generation, or complex planning.',
    requiredCapabilities: ['textGeneration'],
    preferredTier: 'flagship-reasoning'
  },
  'structured-extraction': {
    type: 'structured-extraction',
    displayName: 'Structured JSON',
    description: 'Strict schema-conforming structured JSON generation.',
    requiredCapabilities: ['textGeneration', 'structuredOutput'],
    preferredTier: 'balanced'
  }
}
