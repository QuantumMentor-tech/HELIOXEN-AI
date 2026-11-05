import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import {
  HelioxenApi,
  HelioxenWindowApi,
  HelioxenAiApi,
  HelioxenCredentialsApi,
  HelioxenModelsApi,
  HelioxenPreferencesApi,
  HelioxenHealthApi,
  HelioxenRoutingApi,
  HelioxenAudioApi,
  HelioxenVoiceApi,
  HelioxenCaptureApi,
  HelioxenDocumentsApi,
  HelioxenResearchApi,
  HelioxenMemoryApi,
  HelioxenProductivityApi,
  HelioxenMediaLibraryApi,
  HelioxenVisualHubApi,
  HelioxenWorldMonitorApi,
  HelioxenWidgetsApi,
  HelioxenAgentsApi,
  HelioxenOfficeApi,
  HelioxenIntegrationsApi,
  HelioxenCommunicationApi,
  HelioxenMediaIntegrationsApi,
  HelioxenDevicesApi,
  HelioxenSmartHomeApi,
  HelioxenRecoveryApi
} from './types'
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
import { AudioPermissionStatus, AudioDeviceInfo } from '../shared/audio/types'
import { UserVoicePreferences } from '../shared/voice/types'
import { DesktopDisplaySource, CapturePermissionStatus } from '../shared/capture/types'
import {
  FileAttachment,
  DocumentExtractionResult,
  DocumentValidationResult
} from '../shared/documents/types'
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
 * Hardened, contract-driven preload bridge for HELIOXEN AI.
 * Uses authoritative channel constants and strictly isolates the renderer.
 */
const windowApi: HelioxenWindowApi = Object.freeze({
  minimize: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE)
  },
  maximize: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE)
  },
  close: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE)
  },
  isMaximized: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED)
  },
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }
    ipcRenderer.on(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE, listener)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE, listener)
    }
  }
})

const aiApi: HelioxenAiApi = Object.freeze({
  generateText: (request: AiGenerationRequest): Promise<AiGenerationResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_TEXT, request)
  },
  cancel: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL)
  },
  onStreamChunk: (callback: (chunk: AiStreamChunk) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, chunk: AiStreamChunk): void => {
      callback(chunk)
    }
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, listener)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, listener)
    }
  }
})

const credentialsApi: HelioxenCredentialsApi = Object.freeze({
  set: (params: { provider: AiProviderId; apiKey: string; label?: string }): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_SET, params)
  },
  getStatus: (): Promise<Record<AiProviderId, ProviderCredentialStatus>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_GET_STATUS)
  },
  delete: (provider: AiProviderId): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_DELETE, { provider })
  },
  test: (provider: AiProviderId): Promise<ProviderTestResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_TEST, { provider })
  }
})

const modelsApi: HelioxenModelsApi = Object.freeze({
  getCatalog: (): Promise<ProviderDefinition[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MODELS_GET_CATALOG)
  },
  refresh: (provider: AiProviderId): Promise<ProviderDefinition> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MODELS_REFRESH, { provider })
  }
})

const preferencesApi: HelioxenPreferencesApi = Object.freeze({
  get: (): Promise<UserAiPreferences> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET)
  },
  set: (preferences: UserAiPreferences): Promise<UserAiPreferences> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SET, preferences)
  }
})

const healthApi: HelioxenHealthApi = Object.freeze({
  getStatus: (): Promise<Record<AiProviderId, ProviderHealthRecord>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.HEALTH_GET_STATUS)
  }
})

const routingApi: HelioxenRoutingApi = Object.freeze({
  getTaskDefinitions: (): Promise<Record<AiTaskType, TaskRequirement>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ROUTING_GET_TASK_DEFINITIONS)
  }
})

const audioApi: HelioxenAudioApi = Object.freeze({
  getPermissionStatus: (): Promise<AudioPermissionStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_PERMISSION_STATUS)
  },
  getDevices: (): Promise<AudioDeviceInfo[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_DEVICES)
  }
})

