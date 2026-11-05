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
  /** User profile, long-term memory, and consent-based personalization (Phase 12 Step 34) */
  readonly memory: HelioxenMemoryApi
  /** Integrated Notes, Tasks, Reminders, Calendar, and Daily Briefings (Phase 12 Step 35) */
  readonly productivity: HelioxenProductivityApi
  /** Media Gallery, Asset Library, Collections, and Secure Media Management (Phase 12 Step 36) */
  readonly media: HelioxenMediaLibraryApi
  /** VisualHub, Mermaid Visualization, and AI Image Generation (Phase 13 Step 37) */
  readonly visual: HelioxenVisualHubApi
  /** World Monitor, Interactive Globe, Geographic Maps, and News Intelligence (Phase 13 Step 38) */
  readonly world: HelioxenWorldMonitorApi
  /** System Health, Network Monitoring, and Weather Widgets (Phase 13 Step 39) */
  readonly widgets: HelioxenWidgetsApi
  /** Agent Town, Plugin Connectors, and Dynamic Skills (Phase 14 Step 40) */
  readonly agents: HelioxenAgentsApi
  /** Office Document Studio, Spreadsheets, Presentations, and AI Productivity (Phase 15 Step 43) */
  readonly office: HelioxenOfficeApi
  /** Communication & Media Integrations (Phase 15 Step 44) */
  readonly integrations: HelioxenIntegrationsApi
  readonly communication: HelioxenCommunicationApi
  readonly mediaIntegration: HelioxenMediaIntegrationsApi
  /** Optional Android & Smart-Home Integrations (Phase 15 Step 45) */
  readonly devices: HelioxenDevicesApi
  readonly smartHome: HelioxenSmartHomeApi
  /** Crash Recovery, Verified Backups, and Controlled Self-Repair (Phase 16 Step 46) */
  readonly recovery: HelioxenRecoveryApi
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

import {
  MemoryStateOverview,
  MemoryConsentUpdateRequest,
  UserProfile,
  UserProfileUpdateRequest,
  CreateMemoryRequest,
  CreateMemoryResult,
  ListMemoriesRequest,
  MemoryRecord,
  UpdateMemoryRequest,
  UpdateMemoryResult,
  DeleteMemoryRequest,
  DeleteMemoryResult,
  ClearMemoriesRequest,
  ClearMemoriesResult,
  MemoryRetrievalRequest,
  MemoryRetrievalResult,
  ProposeMemorySuggestionRequest,
  MemorySuggestion,
  ResolveMemorySuggestionRequest,
  ResolveMemorySuggestionResult
} from '../shared/memory/types'

export interface HelioxenMemoryApi {
  getState: (profileId?: string) => Promise<MemoryStateOverview>
  setConsent: (request: MemoryConsentUpdateRequest) => Promise<UserProfile>
  updateProfile: (request: UserProfileUpdateRequest) => Promise<UserProfile>
  create: (request: CreateMemoryRequest) => Promise<CreateMemoryResult>
  list: (request?: ListMemoriesRequest) => Promise<MemoryRecord[]>
  get: (id: string, profileId?: string) => Promise<MemoryRecord | null>
  update: (request: UpdateMemoryRequest) => Promise<UpdateMemoryResult>
  delete: (request: DeleteMemoryRequest) => Promise<DeleteMemoryResult>
  clearAll: (request: ClearMemoriesRequest) => Promise<ClearMemoriesResult>
  retrieve: (request: MemoryRetrievalRequest) => Promise<MemoryRetrievalResult>
  proposeSuggestion: (request: ProposeMemorySuggestionRequest) => Promise<MemorySuggestion>
  resolveSuggestion: (request: ResolveMemorySuggestionRequest) => Promise<ResolveMemorySuggestionResult>
}

