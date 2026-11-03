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
import {
  SystemHealthTelemetrySchema,
  SystemHealthRequestSchema,
  InstalledAppsResultSchema,
  InstalledAppsRequestSchema,
  WindowDiscoveryResultSchema,
  WindowDiscoveryRequestSchema,
  SystemHealthTelemetry,
  SystemHealthRequest,
  InstalledAppsResult,
  InstalledAppsRequest,
  WindowDiscoveryResult,
  WindowDiscoveryRequest
} from '../telemetry'
import {
  DirectoryListingRequestSchema,
  DirectoryListingResultSchema,
  FileMetadataSchema,
  FileSearchRequestSchema,
  FileSearchResultSchema,
  ReadTextFileRequestSchema,
  ReadTextFileResultSchema,
  CreateFileRequestSchema,
  CreateFileResultSchema,
  CopyFileRequestSchema,
  CopyFileResultSchema,
  MoveFileRequestSchema,
  MoveFileResultSchema,
  OrganizationPlanRequestSchema,
  OrganizationPlanSchema,
  OrganizationApplyRequestSchema,
  OrganizationApplyResultSchema,
  OrganizationUndoRequestSchema,
  OrganizationUndoResultSchema,
  ClipboardReadTextResultSchema,
  ClipboardWriteTextRequestSchema,
  ClipboardWriteTextResultSchema,
  DirectoryListingRequest,
  DirectoryListingResult,
  FileMetadata,
  FileSearchRequest,
  FileSearchResult,
  ReadTextFileRequest,
  ReadTextFileResult,
  CreateFileRequest,
  CreateFileResult,
  CopyFileRequest,
  CopyFileResult,
  MoveFileRequest,
  MoveFileResult,
  OrganizationPlanRequest,
  OrganizationPlan,
  OrganizationApplyRequest,
  OrganizationApplyResult,
  OrganizationUndoRequest,
  OrganizationUndoResult,
  ClipboardReadTextResult,
  ClipboardWriteTextRequest,
  ClipboardWriteTextResult
} from '../filesystem'
import {
  TargetWindowReferenceSchema,
  KeyboardActionRequestSchema,
  TextEntryRequestSchema,
  KeyboardActionResultSchema,
  MouseClickRequestSchema,
  MouseScrollRequestSchema,
  MouseActionResultSchema,
  SystemOpenPathRequestSchema,
  SystemOpenPathResultSchema,
  SystemShowInFolderRequestSchema,
  SystemShowInFolderResultSchema,
  SystemOpenUrlRequestSchema,
  SystemOpenUrlResultSchema,
  SystemAlertBeepResultSchema,
  DisplayMetricsResultSchema,
  EmergencyStopResultSchema,
  UndoInteractionRequestSchema,
  UndoInteractionResultSchema
} from '../interaction'
import {
  CreateSessionRequestSchema,
  BrowserSessionMetadataSchema,
  CreateTabRequestSchema,
  BrowserTabStateSchema,
  NavigateTabRequestSchema,
  SwitchTabRequestSchema,
  CloseTabRequestSchema,
  TabActionRequestSchema,
  ClearSessionDataRequestSchema,
  InspectPageRequestSchema,
  PageInspectionSnapshotSchema,
  ClickElementRequestSchema,
  ScrollPageRequestSchema,
  FillFieldRequestSchema,
  SelectOptionRequestSchema,
  ReviewFormRequestSchema,
  FormReviewSummarySchema,
  SubmitFormRequestSchema,
  BrowserActionResultSchema,
  DownloadStateRecordSchema
} from '../browser'
import {
  ResearchSearchQuerySchema,
  ResearchSearchResponseSchema,
  ResearchExtractionRequestSchema,
  ResearchSourceRecordSchema,
  BrowserScreenshotRequestSchema,
  BrowserScreenshotRecordSchema,
  ManageCollectionRequestSchema,
  ValidateCitationsRequestSchema,
  ResearchCitationSchema
} from '../research'

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
 * Tool: telemetry:get_system_health
 * Retrieves real-time host and process CPU, memory, uptime, and primary storage capacity metrics.
 */
export const TelemetryGetSystemHealthTool: ToolDefinition<SystemHealthRequest, SystemHealthTelemetry> = {
  id: 'telemetry:get_system_health',
  displayName: 'Get System Health Telemetry',
  description: 'Returns real-time host and process CPU utilization, memory distribution, uptime, and primary storage capacity metrics.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SystemHealthRequestSchema,
  outputSchema: SystemHealthTelemetrySchema,
  jsonSchema: {
    type: 'object',
    properties: {
      sampleDurationMs: {
        type: 'integer',
        description: 'Duration in milliseconds (50 to 1000) over which to measure CPU utilization deltas. Defaults to 100.'
      }
    },
    required: []
  },
  requiredCapabilities: ['telemetry:readSystemHealth'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['telemetry', 'system', 'cpu', 'memory', 'health', 'storage']
}

/**
 * Tool: system:list_installed_apps
 * Enumerates registered desktop applications with search and filtering.
 */
export const SystemListInstalledAppsTool: ToolDefinition<InstalledAppsRequest, InstalledAppsResult> = {
  id: 'system:list_installed_apps',
  displayName: 'List Installed Applications',
  description: 'Enumerates registered desktop application names, publishers, categories, and installation scopes from Start Menu inventory.',
  category: 'system',
  version: '1.0.0',
  inputSchema: InstalledAppsRequestSchema,
  outputSchema: InstalledAppsResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional case-insensitive search filter for application name, publisher, or category.'
      },
      scope: {
        type: 'string',
        enum: ['all', 'system', 'user'],
        description: 'Optional filter by installation scope (system-wide vs user-specific).'
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of application entries to return (default 50, maximum 200).'
      },
      forceRefresh: {
        type: 'boolean',
        description: 'Bypasses the in-memory inventory cache and performs a fresh discovery scan.'
      }
    },
    required: []
  },
  requiredCapabilities: ['telemetry:readInstalledApps'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['apps', 'inventory', 'applications', 'system', 'software']
}

