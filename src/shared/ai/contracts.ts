import { z } from 'zod'

export const AiProviderIdSchema = z.enum(['google-gemini', 'openai'])

export const MessageRoleSchema = z.enum(['system', 'user', 'assistant'])

export const AiImageAttachmentSchema = z.object({
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1)
})

export const AiDocumentContextSchema = z.object({
  filename: z.string().min(1),
  text: z.string(),
  pageCount: z.number().int().positive().optional()
})

export const AiMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1, 'Message content cannot be empty'),
  imageAttachment: AiImageAttachmentSchema.optional(),
  documentContext: z.array(AiDocumentContextSchema).optional()
})

export const AiTaskTypeSchema = z.enum([
  'conversation',
  'fast-response',
  'complex-reasoning',
  'structured-extraction'
])

export const RoutingModeSchema = z.enum(['manual', 'task-based'])

export const AiGenerationRequestSchema = z.object({
  provider: AiProviderIdSchema.optional(),
  model: z.string().optional(),
  taskType: AiTaskTypeSchema.optional().default('conversation'),
  messages: z.array(AiMessageSchema).min(1, 'At least one message is required'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  imageAttachment: AiImageAttachmentSchema.optional(),
  documentContext: z.array(AiDocumentContextSchema).optional()
})

export type ValidatedAiGenerationRequest = z.infer<typeof AiGenerationRequestSchema>

export const CredentialSetRequestSchema = z.object({
  provider: AiProviderIdSchema,
  apiKey: z.string().min(1, 'API key cannot be empty'),
  label: z.string().optional()
})

export type ValidatedCredentialSetRequest = z.infer<typeof CredentialSetRequestSchema>

export const CredentialDeleteRequestSchema = z.object({
  provider: AiProviderIdSchema
})

export type ValidatedCredentialDeleteRequest = z.infer<typeof CredentialDeleteRequestSchema>

export const CredentialTestRequestSchema = z.object({
  provider: AiProviderIdSchema
})

export type ValidatedCredentialTestRequest = z.infer<typeof CredentialTestRequestSchema>

export const UserAiPreferencesSchema = z.object({
  activeProvider: AiProviderIdSchema,
  activeModel: z.string().min(1, 'Active model identifier cannot be empty'),
  routingMode: RoutingModeSchema.default('manual'),
  allowSameProviderFallback: z.boolean().default(true),
  allowCrossProviderFallback: z.boolean().default(false),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean(),
  clearTransientOnSessionEnd: z.boolean().optional().default(true),
  clearAttachmentsOnConversationClose: z.boolean().optional().default(true),
  enableSourceAttribution: z.boolean().optional().default(true),
  warnOnExternalTransmission: z.boolean().optional().default(true)
})

export type ValidatedUserAiPreferences = z.infer<typeof UserAiPreferencesSchema>

export const ModelRefreshRequestSchema = z.object({
  provider: AiProviderIdSchema
})

export type ValidatedModelRefreshRequest = z.infer<typeof ModelRefreshRequestSchema>
