import { app, BrowserWindow, shell, session, ipcMain, IpcMainInvokeEvent, systemPreferences, desktopCapturer, dialog } from 'electron'
import path, { join } from 'path'
import * as fs from 'fs'
import {
  IPC_CHANNELS,
  IpcException,
  validateIpcPayload,
  WindowMinimizeRequestSchema,
  WindowMaximizeRequestSchema,
  WindowCloseRequestSchema,
  WindowIsMaximizedRequestSchema,
  WindowMaximizedChangeEventSchema
} from '../shared/ipc'
import {
  AiGenerationRequestSchema,
  CredentialSetRequestSchema,
  CredentialDeleteRequestSchema,
  CredentialTestRequestSchema,
  ModelRefreshRequestSchema,
  UserAiPreferencesSchema,
  TASK_DEFINITIONS
} from '../shared/ai'
import { UserVoicePreferencesSchema } from '../shared/voice/contracts'
import { DesktopSourcesRequestSchema } from '../shared/capture/contracts'
import {
  SelectFilesRequestSchema,
  ExtractFileRequestSchema,
  detectDocumentFormat,
  DEFAULT_DOCUMENT_LIMITS,
  FileAttachment
} from '../shared/documents'
import {
  SystemHealthRequestSchema,
  InstalledAppsRequestSchema,
  WindowDiscoveryRequestSchema
} from '../shared/telemetry'
import {
  DirectoryListingRequestSchema,
  FileSearchRequestSchema,
  ReadTextFileRequestSchema,
  CreateFileRequestSchema,
  CopyFileRequestSchema,
  MoveFileRequestSchema,
  OrganizationPlanRequestSchema,
  OrganizationApplyRequestSchema,
  OrganizationUndoRequestSchema,
  ClipboardWriteTextRequestSchema
} from '../shared/filesystem'
import {
  TargetWindowReferenceSchema,
  KeyboardActionRequestSchema,
  TextEntryRequestSchema,
  MouseClickRequestSchema,
  MouseScrollRequestSchema,
  UndoInteractionRequestSchema,
  SystemOpenPathRequestSchema,
  SystemShowInFolderRequestSchema,
  SystemOpenUrlRequestSchema
} from '../shared/interaction'
import {
  CreateSessionRequestSchema,
  CreateTabRequestSchema,
  NavigateTabRequestSchema,
  SwitchTabRequestSchema,
  CloseTabRequestSchema,
  TabActionRequestSchema,
  ClearSessionDataRequestSchema,
  SetBrowserViewBoundsRequestSchema,
  InspectPageRequestSchema,
  ClickElementRequestSchema,
  ScrollPageRequestSchema,
  FillFieldRequestSchema,
  SelectOptionRequestSchema,
  ReviewFormRequestSchema,
  SubmitFormRequestSchema,
  ApproveDownloadRequestSchema,
  CancelDownloadRequestSchema
} from '../shared/browser'
import {
  desktopInteractionManager,
  systemOperationManager
} from './interaction'
import {
  browserSessionManager,
  browserTabManager,
  browserAgentManager,
  browserDownloadManager
} from './browser'
import {
  ResearchSearchQuerySchema,
  ResearchExtractionRequestSchema,
  BrowserScreenshotRequestSchema,
  ValidateCitationsRequestSchema
} from '../shared/research'
import {
  webSearchService,
  webPageExtractor,
  browserScreenshotService,
  researchCollectionManager
} from './research'
import { authorizer, securityLogger, CredentialStorageService } from './security'
import { ProviderService, ModelRegistry, PreferencesStorage } from './ai'
import { VoicePreferencesStorage } from './voice/VoicePreferencesStorage'
import { DocumentExtractionService } from './documents'
import { mainToolRegistry } from './tools'
import { mainTaskPlanner, mainExecutionEngine } from './orchestration'
import {
  systemTelemetryManager,
  installedAppDiscoveryManager,
  windowDiscoveryManager
} from './telemetry'
import {
  fileOperationsManager,
  fileOrganizationManager,
  clipboardManager
} from './filesystem'

// Global window reference
let mainWindow: BrowserWindow | null = null
let providerService: ProviderService | null = null
let modelRegistry: ModelRegistry | null = null
let preferencesStorage: PreferencesStorage | null = null
let voicePreferencesStorage: VoicePreferencesStorage | null = null
let documentExtractionService: DocumentExtractionService | null = null
let activeStreamAbortController: AbortController | null = null

export function getDocumentExtractionService(): DocumentExtractionService {
  if (!documentExtractionService) {
    documentExtractionService = new DocumentExtractionService()
  }
  return documentExtractionService
}

export function getModelRegistry(): ModelRegistry {
  if (!modelRegistry) {
    modelRegistry = new ModelRegistry(join(app.getPath('userData'), 'model_catalog.json'))
  }
  return modelRegistry
}