import {
  ProductivityOverviewSnapshot,
  UpdateProductivitySettingsRequest,
  ProductivityNotificationPreferences,
  DailyBriefingPreferences,
  CreateNoteRequest,
  NoteRecord,
  ListNotesRequest,
  UpdateNoteRequest,
  DeleteNoteRequest,
  CreateTaskRequest,
  TaskItemWithComputedState,
  ListTasksRequest,
  UpdateTaskRequest,
  CompleteTaskByTitleRequest,
  CompleteTaskByTitleResponse,
  DeleteTaskRequest,
  CreateReminderRequest,
  ReminderRecord,
  ListRemindersRequest,
  UpdateReminderRequest,
  SnoozeReminderRequest,
  DismissReminderRequest,
  CancelReminderRequest,
  DeleteReminderRequest,
  CreateCalendarEventRequest,
  CalendarEventRecord,
  ListCalendarEventsRequest,
  UpdateCalendarEventRequest,
  DeleteCalendarEventRequest,
  ConnectExternalCalendarRequest,
  ExternalCalendarAccountState,
  DisconnectExternalCalendarRequest,
  SyncExternalCalendarRequest,
  SyncExternalCalendarResult,
  GenerateDailyBriefingRequest,
  DailyBriefingReport
} from '../shared/productivity'

export interface HelioxenProductivityApi {
  getOverview: (profileId?: string) => Promise<ProductivityOverviewSnapshot>
  updateSettings: (
    request: UpdateProductivitySettingsRequest
  ) => Promise<{ notifications: ProductivityNotificationPreferences; dailyBriefing: DailyBriefingPreferences }>
  createNote: (request: CreateNoteRequest) => Promise<NoteRecord>
  listNotes: (request?: ListNotesRequest) => Promise<NoteRecord[]>
  updateNote: (request: UpdateNoteRequest) => Promise<NoteRecord>
  deleteNote: (request: DeleteNoteRequest) => Promise<{ deleted: boolean; id: string }>
  createTask: (request: CreateTaskRequest) => Promise<TaskItemWithComputedState>
  listTasks: (request?: ListTasksRequest) => Promise<TaskItemWithComputedState[]>
  updateTask: (request: UpdateTaskRequest) => Promise<TaskItemWithComputedState>
  completeTaskByTitle: (request: CompleteTaskByTitleRequest) => Promise<CompleteTaskByTitleResponse>
  deleteTask: (request: DeleteTaskRequest) => Promise<{ deleted: boolean; id: string }>
  createReminder: (request: CreateReminderRequest) => Promise<ReminderRecord>
  listReminders: (request?: ListRemindersRequest) => Promise<ReminderRecord[]>
  updateReminder: (request: UpdateReminderRequest) => Promise<ReminderRecord>
  snoozeReminder: (request: SnoozeReminderRequest) => Promise<ReminderRecord>
  dismissReminder: (request: DismissReminderRequest) => Promise<ReminderRecord>
  cancelReminder: (request: CancelReminderRequest) => Promise<ReminderRecord>
  deleteReminder: (request: DeleteReminderRequest) => Promise<{ deleted: boolean; id: string }>
  createCalendarEvent: (request: CreateCalendarEventRequest) => Promise<CalendarEventRecord>
  listCalendarEvents: (request?: ListCalendarEventsRequest) => Promise<CalendarEventRecord[]>
  updateCalendarEvent: (request: UpdateCalendarEventRequest) => Promise<CalendarEventRecord>
  deleteCalendarEvent: (
    request: DeleteCalendarEventRequest
  ) => Promise<{ deleted: boolean; deletedIds: string[]; scope: string }>
  connectExternalCalendar: (request: ConnectExternalCalendarRequest) => Promise<ExternalCalendarAccountState>
  disconnectExternalCalendar: (request: DisconnectExternalCalendarRequest) => Promise<ExternalCalendarAccountState>
  syncExternalCalendar: (request: SyncExternalCalendarRequest) => Promise<SyncExternalCalendarResult>
  generateBriefing: (request?: GenerateDailyBriefingRequest) => Promise<DailyBriefingReport>
  getLatestBriefing: (profileId?: string) => Promise<DailyBriefingReport | null>
}

