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

// ============================================================================
// STEP 34: USER PROFILE, LONG-TERM MEMORY & PERSONALIZATION TOOLS
// ============================================================================

export const MemoryRememberFactTool: ToolDefinition = {
  id: 'memory:remember_fact',
  displayName: 'Save Approved Long-Term Memory',
  description:
    'Persists an explicit user-approved preference, project constraint, workflow convention, or durable fact to long-term memory when memory consent is enabled.',
  version: '1.0.0',
  category: 'workspace',
  inputSchema: z
    .object({
      content: z.string().trim().min(1).max(2000),
      category: z.enum([
        'preferences',
        'projects',
        'workflows',
        'reference_facts',
        'personalization_settings'
      ]),
      projectScope: z.string().trim().max(120).optional()
    })
    .strict(),
  outputSchema: z.object({
    success: z.boolean(),
    deduplicated: z.boolean(),
    supersededRecordIds: z.array(z.string()),
    message: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Minimal normalized memory fact or preference to retain.'
      },
      category: {
        type: 'string',
        enum: [
          'preferences',
          'projects',
          'workflows',
          'reference_facts',
          'personalization_settings'
        ],
        description: 'Controlled memory category.'
      },
      projectScope: {
        type: 'string',
        description: 'Optional project name or identifier scope.'
      }
    },
    required: ['content', 'category']
  },
  requiredCapabilities: ['memory:write'],
  riskTier: 'moderate',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['memory', 'personalization', 'preferences', 'save']
}

export const MemoryRetrieveRelevantTool: ToolDefinition = {
  id: 'memory:retrieve_relevant',
  displayName: 'Retrieve Relevant Long-Term Memories',
  description:
    'Retrieves bounded, relevant active memories for the current user request when long-term memory is enabled.',
  version: '1.0.0',
  category: 'workspace',
  inputSchema: z
    .object({
      query: z.string().trim().max(2000),
      projectScope: z.string().trim().max(120).optional(),
      maxResults: z.number().int().min(1).max(10).optional()
    })
    .strict(),
  outputSchema: z.object({
    memoryEnabled: z.boolean(),
    allowedForProvider: z.boolean(),
    memories: z.array(z.any()),
    totalChars: z.number(),
    formattedContextBlock: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Task or topic query to match against active memories.'
      },
      projectScope: {
        type: 'string',
        description: 'Optional active project scope.'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of memories to return (1-10).'
      }
    },
    required: ['query']
  },
  requiredCapabilities: ['memory:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['memory', 'retrieve', 'context', 'personalization']
}

export const MemoryProposeSuggestionTool: ToolDefinition = {
  id: 'memory:propose_suggestion',
  displayName: 'Propose Memory Save Suggestion',
  description:
    'Proposes a transient memory save suggestion for the user to approve or dismiss in the interface.',
  version: '1.0.0',
  category: 'workspace',
  inputSchema: z
    .object({
      proposedContent: z.string().trim().min(1).max(2000),
      category: z.enum([
        'preferences',
        'projects',
        'workflows',
        'reference_facts',
        'personalization_settings'
      ]),
      reason: z.string().trim().min(1).max(300),
      projectScope: z.string().trim().max(120).optional()
    })
    .strict(),
  outputSchema: z.object({
    id: z.string(),
    proposedContent: z.string(),
    category: z.string(),
    status: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      proposedContent: {
        type: 'string',
        description: 'Proposed durable preference or fact.'
      },
      category: {
        type: 'string',
        enum: [
          'preferences',
          'projects',
          'workflows',
          'reference_facts',
          'personalization_settings'
        ],
        description: 'Suggested memory category.'
      },
      reason: {
        type: 'string',
        description: 'Concise explanation of why this memory may be helpful.'
      },
      projectScope: {
        type: 'string',
        description: 'Optional project scope.'
      }
    },
    required: ['proposedContent', 'category', 'reason']
  },
  requiredCapabilities: ['memory:write'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['memory', 'suggestion', 'personalization']
}

// ============================================================================
// STEP 35: INTEGRATED PRODUCTIVITY TOOLS (NOTES, TASKS, REMINDERS, CALENDAR, BRIEFING)
// ============================================================================

export const NotesCreateTool: ToolDefinition = {
  id: 'notes:create',
  displayName: 'Create Note',
  description: 'Creates a persistent user note with title, markdown body, and optional tags.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    title: z.string().trim().min(1).max(200),
    body: z.string().max(20000).default(''),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    pinned: z.boolean().optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Note title.' },
      body: { type: 'string', description: 'Note content body.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
      pinned: { type: 'boolean', description: 'Whether to pin the note.' }
    },
    required: ['title']
  },
  requiredCapabilities: ['productivity:notes'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'notes', 'create']
}