/**
 * Tool: system:list_windows
 * Enumerates visible desktop windows and HELIOXEN application windows.
 */
export const SystemListWindowsTool: ToolDefinition<WindowDiscoveryRequest, WindowDiscoveryResult> = {
  id: 'system:list_windows',
  displayName: 'List Desktop Windows',
  description: 'Enumerates permitted visible desktop windows and HELIOXEN application windows without screen content capture.',
  category: 'system',
  version: '1.0.0',
  inputSchema: WindowDiscoveryRequestSchema,
  outputSchema: WindowDiscoveryResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      includeSelf: {
        type: 'boolean',
        description: 'Whether to include HELIOXEN application windows in discovery results. Defaults to true.'
      },
      redactSensitiveTitles: {
        type: 'boolean',
        description: 'Whether to redact emails, URLs, and file paths from window titles. Defaults to false.'
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of window records to return (default 50, maximum 100).'
      }
    },
    required: []
  },
  requiredCapabilities: ['telemetry:readDesktopWindows'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['windows', 'desktop', 'visibility', 'system']
}

/**
 * Tool: filesystem:list_directory
 */
export const FilesystemListDirectoryTool: ToolDefinition<DirectoryListingRequest, DirectoryListingResult> = {
  id: 'filesystem:list_directory',
  displayName: 'List Directory Contents',
  description: 'Enumerates files and subdirectories within an authorized root directory with depth limits.',
  category: 'system',
  version: '1.0.0',
  inputSchema: DirectoryListingRequestSchema,
  outputSchema: DirectoryListingResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      relativePath: { type: 'string', description: 'Optional relative subfolder within root.' },
      maxDepth: { type: 'integer', description: 'Maximum directory recursion depth (0 to 5, default 1).' },
      limit: { type: 'integer', description: 'Maximum items to return (1 to 500, default 100).' }
    },
    required: ['rootPath']
  },
  requiredCapabilities: ['filesystem:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'files', 'directory', 'list']
}

/**
 * Tool: filesystem:get_metadata
 */
export const FilesystemGetMetadataTool: ToolDefinition<{ rootPath: string; filePath: string }, FileMetadata> = {
  id: 'filesystem:get_metadata',
  displayName: 'Get File Metadata',
  description: 'Retrieves type, size, modification time, and read-only status for an authorized file.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({
    rootPath: z.string().min(1).max(1024),
    filePath: z.string().min(1).max(1024)
  }).strict(),
  outputSchema: FileMetadataSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      filePath: { type: 'string', description: 'Path to target file within authorized root.' }
    },
    required: ['rootPath', 'filePath']
  },
  requiredCapabilities: ['filesystem:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'metadata', 'file']
}

/**
 * Tool: filesystem:search_files
 */
export const FilesystemSearchFilesTool: ToolDefinition<FileSearchRequest, FileSearchResult> = {
  id: 'filesystem:search_files',
  displayName: 'Search Files',
  description: 'Searches for files matching name substring, extension, or size ranges within an authorized root.',
  category: 'system',
  version: '1.0.0',
  inputSchema: FileSearchRequestSchema,
  outputSchema: FileSearchResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      query: { type: 'string', description: 'Optional filename substring.' },
      extension: { type: 'string', description: 'Optional extension filter.' },
      minSizeBytes: { type: 'integer', description: 'Optional minimum file size.' },
      maxSizeBytes: { type: 'integer', description: 'Optional maximum file size.' },
      limit: { type: 'integer', description: 'Maximum matches to return (1 to 200, default 50).' }
    },
    required: ['rootPath']
  },
  requiredCapabilities: ['filesystem:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'search', 'filter']
}

/**
 * Tool: filesystem:read_text_file
 */
export const FilesystemReadTextFileTool: ToolDefinition<ReadTextFileRequest, ReadTextFileResult> = {
  id: 'filesystem:read_text_file',
  displayName: 'Read Text File',
  description: 'Reads bounded UTF-8 text from an authorized file.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ReadTextFileRequestSchema,
  outputSchema: ReadTextFileResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      filePath: { type: 'string', description: 'Path to target text file within authorized root.' },
      maxBytes: { type: 'integer', description: 'Maximum bytes to read (default 1MB, maximum 10MB).' }
    },
    required: ['rootPath', 'filePath']
  },
  requiredCapabilities: ['filesystem:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'read', 'text']
}