const voiceApi: HelioxenVoiceApi = Object.freeze({
  getPreferences: (): Promise<UserVoicePreferences> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VOICE_PREFERENCES_GET)
  },
  setPreferences: (preferences: Partial<UserVoicePreferences>): Promise<UserVoicePreferences> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VOICE_PREFERENCES_SET, preferences)
  }
})

const captureApi: HelioxenCaptureApi = Object.freeze({
  getDesktopSources: (types: ('screen' | 'window')[] = ['screen', 'window']): Promise<DesktopDisplaySource[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_GET_DESKTOP_SOURCES, { types })
  },
  checkPermission: (sourceType: 'camera' | 'screen'): Promise<CapturePermissionStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_CHECK_PERMISSION, { sourceType })
  }
})

const documentsApi: HelioxenDocumentsApi = Object.freeze({
  selectFiles: (options?: { multiple?: boolean; maxCount?: number }): Promise<FileAttachment[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_SELECT_FILES, options)
  },
  extractFile: (
    attachmentId: string,
    fileName: string,
    filePath?: string,
    fileBuffer?: Uint8Array
  ): Promise<DocumentExtractionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_EXTRACT_FILE, {
      attachmentId,
      fileName,
      filePath,
      fileBuffer
    })
  },
  validateFile: (metadata: {
    name: string
    sizeBytes: number
    mimeType?: string
  }): Promise<DocumentValidationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_VALIDATE_FILE, metadata)
  }
})

import {
  HelioxenToolsApi,
  HelioxenOrchestrationApi,
  HelioxenTelemetryApi,
  HelioxenFilesystemApi,
  HelioxenClipboardApi,
  HelioxenDesktopApi,
  HelioxenBrowserApi
} from './types'
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
import { ToolMetadata, ToolQueryFilter, ToolValidationResult } from '../shared/tools/types'
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
import {
  SystemHealthTelemetry,
  SystemHealthRequest,
  InstalledAppsResult,
  InstalledAppsRequest,
  InstalledApplicationEntry,
  WindowDiscoveryResult,
  WindowDiscoveryRequest
} from '../shared/telemetry/types'
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

const toolsApi: HelioxenToolsApi = Object.freeze({
  list: (filter?: ToolQueryFilter): Promise<ToolMetadata[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TOOLS_LIST, filter)
  },
  get: (id: string): Promise<ToolMetadata | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TOOLS_GET, { id })
  },
  validateInput: (id: string, input: unknown): Promise<ToolValidationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TOOLS_VALIDATE_INPUT, { id, input })
  }
})

const orchestrationApi: HelioxenOrchestrationApi = Object.freeze({
  plan: (request: TaskPlannerRequest): Promise<TaskPlannerResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_PLAN, request)
  },
  execute: (
    plan: TaskPlan,
    options?: { approvedConfirmations?: string[] }
  ): Promise<TaskExecutionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_EXECUTE, { plan, ...options })
  },
  cancel: (request: TaskCancellationRequest): Promise<TaskCancellationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_CANCEL, request)
  },
  getAudit: (taskId: string): Promise<readonly AuditEvent[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_GET_AUDIT, { taskId })
  },
  getTask: (taskId: string): Promise<TaskRecord | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_GET_TASK, { taskId })
  },
  onProgress: (listener: (event: TaskProgressEvent) => void): (() => void) => {
    const handler = (_ipcEvent: unknown, event: TaskProgressEvent): void => {
      listener(event)
    }
    ipcRenderer.on(IPC_CHANNELS.ORCHESTRATION_PROGRESS_EVENT, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ORCHESTRATION_PROGRESS_EVENT, handler)
    }
  }
})

const telemetryApi: HelioxenTelemetryApi = Object.freeze({
  getSystemHealth: (request?: SystemHealthRequest): Promise<SystemHealthTelemetry> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_GET_SYSTEM_HEALTH, request)
  },
  getInstalledApps: (request?: InstalledAppsRequest): Promise<InstalledAppsResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_GET_INSTALLED_APPS, request)
  },
  searchInstalledApps: (query: string, limit?: number): Promise<InstalledApplicationEntry[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_SEARCH_INSTALLED_APPS, { query, limit })
  },
  getDesktopWindows: (request?: WindowDiscoveryRequest): Promise<WindowDiscoveryResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_GET_DESKTOP_WINDOWS, request)
  }
})

