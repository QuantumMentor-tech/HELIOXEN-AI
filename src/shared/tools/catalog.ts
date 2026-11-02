/**
 * HELIOXEN AI — Step 25: Built-in Tool Catalog
 * Approved, type-safe canonical tool definitions matching genuine application capabilities.
 */

import { z } from 'zod'
import {
  ToolDefinition,
  DEFAULT_TOOL_LIMITS,
  DEFAULT_RETRY_POLICY,
  NO_RETRY_POLICY
} from './types'

/**
 * Tool: system:get_time
 * Retrieves the current local time, ISO UTC timestamp, and timezone.
 */
export const SystemGetTimeTool: ToolDefinition<{ timezone?: string }, { localTime: string; isoUtc: string; timestampMs: number; timezone: string }> = {
  id: 'system:get_time',
  displayName: 'Get System Time',
  description: 'Returns the current operating system time in local and ISO UTC formats.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z
    .object({
      timezone: z.string().min(1).max(64).optional()
    })
    .strict(),
  outputSchema: z.object({
    localTime: z.string(),
    isoUtc: z.string(),
    timestampMs: z.number().int().positive(),
    timezone: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone string (e.g., "America/New_York", "UTC"). Defaults to system local.'
      }
    },
    required: []
  },
  requiredCapabilities: [],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['time', 'system', 'clock']
}

/**
 * Tool: workspace:get_context_summary
 * Retrieves summary statistics of active multimodal context.
 */
export const WorkspaceGetContextSummaryTool: ToolDefinition<{ conversationId: string }, { conversationId: string; totalItems: number; activeItems: number; transientBytes: number }> = {
  id: 'workspace:get_context_summary',
  displayName: 'Get Context Summary',
  description: 'Retrieves active multimodal context statistics (item counts, sizes, sources) for the current conversation.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z
    .object({
      conversationId: z.string().min(1).max(128)
    })
    .strict(),
  outputSchema: z.object({
    conversationId: z.string(),
    totalItems: z.number().int().nonnegative(),
    activeItems: z.number().int().nonnegative(),
    transientBytes: z.number().int().nonnegative()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      conversationId: {
        type: 'string',
        description: 'Unique conversation thread identifier to inspect.'
      }
    },
    required: ['conversationId']
  },
  requiredCapabilities: ['workspace:readContext'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['context', 'workspace', 'session']
}

/**
 * Tool: documents:extract_text
 * Extracts normalized text from an approved document file (.txt, .md, .pdf, .docx).
 */
export const DocumentsExtractTextTool: ToolDefinition<{ filePath: string; maxChars?: number }, { text: string; format: string; pageCount?: number; charCount: number; isTruncated: boolean }> = {
  id: 'documents:extract_text',
  displayName: 'Extract Document Text',
  description: 'Safely parses and extracts normalized text and metadata from supported document files (.txt, .md, .pdf, .docx).',
  category: 'documents',
  version: '1.0.0',
  inputSchema: z
    .object({
      filePath: z.string().min(1).max(1024),
      maxChars: z.number().int().min(1).max(100000).optional()
    })
    .strict(),
  outputSchema: z.object({
    text: z.string(),
    format: z.string(),
    pageCount: z.number().int().positive().optional(),
    charCount: z.number().int().nonnegative(),
    isTruncated: z.boolean()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute or application-relative path to a supported document.'
      },
      maxChars: {
        type: 'integer',
        description: 'Optional maximum character limit for extracted text (default 100,000).'
      }
    },
    required: ['filePath']
  },
  requiredCapabilities: ['documents:extract'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: {
    timeoutMs: 45000,
    maxPayloadSizeBytes: 10 * 1024 * 1024 // 10 MB
  },
  retryPolicy: {
    isIdempotent: true,
    hasSideEffects: false,
    maxRetries: 1,
    initialBackoffMs: 500,
    maxBackoffMs: 2000,
    backoffFactor: 2,
    retryableErrorCodes: ['TRANSIENT_ERROR', 'RESOURCE_BUSY']
  },
  source: 'builtin',
  tags: ['document', 'pdf', 'docx', 'markdown', 'text']
}

/**
 * Tool: media:get_capture_sources
 * Enumerates available desktop display screens and application windows for visual capture.
 */
export const MediaGetCaptureSourcesTool: ToolDefinition<{ types?: ('screen' | 'window')[] }, { sources: Array<{ id: string; name: string; isAppWindow: boolean }> }> = {
  id: 'media:get_capture_sources',
  displayName: 'Get Desktop Display Sources',
  description: 'Enumerates display screens and application windows currently available for user-consented visual capture.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z
    .object({
      types: z.array(z.enum(['screen', 'window'])).max(2).optional()
    })
    .strict(),
  outputSchema: z.object({
    sources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        isAppWindow: z.boolean()
      })
    )
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['screen', 'window']
        },
        description: 'Optional filter for desktop source types (screens, application windows, or both).'
      }
    },
    required: []
  },
  requiredCapabilities: ['capture:getSources'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: {
    isIdempotent: true,
    hasSideEffects: false,
    maxRetries: 1,
    initialBackoffMs: 500,
    maxBackoffMs: 2000,
    backoffFactor: 2,
    retryableErrorCodes: ['TRANSIENT_ERROR', 'RESOURCE_BUSY']
  },
  source: 'builtin',
  tags: ['media', 'screen', 'window', 'capture']
}

/**
 * Tool: models:list_available
 * Lists verified AI models and capability profiles.
 */
export const ModelsListAvailableTool: ToolDefinition<{ provider?: string }, { models: Array<{ id: string; providerId: string; displayName: string; tier: string }> }> = {
  id: 'models:list_available',
  displayName: 'List Available Models',
  description: 'Lists active curated AI models and verified capability profiles.',
  category: 'utility',
  version: '1.0.0',
  inputSchema: z
    .object({
      provider: z.string().min(1).max(64).optional()
    })
    .strict(),
  outputSchema: z.object({
    models: z.array(
      z.object({
        id: z.string(),
        providerId: z.string(),
        displayName: z.string(),
        tier: z.string()
      })
    )
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        description: 'Optional provider identifier filter ("google-gemini" or "openai").'
      }
    },
    required: []
  },
  requiredCapabilities: ['models:getCatalog'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['models', 'ai', 'providers']
}

/**
 * Prohibited Reference Tool: shell:execute
 * Explicitly prohibited from execution. Used to test security boundaries and risk classification rejection.
 */
export const ProhibitedShellExecuteTool: ToolDefinition<{ command: string }, { output: string }> = {
  id: 'shell:execute',
  displayName: 'Execute Shell Command',
  description: 'Direct execution of raw bash, cmd, or powershell commands. Permanently prohibited.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z
    .object({
      command: z.string().min(1).max(1024)
    })
    .strict(),
  outputSchema: z.object({
    output: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command line to execute.'
      }
    },
    required: ['command']
  },
  requiredCapabilities: ['shell:execute'],
  riskTier: 'prohibited',
  confirmationPolicy: 'prohibited',
  implementationStatus: 'unavailable',
  registrationStatus: 'disabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['shell', 'command', 'prohibited']
}

export const BUILTIN_TOOL_CATALOG: readonly ToolDefinition[] = [
  SystemGetTimeTool,
  WorkspaceGetContextSummaryTool,
  DocumentsExtractTextTool,
  MediaGetCaptureSourcesTool,
  ModelsListAvailableTool,
  ProhibitedShellExecuteTool
] as const
