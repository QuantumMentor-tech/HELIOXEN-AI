import {
  AiProviderId,
  AiGenerationRequest,
  AiGenerationResponse,
  AiStreamChunk,
  ProviderCredentialStatus,
  ProviderTestResult
} from '../shared/ai/types'
import { ProviderDefinition, UserAiPreferences } from '../shared/ai/models'
import {
  ProviderHealthRecord,
  AiTaskType,
  TaskRequirement
} from '../shared/ai/routing'

/**
 * Authoritative type definitions for the HELIOXEN Preload Bridge.
 * Shared between the preload script and renderer environment declarations.
 */

export interface HelioxenWindowApi {
  /** Minimize the primary application window */
  minimize: () => Promise<void>
  /** Toggle between maximized and restored window geometry */
  maximize: () => Promise<void>
  /** Close the primary application window */
  close: () => Promise<void>
  /** Query whether the window is currently maximized */
  isMaximized: () => Promise<boolean>
  /**
   * Subscribe to native maximize / restore state changes.
   * Returns an unsubscribe function to remove the listener.
   */
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

export interface HelioxenAiApi {
  /**
   * Requests text generation or streaming response from the configured AI provider.
   */
  generateText: (request: AiGenerationRequest) => Promise<AiGenerationResponse>
  /**
   * Cancels an ongoing text generation or streaming request.
   */
  cancel: () => Promise<void>
  /**
   * Subscribes to real-time streaming chunks from the AI provider.
   */
  onStreamChunk: (callback: (chunk: AiStreamChunk) => void) => () => void
}

export interface HelioxenCredentialsApi {
  /**
   * Securely saves an API key into the native DPAPI vault.
   */
  set: (params: { provider: AiProviderId; apiKey: string; label?: string }) => Promise<void>
  /**
   * Queries whether credentials are configured for approved providers without leaking secrets.
   */
  getStatus: () => Promise<Record<AiProviderId, ProviderCredentialStatus>>
  /**
   * Deletes a credential from the secure vault.
   */
  delete: (provider: AiProviderId) => Promise<boolean>
  /**
   * Explicitly tests provider connectivity. Only initiated by user action.
   */
  test: (provider: AiProviderId) => Promise<ProviderTestResult>
}

export interface HelioxenModelsApi {
  /**
   * Retrieves the authoritative model catalog with capability profiles.
   */
  getCatalog: () => Promise<ProviderDefinition[]>
  /**
   * Explicit user-initiated dynamic discovery refresh for an approved provider.
   */
  refresh: (provider: AiProviderId) => Promise<ProviderDefinition>
}

export interface HelioxenPreferencesApi {
  /**
   * Retrieves persisted user AI preferences.
   */
  get: () => Promise<UserAiPreferences>
  /**
   * Validates and persists user AI preferences.
   */
  set: (preferences: UserAiPreferences) => Promise<UserAiPreferences>
}

export interface HelioxenHealthApi {
  /**
   * Retrieves evidence-based operational health status for registered providers.
   */
  getStatus: () => Promise<Record<AiProviderId, ProviderHealthRecord>>
}

export interface HelioxenRoutingApi {
  /**
   * Retrieves supported task classifications and required capability profiles.
   */
  getTaskDefinitions: () => Promise<Record<AiTaskType, TaskRequirement>>
}

import { AudioPermissionStatus, AudioDeviceInfo } from '../shared/audio/types'
import { UserVoicePreferences } from '../shared/voice/types'
import { DesktopDisplaySource, CapturePermissionStatus } from '../shared/capture/types'

export interface HelioxenAudioApi {
  /**
   * Queries OS and application microphone access permission status.
   */
  getPermissionStatus: () => Promise<AudioPermissionStatus>
  /**
   * Enumerates connected microphone hardware input devices.
   */
  getDevices: () => Promise<AudioDeviceInfo[]>
}

export interface HelioxenVoiceApi {
  /**
   * Retrieves persisted voice, audio quality, and wake-word preferences.
   */
  getPreferences: () => Promise<UserVoicePreferences>
  /**
   * Persists updated voice preferences.
   */
  setPreferences: (preferences: Partial<UserVoicePreferences>) => Promise<UserVoicePreferences>
}

export interface HelioxenCaptureApi {
  /**
   * Enumerates active displays and application windows for explicit user-initiated display capture.
   */
  getDesktopSources: (types?: ('screen' | 'window')[]) => Promise<DesktopDisplaySource[]>
  /**
   * Queries OS media access permission for camera or display capture.
   */
  checkPermission: (sourceType: 'camera' | 'screen') => Promise<CapturePermissionStatus>
}

import {
  FileAttachment,
  DocumentExtractionResult,
  DocumentValidationResult
} from '../shared/documents/types'

export interface HelioxenDocumentsApi {
  /**
   * Opens native OS file picker to select supported document or image files.
   */
  selectFiles: (options?: { multiple?: boolean; maxCount?: number }) => Promise<FileAttachment[]>
  /**
   * Extracts normalized content from a selected file reference or buffer.
   */
  extractFile: (
    attachmentId: string,
    fileName: string,
    filePath?: string,
    fileBuffer?: Uint8Array
  ) => Promise<DocumentExtractionResult>
  /**
   * Validates file size and format against security bounds.
   */
  validateFile: (metadata: {
    name: string
    sizeBytes: number
    mimeType?: string
  }) => Promise<DocumentValidationResult>
}

export interface HelioxenApi {
  /** Operating system platform (e.g., 'win32', 'darwin', 'linux') */
  readonly platform: string
  /** Runtime environment (e.g., 'development' or 'production') */
  readonly environment: string
  /** Application semver version */
  readonly version: string
  /** Narrow native window control operations */
  readonly window: HelioxenWindowApi
  /** AI Provider text generation operations */
  readonly ai: HelioxenAiApi
  /** Secure credential management operations */
  readonly credentials: HelioxenCredentialsApi
  /** Model catalog and capability profiles */
  readonly models: HelioxenModelsApi
  /** User AI preferences persistence */
  readonly preferences: HelioxenPreferencesApi
  /** Provider health monitoring status */
  readonly health: HelioxenHealthApi
  /** Task-based model routing definitions */
  readonly routing: HelioxenRoutingApi
  /** Local audio device discovery and permission operations */
  readonly audio: HelioxenAudioApi
  /** Voice preferences and wake-word configuration */
  readonly voice: HelioxenVoiceApi
  /** Camera and desktop screen capture operations (Phase 8 Step 22) */
  readonly capture: HelioxenCaptureApi
  /** Document extraction & file attachment operations (Phase 8 Step 23) */
  readonly documents: HelioxenDocumentsApi
  /** Tool registry and typed schema operations (Phase 9 Step 25) */
  readonly tools: HelioxenToolsApi
  /** Task planner and multi-step agent orchestration operations (Phase 9 Step 26) */
  readonly orchestration: HelioxenOrchestrationApi
  /** System health telemetry, installed apps, and window discovery (Phase 10 Step 28) */
  readonly telemetry: HelioxenTelemetryApi
  /** File operations and reversible organization (Phase 10 Step 29) */
  readonly filesystem: HelioxenFilesystemApi
  /** Clipboard text and image processing (Phase 10 Step 29) */
  readonly clipboard: HelioxenClipboardApi
  /** Controlled desktop interaction and predefined system operations (Phase 10 Step 30) */
  readonly desktop: HelioxenDesktopApi
  /** Browser service, sessions, and tab management (Phase 11 Step 31) */
  readonly browser: HelioxenBrowserApi
  /** Web research, extraction, screenshots, and source citations (Phase 11 Step 32) */
  readonly research: HelioxenResearchApi
}

import {
  ToolMetadata,
  ToolQueryFilter,
  ToolValidationResult
} from '../shared/tools/types'
import {
  TaskPlan,
  TaskPlannerRequest,
  TaskPlannerResponse,
  TaskExecutionResult,
  TaskProgressEvent,
  AuditEvent,
  TaskCancellationRequest,
  TaskCancellationResult,
  TaskRecord
} from '../shared/orchestration/types'

export interface HelioxenToolsApi {
  /**
   * Queries registered tool definitions and metadata.
   */
  list: (filter?: ToolQueryFilter) => Promise<ToolMetadata[]>
  /**
   * Resolves a tool definition by stable identifier.
   */
  get: (id: string) => Promise<ToolMetadata | null>
  /**
   * Validates an untrusted payload against a registered tool's input schema.
   */
  validateInput: (id: string, input: unknown) => Promise<ToolValidationResult>
}

export interface HelioxenOrchestrationApi {
  /**
   * Converts an authorized user request into a structured task plan.
   */
  plan: (request: TaskPlannerRequest) => Promise<TaskPlannerResponse>
  /**
   * Executes a validated multi-step plan through registered tools under security gates.
   */
  execute: (
    plan: TaskPlan,
    options?: { approvedConfirmations?: string[] }
  ) => Promise<TaskExecutionResult>
  /**
   * Requests cooperative cancellation of an active task.
   */
  cancel: (request: TaskCancellationRequest) => Promise<TaskCancellationResult>
  /**
   * Queries the execution audit trail for a task.
   */
  getAudit: (taskId: string) => Promise<readonly AuditEvent[]>
  /**
   * Queries current task state record.
   */
  getTask: (taskId: string) => Promise<TaskRecord | null>
  /**
   * Subscribes to real-time monotonic progress events from the execution engine.
   */
  onProgress: (listener: (event: TaskProgressEvent) => void) => () => void
}

import {
  SystemHealthTelemetry,
  SystemHealthRequest,
  InstalledAppsResult,
  InstalledAppsRequest,
  InstalledApplicationEntry,
  WindowDiscoveryResult,
  WindowDiscoveryRequest
} from '../shared/telemetry/types'

export interface HelioxenTelemetryApi {
  /**
   * Retrieves host and process health telemetry (CPU, memory, uptime, storage capacity).
   */
  getSystemHealth: (request?: SystemHealthRequest) => Promise<SystemHealthTelemetry>
  /**
   * Retrieves installed applications inventory with filtering and caching.
   */
  getInstalledApps: (request?: InstalledAppsRequest) => Promise<InstalledAppsResult>
  /**
   * Searches discovered application inventory by keyword.
   */
  searchInstalledApps: (query: string, limit?: number) => Promise<InstalledApplicationEntry[]>
  /**
   * Discovers permitted desktop windows and HELIOXEN application windows.
   */
  getDesktopWindows: (request?: WindowDiscoveryRequest) => Promise<WindowDiscoveryResult>
}

import {
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
  ClipboardWriteTextResult,
  ClipboardReadImageResult
} from '../shared/filesystem/types'

export interface HelioxenFilesystemApi {
  listDirectory: (request: DirectoryListingRequest) => Promise<DirectoryListingResult>
  getMetadata: (rootPath: string, filePath: string) => Promise<FileMetadata>
  searchFiles: (request: FileSearchRequest) => Promise<FileSearchResult>
  readTextFile: (request: ReadTextFileRequest) => Promise<ReadTextFileResult>
  createFile: (request: CreateFileRequest) => Promise<CreateFileResult>
  copyFile: (request: CopyFileRequest) => Promise<CopyFileResult>
  moveFile: (request: MoveFileRequest) => Promise<MoveFileResult>
  organizePreview: (request: OrganizationPlanRequest) => Promise<OrganizationPlan>
  organizeApply: (request: OrganizationApplyRequest) => Promise<OrganizationApplyResult>
  organizeUndo: (request: OrganizationUndoRequest) => Promise<OrganizationUndoResult>
}

export interface HelioxenClipboardApi {
  readText: (maxChars?: number) => Promise<ClipboardReadTextResult>
  writeText: (request: ClipboardWriteTextRequest) => Promise<ClipboardWriteTextResult>
  readImage: (maxBytes?: number) => Promise<ClipboardReadImageResult>
}

import {
  TargetWindowReference,
  KeyboardActionRequest,
  KeyboardActionResult,
  TextEntryRequest,
  MouseClickRequest,
  MouseScrollRequest,
  MouseActionResult,
  EmergencyStopResult,
  UndoInteractionRequest,
  UndoInteractionResult,
  SystemOpenPathRequest,
  SystemOpenPathResult,
  SystemShowInFolderRequest,
  SystemShowInFolderResult,
  SystemOpenUrlRequest,
  SystemOpenUrlResult,
  SystemAlertBeepResult,
  DisplayMetricsResult
} from '../shared/interaction/types'

export interface HelioxenDesktopApi {
  focusWindow: (target: TargetWindowReference) => Promise<{ success: boolean; windowId: string }>
  sendKeyAction: (request: KeyboardActionRequest) => Promise<KeyboardActionResult>
  sendText: (request: TextEntryRequest) => Promise<KeyboardActionResult>
  sendClick: (request: MouseClickRequest) => Promise<MouseActionResult>
  sendScroll: (request: MouseScrollRequest) => Promise<MouseActionResult>
  emergencyStop: () => Promise<EmergencyStopResult>
  undoLastAction: (request?: UndoInteractionRequest) => Promise<UndoInteractionResult>
  openPath: (request: SystemOpenPathRequest) => Promise<SystemOpenPathResult>
  showInFolder: (request: SystemShowInFolderRequest) => Promise<SystemShowInFolderResult>
  openExternalUrl: (request: SystemOpenUrlRequest) => Promise<SystemOpenUrlResult>
  systemAlertBeep: () => Promise<SystemAlertBeepResult>
  getDisplayMetrics: () => Promise<DisplayMetricsResult>
}

import {
  BrowserSessionConfig,
  BrowserSessionMetadata,
  BrowserTabState,
  CreateSessionRequest,
  CreateTabRequest,
  NavigateTabRequest,
  SwitchTabRequest,
  CloseTabRequest,
  TabActionRequest,
  ClearSessionDataRequest,
  SetBrowserViewBoundsRequest,
  InspectPageRequest,
  PageInspectionSnapshot,
  ClickElementRequest,
  ScrollPageRequest,
  FillFieldRequest,
  SelectOptionRequest,
  ReviewFormRequest,
  FormReviewSummary,
  SubmitFormRequest,
  BrowserActionResult,
  DownloadStateRecord,
  ApproveDownloadRequest,
  CancelDownloadRequest
} from '../shared/browser/types'

export interface HelioxenBrowserApi {
  createSession: (request?: CreateSessionRequest) => Promise<BrowserSessionMetadata>
  listSessions: () => Promise<BrowserSessionMetadata[]>
  closeSession: (sessionId: string) => Promise<{ success: boolean; sessionId: string }>
  clearSession: (request: ClearSessionDataRequest) => Promise<{ success: boolean; sessionId: string }>
  createTab: (request?: CreateTabRequest) => Promise<BrowserTabState>
  navigateTab: (request: NavigateTabRequest) => Promise<BrowserTabState>
  switchTab: (request: SwitchTabRequest) => Promise<BrowserTabState>
  closeTab: (request: CloseTabRequest) => Promise<{ success: boolean; closedTabId: string; newActiveTabId?: string }>
  getTabState: (request: TabActionRequest) => Promise<BrowserTabState>
  listTabs: (sessionId?: string) => Promise<{ tabs: BrowserTabState[] }>
  reloadTab: (request: TabActionRequest) => Promise<BrowserTabState>
  stopTab: (request: TabActionRequest) => Promise<BrowserTabState>
  goBack: (request: TabActionRequest) => Promise<BrowserTabState>
  goForward: (request: TabActionRequest) => Promise<BrowserTabState>
  setBounds: (request: SetBrowserViewBoundsRequest) => Promise<{ success: boolean }>
  // Step 33: Browser Agent Automation & Download Policies
  inspectPage: (request: InspectPageRequest) => Promise<PageInspectionSnapshot>
  clickElement: (request: ClickElementRequest) => Promise<BrowserActionResult>
  scrollPage: (request: ScrollPageRequest) => Promise<BrowserActionResult>
  fillField: (request: FillFieldRequest) => Promise<BrowserActionResult>
  selectOption: (request: SelectOptionRequest) => Promise<BrowserActionResult>
  reviewForm: (request: ReviewFormRequest) => Promise<FormReviewSummary>
  submitForm: (request: SubmitFormRequest) => Promise<BrowserActionResult>
  listDownloads: () => Promise<DownloadStateRecord[]>
  approveDownload: (request: ApproveDownloadRequest) => Promise<DownloadStateRecord>
  cancelDownload: (request: CancelDownloadRequest) => Promise<DownloadStateRecord>
}

import {
  ResearchSearchQuery,
  ResearchSearchResponse,
  ResearchExtractionRequest,
  ResearchSourceRecord,
  BrowserScreenshotRequest,
  BrowserScreenshotRecord,
  ResearchCitation,
  ValidateCitationsRequest,
  ResearchCollection
} from '../shared/research/types'

export interface HelioxenResearchApi {
  search: (query: ResearchSearchQuery) => Promise<ResearchSearchResponse>
  extractTab: (request: ResearchExtractionRequest) => Promise<ResearchSourceRecord>
  extractUrl: (request: ResearchExtractionRequest) => Promise<ResearchSourceRecord>
  captureScreenshot: (request: BrowserScreenshotRequest) => Promise<BrowserScreenshotRecord>
  discardScreenshot: (screenshotId: string) => Promise<{ success: boolean; screenshotId: string }>
  getCollection: (conversationId: string) => Promise<ResearchCollection>
  updateSourceInclusion: (conversationId: string, sourceId: string, included: boolean) => Promise<ResearchSourceRecord>
  clearCollection: (conversationId: string) => Promise<{ success: boolean; message: string }>
  validateCitations: (request: ValidateCitationsRequest) => Promise<ResearchCitation[]>
}