/**
 * Tool: filesystem:create_file
 */
export const FilesystemCreateFileTool: ToolDefinition<CreateFileRequest, CreateFileResult> = {
  id: 'filesystem:create_file',
  displayName: 'Create File',
  description: 'Creates a new file with text content in an authorized root. Rejects collision by default.',
  category: 'system',
  version: '1.0.0',
  inputSchema: CreateFileRequestSchema,
  outputSchema: CreateFileResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      filePath: { type: 'string', description: 'Path to file to create.' },
      content: { type: 'string', description: 'Text content to write.' },
      overwrite: { type: 'boolean', description: 'Whether to overwrite if file exists (default false).' }
    },
    required: ['rootPath', 'filePath', 'content']
  },
  requiredCapabilities: ['filesystem:write'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'write', 'create']
}

/**
 * Tool: filesystem:copy_file
 */
export const FilesystemCopyFileTool: ToolDefinition<CopyFileRequest, CopyFileResult> = {
  id: 'filesystem:copy_file',
  displayName: 'Copy File',
  description: 'Copies a file within an authorized root scope. Rejects collision by default.',
  category: 'system',
  version: '1.0.0',
  inputSchema: CopyFileRequestSchema,
  outputSchema: CopyFileResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      sourcePath: { type: 'string', description: 'Source file path.' },
      destinationPath: { type: 'string', description: 'Destination file path.' },
      overwrite: { type: 'boolean', description: 'Whether to overwrite if destination exists (default false).' }
    },
    required: ['rootPath', 'sourcePath', 'destinationPath']
  },
  requiredCapabilities: ['filesystem:write'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'copy']
}

/**
 * Tool: filesystem:move_file
 */
export const FilesystemMoveFileTool: ToolDefinition<MoveFileRequest, MoveFileResult> = {
  id: 'filesystem:move_file',
  displayName: 'Move or Rename File',
  description: 'Moves or renames a file within an authorized root. Rejects collision by default.',
  category: 'system',
  version: '1.0.0',
  inputSchema: MoveFileRequestSchema,
  outputSchema: MoveFileResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path.' },
      sourcePath: { type: 'string', description: 'Source file path.' },
      destinationPath: { type: 'string', description: 'Destination file path.' },
      overwrite: { type: 'boolean', description: 'Whether to overwrite if destination exists (default false).' }
    },
    required: ['rootPath', 'sourcePath', 'destinationPath']
  },
  requiredCapabilities: ['filesystem:write'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'move', 'rename']
}

/**
 * Tool: filesystem:organize_preview
 */
export const FilesystemOrganizePreviewTool: ToolDefinition<OrganizationPlanRequest, OrganizationPlan> = {
  id: 'filesystem:organize_preview',
  displayName: 'Preview File Organization',
  description: 'Generates a preview of proposed file organization moves without modifying any files.',
  category: 'system',
  version: '1.0.0',
  inputSchema: OrganizationPlanRequestSchema,
  outputSchema: OrganizationPlanSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      rootPath: { type: 'string', description: 'Authorized root directory path to organize.' },
      strategy: { type: 'string', enum: ['by_extension', 'by_date', 'by_category'], description: 'Organization grouping strategy.' }
    },
    required: ['rootPath', 'strategy']
  },
  requiredCapabilities: ['filesystem:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'organize', 'preview']
}

/**
 * Tool: filesystem:organize_apply
 */
export const FilesystemOrganizeApplyTool: ToolDefinition<OrganizationApplyRequest, OrganizationApplyResult> = {
  id: 'filesystem:organize_apply',
  displayName: 'Apply File Organization',
  description: 'Executes an approved organization plan under verified transaction manifest tracking.',
  category: 'system',
  version: '1.0.0',
  inputSchema: OrganizationApplyRequestSchema,
  outputSchema: OrganizationApplyResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      plan: { type: 'object', description: 'Approved organization plan object.' }
    },
    required: ['plan']
  },
  requiredCapabilities: ['filesystem:organize'],
  riskTier: 'high',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'organize', 'apply', 'transaction']
}

/**
 * Tool: filesystem:organize_undo
 */
export const FilesystemOrganizeUndoTool: ToolDefinition<OrganizationUndoRequest, OrganizationUndoResult> = {
  id: 'filesystem:organize_undo',
  displayName: 'Undo File Organization',
  description: 'Reverses an applied organization transaction, restoring files to original locations.',
  category: 'system',
  version: '1.0.0',
  inputSchema: OrganizationUndoRequestSchema,
  outputSchema: OrganizationUndoResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      transactionId: { type: 'string', description: 'Identifier of transaction to undo.' }
    },
    required: ['transactionId']
  },
  requiredCapabilities: ['filesystem:organize'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['filesystem', 'organize', 'undo', 'rollback']
}

/**
 * Tool: clipboard:read_text
 */