const filesystemApi: HelioxenFilesystemApi = Object.freeze({
  listDirectory: (request: DirectoryListingRequest): Promise<DirectoryListingResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_LIST_DIRECTORY, request)
  },
  getMetadata: (rootPath: string, filePath: string): Promise<FileMetadata> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_GET_METADATA, { rootPath, filePath })
  },
  searchFiles: (request: FileSearchRequest): Promise<FileSearchResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_SEARCH_FILES, request)
  },
  readTextFile: (request: ReadTextFileRequest): Promise<ReadTextFileResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_READ_TEXT, request)
  },
  createFile: (request: CreateFileRequest): Promise<CreateFileResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_CREATE_FILE, request)
  },
  copyFile: (request: CopyFileRequest): Promise<CopyFileResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_COPY_FILE, request)
  },
  moveFile: (request: MoveFileRequest): Promise<MoveFileResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_MOVE_FILE, request)
  },
  organizePreview: (request: OrganizationPlanRequest): Promise<OrganizationPlan> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_ORGANIZE_PREVIEW, request)
  },
  organizeApply: (request: OrganizationApplyRequest): Promise<OrganizationApplyResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_ORGANIZE_APPLY, request)
  },
  organizeUndo: (request: OrganizationUndoRequest): Promise<OrganizationUndoResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_ORGANIZE_UNDO, request)
  }
})

const clipboardApi: HelioxenClipboardApi = Object.freeze({
  readText: (maxChars?: number): Promise<ClipboardReadTextResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_READ_TEXT, { maxChars })
  },
  writeText: (request: ClipboardWriteTextRequest): Promise<ClipboardWriteTextResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, request)
  },
  readImage: (maxBytes?: number): Promise<ClipboardReadImageResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_READ_IMAGE, { maxBytes })
  }
})

const desktopApi: HelioxenDesktopApi = Object.freeze({
  focusWindow: (target: TargetWindowReference): Promise<{ success: boolean; windowId: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_FOCUS_WINDOW, { target })
  },
  sendKeyAction: (request: KeyboardActionRequest): Promise<KeyboardActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_EXECUTE_KEYBOARD, request)
  },
  sendText: (request: TextEntryRequest): Promise<KeyboardActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_SEND_TEXT, request)
  },
  sendClick: (request: MouseClickRequest): Promise<MouseActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_EXECUTE_MOUSE, request)
  },
  sendScroll: (request: MouseScrollRequest): Promise<MouseActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_EXECUTE_MOUSE, request)
  },
  emergencyStop: (): Promise<EmergencyStopResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_EMERGENCY_STOP)
  },
  undoLastAction: (request?: UndoInteractionRequest): Promise<UndoInteractionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_UNDO_LAST_ACTION, request)
  },
  openPath: (request: SystemOpenPathRequest): Promise<SystemOpenPathResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_PATH, request)
  },
  showInFolder: (request: SystemShowInFolderRequest): Promise<SystemShowInFolderResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SHOW_IN_FOLDER, request)
  },
  openExternalUrl: (request: SystemOpenUrlRequest): Promise<SystemOpenUrlResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_URL, request)
  },
  systemAlertBeep: (): Promise<SystemAlertBeepResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_ALERT_BEEP)
  },
  getDisplayMetrics: (): Promise<DisplayMetricsResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_DISPLAY_METRICS)
  }
})