export const NotesSearchTool: ToolDefinition = {
  id: 'notes:search',
  displayName: 'Search & List Notes',
  description: 'Searches or lists user notes by keyword, tag, or pinned state.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    query: z.string().trim().max(200).optional(),
    tag: z.string().trim().max(40).optional(),
    pinnedOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional()
  }),
  outputSchema: z.object({
    notes: z.array(z.any()),
    totalCount: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Optional search query.' },
      tag: { type: 'string', description: 'Optional tag filter.' },
      pinnedOnly: { type: 'boolean', description: 'Only return pinned notes.' },
      limit: { type: 'number', description: 'Max notes to return.' }
    }
  },
  requiredCapabilities: ['productivity:notes'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'notes', 'search']
}

export const TasksCreateTool: ToolDefinition = {
  id: 'tasks:create',
  displayName: 'Create Task Item',
  description: 'Creates a tracked task item with optional priority, due timestamp, and tags.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(4000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueAt: z.number().int().positive().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title.' },
      description: { type: 'string', description: 'Optional task description.' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      dueAt: { type: 'number', description: 'Optional due timestamp (ms).' },
      tags: { type: 'array', items: { type: 'string' } }
    },
    required: ['title']
  },
  requiredCapabilities: ['productivity:tasks'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'tasks', 'create']
}

export const TasksListTool: ToolDefinition = {
  id: 'tasks:list',
  displayName: 'List & Filter Tasks',
  description: 'Lists and filters user tasks by status, priority, overdue state, or search query.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    query: z.string().trim().max(200).optional(),
    status: z.enum(['todo', 'in_progress', 'completed', 'cancelled', 'active_only']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    overdueOnly: z.boolean().optional(),
    dueTodayOnly: z.boolean().optional()
  }),
  outputSchema: z.object({
    tasks: z.array(z.any()),
    totalCount: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'cancelled', 'active_only'] },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      overdueOnly: { type: 'boolean' },
      dueTodayOnly: { type: 'boolean' }
    }
  },
  requiredCapabilities: ['productivity:tasks'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'tasks', 'list']
}

export const TasksCompleteTool: ToolDefinition = {
  id: 'tasks:complete',
  displayName: 'Complete Task (Ambiguity-Safe)',
  description: 'Completes a task by title or ID; returns candidate list without mutating if title matches multiple tasks.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    titleQuery: z.string().trim().min(1).max(240),
    targetTaskId: z.string().trim().min(1).max(120).optional()
  }),
  outputSchema: z.object({
    status: z.enum(['completed', 'ambiguous', 'not_found']),
    message: z.string(),
    completedTask: z.any().optional(),
    candidates: z.array(z.any()).optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      titleQuery: { type: 'string', description: 'Title of the task to mark complete.' },
      targetTaskId: { type: 'string', description: 'Optional explicit task ID when disambiguated.' }
    },
    required: ['titleQuery']
  },
  requiredCapabilities: ['productivity:tasks'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'tasks', 'complete']
}

export const RemindersCreateTool: ToolDefinition = {
  id: 'reminders:create',
  displayName: 'Schedule Reminder',
  description: 'Schedules a one-time or recurring reminder with time-zone awareness.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(2000).optional(),
    dueAt: z.number().int().positive(),
    timeZone: z.string().trim().optional(),
    frequency: z.enum(['none', 'daily', 'weekly']).optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    dueAt: z.number(),
    status: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      dueAt: { type: 'number', description: 'Reminder due epoch timestamp (ms).' },
      timeZone: { type: 'string', description: 'IANA time zone.' },
      frequency: { type: 'string', enum: ['none', 'daily', 'weekly'] }
    },
    required: ['title', 'dueAt']
  },
  requiredCapabilities: ['productivity:reminders'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'reminders', 'schedule']
}

