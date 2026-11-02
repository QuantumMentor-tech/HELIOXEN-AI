/**
 * HELIOXEN AI — Step 25: Tool Registry, Typed Schemas and Capability Definitions
 * Canonical tool definition contracts, risk tiers, and model-facing tool schemas.
 */

import type { z } from 'zod'
import type { RiskTier } from '../security/capabilities'

export type { RiskTier }

export type ToolCategory =
  | 'system'
  | 'workspace'
  | 'documents'
  | 'media'
  | 'utility'

export type ConfirmationPolicy =
  | 'none'
  | 'user_confirmation'
  | 'prohibited'

export type ImplementationStatus =
  | 'available'
  | 'unavailable'
  | 'planned'

export type ToolRegistrationStatus =
  | 'enabled'
  | 'disabled'

export type ExecutionMode =
  | 'synchronous'
  | 'asynchronous'

export interface ToolLimits {
  /** Maximum execution duration in milliseconds before timeout */
  readonly timeoutMs: number
  /** Maximum allowable payload size in bytes */
  readonly maxPayloadSizeBytes: number
}

export const DEFAULT_TOOL_LIMITS: ToolLimits = {
  timeoutMs: 30000,
  maxPayloadSizeBytes: 1024 * 1024 // 1 MB
}

export interface ToolRetryPolicy {
  /** Whether invoking the operation multiple times with identical arguments yields the same result without unintended side effects */
  readonly isIdempotent: boolean
  /** Whether the operation causes persistent external or local modifications */
  readonly hasSideEffects: boolean
  /** Maximum number of retry attempts permitted (0 disables automatic retry) */
  readonly maxRetries: number
  /** Initial delay before the first retry attempt in milliseconds */
  readonly initialBackoffMs: number
  /** Maximum delay cap between retry attempts in milliseconds */
  readonly maxBackoffMs: number
  /** Exponential backoff multiplier factor */
  readonly backoffFactor: number
  /** Explicit list of error categories/codes that are considered retryable */
  readonly retryableErrorCodes?: readonly string[]
}

export const DEFAULT_RETRY_POLICY: ToolRetryPolicy = {
  isIdempotent: true,
  hasSideEffects: false,
  maxRetries: 2,
  initialBackoffMs: 500,
  maxBackoffMs: 4000,
  backoffFactor: 2,
  retryableErrorCodes: ['TRANSIENT_ERROR', 'RATE_LIMIT', 'TIMEOUT_BEFORE_DISPATCH', 'RESOURCE_BUSY']
}

export const NO_RETRY_POLICY: ToolRetryPolicy = {
  isIdempotent: false,
  hasSideEffects: true,
  maxRetries: 0,
  initialBackoffMs: 0,
  maxBackoffMs: 0,
  backoffFactor: 1
}

export interface JsonSchemaProperty {
  type: string
  description?: string
  enum?: string[]
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  [key: string]: unknown
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  /** Stable unique identifier (format: namespace:action_name) */
  readonly id: string
  /** Human-readable display title */
  readonly displayName: string
  /** Concise, accurate description of what the tool accomplishes */
  readonly description: string
  /** Categorical grouping */
  readonly category: ToolCategory
  /** Semantic contract version */
  readonly version: string
  /** Runtime Zod input validation schema */
  readonly inputSchema: z.ZodType<TInput>
  /** Runtime Zod output validation schema */
  readonly outputSchema: z.ZodType<TOutput>
  /** Canonical JSON Schema representation for model function calling */
  readonly jsonSchema: JsonSchemaProperty
  /** Required capability IDs from the authoritative security capabilities system */
  readonly requiredCapabilities: readonly string[]
  /** Assessed security risk tier */
  readonly riskTier: RiskTier
  /** Human confirmation requirements prior to invocation */
  readonly confirmationPolicy: ConfirmationPolicy
  /** Genuine implementation availability */
  readonly implementationStatus: ImplementationStatus
  /** Current registration status */
  readonly registrationStatus: ToolRegistrationStatus
  /** Synchronous vs asynchronous execution mode */
  readonly executionMode: ExecutionMode
  /** Resource and timeout constraints */
  readonly limits: ToolLimits
  /** Fault-tolerance and retry policy */
  readonly retryPolicy?: ToolRetryPolicy
  /** Source classification of registration */
  readonly source: 'builtin' | 'extension'
  /** Optional descriptive tags */
  readonly tags?: readonly string[]
}

export interface ToolMetadata {
  readonly id: string
  readonly displayName: string
  readonly description: string
  readonly category: ToolCategory
  readonly version: string
  readonly requiredCapabilities: readonly string[]
  readonly riskTier: RiskTier
  readonly confirmationPolicy: ConfirmationPolicy
  readonly implementationStatus: ImplementationStatus
  readonly registrationStatus: ToolRegistrationStatus
  readonly executionMode: ExecutionMode
  readonly limits: ToolLimits
  readonly retryPolicy?: ToolRetryPolicy
  readonly jsonSchema: JsonSchemaProperty
  readonly tags?: readonly string[]
}

export interface ToolQueryFilter {
  category?: ToolCategory
  riskTier?: RiskTier
  implementationStatus?: ImplementationStatus
  registrationStatus?: ToolRegistrationStatus
  search?: string
}

export interface ToolEligibilityEvaluation {
  eligible: boolean
  toolId: string
  reason?: string
  requiresConfirmation: boolean
  requiredCapabilities: readonly string[]
}

export interface ValidationErrorDetail {
  field?: string
  message: string
  code: string
}

export type ToolValidationResult<T = any> =
  | { valid: true; data: T }
  | { valid: false; errors: ValidationErrorDetail[] }

export interface OpenAiToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: JsonSchemaProperty
  }
}

export interface GeminiToolDeclaration {
  name: string
  description: string
  parameters: JsonSchemaProperty
}
