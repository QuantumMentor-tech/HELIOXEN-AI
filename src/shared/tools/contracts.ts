/**
 * HELIOXEN AI — Step 25: Tool Registry Contracts & Serialization
 * Zod validation schemas, identifier validators, and model formatters.
 */

import { z } from 'zod'
import {
  ToolCategory,
  ConfirmationPolicy,
  ImplementationStatus,
  ToolRegistrationStatus,
  ExecutionMode,
  ToolDefinition,
  ToolMetadata,
  ToolQueryFilter,
  ToolEligibilityEvaluation,
  ValidationErrorDetail,
  OpenAiToolSchema,
  GeminiToolDeclaration
} from './types'

export const ToolCategorySchema = z.enum([
  'system',
  'workspace',
  'documents',
  'media',
  'utility'
])

export const RiskTierSchema = z.enum([
  'low',
  'moderate',
  'high',
  'prohibited'
])

export const ConfirmationPolicySchema = z.enum([
  'none',
  'user_confirmation',
  'prohibited'
])

export const ImplementationStatusSchema = z.enum([
  'available',
  'unavailable',
  'planned'
])

export const ToolRegistrationStatusSchema = z.enum([
  'enabled',
  'disabled'
])

export const ExecutionModeSchema = z.enum([
  'synchronous',
  'asynchronous'
])

export const ToolLimitsSchema = z.object({
  timeoutMs: z.number().int().positive(),
  maxPayloadSizeBytes: z.number().int().positive()
})

export const ToolMetadataSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  category: ToolCategorySchema,
  version: z.string().min(1),
  requiredCapabilities: z.array(z.string()),
  riskTier: RiskTierSchema,
  confirmationPolicy: ConfirmationPolicySchema,
  implementationStatus: ImplementationStatusSchema,
  registrationStatus: ToolRegistrationStatusSchema,
  executionMode: ExecutionModeSchema,
  limits: ToolLimitsSchema,
  jsonSchema: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).optional()
})

export const ToolQueryFilterSchema = z.object({
  category: ToolCategorySchema.optional(),
  riskTier: RiskTierSchema.optional(),
  implementationStatus: ImplementationStatusSchema.optional(),
  registrationStatus: ToolRegistrationStatusSchema.optional(),
  search: z.string().optional()
})

export const ToolEligibilityEvaluationSchema = z.object({
  eligible: z.boolean(),
  toolId: z.string().min(1),
  reason: z.string().optional(),
  requiresConfirmation: z.boolean(),
  requiredCapabilities: z.array(z.string())
})

const TOOL_ID_REGEX = /^[a-z][a-z0-9_-]*:[a-z0-9_]+$/

/**
 * Validates whether a tool identifier conforms to the required `namespace:action_name` convention.
 */
export function validateToolIdentifier(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Tool identifier must be a non-empty string' }
  }
  if (!TOOL_ID_REGEX.test(id)) {
    return {
      valid: false,
      error: `Tool identifier '${id}' must follow 'namespace:action_name' format (lowercase alphanumeric with colons and underscores)`
    }
  }
  return { valid: true }
}

/**
 * Normalizes Zod validation issues into consistent, safe error detail structures.
 */
export function normalizeZodError(error: z.ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }))
}

/**
 * Strips internal and implementation-specific details to produce a clean public ToolMetadata object.
 */
export function sanitizeToolMetadata(def: ToolDefinition): ToolMetadata {
  return {
    id: def.id,
    displayName: def.displayName,
    description: def.description,
    category: def.category,
    version: def.version,
    requiredCapabilities: [...def.requiredCapabilities],
    riskTier: def.riskTier,
    confirmationPolicy: def.confirmationPolicy,
    implementationStatus: def.implementationStatus,
    registrationStatus: def.registrationStatus,
    executionMode: def.executionMode,
    limits: { ...def.limits },
    retryPolicy: def.retryPolicy ? { ...def.retryPolicy } : undefined,
    jsonSchema: JSON.parse(JSON.stringify(def.jsonSchema)),
    tags: def.tags ? [...def.tags] : undefined
  }
}

/**
 * Formats a canonical tool definition into an OpenAI function declaration schema.
 */
export function toOpenAiTool(def: ToolDefinition): OpenAiToolSchema {
  // Sanitize identifier to valid OpenAI tool name (replace colons with double underscores)
  const safeName = def.id.replace(/:/g, '__')
  return {
    type: 'function',
    function: {
      name: safeName,
      description: def.description,
      parameters: def.jsonSchema
    }
  }
}

/**
 * Formats a canonical tool definition into a Google Gemini function declaration schema.
 */
export function toGeminiTool(def: ToolDefinition): GeminiToolDeclaration {
  const safeName = def.id.replace(/:/g, '__')
  return {
    name: safeName,
    description: def.description,
    parameters: def.jsonSchema
  }
}