import {
  MediaLibraryOverviewSnapshot,
  ImportMediaBatchRequest,
  ImportMediaBatchResult,
  SaveCapturedMediaRequest,
  MediaAssetRecord,
  ListMediaAssetsRequest,
  ListMediaAssetsResult,
  MediaAssetPreviewDescriptor,
  UpdateMediaAssetMetadataRequest,
  RelinkExternalMediaAssetRequest,
  CreateMediaCollectionRequest,
  MediaCollectionRecord,
  UpdateMediaCollectionRequest,
  DeleteMediaCollectionRequest,
  ModifyCollectionMembershipRequest,
  RemoveMediaAssetFromLibraryRequest,
  RemoveMediaAssetResult,
  DeleteManagedMediaAssetPermanentlyRequest,
  DeleteManagedMediaAssetResult,
  BulkMediaAssetOperationRequest,
  BulkMediaAssetOperationResult,
  MediaStorageMode
} from '../shared/media'

export interface HelioxenMediaLibraryApi {
  getOverview: (profileId?: string) => Promise<MediaLibraryOverviewSnapshot>
  selectAndImportDialog: (options?: {
    storageMode?: MediaStorageMode
    collectionId?: string
  }) => Promise<ImportMediaBatchResult | null>
  importBatch: (request: ImportMediaBatchRequest) => Promise<ImportMediaBatchResult>
  saveCapture: (request: SaveCapturedMediaRequest) => Promise<MediaAssetRecord>
  listAssets: (request?: ListMediaAssetsRequest) => Promise<ListMediaAssetsResult>
  getAsset: (id: string, profileId?: string) => Promise<MediaAssetRecord | null>
  getPreview: (id: string, profileId?: string) => Promise<MediaAssetPreviewDescriptor>
  updateMetadata: (request: UpdateMediaAssetMetadataRequest) => Promise<MediaAssetRecord>
  relinkExternal: (request: RelinkExternalMediaAssetRequest) => Promise<MediaAssetRecord>
  createCollection: (request: CreateMediaCollectionRequest) => Promise<MediaCollectionRecord>
  listCollections: (profileId?: string) => Promise<MediaCollectionRecord[]>
  updateCollection: (request: UpdateMediaCollectionRequest) => Promise<MediaCollectionRecord>
  deleteCollection: (request: DeleteMediaCollectionRequest) => Promise<{ deleted: boolean; id: string }>
  modifyCollectionMembership: (
    request: ModifyCollectionMembershipRequest
  ) => Promise<MediaCollectionRecord>
  removeFromLibrary: (request: RemoveMediaAssetFromLibraryRequest) => Promise<RemoveMediaAssetResult>
  deleteManagedPermanently: (
    request: DeleteManagedMediaAssetPermanentlyRequest
  ) => Promise<DeleteManagedMediaAssetResult>
  bulkOperation: (request: BulkMediaAssetOperationRequest) => Promise<BulkMediaAssetOperationResult>
}

import {
  VisualHubOverviewSnapshot,
  MermaidRenderResult,
  SaveDiagramDocumentRequest,
  DiagramDocumentRecord,
  ListDiagramDocumentsRequest,
  DeleteDiagramDocumentRequest,
  ExportDiagramRequest,
  ExportDiagramResult,
  ImageModelCapabilityDescriptor,
  ImageGenerationRequest,
  ImageGenerationJobRecord,
  CancelImageGenerationRequest,
  CancelImageGenerationResult,
  SaveGeneratedImageToGalleryRequest,
  SaveGeneratedImageToGalleryResult,
  DiscardGeneratedImageRequest,
  VisualHubPreferences
} from '../shared/visual'