export const RemindersManageTool: ToolDefinition = {
  id: 'reminders:manage',
  displayName: 'Manage Reminder (Snooze, Dismiss, Cancel)',
  description: 'Snoozes, dismisses/acknowledges, or cancels an existing reminder.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    id: z.string().trim().min(1).max(120),
    action: z.enum(['snooze', 'dismiss', 'cancel']),
    durationMinutes: z.number().int().min(1).max(10080).optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    status: z.string(),
    dueAt: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      action: { type: 'string', enum: ['snooze', 'dismiss', 'cancel'] },
      durationMinutes: { type: 'number' }
    },
    required: ['id', 'action']
  },
  requiredCapabilities: ['productivity:reminders'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'reminders', 'manage']
}

export const CalendarListEventsTool: ToolDefinition = {
  id: 'calendar:list_events',
  displayName: 'List Calendar Events',
  description: 'Lists calendar events for a date key (YYYY-MM-DD) or timestamp range.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    dateKey: z.string().trim().optional(),
    rangeStartAt: z.number().int().positive().optional(),
    rangeEndAt: z.number().int().positive().optional(),
    query: z.string().trim().max(200).optional()
  }),
  outputSchema: z.object({
    events: z.array(z.any()),
    totalCount: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      dateKey: { type: 'string', description: 'Optional YYYY-MM-DD date key.' },
      rangeStartAt: { type: 'number' },
      rangeEndAt: { type: 'number' },
      query: { type: 'string' }
    }
  },
  requiredCapabilities: ['productivity:calendarLocal'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'calendar', 'list']
}

export const CalendarCreateEventTool: ToolDefinition = {
  id: 'calendar:create_event',
  displayName: 'Create Local Calendar Event',
  description: 'Creates a timed or all-day event on the local HELIOXEN calendar.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(4000).optional(),
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    allDay: z.boolean().optional(),
    allDayStartDate: z.string().trim().optional(),
    allDayEndDate: z.string().trim().optional(),
    timeZone: z.string().trim().optional(),
    location: z.string().trim().max(300).optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    startAt: z.number(),
    endAt: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      startAt: { type: 'number' },
      endAt: { type: 'number' },
      allDay: { type: 'boolean' },
      allDayStartDate: { type: 'string' },
      allDayEndDate: { type: 'string' },
      timeZone: { type: 'string' },
      location: { type: 'string' }
    },
    required: ['title']
  },
  requiredCapabilities: ['productivity:calendarLocal'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'calendar', 'create']
}

export const CalendarModifyExternalEventTool: ToolDefinition = {
  id: 'calendar:modify_external_event',
  displayName: 'Modify or Delete External Calendar Event',
  description: 'Modifies or deletes an event on a connected external calendar provider under explicit human confirmation.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    id: z.string().trim().min(1).max(120),
    action: z.enum(['update', 'delete']),
    title: z.string().trim().min(1).max(240).optional(),
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    recurrenceScope: z.enum(['single_occurrence', 'entire_series']).optional(),
    humanConfirmed: z.boolean().default(true)
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    action: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      action: { type: 'string', enum: ['update', 'delete'] },
      title: { type: 'string' },
      startAt: { type: 'number' },
      endAt: { type: 'number' },
      recurrenceScope: { type: 'string', enum: ['single_occurrence', 'entire_series'] },
      humanConfirmed: { type: 'boolean' }
    },
    required: ['id', 'action']
  },
  requiredCapabilities: ['productivity:calendarExternalWrite'],
  riskTier: 'high',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'calendar', 'external', 'high-risk']
}

export const BriefingGenerateTool: ToolDefinition = {
  id: 'briefing:generate',
  displayName: 'Generate Daily Briefing',
  description: 'Generates a grounded daily briefing from actual calendar events, tasks, reminders, and notes.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    dateKey: z.string().trim().optional(),
    forceRegenerate: z.boolean().optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    dateKey: z.string(),
    summaryText: z.string(),
    isEmpty: z.boolean()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      dateKey: { type: 'string', description: 'Optional YYYY-MM-DD date key.' },
      forceRegenerate: { type: 'boolean' }
    }
  },
  requiredCapabilities: ['productivity:briefing'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['productivity', 'briefing', 'summary']
}

// ============================================================================
// STEP 36: MEDIA GALLERY AND MEDIA ASSET MANAGEMENT TOOLS
// ============================================================================