const browserApi: HelioxenBrowserApi = Object.freeze({
  createSession: (request?: CreateSessionRequest): Promise<BrowserSessionMetadata> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CREATE_SESSION, request)
  },
  listSessions: (): Promise<BrowserSessionMetadata[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_LIST_SESSIONS)
  },
  closeSession: (sessionId: string): Promise<{ success: boolean; sessionId: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CLOSE_SESSION, { sessionId })
  },
  clearSession: (request: ClearSessionDataRequest): Promise<{ success: boolean; sessionId: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CLEAR_SESSION, request)
  },
  createTab: (request?: CreateTabRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CREATE_TAB, request)
  },
  navigateTab: (request: NavigateTabRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_NAVIGATE_TAB, request)
  },
  switchTab: (request: SwitchTabRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SWITCH_TAB, request)
  },
  closeTab: (request: CloseTabRequest): Promise<{ success: boolean; closedTabId: string; newActiveTabId?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CLOSE_TAB, request)
  },
  getTabState: (request: TabActionRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GET_TAB_STATE, request)
  },
  listTabs: (sessionId?: string): Promise<{ tabs: BrowserTabState[] }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_LIST_TABS, { sessionId })
  },
  reloadTab: (request: TabActionRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_RELOAD_TAB, request)
  },
  stopTab: (request: TabActionRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_STOP_TAB, request)
  },
  goBack: (request: TabActionRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GO_BACK, request)
  },
  goForward: (request: TabActionRequest): Promise<BrowserTabState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GO_FORWARD, request)
  },
  setBounds: (request: SetBrowserViewBoundsRequest): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SET_BOUNDS, request)
  },
  // Step 33: Browser Agent Automation & Download Policies
  inspectPage: (request: InspectPageRequest): Promise<PageInspectionSnapshot> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_INSPECT_PAGE, request)
  },
  clickElement: (request: ClickElementRequest): Promise<BrowserActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CLICK_ELEMENT, request)
  },
  scrollPage: (request: ScrollPageRequest): Promise<BrowserActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SCROLL_PAGE, request)
  },
  fillField: (request: FillFieldRequest): Promise<BrowserActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_FILL_FIELD, request)
  },
  selectOption: (request: SelectOptionRequest): Promise<BrowserActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SELECT_OPTION, request)
  },
  reviewForm: (request: ReviewFormRequest): Promise<FormReviewSummary> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_REVIEW_FORM, request)
  },
  submitForm: (request: SubmitFormRequest): Promise<BrowserActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SUBMIT_FORM, request)
  },
  listDownloads: (): Promise<DownloadStateRecord[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_LIST_DOWNLOADS)
  },
  approveDownload: (request: ApproveDownloadRequest): Promise<DownloadStateRecord> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_APPROVE_DOWNLOAD, request)
  },
  cancelDownload: (request: CancelDownloadRequest): Promise<DownloadStateRecord> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CANCEL_DOWNLOAD, request)
  }
})

const researchApi: HelioxenResearchApi = Object.freeze({
  search: (query: ResearchSearchQuery): Promise<ResearchSearchResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SEARCH, query)
  },
  extractTab: (request: ResearchExtractionRequest): Promise<ResearchSourceRecord> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_EXTRACT_TAB, request)
  },
  extractUrl: (request: ResearchExtractionRequest): Promise<ResearchSourceRecord> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_EXTRACT_URL, request)
  },
  captureScreenshot: (request: BrowserScreenshotRequest): Promise<BrowserScreenshotRecord> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_CAPTURE_SCREENSHOT, request)
  },
  discardScreenshot: (screenshotId: string): Promise<{ success: boolean; screenshotId: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_DISCARD_SCREENSHOT, { screenshotId })
  },
  getCollection: (conversationId: string): Promise<ResearchCollection> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_GET_COLLECTION, { conversationId })
  },
  updateSourceInclusion: (conversationId: string, sourceId: string, included: boolean): Promise<ResearchSourceRecord> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_UPDATE_SOURCE_INCLUSION, { conversationId, sourceId, included })
  },
  clearCollection: (conversationId: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_CLEAR_COLLECTION, { conversationId })
  },
  validateCitations: (request: ValidateCitationsRequest): Promise<ResearchCitation[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_VALIDATE_CITATIONS, request)
  }
})