export interface HelioxenVisualHubApi {
  getOverview: (profileId?: string) => Promise<VisualHubOverviewSnapshot>
  renderMermaid: (request: { source: string }) => Promise<MermaidRenderResult>
  saveDiagram: (request: SaveDiagramDocumentRequest) => Promise<DiagramDocumentRecord>
  listDiagrams: (request?: ListDiagramDocumentsRequest) => Promise<DiagramDocumentRecord[]>
  deleteDiagram: (request: DeleteDiagramDocumentRequest) => Promise<{ deleted: boolean; id: string }>
  exportDiagram: (
    request: ExportDiagramRequest & { promptSaveDialog?: boolean }
  ) => Promise<ExportDiagramResult | null>
  saveDiagramToGallery: (request: {
    profileId?: string
    source: string
    displayName: string
    tags?: readonly string[]
    favorite?: boolean
  }) => Promise<MediaAssetRecord>
  getImageModels: () => Promise<ImageModelCapabilityDescriptor[]>
  generateImage: (request: ImageGenerationRequest) => Promise<ImageGenerationJobRecord>
  cancelImageGeneration: (
    request: CancelImageGenerationRequest
  ) => Promise<CancelImageGenerationResult>
  saveImageToGallery: (
    request: SaveGeneratedImageToGalleryRequest
  ) => Promise<SaveGeneratedImageToGalleryResult>
  discardImageCandidate: (
    request: DiscardGeneratedImageRequest
  ) => Promise<{ discarded: boolean; candidateId: string; preservedSavedAssetId: string | null }>
  updatePreferences: (
    request: Partial<VisualHubPreferences> & { profileId?: string }
  ) => Promise<VisualHubPreferences>
}

import {
  WorldMonitorOverviewSnapshot,
  WorldMonitorFilterQuery,
  WorldMonitorQueryResult,
  WorldMonitorRefreshResult,
  LocationSearchResult,
  NormalizedNewsArticle,
  WorldMonitorPreferences
} from '../shared/world'

export interface HelioxenWorldMonitorApi {
  getOverview: (
    profileId?: string,
    filterQuery?: WorldMonitorFilterQuery
  ) => Promise<WorldMonitorOverviewSnapshot>
  queryFeed: (filterQuery?: WorldMonitorFilterQuery) => Promise<WorldMonitorQueryResult>
  refreshFeed: (request?: {
    profileId?: string
    sourceIds?: string[]
    searchQuery?: string
    forceRefresh?: boolean
  }) => Promise<WorldMonitorRefreshResult>
  searchLocations: (request: {
    query: string
    limit?: number
  }) => Promise<LocationSearchResult>
  toggleBookmark: (request: {
    profileId?: string
    articleId: string
    bookmarked: boolean
  }) => Promise<NormalizedNewsArticle>
  openSourceUrl: (request: {
    articleId?: string
    url: string
  }) => Promise<{ opened: boolean; canonicalUrl: string }>
  updatePreferences: (
    request: Partial<WorldMonitorPreferences> & { profileId?: string }
  ) => Promise<WorldMonitorPreferences>
}

import {
  SystemHealthSnapshot,
  NetworkStatusSnapshot,
  NetworkDiagnosticResult,
  WeatherLocation,
  WeatherForecastSnapshot,
  WidgetPreferences,
  TemperatureUnit,
  WindSpeedUnit
} from '../shared/widgets'

export interface HelioxenWidgetsApi {
  getSystemHealth: (sampleDurationMs?: number) => Promise<SystemHealthSnapshot>
  getNetworkStatus: () => Promise<NetworkStatusSnapshot>
  runNetworkDiagnostic: (request?: {
    targetUrl?: string
    timeoutMs?: number
  }) => Promise<NetworkDiagnosticResult>
  cancelNetworkDiagnostic: () => Promise<boolean>
  searchWeatherLocations: (query: string, limit?: number) => Promise<WeatherLocation[]>
  getWeatherForecast: (request?: {
    location?: WeatherLocation
    temperatureUnit?: TemperatureUnit
    windSpeedUnit?: WindSpeedUnit
    forceRefresh?: boolean
  }) => Promise<WeatherForecastSnapshot>
  getPreferences: () => Promise<WidgetPreferences>
  updatePreferences: (patch: any) => Promise<WidgetPreferences>
}