export const ClipboardReadTextTool: ToolDefinition<{ maxChars?: number }, ClipboardReadTextResult> = {
  id: 'clipboard:read_text',
  displayName: 'Read Clipboard Text',
  description: 'Reads text content from system clipboard on explicit user request.',
  category: 'utility',
  version: '1.0.0',
  inputSchema: z.object({ maxChars: z.number().int().min(1).max(1000000).optional() }).strict(),
  outputSchema: ClipboardReadTextResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      maxChars: { type: 'integer', description: 'Maximum characters to retrieve (default 1,000,000).' }
    },
    required: []
  },
  requiredCapabilities: ['clipboard:read'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['clipboard', 'text', 'read']
}

/**
 * Tool: clipboard:write_text
 */
export const ClipboardWriteTextTool: ToolDefinition<ClipboardWriteTextRequest, ClipboardWriteTextResult> = {
  id: 'clipboard:write_text',
  displayName: 'Write Clipboard Text',
  description: 'Copies user-approved text into the system clipboard.',
  category: 'utility',
  version: '1.0.0',
  inputSchema: ClipboardWriteTextRequestSchema,
  outputSchema: ClipboardWriteTextResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to copy to clipboard.' }
    },
    required: ['text']
  },
  requiredCapabilities: ['clipboard:write'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['clipboard', 'text', 'write']
}

/**
 * Tool: desktop:focus_window
 * Focuses a verified target application window.
 */
export const DesktopFocusWindowTool: ToolDefinition = {
  id: 'desktop:focus_window',
  displayName: 'Focus Window',
  description: 'Brings an authorized, verified desktop window into focused foreground state.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({
    target: TargetWindowReferenceSchema
  }).strict(),
  outputSchema: z.object({
    success: z.boolean(),
    windowId: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'object',
        properties: {
          windowId: { type: 'string' }
        },
        required: ['windowId']
      }
    },
    required: ['target']
  },
  requiredCapabilities: ['desktop:focusWindow'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'focus', 'window']
}

/**
 * Tool: desktop:send_key_action
 * Executes an allowlisted keyboard shortcut on a verified target.
 */
export const DesktopSendKeyActionTool: ToolDefinition = {
  id: 'desktop:send_key_action',
  displayName: 'Send Keyboard Action',
  description: 'Executes an allowlisted keyboard shortcut on a verified focused target window.',
  category: 'system',
  version: '1.0.0',
  inputSchema: KeyboardActionRequestSchema,
  outputSchema: KeyboardActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      target: { type: 'object' },
      shortcut: { type: 'string' },
      modifiers: { type: 'array', items: { type: 'string' } }
    },
    required: ['target', 'shortcut']
  },
  requiredCapabilities: ['desktop:keyAction'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'keyboard', 'shortcut']
}

/**
 * Tool: desktop:send_text
 * Enters user-approved text into a verified target window without implicit submit.
 */
export const DesktopSendTextTool: ToolDefinition = {
  id: 'desktop:send_text',
  displayName: 'Send Text',
  description: 'Types user-approved text into a verified target input context without implicit submission.',
  category: 'system',
  version: '1.0.0',
  inputSchema: TextEntryRequestSchema,
  outputSchema: KeyboardActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      target: { type: 'object' },
      text: { type: 'string' },
      maxChars: { type: 'number' }
    },
    required: ['target', 'text']
  },
  requiredCapabilities: ['desktop:sendText'],
  riskTier: 'high',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'keyboard', 'text', 'high-risk']
}

/**
 * Tool: desktop:send_click
 * Executes a target-relative mouse click within verified window boundaries.
 */
export const DesktopSendClickTool: ToolDefinition = {
  id: 'desktop:send_click',
  displayName: 'Send Mouse Click',
  description: 'Executes a target-relative mouse click within verified window bounds.',
  category: 'system',
  version: '1.0.0',
  inputSchema: MouseClickRequestSchema,
  outputSchema: MouseActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      target: { type: 'object' },
      x: { type: 'number' },
      y: { type: 'number' },
      button: { type: 'string' },
      clickCount: { type: 'number' }
    },
    required: ['target', 'x', 'y']
  },
  requiredCapabilities: ['desktop:mouseAction'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'mouse', 'click']
}

/**
 * Tool: desktop:send_scroll
 * Executes bounded scrolling on a verified target window.
 */
export const DesktopSendScrollTool: ToolDefinition = {
  id: 'desktop:send_scroll',
  displayName: 'Send Scroll',
  description: 'Executes bounded scrolling on a verified target window.',
  category: 'system',
  version: '1.0.0',
  inputSchema: MouseScrollRequestSchema,
  outputSchema: MouseActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      target: { type: 'object' },
      deltaX: { type: 'number' },
      deltaY: { type: 'number' }
    },
    required: ['target']
  },
  requiredCapabilities: ['desktop:mouseAction'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'mouse', 'scroll']
}

/**
 * Tool: desktop:emergency_stop
 * Halts active desktop automation sequences immediately and releases held modifiers.
 */