export function getPreferencesStorage(): PreferencesStorage {
  if (!preferencesStorage) {
    preferencesStorage = new PreferencesStorage(
      join(app.getPath('userData'), 'ai_preferences.json'),
      getModelRegistry()
    )
  }
  return preferencesStorage
}

export function getVoicePreferencesStorage(): VoicePreferencesStorage {
  if (!voicePreferencesStorage) {
    voicePreferencesStorage = new VoicePreferencesStorage(
      join(app.getPath('userData'), 'voice_preferences.json')
    )
  }
  return voicePreferencesStorage
}

export function getProviderService(): ProviderService {
  if (!providerService) {
    const credentialStorage = new CredentialStorageService(
      join(app.getPath('userData'), 'credentials.json')
    )
    providerService = new ProviderService(
      credentialStorage,
      undefined,
      getModelRegistry(),
      undefined,
      getPreferencesStorage()
    )
  }
  return providerService
}

// Enforce single instance lock to prevent multi-process window race conditions
const hasSingleInstanceLock = typeof app?.requestSingleInstanceLock === 'function'
  ? app.requestSingleInstanceLock()
  : true

if (!hasSingleInstanceLock && typeof app?.quit === 'function') {
  app.quit()
} else if (typeof app?.on === 'function') {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

/**
 * Validates that an external URL protocol is safe before dispatching to the OS shell.
 * Restricts strictly to http: and https: to prevent protocol handler exploits.
 */
function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Validates that an IPC request originates strictly from the authorized top-level main window frame.
 * Throws a normalized IpcException if sender or frame validation fails.
 */
export function assertValidSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new IpcException(
      'OPERATION_UNAVAILABLE',
      'Primary application window is unavailable or destroyed'
    )
  }
  // Verify sender webContents matches authorized mainWindow
  if (event.sender.id !== mainWindow.webContents.id) {
    throw new IpcException(
      'UNAUTHORIZED_SENDER',
      'IPC invocation rejected: Unauthorized sender WebContents ID'
    )
  }
  // Verify request originates from top-level main frame (reject child iframes or subframes)
  if (event.senderFrame && event.senderFrame.parent) {
    throw new IpcException(
      'UNAUTHORIZED_FRAME',
      'IPC invocation rejected: Requests from child frames or iframes are prohibited'
    )
  }
}

/**
 * Register native window-control IPC handlers with runtime validation and sender checks.
 */
export function registerWindowIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (event, payload) => {
    assertValidSender(event)
    validateIpcPayload(WindowMinimizeRequestSchema, payload)
    authorizer.authorize('window:minimize', { requester: 'renderer-main-window' })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, (event, payload) => {
    assertValidSender(event)
    validateIpcPayload(WindowMaximizeRequestSchema, payload)
    authorizer.authorize('window:maximize', { requester: 'renderer-main-window' })
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event, payload) => {
    assertValidSender(event)
    validateIpcPayload(WindowCloseRequestSchema, payload)
    authorizer.authorize('window:close', { requester: 'renderer-main-window' })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close()
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event, payload): boolean => {
    assertValidSender(event)
    validateIpcPayload(WindowIsMaximizedRequestSchema, payload)
    authorizer.authorize('window:isMaximized', { requester: 'renderer-main-window' })
    if (!mainWindow || mainWindow.isDestroyed()) return false
    return mainWindow.isMaximized()
  })
}

/**
 * Register AI Provider and Secure Credential Management IPC handlers.
 */