const memoryApi: HelioxenMemoryApi = Object.freeze({
  getState: (profileId?: string): Promise<MemoryStateOverview> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET_STATE, { profileId })
  },
  setConsent: (request: MemoryConsentUpdateRequest): Promise<UserProfile> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_SET_CONSENT, request)
  },
  updateProfile: (request: UserProfileUpdateRequest): Promise<UserProfile> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_UPDATE_PROFILE, request)
  },
  create: (request: CreateMemoryRequest): Promise<CreateMemoryResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_CREATE, request)
  },
  list: (request?: ListMemoriesRequest): Promise<MemoryRecord[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_LIST, request)
  },
  get: (id: string, profileId?: string): Promise<MemoryRecord | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET, { id, profileId })
  },
  update: (request: UpdateMemoryRequest): Promise<UpdateMemoryResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_UPDATE, request)
  },
  delete: (request: DeleteMemoryRequest): Promise<DeleteMemoryResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_DELETE, request)
  },
  clearAll: (request: ClearMemoriesRequest): Promise<ClearMemoriesResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_CLEAR_ALL, request)
  },
  retrieve: (request: MemoryRetrievalRequest): Promise<MemoryRetrievalResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_RETRIEVE, request)
  },
  proposeSuggestion: (request: ProposeMemorySuggestionRequest): Promise<MemorySuggestion> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_PROPOSE_SUGGESTION, request)
  },
  resolveSuggestion: (request: ResolveMemorySuggestionRequest): Promise<ResolveMemorySuggestionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_RESOLVE_SUGGESTION, request)
  }
})

const productivityApi: HelioxenProductivityApi = Object.freeze<HelioxenProductivityApi>({
  getOverview: (profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_GET_OVERVIEW, { profileId }),
  updateSettings: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_UPDATE_SETTINGS, request),
  createNote: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_NOTE_CREATE, request),
  listNotes: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_NOTE_LIST, request),
  updateNote: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_NOTE_UPDATE, request),
  deleteNote: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_NOTE_DELETE, request),
  createTask: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_TASK_CREATE, request),
  listTasks: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_TASK_LIST, request),
  updateTask: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_TASK_UPDATE, request),
  completeTaskByTitle: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_TASK_COMPLETE_BY_TITLE, request),
  deleteTask: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_TASK_DELETE, request),
  createReminder: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_CREATE, request),
  listReminders: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_LIST, request),
  updateReminder: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_UPDATE, request),
  snoozeReminder: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_SNOOZE, request),
  dismissReminder: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_DISMISS, request),
  cancelReminder: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_CANCEL, request),
  deleteReminder: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_REMINDER_DELETE, request),
  createCalendarEvent: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_CREATE_EVENT, request),
  listCalendarEvents: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_LIST_EVENTS, request),
  updateCalendarEvent: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_UPDATE_EVENT, request),
  deleteCalendarEvent: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_DELETE_EVENT, request),
  connectExternalCalendar: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_CONNECT_PROVIDER, request),
  disconnectExternalCalendar: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_DISCONNECT_PROVIDER, request),
  syncExternalCalendar: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_SYNC_PROVIDER, request),
  generateBriefing: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_BRIEFING_GENERATE, request),
  getLatestBriefing: (profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRODUCTIVITY_BRIEFING_GET_LATEST, { profileId })
})

const mediaLibraryApi: HelioxenMediaLibraryApi = Object.freeze<HelioxenMediaLibraryApi>({
  getOverview: (profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_GET_OVERVIEW, { profileId }),
  selectAndImportDialog: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_SELECT_AND_IMPORT_DIALOG, options),
  importBatch: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_IMPORT_BATCH, request),
  saveCapture: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_SAVE_CAPTURE, request),
  listAssets: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_LIST_ASSETS, request),
  getAsset: (id: string, profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_GET_ASSET, { id, profileId }),
  getPreview: (id: string, profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_GET_PREVIEW, { id, profileId }),
  updateMetadata: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_UPDATE_METADATA, request),
  relinkExternal: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_RELINK_EXTERNAL, request),
  createCollection: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_CREATE_COLLECTION, request),
  listCollections: (profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_LIST_COLLECTIONS, { profileId }),
  updateCollection: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_UPDATE_COLLECTION, request),
  deleteCollection: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_DELETE_COLLECTION, request),
  modifyCollectionMembership: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_MODIFY_COLLECTION_MEMBERSHIP, request),
  removeFromLibrary: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_REMOVE_FROM_LIBRARY, request),
  deleteManagedPermanently: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_DELETE_MANAGED_PERMANENTLY, request),
  bulkOperation: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_BULK_OPERATION, request)
})