import {
  AgentDefinition,
  AgentTownOverviewSnapshot,
  ConnectorDescriptor,
  DynamicSkillDefinition,
  PluginManifest,
  SkillDryRunResult,
  SkillExecutionResult,
  SkillValidationResult,
  DynamicSkillCreateInput
} from '../shared/agents/types'
import {
  CollaborationPlanInput,
  CoordinatedParentTask
} from '../shared/agents/collaborationTypes'
import {
  SkillExportPackage,
  SkillImportPreview,
  SkillRegressionTestReport,
  SkillScenarioTestResult,
  SkillTestScenario,
  SkillValidationReport,
  SkillVersionDiff,
  SkillVersionRecord
} from '../shared/agents/skillStudioTypes'

export interface HelioxenAgentsApi {
  getOverview: () => Promise<AgentTownOverviewSnapshot>
  listAgents: (category?: string) => Promise<AgentDefinition[]>
  setAgentEnabled: (id: string, enabled: boolean) => Promise<AgentDefinition>
  listPlugins: () => Promise<PluginManifest[]>
  setPluginEnabled: (id: string, enabled: boolean) => Promise<PluginManifest>
  connectConnector: (connectorId: string, credentialRef?: string) => Promise<ConnectorDescriptor>
  disconnectConnector: (connectorId: string) => Promise<ConnectorDescriptor>
  updateConnectorScopes: (connectorId: string, grantedScopes: string[]) => Promise<ConnectorDescriptor>
  listSkills: (category?: string) => Promise<DynamicSkillDefinition[]>
  getSkill: (skillId: string) => Promise<DynamicSkillDefinition | null>
  validateSkill: (definition: DynamicSkillCreateInput) => Promise<SkillValidationResult>
  dryRunSkill: (definition: DynamicSkillCreateInput, testInputs?: Record<string, unknown>) => Promise<SkillDryRunResult>
  saveSkill: (definition: DynamicSkillCreateInput) => Promise<DynamicSkillDefinition>
  setSkillStatus: (skillId: string, status: 'draft' | 'validated' | 'enabled' | 'disabled' | 'archived') => Promise<DynamicSkillDefinition>
  deleteSkill: (skillId: string) => Promise<boolean>
  executeSkill: (skillId: string, parameters?: Record<string, unknown>) => Promise<SkillExecutionResult>
  coordinateTask: (input: CollaborationPlanInput) => Promise<CoordinatedParentTask>
  getCoordinatedTask: (parentTaskId: string) => Promise<CoordinatedParentTask | null>
  listCoordinatedTasks: () => Promise<CoordinatedParentTask[]>
  cancelCoordinatedTask: (parentTaskId: string, reason?: string) => Promise<boolean>
  validateSkillStaged: (definitionOrId: unknown) => Promise<SkillValidationReport>
  createSkillVersion: (skillId: string, changelog?: string) => Promise<SkillVersionRecord>
  listSkillVersions: (skillId: string) => Promise<SkillVersionRecord[]>
  getSkillVersion: (skillId: string, versionId: string) => Promise<SkillVersionRecord | null>
  compareSkillVersions: (skillId: string, baseVersionId: string, targetVersionId: string) => Promise<SkillVersionDiff>
  rollbackSkillVersion: (skillId: string, targetVersionId: string) => Promise<DynamicSkillDefinition>
  createTestScenario: (skillId: string, scenario: Omit<SkillTestScenario, 'createdAt' | 'updatedAt'>) => Promise<SkillTestScenario>
  listTestScenarios: (skillId: string) => Promise<SkillTestScenario[]>
  deleteTestScenario: (skillId: string, scenarioId: string) => Promise<boolean>
  runTestScenario: (skillId: string, scenarioId: string) => Promise<SkillScenarioTestResult>
  runRegressionTests: (skillId: string) => Promise<SkillRegressionTestReport>
  exportSkillPackage: (skillId: string) => Promise<string>
  previewSkillImport: (rawJson: string) => Promise<SkillImportPreview>
  importSkillPackage: (rawJson: string, options?: { newId?: string; author?: string }) => Promise<DynamicSkillDefinition>
  generateSkillDraftWithAi: (prompt: string, category?: string) => Promise<DynamicSkillDefinition>
  refineSkillWithAi: (skillId: string, instruction: string) => Promise<DynamicSkillDefinition>
}