export const DesktopEmergencyStopTool: ToolDefinition = {
  id: 'desktop:emergency_stop',
  displayName: 'Emergency Stop Interaction',
  description: 'Immediately halts active desktop automation sequences and releases held modifier keys.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({}).strict(),
  outputSchema: EmergencyStopResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {}
  },
  requiredCapabilities: ['desktop:emergencyStop'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'emergency', 'stop']
}

/**
 * Tool: desktop:undo_last_action
 * Performs verified undo on a reversible desktop interaction.
 */
export const DesktopUndoLastActionTool: ToolDefinition = {
  id: 'desktop:undo_last_action',
  displayName: 'Undo Last Desktop Action',
  description: 'Reverts the most recent reversible desktop interaction (e.g., text entry).',
  category: 'system',
  version: '1.0.0',
  inputSchema: UndoInteractionRequestSchema,
  outputSchema: UndoInteractionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      undoToken: { type: 'string' }
    }
  },
  requiredCapabilities: ['desktop:undo'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['desktop', 'undo', 'recovery']
}

/**
 * Tool: system:open_path
 * Opens an authorized file or directory in the default operating system application.
 */
export const SystemOpenPathTool: ToolDefinition = {
  id: 'system:open_path',
  displayName: 'Open Path',
  description: 'Opens an authorized file or folder in the default system viewer.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SystemOpenPathRequestSchema,
  outputSchema: SystemOpenPathResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      targetPath: { type: 'string' }
    },
    required: ['targetPath']
  },
  requiredCapabilities: ['system:openPath'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['system', 'open', 'file']
}

/**
 * Tool: system:show_in_folder
 * Reveals an authorized file or folder in Windows File Explorer.
 */
export const SystemShowInFolderTool: ToolDefinition = {
  id: 'system:show_in_folder',
  displayName: 'Show In Folder',
  description: 'Reveals an authorized file or directory in Windows File Explorer.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SystemShowInFolderRequestSchema,
  outputSchema: SystemShowInFolderResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      targetPath: { type: 'string' }
    },
    required: ['targetPath']
  },
  requiredCapabilities: ['system:showInFolder'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['system', 'explorer', 'folder']
}

/**
 * Tool: system:open_external_url
 * Opens an approved HTTP or HTTPS web URL in the user default browser.
 */
export const SystemOpenExternalUrlTool: ToolDefinition = {
  id: 'system:open_external_url',
  displayName: 'Open External URL',
  description: 'Opens an approved HTTP or HTTPS web address in the user default web browser.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SystemOpenUrlRequestSchema,
  outputSchema: SystemOpenUrlResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' }
    },
    required: ['url']
  },
  requiredCapabilities: ['system:openExternalUrl'],
  riskTier: 'high',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['system', 'browser', 'url', 'high-risk']
}

/**
 * Tool: system:alert_beep
 * Emits an audible standard system alert sound.
 */
export const SystemAlertBeepTool: ToolDefinition = {
  id: 'system:alert_beep',
  displayName: 'System Alert Beep',
  description: 'Emits an audible standard operating system notification beep.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({}).strict(),
  outputSchema: SystemAlertBeepResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {}
  },
  requiredCapabilities: ['system:systemAlert'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['system', 'beep', 'alert']
}

/**
 * Tool: system:get_display_metrics
 * Retrieves primary and connected display boundaries, scale factors, and work areas.
 */
export const SystemGetDisplayMetricsTool: ToolDefinition = {
  id: 'system:get_display_metrics',
  displayName: 'Get Display Metrics',
  description: 'Retrieves primary and connected display bounds, work areas, and DPI scale factors.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({}).strict(),
  outputSchema: DisplayMetricsResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {}
  },
  requiredCapabilities: ['system:getDisplayMetrics'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['system', 'display', 'screen']
}

/**
 * Tool: browser:create_session
 * Creates an isolated in-memory or persistent browser session profile.
 */
export const BrowserCreateSessionTool: ToolDefinition = {
  id: 'browser:create_session',
  displayName: 'Create Browser Session',
  description: 'Creates or configures an isolated in-memory or persistent browser session partition.',
  category: 'system',
  version: '1.0.0',
  inputSchema: CreateSessionRequestSchema,
  outputSchema: BrowserSessionMetadataSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      persist: { type: 'boolean' }
    }
  },
  requiredCapabilities: ['browser:createSession'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'session', 'privacy']
}

/**
 * Tool: browser:create_tab
 * Opens a new isolated browser tab within an authorized session.
 */
export const BrowserCreateTabTool: ToolDefinition = {
  id: 'browser:create_tab',
  displayName: 'Create Browser Tab',
  description: 'Opens a new browser tab within an authorized session profile.',
  category: 'system',
  version: '1.0.0',
  inputSchema: CreateTabRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      url: { type: 'string' },
      activate: { type: 'boolean' }
    }
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'tab', 'create']
}

/**
 * Tool: browser:navigate
 * Navigates a browser tab to a validated HTTP or HTTPS URL.
 */