const visualHubApi: HelioxenVisualHubApi = Object.freeze<HelioxenVisualHubApi>({
  getOverview: (profileId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_GET_OVERVIEW, { profileId }),
  renderMermaid: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_RENDER_MERMAID, request),
  saveDiagram: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_SAVE_DIAGRAM, request),
  listDiagrams: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_LIST_DIAGRAMS, request),
  deleteDiagram: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_DELETE_DIAGRAM, request),
  exportDiagram: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_EXPORT_DIAGRAM, request),
  saveDiagramToGallery: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_SAVE_DIAGRAM_TO_GALLERY, request),
  getImageModels: () =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_GET_IMAGE_MODELS),
  generateImage: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_GENERATE_IMAGE, request),
  cancelImageGeneration: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_CANCEL_IMAGE_GENERATION, request),
  saveImageToGallery: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_SAVE_IMAGE_TO_GALLERY, request),
  discardImageCandidate: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_DISCARD_IMAGE_CANDIDATE, request),
  updatePreferences: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISUAL_UPDATE_PREFERENCES, request)
})

const worldMonitorApi: HelioxenWorldMonitorApi = Object.freeze<HelioxenWorldMonitorApi>({
  getOverview: (profileId?: string, filterQuery?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_GET_OVERVIEW, { profileId, filterQuery }),
  queryFeed: (filterQuery) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_QUERY_FEED, filterQuery ?? {}),
  refreshFeed: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_REFRESH_FEED, request ?? {}),
  searchLocations: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_SEARCH_LOCATIONS, request),
  toggleBookmark: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_TOGGLE_BOOKMARK, request),
  openSourceUrl: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_OPEN_SOURCE_URL, request),
  updatePreferences: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORLD_UPDATE_PREFERENCES, request)
})

const widgetsApi: HelioxenWidgetsApi = Object.freeze({
  getSystemHealth: (sampleDurationMs?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_GET_SYSTEM_HEALTH, { sampleDurationMs }),
  getNetworkStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_GET_NETWORK_STATUS),
  runNetworkDiagnostic: (request?: { targetUrl?: string; timeoutMs?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_RUN_NETWORK_DIAGNOSTIC, request ?? {}),
  cancelNetworkDiagnostic: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_CANCEL_NETWORK_DIAGNOSTIC),
  searchWeatherLocations: (query: string, limit?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_SEARCH_WEATHER_LOCATIONS, { query, limit }),
  getWeatherForecast: (request?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_GET_WEATHER_FORECAST, request ?? {}),
  getPreferences: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_GET_PREFERENCES),
  updatePreferences: (patch: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WIDGETS_UPDATE_PREFERENCES, patch)
})