export const MediaListAssetsTool: ToolDefinition = {
  id: 'media:list_assets',
  displayName: 'Search & List Media Gallery Assets',
  description: 'Searches and filters media assets in the Media Gallery by query, mediaType, tag, collection, or favorites.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    query: z.string().trim().max(200).optional(),
    mediaType: z.enum(['all', 'image', 'video', 'audio']).optional(),
    collectionId: z.string().trim().max(120).optional(),
    tag: z.string().trim().max(40).optional(),
    favoritesOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional()
  }),
  outputSchema: z.object({
    assets: z.array(z.any()),
    totalCount: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      mediaType: { type: 'string', enum: ['all', 'image', 'video', 'audio'] },
      collectionId: { type: 'string' },
      tag: { type: 'string' },
      favoritesOnly: { type: 'boolean' },
      limit: { type: 'number' }
    }
  },
  requiredCapabilities: ['media:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['media', 'gallery', 'search']
}

export const MediaUpdateMetadataTool: ToolDefinition = {
  id: 'media:update_metadata',
  displayName: 'Update Media Asset Metadata',
  description: 'Updates a media asset display name, description, tags, or favorite status without altering the source file.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    id: z.string().trim().min(1).max(120),
    displayName: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    favorite: z.boolean().optional()
  }),
  outputSchema: z.object({
    id: z.string(),
    displayName: z.string(),
    favorite: z.boolean()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      description: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      favorite: { type: 'boolean' }
    },
    required: ['id']
  },
  requiredCapabilities: ['media:organize'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['media', 'gallery', 'metadata']
}

export const MediaManageCollectionsTool: ToolDefinition = {
  id: 'media:manage_collections',
  displayName: 'Manage Media Collections',
  description: 'Creates, lists, or modifies asset membership in Media Gallery collections.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'add_assets', 'remove_assets', 'delete']),
    name: z.string().trim().min(1).max(100).optional(),
    collectionId: z.string().trim().min(1).max(120).optional(),
    assetIds: z.array(z.string().trim().min(1).max(120)).optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    collections: z.array(z.any()).optional(),
    collection: z.any().optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'create', 'add_assets', 'remove_assets', 'delete'] },
      name: { type: 'string' },
      collectionId: { type: 'string' },
      assetIds: { type: 'array', items: { type: 'string' } }
    },
    required: ['action']
  },
  requiredCapabilities: ['media:organize'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['media', 'collections', 'organize']
}

export const MediaRemoveAssetTool: ToolDefinition = {
  id: 'media:remove_asset',
  displayName: 'Remove Media Entry from Library',
  description: 'Removes an asset entry from the Media Gallery while preserving any external source file.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    id: z.string().trim().min(1).max(120)
  }),
  outputSchema: z.object({
    removed: z.boolean(),
    id: z.string(),
    originalExternalFilePreserved: z.boolean()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    },
    required: ['id']
  },
  requiredCapabilities: ['media:remove'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['media', 'gallery', 'remove']
}

export const MediaDeleteManagedAssetTool: ToolDefinition = {
  id: 'media:delete_managed_asset',
  displayName: 'Permanently Delete Managed Media Asset',
  description: 'Permanently deletes an application-managed media copy and its thumbnail under explicit human confirmation.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    id: z.string().trim().min(1).max(120),
    confirmPermanentDelete: z.boolean().default(true)
  }),
  outputSchema: z.object({
    deleted: z.boolean(),
    id: z.string(),
    managedFileDeleted: z.boolean()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      confirmPermanentDelete: { type: 'boolean' }
    },
    required: ['id']
  },
  requiredCapabilities: ['media:deletePermanent'],
  riskTier: 'high',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['media', 'gallery', 'delete', 'high-risk']
}

// ============================================================================
// Step 37: VisualHub, Mermaid Visualization, and AI Image Generation Tools
// ============================================================================

export const VisualRenderMermaidTool: ToolDefinition = {
  id: 'visual:render_mermaid',
  displayName: 'Validate & Render Mermaid Diagram',
  description: 'Validates Mermaid diagram source syntax against strict security controls and generates a sanitized SVG preview.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    sourceText: z.string().min(1).max(200000),
    title: z.string().trim().max(180).optional()
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    diagramType: z.string(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    diagnostics: z.array(z.any()),
    svgMarkup: z.string().optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      sourceText: { type: 'string', description: 'Mermaid diagram source text.' },
      title: { type: 'string', description: 'Optional diagram title.' }
    },
    required: ['sourceText']
  },
  requiredCapabilities: ['visual:mermaid'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['visual', 'mermaid', 'diagram', 'svg']
}