export function registerAiAndCredentialIpcHandlers(): void {
  const service = getProviderService()

  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_TEXT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('ai:chat', { requester: 'renderer-main-window' })
    const request = validateIpcPayload(AiGenerationRequestSchema, payload)

    activeStreamAbortController = new AbortController()
    const signal = activeStreamAbortController.signal

    if (request.stream) {
      return service.streamText(
        request,
        (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk)
          }
        },
        signal
      )
    }

    return service.generateText(request, signal)
  })

  ipcMain.handle(IPC_CHANNELS.AI_CANCEL, (event) => {
    assertValidSender(event)
    if (activeStreamAbortController) {
      activeStreamAbortController.abort()
      activeStreamAbortController = null
    }
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS_SET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('credentials:set', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CredentialSetRequestSchema, payload)
    await service.setCredential(valid.provider, valid.apiKey, valid.label)
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS_GET_STATUS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('credentials:getStatus', { requester: 'renderer-main-window' })
    return service.getCredentialStatus()
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS_DELETE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('credentials:delete', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CredentialDeleteRequestSchema, payload)
    return service.deleteCredential(valid.provider)
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS_TEST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('credentials:test', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CredentialTestRequestSchema, payload)
    return service.testConnection(valid.provider)
  })

  ipcMain.handle(IPC_CHANNELS.MODELS_GET_CATALOG, async (event) => {
    assertValidSender(event)
    authorizer.authorize('models:getCatalog', { requester: 'renderer-main-window' })
    return service.getModelCatalog()
  })

  ipcMain.handle(IPC_CHANNELS.MODELS_REFRESH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('models:refresh', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ModelRefreshRequestSchema, payload)
    return service.refreshCatalog(valid.provider)
  })

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async (event) => {
    assertValidSender(event)
    authorizer.authorize('preferences:get', { requester: 'renderer-main-window' })
    return getPreferencesStorage().getPreferences()
  })

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('preferences:set', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(UserAiPreferencesSchema, payload)
    return getPreferencesStorage().setPreferences(valid)
  })

  ipcMain.handle(IPC_CHANNELS.HEALTH_GET_STATUS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('health:getStatus', { requester: 'renderer-main-window' })
    return service.getHealthStatus()
  })

  ipcMain.handle(IPC_CHANNELS.ROUTING_GET_TASK_DEFINITIONS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('routing:getTaskDefinitions', { requester: 'renderer-main-window' })
    return TASK_DEFINITIONS
  })

  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_PERMISSION_STATUS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('audio:getPermissionStatus', { requester: 'renderer-main-window' })
    try {
      if (typeof systemPreferences.getMediaAccessStatus === 'function') {
        const status = systemPreferences.getMediaAccessStatus('microphone')
        return status
      }
      return 'unknown'
    } catch {
      return 'unknown'
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_DEVICES, async (event) => {
    assertValidSender(event)
    authorizer.authorize('audio:getDevices', { requester: 'renderer-main-window' })
    return []
  })

  ipcMain.handle(IPC_CHANNELS.VOICE_PREFERENCES_GET, async (event) => {
    assertValidSender(event)
    authorizer.authorize('voice:preferencesGet', { requester: 'renderer-main-window' })
    return getVoicePreferencesStorage().getPreferences()
  })

  ipcMain.handle(IPC_CHANNELS.VOICE_PREFERENCES_SET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('voice:preferencesSet', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(UserVoicePreferencesSchema, payload)
    return getVoicePreferencesStorage().setPreferences(valid)
  })

  ipcMain.handle(IPC_CHANNELS.CAPTURE_GET_DESKTOP_SOURCES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('capture:getSources', {
      requester: 'renderer-main-window',
      consentRequestId: payload?.consentRequestId || 'engine_approved_ui_picker'
    })
    const valid = validateIpcPayload(DesktopSourcesRequestSchema, payload || { types: ['screen', 'window'] })
    try {
      const sources = await desktopCapturer.getSources({
        types: valid.types,
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      })
      return sources.map((src) => ({
        id: src.id,
        name: src.name,
        thumbnailDataUrl: src.thumbnail ? src.thumbnail.toDataURL() : undefined,
        displayId: src.display_id,
        isAppWindow: src.id.startsWith('window:')
      }))
    } catch (err) {
      console.warn('[Main] Failed to enumerate desktop display sources:', err)
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.CAPTURE_CHECK_PERMISSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('capture:checkPermission', { requester: 'renderer-main-window' })
    try {
      const targetType = payload?.sourceType === 'screen' ? 'screen' : 'camera'
      if (typeof systemPreferences.getMediaAccessStatus === 'function') {
        const status = systemPreferences.getMediaAccessStatus(targetType)
        return status
      }
      return 'granted'
    } catch {
      return 'unsupported'
    }
  })

  // Document Extraction & File Attachment Operations (Renderer -> Main, Phase 8 Step 23)
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_SELECT_FILES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('documents:select', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SelectFilesRequestSchema, payload || {})

    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select Supported Document or Image Files',
      properties: valid.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        { name: 'All Supported Files', extensions: ['txt', 'md', 'pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
      ]
    })

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return []
    }

    const selectedPaths = result.filePaths.slice(0, valid.maxCount)
    const attachments: FileAttachment[] = []

    for (const filePath of selectedPaths) {
      try {
        const stat = await fs.promises.stat(filePath)
        const fileName = path.basename(filePath)
        const format = detectDocumentFormat(fileName) || 'txt'
        let imagePreviewUrl: string | undefined

        if (format === 'image' && stat.size <= 4 * 1024 * 1024) {
          const buf = await fs.promises.readFile(filePath)
          const ext = path.extname(fileName).toLowerCase().replace('.', '')
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
          imagePreviewUrl = `data:${mime};base64,${buf.toString('base64')}`
        }

        const isOversized = stat.size > DEFAULT_DOCUMENT_LIMITS.maxFileSizeBytes

        attachments.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: fileName,
          format,
          mimeType: format === 'image' ? (path.extname(fileName).toLowerCase().includes('png') ? 'image/png' : 'image/jpeg') : 'application/octet-stream',
          sizeBytes: stat.size,
          status: isOversized ? 'validation-failed' : 'selected',
          imagePreviewUrl,
          errorDetails: isOversized ? {
            code: 'PAYLOAD_OVERSIZED',
            message: `File exceeds 10MB limit (${Math.round(stat.size / (1024 * 1024))}MB)`,
            recoverable: false
          } : undefined,
          timestamp: Date.now(),
          filePath
        })
      } catch (err) {
        console.warn('[Main] Failed to process selected file path:', filePath, err)
      }
    }

    return attachments
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_EXTRACT_FILE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('documents:extract', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ExtractFileRequestSchema, payload)
    const service = getDocumentExtractionService()

    return service.extract(
      valid.attachmentId,
      valid.fileName,
      valid.filePath || valid.fileBuffer!,
      valid.format
    )
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_VALIDATE_FILE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('documents:validate', { requester: 'renderer-main-window' })
    const service = getDocumentExtractionService()
    return service.validate(payload?.name, payload?.sizeBytes, payload?.mimeType)
  })

  // Tool Registry Handlers (Phase 9 Step 25)
  ipcMain.handle(IPC_CHANNELS.TOOLS_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('tools:list', { requester: 'renderer-main-window' })
    return mainToolRegistry.list(payload)
  })

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('tools:get', { requester: 'renderer-main-window' })
    if (!payload?.id) return null
    return mainToolRegistry.getMetadata(payload.id) || null
  })

  ipcMain.handle(IPC_CHANNELS.TOOLS_VALIDATE_INPUT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('tools:validate', { requester: 'renderer-main-window' })
    return mainToolRegistry.validateInput(payload?.id, payload?.input)
  })

  // Task Planner & Agent Orchestration Handlers (Phase 9 Step 26-27)
  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_PLAN, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('orchestration:plan', { requester: 'renderer-main-window' })
    return mainTaskPlanner.planTask(payload)
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_EXECUTE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('orchestration:execute', { requester: 'renderer-main-window' })
    const approvedConfirmations = payload?.approvedConfirmations
      ? new Set<string>(payload.approvedConfirmations)
      : undefined
    return mainExecutionEngine.executePlan(payload?.plan, { approvedConfirmations })
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_CANCEL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('orchestration:cancel', { requester: 'renderer-main-window' })
    return mainExecutionEngine.requestCancellation(payload?.taskId, payload?.reason)
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_GET_AUDIT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('orchestration:audit', { requester: 'renderer-main-window' })
    return mainExecutionEngine.getTaskAudit(payload?.taskId)
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_GET_TASK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('orchestration:plan', { requester: 'renderer-main-window' })
    return mainExecutionEngine.getTask(payload?.taskId) || null
  })

  // System Telemetry & Desktop Awareness Handlers (Phase 10 Step 28)
  ipcMain.handle(IPC_CHANNELS.TELEMETRY_GET_SYSTEM_HEALTH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('telemetry:readSystemHealth', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SystemHealthRequestSchema, payload || {})
    return await systemTelemetryManager.getSystemHealth(valid)
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_GET_INSTALLED_APPS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('telemetry:readInstalledApps', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(InstalledAppsRequestSchema, payload || {})
    return await installedAppDiscoveryManager.getInstalledApps(valid)
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_SEARCH_INSTALLED_APPS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('telemetry:readInstalledApps', { requester: 'renderer-main-window' })
    return await installedAppDiscoveryManager.searchInstalledApps(payload?.query || '', payload?.limit)
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_GET_DESKTOP_WINDOWS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('telemetry:readDesktopWindows', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(WindowDiscoveryRequestSchema, payload || {})
    return await windowDiscoveryManager.getDesktopWindows(valid)
  })

  // Filesystem & Clipboard Operations Handlers (Phase 10 Step 29)
  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_LIST_DIRECTORY, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:read', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(DirectoryListingRequestSchema, payload || {})
    return await fileOperationsManager.listDirectory(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_GET_METADATA, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:read', { requester: 'renderer-main-window' })
    if (!payload?.rootPath || !payload?.filePath) throw new Error('rootPath and filePath required')
    return await fileOperationsManager.getFileMetadata(payload.rootPath, payload.filePath)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_SEARCH_FILES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:read', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(FileSearchRequestSchema, payload || {})
    return await fileOperationsManager.searchFiles(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_READ_TEXT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:read', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ReadTextFileRequestSchema, payload || {})
    return await fileOperationsManager.readTextFile(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_CREATE_FILE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:write', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CreateFileRequestSchema, payload || {})
    return await fileOperationsManager.createFile(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_COPY_FILE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:write', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CopyFileRequestSchema, payload || {})
    return await fileOperationsManager.copyFile(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_MOVE_FILE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:write', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(MoveFileRequestSchema, payload || {})
    return await fileOperationsManager.moveFile(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_ORGANIZE_PREVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:read', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(OrganizationPlanRequestSchema, payload || {})
    return await fileOrganizationManager.createOrganizationPlan(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_ORGANIZE_APPLY, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:organize', {
      requester: 'renderer-main-window',
      consentRequestId: payload?.consentRequestId || (payload?.planId ? `engine_approved_${payload.planId}` : undefined)
    })
    const valid = validateIpcPayload(OrganizationApplyRequestSchema, payload || {})
    return await fileOrganizationManager.applyOrganizationPlan(valid)
  })

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_ORGANIZE_UNDO, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('filesystem:organize', {
      requester: 'renderer-main-window',
      consentRequestId: payload?.consentRequestId || (payload?.manifestId ? `engine_approved_${payload.manifestId}` : undefined)
    })
    const valid = validateIpcPayload(OrganizationUndoRequestSchema, payload || {})
    return await fileOrganizationManager.undoOrganization(valid)
  })

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ_TEXT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('clipboard:read', { requester: 'renderer-main-window' })
    return clipboardManager.readText(payload?.maxChars)
  })

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('clipboard:write', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ClipboardWriteTextRequestSchema, payload || {})
    return clipboardManager.writeText(valid)
  })

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ_IMAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('clipboard:read', { requester: 'renderer-main-window' })
    return clipboardManager.readImage(payload?.maxBytes)
  })

  // Desktop Interaction & System Operations Handlers (Phase 10 Step 30)
  ipcMain.handle(IPC_CHANNELS.DESKTOP_FOCUS_WINDOW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('desktop:focusWindow', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(TargetWindowReferenceSchema, payload?.target || {})
    return await desktopInteractionManager.focusWindow(valid)
  })

  ipcMain.handle(IPC_CHANNELS.DESKTOP_EXECUTE_KEYBOARD, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('desktop:keyAction', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(KeyboardActionRequestSchema, payload || {})
    return await desktopInteractionManager.sendKeyAction(valid)
  })

  ipcMain.handle(IPC_CHANNELS.DESKTOP_SEND_TEXT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('desktop:sendText', {
      requester: 'renderer-main-window',
      consentRequestId: payload?.consentRequestId
    })
    const valid = validateIpcPayload(TextEntryRequestSchema, payload || {})
    return await desktopInteractionManager.sendText(valid)
  })

  ipcMain.handle(IPC_CHANNELS.DESKTOP_EXECUTE_MOUSE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('desktop:mouseAction', { requester: 'renderer-main-window' })
    if (payload?.x !== undefined || payload?.button !== undefined || payload?.clickCount !== undefined) {
      const valid = validateIpcPayload(MouseClickRequestSchema, payload || {})
      return await desktopInteractionManager.sendClick(valid)
    }
    const valid = validateIpcPayload(MouseScrollRequestSchema, payload || {})
    return await desktopInteractionManager.sendScroll(valid)
  })

  ipcMain.handle(IPC_CHANNELS.DESKTOP_EMERGENCY_STOP, async (event) => {
    assertValidSender(event)
    authorizer.authorize('desktop:emergencyStop', { requester: 'renderer-main-window' })
    return desktopInteractionManager.emergencyStop()
  })

  ipcMain.handle(IPC_CHANNELS.DESKTOP_UNDO_LAST_ACTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('desktop:undo', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(UndoInteractionRequestSchema, payload || {})
    return await desktopInteractionManager.undoLastAction(valid)
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_PATH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('system:openPath', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SystemOpenPathRequestSchema, payload || {})
    return await systemOperationManager.openPath(valid)
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SHOW_IN_FOLDER, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('system:showInFolder', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SystemShowInFolderRequestSchema, payload || {})
    return await systemOperationManager.showInFolder(valid)
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_URL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('system:openExternalUrl', {
      requester: 'renderer-main-window',
      consentRequestId: payload?.consentRequestId
    })
    const valid = validateIpcPayload(SystemOpenUrlRequestSchema, payload || {})
    return await systemOperationManager.openExternalUrl(valid)
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_ALERT_BEEP, async (event) => {
    assertValidSender(event)
    authorizer.authorize('system:systemAlert', { requester: 'renderer-main-window' })
    return systemOperationManager.systemAlertBeep()
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_DISPLAY_METRICS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('system:getDisplayMetrics', { requester: 'renderer-main-window' })
    return systemOperationManager.getDisplayMetrics()
  })

  // Browser Services, Sessions & Tab Handlers (Phase 11 Step 31)
  ipcMain.handle(IPC_CHANNELS.BROWSER_CREATE_SESSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:createSession', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CreateSessionRequestSchema, payload || {})
    return browserSessionManager.createSession(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_LIST_SESSIONS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('browser:createSession', { requester: 'renderer-main-window' })
    return browserSessionManager.listSessions()
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE_SESSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:closeSession', { requester: 'renderer-main-window' })
    return browserSessionManager.closeSession(payload?.sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_CLEAR_SESSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:clearSession', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ClearSessionDataRequestSchema, payload || {})
    return await browserSessionManager.clearSessionData(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_CREATE_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CreateTabRequestSchema, payload || {})
    return await browserTabManager.createTab(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_NAVIGATE_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:navigate', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(NavigateTabRequestSchema, payload || {})
    return await browserTabManager.navigateTab(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_SWITCH_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SwitchTabRequestSchema, payload || {})
    return browserTabManager.switchTab(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CloseTabRequestSchema, payload || {})
    return browserTabManager.closeTab(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_GET_TAB_STATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(TabActionRequestSchema, payload || {})
    return browserTabManager.getTabState(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_LIST_TABS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    return { tabs: browserTabManager.listTabs(payload?.sessionId) }
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_RELOAD_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(TabActionRequestSchema, payload || {})
    return browserTabManager.reloadTab(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_STOP_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(TabActionRequestSchema, payload || {})
    return browserTabManager.stopTab(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_BACK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(TabActionRequestSchema, payload || {})
    return browserTabManager.goBack(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_FORWARD, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(TabActionRequestSchema, payload || {})
    return browserTabManager.goForward(valid.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_BOUNDS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:manageTabs', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SetBrowserViewBoundsRequestSchema, payload || {})
    browserTabManager.setBounds(valid.bounds)
    return { success: true }
  })

  // Web Research, Content Extraction, Screenshots & Provenance (Phase 11 Step 32)
  ipcMain.handle(IPC_CHANNELS.RESEARCH_SEARCH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:webSearch', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ResearchSearchQuerySchema, payload)
    return await webSearchService.search(valid)
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_EXTRACT_TAB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:extractContent', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ResearchExtractionRequestSchema, payload)
    const record = await webPageExtractor.extractTabContent(valid)
    if (payload?.conversationId) {
      researchCollectionManager.addSourceRecord(payload.conversationId, record)
    }
    return record
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_EXTRACT_URL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:extractContent', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ResearchExtractionRequestSchema, payload)
    const record = await webPageExtractor.extractTabContent(valid)
    if (payload?.conversationId) {
      researchCollectionManager.addSourceRecord(payload.conversationId, record)
    }
    return record
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_CAPTURE_SCREENSHOT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:captureScreenshot', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(BrowserScreenshotRequestSchema, payload)
    const record = await browserScreenshotService.captureTabScreenshot(valid)
    if (payload?.conversationId) {
      researchCollectionManager.addScreenshotRecord(payload.conversationId, record)
    }
    return record
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_DISCARD_SCREENSHOT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:captureScreenshot', { requester: 'renderer-main-window' })
    return browserScreenshotService.discardScreenshot(payload?.screenshotId)
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_GET_COLLECTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:manageResults', { requester: 'renderer-main-window' })
    return researchCollectionManager.getOrCreateCollection(payload?.conversationId)
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_UPDATE_SOURCE_INCLUSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:manageResults', { requester: 'renderer-main-window' })
    return researchCollectionManager.setSourceInclusion(
      payload?.conversationId,
      payload?.sourceId,
      Boolean(payload?.included)
    )
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_CLEAR_COLLECTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:manageResults', { requester: 'renderer-main-window' })
    return researchCollectionManager.manageCollection({
      conversationId: payload?.conversationId,
      action: 'clear'
    })
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_VALIDATE_CITATIONS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('research:manageResults', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ValidateCitationsRequestSchema, payload)
    return researchCollectionManager.validateCitations(valid)
  })

  // Browser Agent Automation, Safe Navigation, Form Interaction, and Download Policies (Phase 11 Step 33)
  ipcMain.handle(IPC_CHANNELS.BROWSER_INSPECT_PAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:inspectPage', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(InspectPageRequestSchema, payload || {})
    return await browserAgentManager.inspectPage(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_CLICK_ELEMENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:interact', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ClickElementRequestSchema, payload || {})
    return await browserAgentManager.clickElement(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_SCROLL_PAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:interact', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ScrollPageRequestSchema, payload || {})
    return await browserAgentManager.scrollPage(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_FILL_FIELD, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:fillForm', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(FillFieldRequestSchema, payload || {})
    return await browserAgentManager.fillField(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_SELECT_OPTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:fillForm', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(SelectOptionRequestSchema, payload || {})
    return await browserAgentManager.selectOption(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_REVIEW_FORM, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:inspectPage', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ReviewFormRequestSchema, payload || {})
    return await browserAgentManager.reviewForm(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_SUBMIT_FORM, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:submitForm', {
      requester: 'renderer-main-window',
      consentRequestId:
        payload?.consentRequestId ||
        (payload?.confirmationToken ? `engine_approved_${payload.confirmationToken}` : undefined)
    })
    const valid = validateIpcPayload(SubmitFormRequestSchema, payload || {})
    return await browserAgentManager.submitForm(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_LIST_DOWNLOADS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('browser:download', { requester: 'renderer-main-window' })
    return browserDownloadManager.listDownloads()
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_APPROVE_DOWNLOAD, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:download', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(ApproveDownloadRequestSchema, payload || {})
    return browserDownloadManager.approveDownload(valid)
  })

  ipcMain.handle(IPC_CHANNELS.BROWSER_CANCEL_DOWNLOAD, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('browser:download', { requester: 'renderer-main-window' })
    const valid = validateIpcPayload(CancelDownloadRequestSchema, payload || {})
    return browserDownloadManager.cancelDownload(valid)
  })
}

/**
 * Construct and configure the primary secure application window.
 */
function createWindow(): void {
  // Enforce secure Content Security Policy on all web responses
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data: blob:; connect-src 'self' ws://localhost:* http://localhost:*;"
        ]
      }
    })
  })

  // Permission handling: strictly allow user-authorized audio and video capture for main window
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isMainWindow = Boolean(
      mainWindow && !mainWindow.isDestroyed() && webContents && webContents.id === mainWindow.webContents.id
    )
    if (isMainWindow && permission === 'media') {
      const mediaTypes = details && 'mediaTypes' in details ? details.mediaTypes : undefined
      const isMediaPermitted =
        !mediaTypes ||
        mediaTypes.includes('audio') ||
        mediaTypes.includes('video')
      if (isMediaPermitted) {
        securityLogger.logEvent('PERMISSION_REQUEST', 'session-default', 'PERMITTED', {
          permission,
          mediaTypes,
          reason: 'User-authorized media capture for HELIOXEN (Phase 7 voice & Phase 8 camera/screen)'
        })
        callback(true)
        return
      }
    }

    securityLogger.logEvent('PERMISSION_REQUEST', 'session-default', 'DENIED', {
      permission,
      reason: 'Unauthorized permission request blocked by security policy'
    })
    callback(false)
  })

  // Synchronous permission check
  session.defaultSession.setPermissionCheckHandler((webContents, permission, _origin, details) => {
    const isMainWindow = Boolean(
      mainWindow && !mainWindow.isDestroyed() && webContents && webContents.id === mainWindow.webContents.id
    )
    if (isMainWindow && permission === 'media') {
      const mediaType = details && 'mediaType' in details ? details.mediaType : undefined
      if (!mediaType || mediaType === 'audio' || mediaType === 'video') {
        return true
      }
    }
    return false
  })

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false, // Frameless window enabling custom HELIOXEN titlebar
    autoHideMenuBar: true,
    backgroundColor: '#070a10',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  // Synchronize native window maximize / restore events with renderer using validated event contract
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      validateIpcPayload(WindowMaximizedChangeEventSchema, true)
      mainWindow.webContents.send(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE, true)
    }
  })

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      validateIpcPayload(WindowMaximizedChangeEventSchema, false)
      mainWindow.webContents.send(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE, false)
    }
  })

  // Clear window reference when destroyed to prevent stale pointer leaks
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Block creation of arbitrary child windows / popups; route safe URLs to OS browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // Prevent in-app navigation away from authorized origin
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDevUrl = navigationUrl.startsWith('http://localhost:5173')
    const isFileUrl = navigationUrl.startsWith('file:')

    if (!isDevUrl && !isFileUrl) {
      event.preventDefault()
      if (isSafeExternalUrl(navigationUrl)) {
        shell.openExternal(navigationUrl)
      }
    }
  })

  // Load the remote dev server URL or local production HTML bundle
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await getModelRegistry().initialize()
  await getPreferencesStorage().initialize()
  await getVoicePreferencesStorage().initialize()
  registerWindowIpcHandlers()
  registerAiAndCredentialIpcHandlers()
  createWindow()

  // Forward agent progress events to the primary renderer window
  mainExecutionEngine.onProgress((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.ORCHESTRATION_PROGRESS_EVENT, event)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_MINIMIZE)
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_MAXIMIZE)
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_CLOSE)
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_IS_MAXIMIZED)
  ipcMain.removeHandler(IPC_CHANNELS.AI_GENERATE_TEXT)
  ipcMain.removeHandler(IPC_CHANNELS.AI_CANCEL)
  ipcMain.removeHandler(IPC_CHANNELS.CREDENTIALS_SET)
  ipcMain.removeHandler(IPC_CHANNELS.CREDENTIALS_GET_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.CREDENTIALS_DELETE)
  ipcMain.removeHandler(IPC_CHANNELS.CREDENTIALS_TEST)
  ipcMain.removeHandler(IPC_CHANNELS.MODELS_GET_CATALOG)
  ipcMain.removeHandler(IPC_CHANNELS.MODELS_REFRESH)
  ipcMain.removeHandler(IPC_CHANNELS.PREFERENCES_GET)
  ipcMain.removeHandler(IPC_CHANNELS.PREFERENCES_SET)
  ipcMain.removeHandler(IPC_CHANNELS.HEALTH_GET_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.ROUTING_GET_TASK_DEFINITIONS)
  ipcMain.removeHandler(IPC_CHANNELS.AUDIO_GET_PERMISSION_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.AUDIO_GET_DEVICES)
  ipcMain.removeHandler(IPC_CHANNELS.VOICE_PREFERENCES_GET)
  ipcMain.removeHandler(IPC_CHANNELS.VOICE_PREFERENCES_SET)
  ipcMain.removeHandler(IPC_CHANNELS.CAPTURE_GET_DESKTOP_SOURCES)
  ipcMain.removeHandler(IPC_CHANNELS.CAPTURE_CHECK_PERMISSION)
  ipcMain.removeHandler(IPC_CHANNELS.DOCUMENTS_SELECT_FILES)
  ipcMain.removeHandler(IPC_CHANNELS.DOCUMENTS_EXTRACT_FILE)
  ipcMain.removeHandler(IPC_CHANNELS.DOCUMENTS_VALIDATE_FILE)
  ipcMain.removeHandler(IPC_CHANNELS.TOOLS_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.TOOLS_GET)
  ipcMain.removeHandler(IPC_CHANNELS.TOOLS_VALIDATE_INPUT)
  ipcMain.removeHandler(IPC_CHANNELS.ORCHESTRATION_PLAN)
  ipcMain.removeHandler(IPC_CHANNELS.ORCHESTRATION_EXECUTE)
  ipcMain.removeHandler(IPC_CHANNELS.ORCHESTRATION_CANCEL)
  ipcMain.removeHandler(IPC_CHANNELS.ORCHESTRATION_GET_AUDIT)
  ipcMain.removeHandler(IPC_CHANNELS.ORCHESTRATION_GET_TASK)
  ipcMain.removeHandler(IPC_CHANNELS.TELEMETRY_GET_SYSTEM_HEALTH)
  ipcMain.removeHandler(IPC_CHANNELS.TELEMETRY_GET_INSTALLED_APPS)
  ipcMain.removeHandler(IPC_CHANNELS.TELEMETRY_SEARCH_INSTALLED_APPS)
  ipcMain.removeHandler(IPC_CHANNELS.TELEMETRY_GET_DESKTOP_WINDOWS)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_LIST_DIRECTORY)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_GET_METADATA)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_SEARCH_FILES)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_READ_TEXT)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_CREATE_FILE)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_COPY_FILE)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_MOVE_FILE)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_ORGANIZE_PREVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_ORGANIZE_APPLY)
  ipcMain.removeHandler(IPC_CHANNELS.FILESYSTEM_ORGANIZE_UNDO)
  ipcMain.removeHandler(IPC_CHANNELS.CLIPBOARD_READ_TEXT)
  ipcMain.removeHandler(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT)
  ipcMain.removeHandler(IPC_CHANNELS.CLIPBOARD_READ_IMAGE)
  ipcMain.removeHandler(IPC_CHANNELS.DESKTOP_FOCUS_WINDOW)
  ipcMain.removeHandler(IPC_CHANNELS.DESKTOP_EXECUTE_KEYBOARD)
  ipcMain.removeHandler(IPC_CHANNELS.DESKTOP_SEND_TEXT)
  ipcMain.removeHandler(IPC_CHANNELS.DESKTOP_EXECUTE_MOUSE)
  ipcMain.removeHandler(IPC_CHANNELS.DESKTOP_EMERGENCY_STOP)
  ipcMain.removeHandler(IPC_CHANNELS.DESKTOP_UNDO_LAST_ACTION)
  ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_OPEN_PATH)
  ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_SHOW_IN_FOLDER)
  ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_OPEN_URL)
  ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_ALERT_BEEP)
  ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_GET_DISPLAY_METRICS)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CREATE_SESSION)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_LIST_SESSIONS)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CLOSE_SESSION)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CLEAR_SESSION)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CREATE_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_NAVIGATE_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SWITCH_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CLOSE_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GET_TAB_STATE)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_LIST_TABS)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_RELOAD_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_STOP_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GO_BACK)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GO_FORWARD)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SET_BOUNDS)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_SEARCH)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_EXTRACT_TAB)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_EXTRACT_URL)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_CAPTURE_SCREENSHOT)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_DISCARD_SCREENSHOT)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_GET_COLLECTION)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_UPDATE_SOURCE_INCLUSION)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_CLEAR_COLLECTION)
  ipcMain.removeHandler(IPC_CHANNELS.RESEARCH_VALIDATE_CITATIONS)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_INSPECT_PAGE)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CLICK_ELEMENT)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SCROLL_PAGE)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_FILL_FIELD)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SELECT_OPTION)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_REVIEW_FORM)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SUBMIT_FORM)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_LIST_DOWNLOADS)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_APPROVE_DOWNLOAD)
  ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CANCEL_DOWNLOAD)
})