const agentsApi: HelioxenAgentsApi = Object.freeze<HelioxenAgentsApi>({
  getOverview: () => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_GET_OVERVIEW),
  listAgents: (category?: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_LIST, { category }),
  setAgentEnabled: (id: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENTS_SET_ENABLED, { id, enabled }),
  listPlugins: () => ipcRenderer.invoke(IPC_CHANNELS.PLUGINS_LIST),
  setPluginEnabled: (id: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLUGINS_SET_ENABLED, { id, enabled }),
  connectConnector: (connectorId: string, credentialRef?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECTORS_CONNECT, { connectorId, credentialRef }),
  disconnectConnector: (connectorId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECTORS_DISCONNECT, { connectorId }),
  updateConnectorScopes: (connectorId: string, grantedScopes: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECTORS_UPDATE_SCOPES, { connectorId, grantedScopes }),
  listSkills: (category?: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST, { category }),
  getSkill: (skillId: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET, { skillId }),
  validateSkill: (definition: any) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_VALIDATE, { definition }),
  dryRunSkill: (definition: any, testInputs?: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DRY_RUN, { definition, testInputs }),
  saveSkill: (definition: any) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SAVE, { definition }),
  setSkillStatus: (skillId: string, status: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SET_STATUS, { skillId, status }),
  deleteSkill: (skillId: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DELETE, { skillId }),
  executeSkill: (skillId: string, parameters?: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_EXECUTE, { skillId, parameters }),
  coordinateTask: (input: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENTS_COORDINATE_TASK, { input }),
  getCoordinatedTask: (parentTaskId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENTS_GET_COORDINATED_TASK, { parentTaskId }),
  listCoordinatedTasks: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENTS_LIST_COORDINATED_TASKS),
  cancelCoordinatedTask: (parentTaskId: string, reason?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENTS_CANCEL_COORDINATED_TASK, { parentTaskId, reason }),

  // Step 42: Advanced Dynamic Skill Studio
  validateSkillStaged: (definitionOrId: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_VALIDATE_STAGED, { definitionOrId }),
  createSkillVersion: (skillId: string, changelog?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_CREATE_VERSION, { skillId, changelog }),
  listSkillVersions: (skillId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST_VERSIONS, { skillId }),
  getSkillVersion: (skillId: string, versionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET_VERSION, { skillId, versionId }),
  compareSkillVersions: (skillId: string, baseVersionId: string, targetVersionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_COMPARE_VERSIONS, { skillId, baseVersionId, targetVersionId }),
  rollbackSkillVersion: (skillId: string, targetVersionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_ROLLBACK_VERSION, { skillId, targetVersionId }),
  createTestScenario: (skillId: string, scenario: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_CREATE_SCENARIO, { skillId, scenario }),
  listTestScenarios: (skillId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST_SCENARIOS, { skillId }),
  deleteTestScenario: (skillId: string, scenarioId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DELETE_SCENARIO, { skillId, scenarioId }),
  runTestScenario: (skillId: string, scenarioId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_RUN_SCENARIO, { skillId, scenarioId }),
  runRegressionTests: (skillId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_RUN_REGRESSION_TESTS, { skillId }),
  exportSkillPackage: (skillId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_EXPORT_PACKAGE, { skillId }),
  previewSkillImport: (rawJson: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_PREVIEW_IMPORT, { rawJson }),
  importSkillPackage: (rawJson: string, options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_IMPORT_PACKAGE, { rawJson, options }),
  generateSkillDraftWithAi: (prompt: string, category?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GENERATE_AI_DRAFT, { prompt, category }),
  refineSkillWithAi: (skillId: string, instruction: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_REFINE_AI_DRAFT, { skillId, instruction })
})

const officeApi: HelioxenOfficeApi = Object.freeze({
  listDocuments: () =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_LIST_DOCUMENTS),
  getDocument: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_GET_DOCUMENT, { documentId }),
  saveDocument: (doc: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_SAVE_DOCUMENT, { document: doc }),
  deleteDocument: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_DELETE_DOCUMENT, { documentId }),
  listTemplates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_LIST_TEMPLATES),
  createFromTemplate: (templateId: string, title?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_CREATE_FROM_TEMPLATE, { templateId, title }),
  exportDocument: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXPORT_DOCUMENT, request),
  importDocument: (sourceFilePath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_IMPORT_DOCUMENT, { sourceFilePath }),
  generateAiDraft: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_GENERATE_AI_DRAFT, request),
  rewriteTextAi: (text: string, instruction: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_REWRITE_TEXT_AI, { text, instruction }),
  suggestFormulaAi: (description: string, sampleDataSnippet?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OFFICE_SUGGEST_FORMULA_AI, { description, sampleDataSnippet })
})

const integrationsApi: HelioxenIntegrationsApi = Object.freeze({
  listIntegrations: () =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_LIST),
  getIntegration: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_GET, { integrationId: id }),
  connectIntegration: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_CONNECT, request),
  disconnectIntegration: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_DISCONNECT, request),
  checkHealth: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_HEALTH_CHECK, { integrationId: id })
})