import {
  OfficeDocumentMetadata,
  WordDocumentModel,
  SpreadsheetWorkbookModel,
  PresentationModel,
  OfficeTemplate,
  OfficeAiDraftRequest,
  OfficeAiDraftResponse,
  OfficeExportRequest,
  OfficeExportResult,
  OfficeImportResult
} from '../shared/office/types'

export interface HelioxenOfficeApi {
  listDocuments: () => Promise<OfficeDocumentMetadata[]>
  getDocument: (documentId: string) => Promise<WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel | null>
  saveDocument: (doc: WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel) => Promise<OfficeDocumentMetadata>
  deleteDocument: (documentId: string) => Promise<boolean>
  listTemplates: () => Promise<OfficeTemplate[]>
  createFromTemplate: (templateId: string, title?: string) => Promise<WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel>
  exportDocument: (request: OfficeExportRequest) => Promise<OfficeExportResult>
  importDocument: (sourceFilePath?: string) => Promise<OfficeImportResult>
  generateAiDraft: (request: OfficeAiDraftRequest) => Promise<OfficeAiDraftResponse>
  rewriteTextAi: (text: string, instruction: string) => Promise<string>
  suggestFormulaAi: (description: string, sampleDataSnippet?: string) => Promise<{ formula: string; explanation: string }>
}

import {
  IntegrationDescriptor,
  IntegrationConnectionStatus,
  ConnectIntegrationRequest,
  DisconnectIntegrationRequest,
  IntegrationOperationResult
} from '../shared/integrations/types'

export interface HelioxenIntegrationsApi {
  listIntegrations: () => Promise<IntegrationDescriptor[]>
  getIntegration: (id: string) => Promise<IntegrationDescriptor | null>
  connectIntegration: (request: ConnectIntegrationRequest) => Promise<IntegrationOperationResult>
  disconnectIntegration: (request: DisconnectIntegrationRequest) => Promise<IntegrationOperationResult>
  checkHealth: (id: string) => Promise<{ status: IntegrationConnectionStatus; error?: string; latencyMs?: number }>
}

import {
  CommunicationChannelType,
  CommunicationMessage,
  MessageDraft,
  SendConfirmationRequest,
  SendMessageRequest,
  SendMessageResult,
  CommunicationSearchQuery,
  CommunicationAiDraftRequest,
  CommunicationAiDraftResponse,
  MessageRecipient,
  MessageAttachment
} from '../shared/communication/types'

export interface HelioxenCommunicationApi {
  listMessages: (query?: CommunicationSearchQuery) => Promise<CommunicationMessage[]>
  getMessage: (messageId: string) => Promise<CommunicationMessage | null>
  listDrafts: (channel?: string) => Promise<MessageDraft[]>
  getDraft: (draftId: string) => Promise<MessageDraft | null>
  createDraft: (draft: {
    integrationId?: string
    channelType: CommunicationChannelType
    recipients: readonly MessageRecipient[]
    subject?: string
    body: string
    attachments?: readonly MessageAttachment[]
  }) => Promise<MessageDraft>
  updateDraft: (draftId: string, patch: Partial<MessageDraft>) => Promise<MessageDraft>
  deleteDraft: (draftId: string) => Promise<boolean>
  requestSendConfirmation: (request: { draftId: string }) => Promise<SendConfirmationRequest>
  confirmAndSend: (request: SendMessageRequest) => Promise<SendMessageResult>
  generateAiDraft: (request: CommunicationAiDraftRequest) => Promise<CommunicationAiDraftResponse>
}

