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
  HelioxenResearchApi
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
  research: researchApi
})

try {
  contextBridge.exposeInMainWorld('helioxen', helioxenApi)
} catch (error) {
  console.error('[Preload] Context bridge initialization failed:', error)
}