const communicationApi: HelioxenCommunicationApi = Object.freeze({
  listMessages: (query?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_LIST_MESSAGES, query),
  getMessage: (messageId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_GET_MESSAGE, { messageId }),
  listDrafts: (channel?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_LIST_DRAFTS, { channel }),
  getDraft: (draftId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_GET_DRAFT, { draftId }),
  createDraft: (draft: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_CREATE_DRAFT, draft),
  updateDraft: (draftId: string, patch: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_UPDATE_DRAFT, { draftId, updates: patch }),
  deleteDraft: (draftId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_DELETE_DRAFT, { draftId }),
  requestSendConfirmation: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_REQUEST_SEND_CONFIRMATION, request),
  confirmAndSend: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_CONFIRM_AND_SEND, request),
  generateAiDraft: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMUNICATION_GENERATE_AI_DRAFT, request)
})

const mediaIntegrationApi: HelioxenMediaIntegrationsApi = Object.freeze({
  searchCatalog: (query: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_INTEGRATION_SEARCH, query),
  listPlaylists: (integrationId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_INTEGRATION_LIST_PLAYLISTS, { integrationId }),
  listDevices: (integrationId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_INTEGRATION_LIST_DEVICES, { integrationId }),
  getPlaybackState: (integrationId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_INTEGRATION_GET_PLAYBACK_STATE, { integrationId }),
  executeControl: (command: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_INTEGRATION_CONTROL_PLAYBACK, command)
})

const devicesApi: HelioxenDevicesApi = Object.freeze({
  listAndroid: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICES_LIST_ANDROID),
  getAndroidStatus: (deviceId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICES_GET_ANDROID_STATUS, { deviceId }),
  pairAndroid: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICES_PAIR_ANDROID, request),
  disconnectAndroid: (deviceId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICES_DISCONNECT_ANDROID, { deviceId }),
  executeAndroidAction: (command: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICES_EXECUTE_ANDROID_ACTION, command)
})

const smartHomeApi: HelioxenSmartHomeApi = Object.freeze({
  getHubStatus: (hubId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_GET_HUB_STATUS, { hubId }),
  connectHub: (params: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_CONNECT_HUB, params),
  disconnectHub: (hubId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_DISCONNECT_HUB, { hubId }),
  listEntities: (query?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_LIST_ENTITIES, query),
  getEntityState: (entityId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_GET_ENTITY_STATE, { entityId }),
  requestSecurityConfirmation: (params: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_REQUEST_SECURITY_CONFIRMATION, params),
  executeAction: (command: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SMART_HOME_EXECUTE_ACTION, command)
})

const recoveryApi: HelioxenRecoveryApi = Object.freeze({
  getStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_GET_STATUS),
  listBackups: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_LIST_BACKUPS),
  createBackup: (request?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_CREATE_BACKUP, request),
  verifyBackup: (backupId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_VERIFY_BACKUP, { backupId }),
  getRestorePreview: (backupId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_RESTORE_PREVIEW, { backupId }),
  executeRestore: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_EXECUTE_RESTORE, request),
  runDiagnostics: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_RUN_DIAGNOSTICS),
  executeRepair: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_EXECUTE_REPAIR, request)
})

const helioxenApi: HelioxenApi = Object.freeze({
  platform: process.platform,
  environment: process.env.NODE_ENV || 'development',
  version: '0.1.0-alpha.1',
  window: windowApi,
  ai: aiApi,
  credentials: credentialsApi,
  models: modelsApi,
  preferences: preferencesApi,
  health: healthApi,
  routing: routingApi,
  audio: audioApi,
  voice: voiceApi,
  capture: captureApi,
  documents: documentsApi,
  tools: toolsApi,
  orchestration: orchestrationApi,
  telemetry: telemetryApi,
  filesystem: filesystemApi,
  clipboard: clipboardApi,
  desktop: desktopApi,
  browser: browserApi,
  research: researchApi,
  memory: memoryApi,
  productivity: productivityApi,
  media: mediaLibraryApi,
  visual: visualHubApi,
  world: worldMonitorApi,
  widgets: widgetsApi,
  agents: agentsApi,
  office: officeApi,
  integrations: integrationsApi,
  communication: communicationApi,
  mediaIntegration: mediaIntegrationApi,
  devices: devicesApi,
  smartHome: smartHomeApi,
  recovery: recoveryApi
})

try {
  contextBridge.exposeInMainWorld('helioxen', helioxenApi)
} catch (error) {
  console.error('[Preload] Context bridge initialization failed:', error)
}