export const VisualExportDiagramTool: ToolDefinition = {
  id: 'visual:export_diagram',
  displayName: 'Export Mermaid Diagram (.mmd, .svg, .png)',
  description: 'Exports a validated Mermaid diagram to an approved destination path in .mmd, .svg, or .png format.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    title: z.string().trim().min(1).max(180).default('Untitled Diagram'),
    sourceText: z.string().min(1).max(200000),
    format: z.enum(['mmd', 'svg', 'png']),
    destinationPath: z.string().trim().min(1).max(1024).optional(),
    conflictPolicy: z.enum(['rename_with_suffix', 'overwrite', 'reject']).default('rename_with_suffix')
  }),
  outputSchema: z.object({
    exported: z.boolean(),
    format: z.enum(['mmd', 'svg', 'png']),
    destinationPath: z.string(),
    fileName: z.string(),
    sizeBytes: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      sourceText: { type: 'string' },
      format: { type: 'string', enum: ['mmd', 'svg', 'png'] },
      destinationPath: { type: 'string' },
      conflictPolicy: { type: 'string', enum: ['rename_with_suffix', 'overwrite', 'reject'] }
    },
    required: ['sourceText', 'format']
  },
  requiredCapabilities: ['visual:exportDiagram'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['visual', 'mermaid', 'export', 'diagram']
}

export const VisualGenerateImageTool: ToolDefinition = {
  id: 'visual:generate_image',
  displayName: 'Generate AI Image via Verified Provider',
  description: 'Submits an explicit user-confirmed image generation request to a verified AI provider adapter.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    providerId: z.enum(['google-gemini', 'openai']),
    modelId: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1).max(4000),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('1:1'),
    resolutionTier: z.enum(['1K', '2K', '4K']).optional(),
    sizePreset: z.enum(['1024x1024', '1536x1024', '1024x1536']).optional(),
    quality: z.enum(['low', 'medium', 'high', 'standard']).optional(),
    outputFormat: z.enum(['png', 'jpeg', 'webp']).default('png'),
    transparentBackground: z.boolean().default(false),
    externalTransmissionConfirmed: z.boolean().default(true)
  }),
  outputSchema: z.object({
    id: z.string(),
    status: z.string(),
    providerId: z.string(),
    modelId: z.string(),
    candidates: z.array(z.any())
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      providerId: { type: 'string', enum: ['google-gemini', 'openai'] },
      modelId: { type: 'string' },
      prompt: { type: 'string' },
      aspectRatio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3', '3:4'] },
      outputFormat: { type: 'string', enum: ['png', 'jpeg', 'webp'] },
      externalTransmissionConfirmed: { type: 'boolean' }
    },
    required: ['providerId', 'modelId', 'prompt']
  },
  requiredCapabilities: ['visual:generateImage'],
  riskTier: 'moderate',
  confirmationPolicy: 'user_confirmation',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['visual', 'image', 'ai', 'generation']
}

export const VisualSaveToGalleryTool: ToolDefinition = {
  id: 'visual:save_to_gallery',
  displayName: 'Save Generated Image to Media Gallery',
  description: 'Explicitly persists a generated image candidate into the Step 36 Media Gallery with provenance metadata.',
  category: 'media',
  version: '1.0.0',
  inputSchema: z.object({
    candidateId: z.string().trim().min(1).max(120),
    displayName: z.string().trim().min(1).max(180).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
    collectionIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
    favorite: z.boolean().default(false)
  }),
  outputSchema: z.object({
    saved: z.boolean(),
    candidateId: z.string(),
    mediaAssetId: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      candidateId: { type: 'string' },
      displayName: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      favorite: { type: 'boolean' }
    },
    required: ['candidateId']
  },
  requiredCapabilities: ['visual:saveToGallery'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['visual', 'media', 'gallery', 'save']
}

// ============================================================================
// Step 38: World Monitor, Interactive Globe, Maps, and News Intelligence Tools
// ============================================================================

export const WorldQueryNewsFeedTool: ToolDefinition = {
  id: 'world:query_news_feed',
  displayName: 'Query World Monitor News Feed & Geographic Markers',
  description: 'Searches and filters normalized source-attributed news records, story clusters, and validated map markers.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    searchQuery: z.string().trim().max(240).optional(),
    category: z.enum(['all', 'world', 'technology', 'science', 'economy', 'environment', 'policy', 'general']).default('all'),
    regionId: z.enum(['all', 'global', 'north_america', 'south_america', 'europe', 'middle_east_north_africa', 'sub_saharan_africa', 'south_central_asia', 'east_southeast_asia', 'oceania', 'polar_maritime']).default('all'),
    pageSize: z.number().int().min(1).max(50).default(20)
  }),
  outputSchema: z.object({
    totalMatchingCount: z.number(),
    articles: z.array(z.any()),
    markers: z.array(z.any()),
    freshnessState: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      searchQuery: { type: 'string' },
      category: { type: 'string' },
      regionId: { type: 'string' },
      pageSize: { type: 'integer' }
    },
    required: []
  },
  requiredCapabilities: ['world:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['world', 'news', 'globe', 'map', 'geospatial']
}