export const BrowserNavigateTool: ToolDefinition = {
  id: 'browser:navigate',
  displayName: 'Navigate Browser Tab',
  description: 'Navigates an existing browser tab to a validated HTTP or HTTPS URL.',
  category: 'system',
  version: '1.0.0',
  inputSchema: NavigateTabRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      url: { type: 'string' }
    },
    required: ['tabId', 'url']
  },
  requiredCapabilities: ['browser:navigate'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'navigate', 'web']
}

/**
 * Tool: browser:switch_tab
 * Switches the active focused browser tab.
 */
export const BrowserSwitchTabTool: ToolDefinition = {
  id: 'browser:switch_tab',
  displayName: 'Switch Browser Tab',
  description: 'Switches the active displayed browser tab to the requested tabId.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SwitchTabRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'tab', 'switch']
}

/**
 * Tool: browser:close_tab
 * Closes a browser tab and safely releases its resources.
 */
export const BrowserCloseTabTool: ToolDefinition = {
  id: 'browser:close_tab',
  displayName: 'Close Browser Tab',
  description: 'Closes a browser tab and releases its associated rendering view.',
  category: 'system',
  version: '1.0.0',
  inputSchema: CloseTabRequestSchema,
  outputSchema: z.object({
    success: z.boolean(),
    closedTabId: z.string(),
    newActiveTabId: z.string().optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'tab', 'close']
}

/**
 * Tool: browser:get_tab_state
 * Retrieves the current navigation state, title, and loading status of a tab.
 */
export const BrowserGetTabStateTool: ToolDefinition = {
  id: 'browser:get_tab_state',
  displayName: 'Get Tab State',
  description: 'Retrieves current navigation status, URL, title, and history availability of a tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: TabActionRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'tab', 'status']
}

/**
 * Tool: browser:list_tabs
 * Lists all active tabs in a session.
 */
export const BrowserListTabsTool: ToolDefinition = {
  id: 'browser:list_tabs',
  displayName: 'List Browser Tabs',
  description: 'Lists all open browser tabs and their current status.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({ sessionId: z.string().optional() }).strict(),
  outputSchema: z.object({
    tabs: z.array(BrowserTabStateSchema)
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' }
    }
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'tabs', 'list']
}

/**
 * Tool: browser:reload
 * Reloads the web content in a tab.
 */
export const BrowserReloadTool: ToolDefinition = {
  id: 'browser:reload',
  displayName: 'Reload Tab',
  description: 'Reloads the current web page in a specified tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: TabActionRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'reload']
}

/**
 * Tool: browser:stop
 * Stops loading the current web page in a tab.
 */
export const BrowserStopTool: ToolDefinition = {
  id: 'browser:stop',
  displayName: 'Stop Tab Loading',
  description: 'Stops ongoing page loading in a specified tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: TabActionRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'stop']
}

/**
 * Tool: browser:go_back
 * Navigates backward in tab history.
 */
export const BrowserGoBackTool: ToolDefinition = {
  id: 'browser:go_back',
  displayName: 'Tab Go Back',
  description: 'Navigates backward in a tab navigation history.',
  category: 'system',
  version: '1.0.0',
  inputSchema: TabActionRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'history', 'back']
}

/**
 * Tool: browser:go_forward
 * Navigates forward in tab history.
 */
export const BrowserGoForwardTool: ToolDefinition = {
  id: 'browser:go_forward',
  displayName: 'Tab Go Forward',
  description: 'Navigates forward in a tab navigation history.',
  category: 'system',
  version: '1.0.0',
  inputSchema: TabActionRequestSchema,
  outputSchema: BrowserTabStateSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:manageTabs'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'history', 'forward']
}

/**
 * Tool: browser:clear_session
 * Clears cookies, cache, and storage data for a browser session.
 */
export const BrowserClearSessionTool: ToolDefinition = {
  id: 'browser:clear_session',
  displayName: 'Clear Browser Session',
  description: 'Clears cookies, cache, and web storage data for a specific browser session profile.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ClearSessionDataRequestSchema,
  outputSchema: z.object({
    success: z.boolean(),
    sessionId: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      storages: { type: 'array', items: { type: 'string' } }
    },
    required: ['sessionId']
  },
  requiredCapabilities: ['browser:clearSession'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'clear', 'privacy']
}

/**
 * Tool: browser:inspect_page
 * Discovers visible interactive controls, inputs, and form definitions on an authorized page.
 */
export const BrowserInspectPageTool: ToolDefinition = {
  id: 'browser:inspect_page',
  displayName: 'Inspect Page Elements',
  description: 'Gathers a bounded snapshot of visible buttons, links, inputs, and forms on an open browser tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: InspectPageRequestSchema,
  outputSchema: PageInspectionSnapshotSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      maxElements: { type: 'number' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:inspectPage'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'inspect']
}

/**
 * Tool: browser:click_element
 * Clicks a uniquely targeted interactive element on the page.
 */
export const BrowserClickElementTool: ToolDefinition = {
  id: 'browser:click_element',
  displayName: 'Click Page Element',
  description: 'Clicks a uniquely identified button, link, or interactive control on an authorized browser tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ClickElementRequestSchema,
  outputSchema: BrowserActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      target: { type: 'object' },
      expectedUrl: { type: 'string' },
      confirmationToken: { type: 'string' }
    },
    required: ['tabId', 'target']
  },
  requiredCapabilities: ['browser:interact'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'click']
}