import {
  MediaCatalogSearchQuery,
  MediaCatalogSearchResult,
  MediaPlaylist,
  MediaPlaybackDevice,
  MediaPlaybackState,
  MediaControlCommand,
  MediaControlResult
} from '../shared/media-integrations/types'

export interface HelioxenMediaIntegrationsApi {
  searchCatalog: (query: MediaCatalogSearchQuery) => Promise<MediaCatalogSearchResult>
  listPlaylists: (integrationId?: string) => Promise<MediaPlaylist[]>
  listDevices: (integrationId?: string) => Promise<MediaPlaybackDevice[]>
  getPlaybackState: (integrationId?: string) => Promise<MediaPlaybackState>
  executeControl: (command: MediaControlCommand) => Promise<MediaControlResult>
}

import {
  AndroidDevice,
  AndroidPairingRequest,
  AndroidPairingResult,
  AndroidActionCommand,
  AndroidActionResult
} from '../shared/devices/types'

export interface HelioxenDevicesApi {
  listAndroid: () => Promise<AndroidDevice[]>
  getAndroidStatus: (deviceId?: string) => Promise<AndroidDevice | null>
  pairAndroid: (request: AndroidPairingRequest) => Promise<AndroidPairingResult>
  disconnectAndroid: (deviceId: string) => Promise<boolean>
  executeAndroidAction: (command: AndroidActionCommand) => Promise<AndroidActionResult>
}

import {
  SmartHomeEntity,
  SmartHomeHubDescriptor,
  SmartHomeActionCommand,
  SmartHomeActionResult,
  SmartHomeSecurityConfirmationRequest,
  SmartHomeEntityDomain
} from '../shared/smart-home/types'

export interface HelioxenSmartHomeApi {
  getHubStatus: (hubId?: string) => Promise<SmartHomeHubDescriptor | null>
  connectHub: (params: {
    hubId: string
    endpointUrl: string
    accessToken?: string
    displayName?: string
  }) => Promise<{ success: boolean; hub?: SmartHomeHubDescriptor; error?: string }>
  disconnectHub: (hubId: string) => Promise<boolean>
  listEntities: (query?: { hubId?: string; domain?: SmartHomeEntityDomain }) => Promise<SmartHomeEntity[]>
  getEntityState: (entityId: string) => Promise<SmartHomeEntity | null>
  requestSecurityConfirmation: (params: {
    hubId: string
    entityId: string
    command: string
  }) => Promise<SmartHomeSecurityConfirmationRequest>
  executeAction: (command: SmartHomeActionCommand) => Promise<SmartHomeActionResult>
}

import {
  RecoveryOverview,
  BackupManifest,
  BackupCreationRequest,
  BackupCreationResult,
  BackupVerificationResult,
  RestorePreview,
  RestoreExecutionRequest,
  RestoreExecutionResult,
  DiagnosticReport,
  SelfRepairRequest,
  SelfRepairResult
} from '../shared/recovery/types'

export interface HelioxenRecoveryApi {
  getStatus: () => Promise<RecoveryOverview>
  listBackups: () => Promise<BackupManifest[]>
  createBackup: (request?: BackupCreationRequest) => Promise<BackupCreationResult>
  verifyBackup: (backupId: string) => Promise<BackupVerificationResult>
  getRestorePreview: (backupId: string) => Promise<RestorePreview>
  executeRestore: (request: RestoreExecutionRequest) => Promise<RestoreExecutionResult>
  runDiagnostics: () => Promise<DiagnosticReport>
  executeRepair: (request: SelfRepairRequest) => Promise<SelfRepairResult>
}