export const WorldSearchLocationsTool: ToolDefinition = {
  id: 'world:search_locations',
  displayName: 'Search World Monitor Geographic Gazetteer',
  description: 'Searches validated cities, countries, and macro-regions in the World Monitor gazetteer, identifying ambiguous homonyms.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    query: z.string().trim().min(1).max(160),
    limit: z.number().int().min(1).max(25).default(10)
  }),
  outputSchema: z.object({
    query: z.string(),
    candidates: z.array(z.any()),
    isAmbiguous: z.boolean()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'integer' }
    },
    required: ['query']
  },
  requiredCapabilities: ['world:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'synchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['world', 'map', 'location', 'gazetteer']
}

export const WorldRefreshNewsFeedTool: ToolDefinition = {
  id: 'world:refresh_news_feed',
  displayName: 'Refresh Authorized World Monitor News Sources',
  description: 'Fetches bounded metadata updates from approved public news and science feeds while respecting rate limits.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    searchQuery: z.string().trim().max(200).optional(),
    forceRefresh: z.boolean().default(false)
  }),
  outputSchema: z.object({
    refreshedAt: z.number(),
    freshnessState: z.string(),
    totalArticles: z.number(),
    newArticlesCount: z.number(),
    warnings: z.array(z.string())
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      searchQuery: { type: 'string' },
      forceRefresh: { type: 'boolean' }
    },
    required: []
  },
  requiredCapabilities: ['world:refreshFeed'],
  riskTier: 'moderate',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['world', 'news', 'refresh', 'feeds']
}

export const WidgetsGetSystemHealthTool: ToolDefinition = {
  id: 'widgets:get_system_health',
  displayName: 'Get System Health & Process Telemetry',
  description: 'Returns local OS and HELIOXEN process memory, CPU utilization, battery status, and process health.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({
    sampleDurationMs: z.number().int().min(50).max(1000).optional()
  }),
  outputSchema: z.object({
    acquiredAt: z.number(),
    host: z.any(),
    helioxenProcess: z.any(),
    powerAndSensors: z.any(),
    storage: z.any()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      sampleDurationMs: { type: 'integer' }
    },
    required: []
  },
  requiredCapabilities: ['widgets:readSystemHealth'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['system', 'health', 'metrics', 'cpu', 'memory', 'battery']
}

export const WidgetsRunNetworkDiagnosticTool: ToolDefinition = {
  id: 'widgets:run_network_diagnostic',
  displayName: 'Run Bounded Network Diagnostic',
  description: 'Executes a bounded HTTPS connectivity request to an approved endpoint measuring round-trip time.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({
    targetUrl: z.string().url().max(500).optional(),
    timeoutMs: z.number().int().min(1000).max(30000).optional()
  }),
  outputSchema: z.object({
    testId: z.string(),
    targetUrl: z.string(),
    targetHost: z.string(),
    status: z.string(),
    statusCode: z.number().nullable(),
    roundTripTimeMs: z.number().nullable(),
    diagnosticBasis: z.string(),
    disclaimer: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      targetUrl: { type: 'string' },
      timeoutMs: { type: 'integer' }
    },
    required: []
  },
  requiredCapabilities: ['widgets:runNetworkDiagnostic'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: NO_RETRY_POLICY,
  source: 'builtin',
  tags: ['network', 'diagnostic', 'connectivity', 'latency']
}