/**
 * Tool: browser:scroll_page
 * Scrolls the page viewport up, down, top, or bottom.
 */
export const BrowserScrollPageTool: ToolDefinition = {
  id: 'browser:scroll_page',
  displayName: 'Scroll Page Viewport',
  description: 'Scrolls an authorized browser tab viewport in a specified direction.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ScrollPageRequestSchema,
  outputSchema: BrowserActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      direction: { type: 'string' },
      distance: { type: 'number' }
    },
    required: ['tabId', 'direction']
  },
  requiredCapabilities: ['browser:interact'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'scroll']
}

/**
 * Tool: browser:fill_field
 * Fills an ordinary, non-sensitive form input with user-provided text.
 */
export const BrowserFillFieldTool: ToolDefinition = {
  id: 'browser:fill_field',
  displayName: 'Fill Form Field',
  description: 'Enters user-provided text into a verified non-sensitive input field without implicit submission.',
  category: 'system',
  version: '1.0.0',
  inputSchema: FillFieldRequestSchema,
  outputSchema: BrowserActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      target: { type: 'object' },
      value: { type: 'string' },
      clearFirst: { type: 'boolean' }
    },
    required: ['tabId', 'target', 'value']
  },
  requiredCapabilities: ['browser:fillForm'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'forms']
}

/**
 * Tool: browser:select_option
 * Selects a choice in a dropdown or toggles a checkbox/radio.
 */
export const BrowserSelectOptionTool: ToolDefinition = {
  id: 'browser:select_option',
  displayName: 'Select Option',
  description: 'Selects a dropdown option or sets a checkbox/radio state on an authorized browser tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SelectOptionRequestSchema,
  outputSchema: BrowserActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      target: { type: 'object' },
      optionValue: { type: 'string' }
    },
    required: ['tabId', 'target', 'optionValue']
  },
  requiredCapabilities: ['browser:fillForm'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'select']
}

/**
 * Tool: browser:review_form
 * Inspects a form and summarizes proposed values before submission.
 */
export const BrowserReviewFormTool: ToolDefinition = {
  id: 'browser:review_form',
  displayName: 'Review Form Submission',
  description: 'Summarizes form destination and non-sensitive field values, generating an authorization review token.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ReviewFormRequestSchema,
  outputSchema: FormReviewSummarySchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      formId: { type: 'string' },
      proposedValues: { type: 'object' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['browser:inspectPage'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'review']
}

/**
 * Tool: browser:submit_form
 * Submits an authorized online form under strict user confirmation.
 */
export const BrowserSubmitFormTool: ToolDefinition = {
  id: 'browser:submit_form',
  displayName: 'Submit Browser Form',
  description: 'Submits an online web form to external endpoints under explicit human confirmation.',
  category: 'system',
  version: '1.0.0',
  inputSchema: SubmitFormRequestSchema,
  outputSchema: BrowserActionResultSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      formId: { type: 'string' },
      confirmationToken: { type: 'string' }
    },
    required: ['tabId', 'confirmationToken']
  },
  requiredCapabilities: ['browser:submitForm'],
  riskTier: 'high',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'automation', 'submit', 'high-risk']
}

/**
 * Tool: browser:manage_downloads
 * Inspects, approves, or cancels downloads under safe security policies.
 */
export const BrowserManageDownloadsTool: ToolDefinition = {
  id: 'browser:manage_downloads',
  displayName: 'Manage Downloads',
  description: 'Lists active downloads, approves downloads with safe paths, or cancels dangerous downloads.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z
    .object({
      action: z.enum(['list', 'get', 'cancel']),
      downloadId: z.string().optional()
    })
    .strict(),
  outputSchema: z.any(),
  jsonSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      downloadId: { type: 'string' }
    },
    required: ['action']
  },
  requiredCapabilities: ['browser:download'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['browser', 'downloads', 'security']
}

/**
 * Tool: research:web_search
 * Executes validated web search queries and normalizes results.
 */
export const ResearchWebSearchTool: ToolDefinition = {
  id: 'research:web_search',
  displayName: 'Web Search',
  description: 'Executes approved web search queries, validates URLs, and returns normalized, source-attributed results.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ResearchSearchQuerySchema,
  outputSchema: ResearchSearchResponseSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      maxResults: { type: 'number' },
      domainFilter: { type: 'array', items: { type: 'string' } },
      safeSearch: { type: 'boolean' }
    },
    required: ['query']
  },
  requiredCapabilities: ['research:webSearch'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['research', 'web', 'search']
}

/**
 * Tool: research:extract_tab_content
 * Extracts structured text and metadata from an open browser tab.
 */
export const ResearchExtractTabContentTool: ToolDefinition = {
  id: 'research:extract_tab_content',
  displayName: 'Extract Tab Content',
  description: 'Extracts readable textual content, headings, and links from an authorized browser tab.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ResearchExtractionRequestSchema,
  outputSchema: ResearchSourceRecordSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      url: { type: 'string' },
      mode: { type: 'string' },
      maxChars: { type: 'number' }
    }
  },
  requiredCapabilities: ['research:extractContent'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['research', 'web', 'extract']
}

/**
 * Tool: research:extract_url_content
 * Extracts readable textual content from a validated URL in a temporary tab.
 */
export const ResearchExtractUrlContentTool: ToolDefinition = {
  id: 'research:extract_url_content',
  displayName: 'Extract URL Content',
  description: 'Extracts readable textual content from a validated HTTP/HTTPS URL.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ResearchExtractionRequestSchema,
  outputSchema: ResearchSourceRecordSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      maxChars: { type: 'number' }
    },
    required: ['url']
  },
  requiredCapabilities: ['research:extractContent'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['research', 'web', 'extract', 'url']
}

/**
 * Tool: research:capture_tab_screenshot
 * Captures a viewport screenshot from an authorized browser tab.
 */
export const ResearchCaptureTabScreenshotTool: ToolDefinition = {
  id: 'research:capture_tab_screenshot',
  displayName: 'Capture Tab Screenshot',
  description: 'Captures a temporary viewport screenshot of an authorized browser tab with dimensions and preview.',
  category: 'system',
  version: '1.0.0',
  inputSchema: BrowserScreenshotRequestSchema,
  outputSchema: BrowserScreenshotRecordSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'string' },
      format: { type: 'string' },
      quality: { type: 'number' }
    },
    required: ['tabId']
  },
  requiredCapabilities: ['research:captureScreenshot'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['research', 'browser', 'screenshot']
}

/**
 * Tool: research:manage_collection
 * Manages research results, source inclusion, and screenshot discard in active collection.
 */
export const ResearchManageCollectionTool: ToolDefinition = {
  id: 'research:manage_collection',
  displayName: 'Manage Research Collection',
  description: 'Manages task-scoped research results, including context inclusion and temporary screenshot discard.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ManageCollectionRequestSchema,
  outputSchema: z.any(),
  jsonSchema: {
    type: 'object',
    properties: {
      conversationId: { type: 'string' },
      action: { type: 'string' },
      sourceId: { type: 'string' },
      screenshotId: { type: 'string' }
    },
    required: ['conversationId', 'action']
  },
  requiredCapabilities: ['research:manageResults'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['research', 'collection', 'manage']
}

/**
 * Tool: research:validate_citations
 * Validates proposed citations against genuinely extracted sources in collection.
 */
export const ResearchValidateCitationsTool: ToolDefinition = {
  id: 'research:validate_citations',
  displayName: 'Validate Research Citations',
  description: 'Resolves proposed citations against actual extracted sources to prevent fabricated references.',
  category: 'system',
  version: '1.0.0',
  inputSchema: ValidateCitationsRequestSchema,
  outputSchema: z.array(ResearchCitationSchema),
  jsonSchema: {
    type: 'object',
    properties: {
      conversationId: { type: 'string' },
      citations: { type: 'array', items: { type: 'object' } }
    },
    required: ['conversationId', 'citations']
  },
  requiredCapabilities: ['research:manageResults'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['research', 'citations', 'verify']
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
  TelemetryGetSystemHealthTool,
  SystemListInstalledAppsTool,
  SystemListWindowsTool,
  FilesystemListDirectoryTool,
  FilesystemGetMetadataTool,
  FilesystemSearchFilesTool,
  FilesystemReadTextFileTool,
  FilesystemCreateFileTool,
  FilesystemCopyFileTool,
  FilesystemMoveFileTool,
  FilesystemOrganizePreviewTool,
  FilesystemOrganizeApplyTool,
  FilesystemOrganizeUndoTool,
  ClipboardReadTextTool,
  ClipboardWriteTextTool,
  DesktopFocusWindowTool,
  DesktopSendKeyActionTool,
  DesktopSendTextTool,
  DesktopSendClickTool,
  DesktopSendScrollTool,
  DesktopEmergencyStopTool,
  DesktopUndoLastActionTool,
  SystemOpenPathTool,
  SystemShowInFolderTool,
  SystemOpenExternalUrlTool,
  SystemAlertBeepTool,
  SystemGetDisplayMetricsTool,
  BrowserCreateSessionTool,
  BrowserCreateTabTool,
  BrowserNavigateTool,
  BrowserSwitchTabTool,
  BrowserCloseTabTool,
  BrowserGetTabStateTool,
  BrowserListTabsTool,
  BrowserReloadTool,
  BrowserStopTool,
  BrowserGoBackTool,
  BrowserGoForwardTool,
  BrowserClearSessionTool,
  ResearchWebSearchTool,
  ResearchExtractTabContentTool,
  ResearchExtractUrlContentTool,
  ResearchCaptureTabScreenshotTool,
  ResearchManageCollectionTool,
  ResearchValidateCitationsTool,
  BrowserInspectPageTool,
  BrowserClickElementTool,
  BrowserScrollPageTool,
  BrowserFillFieldTool,
  BrowserSelectOptionTool,
  BrowserReviewFormTool,
  BrowserSubmitFormTool,
  BrowserManageDownloadsTool,
  ProhibitedShellExecuteTool
] as const