export const WidgetsGetWeatherForecastTool: ToolDefinition = {
  id: 'widgets:get_weather_forecast',
  displayName: 'Get Weather Forecast & Current Conditions',
  description: 'Retrieves current weather conditions, 24h hourly forecast, and 7-day forecast for a selected location.',
  category: 'workspace',
  version: '1.0.0',
  inputSchema: z.object({
    temperatureUnit: z.enum(['celsius', 'fahrenheit']).optional(),
    windSpeedUnit: z.enum(['kmh', 'mph']).optional(),
    forceRefresh: z.boolean().optional()
  }),
  outputSchema: z.object({
    location: z.any(),
    current: z.any(),
    hourly: z.array(z.any()),
    daily: z.array(z.any()),
    freshnessStatus: z.string(),
    attributionText: z.string()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      temperatureUnit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      windSpeedUnit: { type: 'string', enum: ['kmh', 'mph'] },
      forceRefresh: { type: 'boolean' }
    },
    required: []
  },
  requiredCapabilities: ['widgets:readWeather'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['weather', 'forecast', 'temperature', 'conditions']
}

/**
 * Tool: agents:list_available
 */
export const AgentsListAvailableTool: ToolDefinition<
  { category?: string },
  { agents: Array<{ id: string; name: string; role: string; status: string; enabled: boolean }> }
> = {
  id: 'agents:list_available',
  displayName: 'List Available Agents',
  description: 'Lists active and registered agents, their eligible capabilities, and current status.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({
    category: z.string().optional()
  }),
  outputSchema: z.object({
    agents: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        status: z.string(),
        enabled: z.boolean()
      })
    )
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Optional agent category filter.' }
    },
    required: []
  },
  requiredCapabilities: ['agents:read'],
  riskTier: 'low',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['agents', 'registry', 'town', 'capabilities']
}

/**
 * Tool: skills:execute_skill
 */
export const SkillsExecuteSkillTool: ToolDefinition<
  { skillId: string; parameters?: Record<string, unknown> },
  { success: boolean; skillId: string; outputs: Record<string, unknown>; durationMs: number; error?: string }
> = {
  id: 'skills:execute_skill',
  displayName: 'Execute Dynamic Skill',
  description: 'Executes an approved declarative dynamic skill with input parameters through the orchestration engine.',
  category: 'system',
  version: '1.0.0',
  inputSchema: z.object({
    skillId: z.string().min(1),
    parameters: z.record(z.string(), z.unknown()).optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    skillId: z.string(),
    outputs: z.record(z.string(), z.unknown()),
    durationMs: z.number(),
    error: z.string().optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'Identifier of the approved skill to execute.' },
      parameters: { type: 'object', description: 'Input parameter values for the skill.' }
    },
    required: ['skillId']
  },
  requiredCapabilities: ['skills:execute'],
  riskTier: 'high',
  confirmationPolicy: 'none',
  implementationStatus: 'available',
  registrationStatus: 'enabled',
  executionMode: 'asynchronous',
  limits: DEFAULT_TOOL_LIMITS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  source: 'builtin',
  tags: ['skills', 'workflow', 'orchestration', 'execute']
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
  MemoryRememberFactTool,
  MemoryRetrieveRelevantTool,
  MemoryProposeSuggestionTool,
  NotesCreateTool,
  NotesSearchTool,
  TasksCreateTool,
  TasksListTool,
  TasksCompleteTool,
  RemindersCreateTool,
  RemindersManageTool,
  CalendarListEventsTool,
  CalendarCreateEventTool,
  CalendarModifyExternalEventTool,
  BriefingGenerateTool,
  MediaListAssetsTool,
  MediaUpdateMetadataTool,
  MediaManageCollectionsTool,
  MediaRemoveAssetTool,
  MediaDeleteManagedAssetTool,
  VisualRenderMermaidTool,
  VisualExportDiagramTool,
  VisualGenerateImageTool,
  VisualSaveToGalleryTool,
  WorldQueryNewsFeedTool,
  WorldSearchLocationsTool,
  WorldRefreshNewsFeedTool,
  WidgetsGetSystemHealthTool,
  WidgetsRunNetworkDiagnosticTool,
  WidgetsGetWeatherForecastTool,
  AgentsListAvailableTool,
  SkillsExecuteSkillTool,
  ProhibitedShellExecuteTool
] as const
