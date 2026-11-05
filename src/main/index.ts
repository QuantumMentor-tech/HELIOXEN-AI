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
import { authorizer, securityLogger, CredentialStorageService, validateIpcSender, isSafeExternalUrl } from './security'
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
import { memoryService } from './memory'
import { productivityService } from './productivity'
import { mediaLibraryService } from './media'
import { visualHubService, setVisualHubProviderServiceGetter } from './visual'
import { sanitizeSuggestedFileName } from '../shared/visual'
import { worldMonitorService } from './world'
import {
  systemHealthService,
  networkMonitorService,
  weatherService,
  widgetPreferencesManager
} from './widgets'
import { agentTownService, setAgentTownProviderServiceGetter } from './agents'
import { OfficeService } from './office'
import { IntegrationsManager } from './integrations'
import { CommunicationService } from './communication'
import { MediaIntegrationService } from './media-integrations'
import { AndroidDeviceService } from './devices'
import { SmartHomeService } from './smart-home'
import { RecoveryService, getRecoveryService } from './recovery'

// Global window reference
let mainWindow: BrowserWindow | null = null
let providerService: ProviderService | null = null
let credentialStorageService: CredentialStorageService | null = null
let modelRegistry: ModelRegistry | null = null
let preferencesStorage: PreferencesStorage | null = null
let voicePreferencesStorage: VoicePreferencesStorage | null = null
let documentExtractionService: DocumentExtractionService | null = null
let officeService: OfficeService | null = null
let integrationsManager: IntegrationsManager | null = null
let communicationService: CommunicationService | null = null
let mediaIntegrationService: MediaIntegrationService | null = null
let androidDeviceService: AndroidDeviceService | null = null
let smartHomeService: SmartHomeService | null = null
let activeStreamAbortController: AbortController | null = null

export function getCredentialStorage(): CredentialStorageService {
  if (!credentialStorageService) {
    credentialStorageService = new CredentialStorageService(
      join(app.getPath('userData'), 'credentials.json')
    )
  }
  return credentialStorageService
}

export function getIntegrationsManager(): IntegrationsManager {
  if (!integrationsManager) {
    integrationsManager = new IntegrationsManager({
      storageDir: app.getPath('userData'),
      credentialStorage: getCredentialStorage()
    })
  }
  return integrationsManager
}

export function getCommunicationService(): CommunicationService {
  if (!communicationService) {
    communicationService = new CommunicationService({
      storageDir: app.getPath('userData'),
      integrationsManager: getIntegrationsManager(),
      providerServiceGetter: () => getProviderService()
    })
  }
  return communicationService
}

export function getMediaIntegrationService(): MediaIntegrationService {
  if (!mediaIntegrationService) {
    mediaIntegrationService = new MediaIntegrationService({
      integrationsManager: getIntegrationsManager()
    })
  }
  return mediaIntegrationService
}

export function getOfficeService(): OfficeService {
  if (!officeService) {
    officeService = new OfficeService({
      storageDir: app.getPath('userData'),
      providerServiceGetter: () => getProviderService()
    })
  }
  return officeService
}

export function getAndroidDeviceService(): AndroidDeviceService {
  if (!androidDeviceService) {
    androidDeviceService = new AndroidDeviceService({
      storageDir: app.getPath('userData')
    })
  }
  return androidDeviceService
}

export function getSmartHomeService(): SmartHomeService {
  if (!smartHomeService) {
    smartHomeService = new SmartHomeService({
      storageDir: app.getPath('userData'),
      credentialStorage: getCredentialStorage()
    })
  }
  return smartHomeService
}

export function getAppRecoveryService(): RecoveryService {
  return getRecoveryService(app.getPath('userData'))
}

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
    providerService = new ProviderService(
      getCredentialStorage(),
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
 * Validates that an IPC request originates strictly from the authorized top-level main window frame.
 * Throws a normalized IpcException if sender or frame validation fails.
 */
export function assertValidSender(event: IpcMainInvokeEvent): void {
  validateIpcSender(event, mainWindow)
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

  // User Profile, Long-Term Memory & Consent-Based Personalization (Phase 12 Step 34)
  ipcMain.handle(IPC_CHANNELS.MEMORY_GET_STATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:read', { requester: 'renderer-main-window' })
    return memoryService.getStateOverview(payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_SET_CONSENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:manageConsent', { requester: 'renderer-main-window' })
    return await memoryService.setConsent(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_UPDATE_PROFILE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:write', { requester: 'renderer-main-window' })
    return await memoryService.updateProfile(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_CREATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:write', { requester: 'renderer-main-window' })
    return await memoryService.createMemory(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:read', { requester: 'renderer-main-window' })
    return memoryService.listMemories(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_GET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:read', { requester: 'renderer-main-window' })
    return memoryService.getMemory(payload?.id, payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_UPDATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:write', { requester: 'renderer-main-window' })
    return await memoryService.updateMemory(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_DELETE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:delete', { requester: 'renderer-main-window' })
    return await memoryService.deleteMemory(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_CLEAR_ALL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:clearAll', {
      requester: 'renderer-main-window',
      consentRequestId:
        payload?.consentRequestId || (payload?.confirmClearAll ? 'engine_approved_clear_all_memories' : undefined)
    })
    return await memoryService.clearAllMemories(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_RETRIEVE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:read', { requester: 'renderer-main-window' })
    return memoryService.retrieveMemories(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_PROPOSE_SUGGESTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:write', { requester: 'renderer-main-window' })
    return memoryService.proposeSuggestion(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_RESOLVE_SUGGESTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('memory:write', { requester: 'renderer-main-window' })
    return await memoryService.resolveSuggestion(payload)
  })

  // Integrated Productivity System: Notes, Tasks, Reminders, Calendar, and Daily Briefings (Phase 12 Step 35)
  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_GET_OVERVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:briefing', { requester: 'renderer-main-window' })
    return productivityService.getOverviewSnapshot(payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_UPDATE_SETTINGS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:briefing', { requester: 'renderer-main-window' })
    return productivityService.updateSettings(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_NOTE_CREATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:notes', { requester: 'renderer-main-window' })
    return productivityService.createNote(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_NOTE_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:notes', { requester: 'renderer-main-window' })
    return productivityService.listNotes(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_NOTE_UPDATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:notes', { requester: 'renderer-main-window' })
    return productivityService.updateNote(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_NOTE_DELETE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:notes', { requester: 'renderer-main-window' })
    return productivityService.deleteNote(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_TASK_CREATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:tasks', { requester: 'renderer-main-window' })
    return productivityService.createTask(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_TASK_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:tasks', { requester: 'renderer-main-window' })
    return productivityService.listTasks(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_TASK_UPDATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:tasks', { requester: 'renderer-main-window' })
    return productivityService.updateTask(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_TASK_COMPLETE_BY_TITLE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:tasks', { requester: 'renderer-main-window' })
    return productivityService.completeTaskByTitle(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_TASK_DELETE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:tasks', { requester: 'renderer-main-window' })
    return productivityService.deleteTask(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_CREATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.createReminder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.listReminders(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_UPDATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.updateReminder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_SNOOZE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.snoozeReminder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_DISMISS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.dismissReminder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_CANCEL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.cancelReminder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_REMINDER_DELETE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:reminders', { requester: 'renderer-main-window' })
    return productivityService.deleteReminder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_CREATE_EVENT, async (event, payload) => {
    assertValidSender(event)
    const isExternal = payload?.providerId && payload.providerId !== 'local'
    if (isExternal) {
      authorizer.authorize('productivity:calendarExternalWrite', {
        requester: 'renderer-main-window',
        consentRequestId: payload?.humanConfirmed ? 'engine_approved_calendar_write' : undefined
      })
    } else {
      authorizer.authorize('productivity:calendarLocal', { requester: 'renderer-main-window' })
    }
    return await productivityService.createCalendarEvent(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_LIST_EVENTS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:calendarLocal', { requester: 'renderer-main-window' })
    return productivityService.listCalendarEvents(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_UPDATE_EVENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:calendarLocal', { requester: 'renderer-main-window' })
    return await productivityService.updateCalendarEvent(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_DELETE_EVENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:calendarLocal', { requester: 'renderer-main-window' })
    return await productivityService.deleteCalendarEvent(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_CONNECT_PROVIDER, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:calendarExternalWrite', {
      requester: 'renderer-main-window',
      consentRequestId: 'engine_approved_calendar_connect'
    })
    return await productivityService.connectExternalCalendar(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_DISCONNECT_PROVIDER, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:calendarLocal', { requester: 'renderer-main-window' })
    return productivityService.disconnectExternalCalendar(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_SYNC_PROVIDER, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:calendarLocal', { requester: 'renderer-main-window' })
    return await productivityService.syncExternalCalendar(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_BRIEFING_GENERATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:briefing', { requester: 'renderer-main-window' })
    return await productivityService.generateDailyBriefing(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTIVITY_BRIEFING_GET_LATEST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('productivity:briefing', { requester: 'renderer-main-window' })
    return productivityService.getLatestDailyBriefing(payload?.profileId)
  })

  // Media Gallery, Asset Library, Collections & Secure Media Management (Phase 12 Step 36)
  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_OVERVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:read', { requester: 'renderer-main-window' })
    return mediaLibraryService.getOverviewSnapshot(payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_SELECT_AND_IMPORT_DIALOG, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:import', { requester: 'renderer-main-window' })
    if (!mainWindow || mainWindow.isDestroyed()) {
      return null
    }
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Media Assets into HELIOXEN Media Gallery',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Supported Media (Images, Video, Audio)',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'mp4', 'webm', 'mp3', 'wav', 'ogg']
        }
      ]
    })
    if (res.canceled || res.filePaths.length === 0) {
      return null
    }
    return await mediaLibraryService.importBatch({
      storageMode: payload?.storageMode ?? 'managed_copy',
      items: res.filePaths.map((fp) => ({
        filePath: fp,
        collectionIds: payload?.collectionId ? [payload.collectionId] : undefined
      }))
    })
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_IMPORT_BATCH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:import', { requester: 'renderer-main-window' })
    return await mediaLibraryService.importBatch(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_SAVE_CAPTURE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:import', { requester: 'renderer-main-window' })
    return await mediaLibraryService.saveCapturedMedia(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_LIST_ASSETS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:read', { requester: 'renderer-main-window' })
    return mediaLibraryService.listAssets(payload || {})
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_ASSET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:read', { requester: 'renderer-main-window' })
    return mediaLibraryService.getAsset(payload?.id, payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_PREVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:read', { requester: 'renderer-main-window' })
    return await mediaLibraryService.getAssetPreview(payload?.id, payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_UPDATE_METADATA, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:organize', { requester: 'renderer-main-window' })
    return mediaLibraryService.updateAssetMetadata(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_RELINK_EXTERNAL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:import', { requester: 'renderer-main-window' })
    return mediaLibraryService.relinkExternalAsset(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_CREATE_COLLECTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:organize', { requester: 'renderer-main-window' })
    return mediaLibraryService.createCollection(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_LIST_COLLECTIONS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:read', { requester: 'renderer-main-window' })
    return mediaLibraryService.listCollections(payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_UPDATE_COLLECTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:organize', { requester: 'renderer-main-window' })
    return mediaLibraryService.updateCollection(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_DELETE_COLLECTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:organize', { requester: 'renderer-main-window' })
    return mediaLibraryService.deleteCollection(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_MODIFY_COLLECTION_MEMBERSHIP, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:organize', { requester: 'renderer-main-window' })
    return mediaLibraryService.modifyCollectionMembership(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_REMOVE_FROM_LIBRARY, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:remove', { requester: 'renderer-main-window' })
    return mediaLibraryService.removeAssetFromLibrary(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_DELETE_MANAGED_PERMANENTLY, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media:deletePermanent', {
      requester: 'renderer-main-window',
      consentRequestId: payload?.confirmPermanentDelete
        ? 'engine_approved_media_permanent_delete'
        : undefined
    })
    return mediaLibraryService.deleteManagedAssetPermanently(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_BULK_OPERATION, async (event, payload) => {
    assertValidSender(event)
    if (payload?.operation === 'delete_managed_permanently') {
      authorizer.authorize('media:deletePermanent', {
        requester: 'renderer-main-window',
        consentRequestId: payload?.confirmPermanentDelete
          ? 'engine_approved_media_bulk_delete'
          : undefined
      })
    } else if (payload?.operation === 'remove_from_library') {
      authorizer.authorize('media:remove', { requester: 'renderer-main-window' })
    } else {
      authorizer.authorize('media:organize', { requester: 'renderer-main-window' })
    }
    return mediaLibraryService.executeBulkOperation(payload)
  })

  // Step 37: VisualHub, Mermaid Visualization, and AI Image Generation
  ipcMain.handle(IPC_CHANNELS.VISUAL_GET_OVERVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    return await visualHubService.getOverviewSnapshot(payload?.profileId)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_RENDER_MERMAID, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    return visualHubService.validateAndRenderMermaid(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_SAVE_DIAGRAM, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    return visualHubService.saveDiagramDocument(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_LIST_DIAGRAMS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    return visualHubService.listDiagramDocuments(payload ?? {})
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_DELETE_DIAGRAM, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    return visualHubService.deleteDiagramDocument(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_EXPORT_DIAGRAM, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:exportDiagram', { requester: 'renderer-main-window' })

    let targetFilePath: string | undefined = payload?.targetFilePath
    let overwriteExisting = Boolean(payload?.overwriteExisting)
    if (payload?.promptSaveDialog && mainWindow && !mainWindow.isDestroyed()) {
      const ext = payload.format === 'svg' ? 'svg' : payload.format === 'png' ? 'png' : 'mmd'
      const defaultName = `${sanitizeSuggestedFileName(payload.suggestedFileName || 'diagram', 'diagram')}.${ext}`
      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: `Export Mermaid Diagram (.${ext})`,
        defaultPath: defaultName,
        filters: [
          {
            name: ext.toUpperCase(),
            extensions: [ext]
          }
        ]
      })
      if (saveResult.canceled || !saveResult.filePath) {
        return null
      }
      targetFilePath = saveResult.filePath
      overwriteExisting = true
    }

    const { promptSaveDialog: _ignore, ...exportReq } = payload ?? {}
    return visualHubService.exportDiagram({
      ...exportReq,
      targetFilePath,
      overwriteExisting
    })
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_SAVE_DIAGRAM_TO_GALLERY, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:saveToGallery', { requester: 'renderer-main-window' })
    return await visualHubService.saveDiagramPngToGallery(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_GET_IMAGE_MODELS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    return await visualHubService.getEligibleImageModels()
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_GENERATE_IMAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:generateImage', { requester: 'renderer-main-window' })
    return await visualHubService.generateImage(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_CANCEL_IMAGE_GENERATION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:generateImage', { requester: 'renderer-main-window' })
    return visualHubService.cancelImageGeneration(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_SAVE_IMAGE_TO_GALLERY, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:saveToGallery', { requester: 'renderer-main-window' })
    return await visualHubService.saveGeneratedImageToGallery(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_DISCARD_IMAGE_CANDIDATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:generateImage', { requester: 'renderer-main-window' })
    return visualHubService.discardGeneratedCandidate(payload)
  })

  ipcMain.handle(IPC_CHANNELS.VISUAL_UPDATE_PREFERENCES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('visual:mermaid', { requester: 'renderer-main-window' })
    const { profileId, ...prefs } = payload ?? {}
    return visualHubService.updatePreferences(prefs, profileId)
  })

  // Step 38: World Monitor, Interactive Globe, Geographic Maps, and News Intelligence
  ipcMain.handle(IPC_CHANNELS.WORLD_GET_OVERVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:read', { requester: 'renderer-main-window' })
    return worldMonitorService.getOverviewSnapshot(payload?.profileId, payload?.filterQuery)
  })

  ipcMain.handle(IPC_CHANNELS.WORLD_QUERY_FEED, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:read', { requester: 'renderer-main-window' })
    return worldMonitorService.queryFeedAndMarkers(payload ?? {})
  })

  ipcMain.handle(IPC_CHANNELS.WORLD_REFRESH_FEED, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:refreshFeed', { requester: 'renderer-main-window' })
    return await worldMonitorService.refreshNewsFeed(payload ?? {})
  })

  ipcMain.handle(IPC_CHANNELS.WORLD_SEARCH_LOCATIONS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:read', { requester: 'renderer-main-window' })
    return worldMonitorService.searchLocations(payload)
  })

  ipcMain.handle(IPC_CHANNELS.WORLD_TOGGLE_BOOKMARK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:read', { requester: 'renderer-main-window' })
    return worldMonitorService.toggleArticleBookmark(payload)
  })

  ipcMain.handle(IPC_CHANNELS.WORLD_OPEN_SOURCE_URL, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:openSource', { requester: 'renderer-main-window' })
    return await worldMonitorService.openArticleSourceUrl(payload)
  })

  ipcMain.handle(IPC_CHANNELS.WORLD_UPDATE_PREFERENCES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('world:read', { requester: 'renderer-main-window' })
    const { profileId, ...prefs } = payload ?? {}
    return worldMonitorService.updatePreferences(prefs, profileId)
  })

  // Step 39: System Health, Network Monitoring, and Weather Widgets
  ipcMain.handle(IPC_CHANNELS.WIDGETS_GET_SYSTEM_HEALTH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('widgets:readSystemHealth', { requester: 'renderer-main-window' })
    return await systemHealthService.getSnapshot(payload?.sampleDurationMs ?? 100)
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_GET_NETWORK_STATUS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('widgets:runNetworkDiagnostic', { requester: 'renderer-main-window' })
    return networkMonitorService.getNetworkStatusSnapshot()
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_RUN_NETWORK_DIAGNOSTIC, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('widgets:runNetworkDiagnostic', { requester: 'renderer-main-window' })
    return await networkMonitorService.runDiagnostic({
      targetUrl: payload?.targetUrl,
      timeoutMs: payload?.timeoutMs
    })
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_CANCEL_NETWORK_DIAGNOSTIC, async (event) => {
    assertValidSender(event)
    authorizer.authorize('widgets:runNetworkDiagnostic', { requester: 'renderer-main-window' })
    return networkMonitorService.cancelDiagnostic()
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_SEARCH_WEATHER_LOCATIONS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('widgets:readWeather', { requester: 'renderer-main-window' })
    return await weatherService.searchLocations(payload?.query ?? '', payload?.limit ?? 8)
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_GET_WEATHER_FORECAST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('widgets:readWeather', { requester: 'renderer-main-window' })
    const prefs = widgetPreferencesManager.getPreferences()
    return await weatherService.getForecast({
      location: payload?.location ?? prefs.weather.selectedLocation,
      temperatureUnit: payload?.temperatureUnit ?? prefs.weather.temperatureUnit,
      windSpeedUnit: payload?.windSpeedUnit ?? prefs.weather.windSpeedUnit,
      apiKey: prefs.weather.apiKey,
      forceRefresh: payload?.forceRefresh ?? false
    })
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_GET_PREFERENCES, async (event) => {
    assertValidSender(event)
    authorizer.authorize('widgets:managePreferences', { requester: 'renderer-main-window' })
    return widgetPreferencesManager.getPreferences()
  })

  ipcMain.handle(IPC_CHANNELS.WIDGETS_UPDATE_PREFERENCES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('widgets:managePreferences', { requester: 'renderer-main-window' })
    const updated = widgetPreferencesManager.updatePreferences(payload)
    if (payload?.networkMonitor?.selectedEndpointUrl) {
      try {
        networkMonitorService.setSelectedEndpoint(payload.networkMonitor.selectedEndpointUrl)
      } catch {
        // Ignore invalid endpoint
      }
    }
    return updated
  })

  // Step 40: Agent Town, Plugin Connectors, and Dynamic Skills Framework
  ipcMain.handle(IPC_CHANNELS.AGENTS_GET_OVERVIEW, async (event) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.getOverviewSnapshot()
  })

  ipcMain.handle(IPC_CHANNELS.AGENTS_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.listAgents(payload?.category)
  })

  ipcMain.handle(IPC_CHANNELS.AGENTS_SET_ENABLED, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:manage', { requester: 'renderer-main-window' })
    return agentTownService.setAgentEnabled(payload.id, payload.enabled)
  })

  ipcMain.handle(IPC_CHANNELS.PLUGINS_LIST, async (event) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.listPlugins()
  })

  ipcMain.handle(IPC_CHANNELS.PLUGINS_SET_ENABLED, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('plugins:manage', { requester: 'renderer-main-window' })
    return agentTownService.setPluginEnabled(payload.id, payload.enabled)
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTORS_CONNECT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('plugins:manage', { requester: 'renderer-main-window' })
    return agentTownService.connectConnector(payload.connectorId, payload?.credentialRef)
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTORS_DISCONNECT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('plugins:manage', { requester: 'renderer-main-window' })
    return agentTownService.disconnectConnector(payload.connectorId)
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTORS_UPDATE_SCOPES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('plugins:manage', { requester: 'renderer-main-window' })
    return agentTownService.updateConnectorScopes(payload.connectorId, payload.grantedScopes)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.listSkills(payload?.category)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_GET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.getSkill(payload.skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_VALIDATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.validateSkill(payload.definition)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_DRY_RUN, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.dryRunSkill(payload.definition, payload?.testInputs)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_SAVE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.saveSkill(payload.definition)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_SET_STATUS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.setSkillStatus(payload.skillId, payload.status)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_DELETE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.deleteSkill(payload.skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_EXECUTE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:execute', { requester: 'renderer-main-window' })
    return await agentTownService.executeSkill(payload.skillId, payload?.parameters)
  })

  // Step 41: Multi-Agent Collaboration, Delegation, and Coordinated Task Execution
  ipcMain.handle(IPC_CHANNELS.AGENTS_COORDINATE_TASK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:coordinate', { requester: 'renderer-main-window' })
    return await agentTownService.coordinateTask(payload.input)
  })

  ipcMain.handle(IPC_CHANNELS.AGENTS_GET_COORDINATED_TASK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.getCoordinatedTask(payload.parentTaskId) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.AGENTS_LIST_COORDINATED_TASKS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('agents:read', { requester: 'renderer-main-window' })
    return agentTownService.listCoordinatedTasks()
  })

  ipcMain.handle(IPC_CHANNELS.AGENTS_CANCEL_COORDINATED_TASK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('agents:coordinate', { requester: 'renderer-main-window' })
    return agentTownService.cancelCoordinatedTask(payload.parentTaskId, payload?.reason)
  })

  // Step 42: Advanced Dynamic Skill Studio, Validation, Testing, Versioning, and Safe Evolution
  ipcMain.handle(IPC_CHANNELS.SKILLS_VALIDATE_STAGED, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.validateSkillStaged(payload.definitionOrId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_CREATE_VERSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.createSkillVersion(payload.skillId, payload?.changelog)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST_VERSIONS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.listSkillVersions(payload.skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_GET_VERSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.getSkillVersion(payload.skillId, payload.versionId) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_COMPARE_VERSIONS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.compareSkillVersions(payload.skillId, payload.baseVersionId, payload.targetVersionId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_ROLLBACK_VERSION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.rollbackSkillVersion(payload.skillId, payload.targetVersionId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_CREATE_SCENARIO, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.createTestScenario(payload.skillId, payload.scenario)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST_SCENARIOS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.listTestScenarios(payload.skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_DELETE_SCENARIO, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.deleteTestScenario(payload.skillId, payload.scenarioId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_RUN_SCENARIO, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return await agentTownService.runTestScenario(payload.skillId, payload.scenarioId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_RUN_REGRESSION_TESTS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return await agentTownService.runRegressionTests(payload.skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_EXPORT_PACKAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.exportSkillPackage(payload.skillId)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_PREVIEW_IMPORT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.previewSkillImport(payload.rawJson)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_IMPORT_PACKAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return agentTownService.importSkillPackage(payload.rawJson, payload?.options)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_GENERATE_AI_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return await agentTownService.generateSkillDraftWithAi(payload.prompt, payload?.category)
  })

  ipcMain.handle(IPC_CHANNELS.SKILLS_REFINE_AI_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('skills:author', { requester: 'renderer-main-window' })
    return await agentTownService.refineSkillWithAi(payload.skillId, payload.instruction)
  })

  // Step 43: Office Document Studio, Spreadsheets, Presentations, and AI Productivity
  ipcMain.handle(IPC_CHANNELS.OFFICE_LIST_DOCUMENTS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('office:read', { requester: 'renderer-main-window' })
    return getOfficeService().listDocuments()
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_GET_DOCUMENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:read', { requester: 'renderer-main-window' })
    return getOfficeService().getDocument(payload.documentId)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_SAVE_DOCUMENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:write', { requester: 'renderer-main-window' })
    return getOfficeService().saveDocument(payload)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_DELETE_DOCUMENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:write', { requester: 'renderer-main-window' })
    return getOfficeService().deleteDocument(payload.documentId)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_LIST_TEMPLATES, async (event) => {
    assertValidSender(event)
    authorizer.authorize('office:read', { requester: 'renderer-main-window' })
    return getOfficeService().listTemplates()
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_CREATE_FROM_TEMPLATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:write', { requester: 'renderer-main-window' })
    return getOfficeService().createFromTemplate(payload.templateId, payload?.title)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_EXPORT_DOCUMENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:export', { requester: 'renderer-main-window' })
    return await getOfficeService().exportDocument(payload, mainWindow)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_IMPORT_DOCUMENT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:import', { requester: 'renderer-main-window' })
    return await getOfficeService().importDocument(payload?.sourceFilePath, mainWindow)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_GENERATE_AI_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:write', { requester: 'renderer-main-window' })
    return await getOfficeService().generateAiDraft(payload)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_REWRITE_TEXT_AI, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:write', { requester: 'renderer-main-window' })
    return await getOfficeService().rewriteTextAi(payload.text, payload.instruction)
  })

  ipcMain.handle(IPC_CHANNELS.OFFICE_SUGGEST_FORMULA_AI, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('office:read', { requester: 'renderer-main-window' })
    return await getOfficeService().suggestFormulaAi(payload.description, payload?.sampleDataSnippet)
  })

  // Step 44: Integrations Management IPC Handlers
  ipcMain.handle(IPC_CHANNELS.INTEGRATIONS_LIST, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('integrations:read', { requester: 'renderer-main-window' })
    return getIntegrationsManager().listIntegrations(payload?.category)
  })

  ipcMain.handle(IPC_CHANNELS.INTEGRATIONS_GET, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('integrations:read', { requester: 'renderer-main-window' })
    return getIntegrationsManager().getIntegration(payload?.integrationId)
  })

  ipcMain.handle(IPC_CHANNELS.INTEGRATIONS_CONNECT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('integrations:manage', { requester: 'renderer-main-window' })
    return await getIntegrationsManager().connectIntegration(payload)
  })

  ipcMain.handle(IPC_CHANNELS.INTEGRATIONS_DISCONNECT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('integrations:manage', { requester: 'renderer-main-window' })
    return await getIntegrationsManager().disconnectIntegration(payload)
  })

  ipcMain.handle(IPC_CHANNELS.INTEGRATIONS_HEALTH_CHECK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('integrations:read', { requester: 'renderer-main-window' })
    return await getIntegrationsManager().checkHealth(payload?.integrationId)
  })

  // Step 44: Communication Subsystem IPC Handlers
  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_LIST_MESSAGES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:read', { requester: 'renderer-main-window' })
    return getCommunicationService().listMessages(payload)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_GET_MESSAGE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:read', { requester: 'renderer-main-window' })
    return getCommunicationService().getMessage(payload?.messageId)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_SEARCH_MESSAGES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:read', { requester: 'renderer-main-window' })
    return getCommunicationService().listMessages(payload)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_CREATE_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return getCommunicationService().createDraft(payload)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_GET_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return getCommunicationService().getDraft(payload?.draftId)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_UPDATE_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return getCommunicationService().updateDraft(payload?.draftId, payload?.updates)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_DELETE_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return getCommunicationService().deleteDraft(payload?.draftId)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_LIST_DRAFTS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return getCommunicationService().listDrafts()
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_REQUEST_SEND_CONFIRMATION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return getCommunicationService().requestSendConfirmation(payload?.draftId)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_CONFIRM_AND_SEND, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:send', { requester: 'renderer-main-window' })
    return await getCommunicationService().confirmAndSend(payload)
  })

  ipcMain.handle(IPC_CHANNELS.COMMUNICATION_GENERATE_AI_DRAFT, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('communication:draft', { requester: 'renderer-main-window' })
    return await getCommunicationService().generateAiDraft(payload)
  })

  // Step 44: Media Integration IPC Handlers
  ipcMain.handle(IPC_CHANNELS.MEDIA_INTEGRATION_SEARCH, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media_integration:read', { requester: 'renderer-main-window' })
    return await getMediaIntegrationService().searchCatalog(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_INTEGRATION_GET_PLAYBACK_STATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media_integration:read', { requester: 'renderer-main-window' })
    return getMediaIntegrationService().getPlaybackState(payload?.integrationId)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_INTEGRATION_CONTROL_PLAYBACK, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media_integration:control', { requester: 'renderer-main-window' })
    return await getMediaIntegrationService().controlPlayback(payload)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_INTEGRATION_LIST_DEVICES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media_integration:read', { requester: 'renderer-main-window' })
    return getMediaIntegrationService().listDevices(payload?.integrationId)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_INTEGRATION_LIST_PLAYLISTS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('media_integration:read', { requester: 'renderer-main-window' })
    return getMediaIntegrationService().listPlaylists(payload?.integrationId)
  })

  // Step 45: Android Device Integration IPC Handlers
  ipcMain.handle(IPC_CHANNELS.DEVICES_LIST_ANDROID, async (event) => {
    assertValidSender(event)
    authorizer.authorize('device:read', { requester: 'renderer-main-window' })
    return getAndroidDeviceService().listDevices()
  })

  ipcMain.handle(IPC_CHANNELS.DEVICES_GET_ANDROID_STATUS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('device:read', { requester: 'renderer-main-window' })
    return getAndroidDeviceService().getDeviceStatus(payload?.deviceId)
  })

  ipcMain.handle(IPC_CHANNELS.DEVICES_PAIR_ANDROID, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('device:pair', { requester: 'renderer-main-window' })
    return await getAndroidDeviceService().pairDevice(payload)
  })

  ipcMain.handle(IPC_CHANNELS.DEVICES_DISCONNECT_ANDROID, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('device:pair', { requester: 'renderer-main-window' })
    return getAndroidDeviceService().disconnectDevice(payload?.deviceId)
  })

  ipcMain.handle(IPC_CHANNELS.DEVICES_EXECUTE_ANDROID_ACTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('device:action', { requester: 'renderer-main-window' })
    return await getAndroidDeviceService().executeAction(payload)
  })

  // Step 45: Smart-Home Integration IPC Handlers
  ipcMain.handle(IPC_CHANNELS.SMART_HOME_GET_HUB_STATUS, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:read', { requester: 'renderer-main-window' })
    return getSmartHomeService().getHubStatus(payload?.hubId)
  })

  ipcMain.handle(IPC_CHANNELS.SMART_HOME_CONNECT_HUB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:control', { requester: 'renderer-main-window' })
    return await getSmartHomeService().connectHub(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SMART_HOME_DISCONNECT_HUB, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:control', { requester: 'renderer-main-window' })
    return await getSmartHomeService().disconnectHub(payload?.hubId)
  })

  ipcMain.handle(IPC_CHANNELS.SMART_HOME_LIST_ENTITIES, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:read', { requester: 'renderer-main-window' })
    return getSmartHomeService().listEntities(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SMART_HOME_GET_ENTITY_STATE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:read', { requester: 'renderer-main-window' })
    return getSmartHomeService().getEntityState(payload?.entityId)
  })

  ipcMain.handle(IPC_CHANNELS.SMART_HOME_REQUEST_SECURITY_CONFIRMATION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:security_control', { requester: 'renderer-main-window' })
    return getSmartHomeService().requestSecurityConfirmation(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SMART_HOME_EXECUTE_ACTION, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('smart_home:control', { requester: 'renderer-main-window' })
    return await getSmartHomeService().executeAction(payload)
  })

  // Step 46: Recovery, Verified Backups, and Controlled Self-Repair IPC Handlers
  ipcMain.handle(IPC_CHANNELS.RECOVERY_GET_STATUS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('recovery:read', { requester: 'renderer-main-window' })
    return getAppRecoveryService().getOverview()
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_LIST_BACKUPS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('recovery:read', { requester: 'renderer-main-window' })
    return getAppRecoveryService().listBackups()
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_CREATE_BACKUP, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('recovery:backup', { requester: 'renderer-main-window' })
    return await getAppRecoveryService().createBackup(payload)
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_VERIFY_BACKUP, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('recovery:read', { requester: 'renderer-main-window' })
    return getAppRecoveryService().verifyBackup(payload?.backupId)
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_RESTORE_PREVIEW, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('recovery:read', { requester: 'renderer-main-window' })
    return getAppRecoveryService().getRestorePreview(payload?.backupId)
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_EXECUTE_RESTORE, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('recovery:restore', { requester: 'renderer-main-window' })
    return await getAppRecoveryService().executeRestore(payload)
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_RUN_DIAGNOSTICS, async (event) => {
    assertValidSender(event)
    authorizer.authorize('recovery:read', { requester: 'renderer-main-window' })
    return getAppRecoveryService().runDiagnostics()
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_EXECUTE_REPAIR, async (event, payload) => {
    assertValidSender(event)
    authorizer.authorize('recovery:repair', { requester: 'renderer-main-window' })
    return await getAppRecoveryService().executeRepair(payload)
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
  setVisualHubProviderServiceGetter(() => getProviderService())
  setAgentTownProviderServiceGetter(() => getProviderService())
  await getModelRegistry().initialize()
  await getPreferencesStorage().initialize()
  await getVoicePreferencesStorage().initialize()
  await memoryService.initialize()
  productivityService.reconcileStartupAndResume()
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
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_GET_STATE)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_SET_CONSENT)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_UPDATE_PROFILE)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_CREATE)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_GET)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_UPDATE)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_DELETE)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_CLEAR_ALL)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_RETRIEVE)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_PROPOSE_SUGGESTION)
  ipcMain.removeHandler(IPC_CHANNELS.MEMORY_RESOLVE_SUGGESTION)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_GET_OVERVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_UPDATE_SETTINGS)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_NOTE_CREATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_NOTE_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_NOTE_UPDATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_NOTE_DELETE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_TASK_CREATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_TASK_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_TASK_UPDATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_TASK_COMPLETE_BY_TITLE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_TASK_DELETE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_CREATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_UPDATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_SNOOZE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_DISMISS)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_CANCEL)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_REMINDER_DELETE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_CREATE_EVENT)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_LIST_EVENTS)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_UPDATE_EVENT)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_DELETE_EVENT)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_CONNECT_PROVIDER)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_DISCONNECT_PROVIDER)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_CALENDAR_SYNC_PROVIDER)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_BRIEFING_GENERATE)
  ipcMain.removeHandler(IPC_CHANNELS.PRODUCTIVITY_BRIEFING_GET_LATEST)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_GET_OVERVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_SELECT_AND_IMPORT_DIALOG)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_IMPORT_BATCH)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_SAVE_CAPTURE)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_LIST_ASSETS)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_GET_ASSET)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_GET_PREVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_UPDATE_METADATA)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_RELINK_EXTERNAL)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_CREATE_COLLECTION)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_LIST_COLLECTIONS)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_UPDATE_COLLECTION)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_DELETE_COLLECTION)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_MODIFY_COLLECTION_MEMBERSHIP)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_REMOVE_FROM_LIBRARY)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_DELETE_MANAGED_PERMANENTLY)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_BULK_OPERATION)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_GET_OVERVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_RENDER_MERMAID)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_SAVE_DIAGRAM)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_LIST_DIAGRAMS)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_DELETE_DIAGRAM)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_EXPORT_DIAGRAM)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_SAVE_DIAGRAM_TO_GALLERY)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_GET_IMAGE_MODELS)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_GENERATE_IMAGE)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_CANCEL_IMAGE_GENERATION)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_SAVE_IMAGE_TO_GALLERY)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_DISCARD_IMAGE_CANDIDATE)
  ipcMain.removeHandler(IPC_CHANNELS.VISUAL_UPDATE_PREFERENCES)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_GET_OVERVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_QUERY_FEED)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_REFRESH_FEED)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_SEARCH_LOCATIONS)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_TOGGLE_BOOKMARK)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_OPEN_SOURCE_URL)
  ipcMain.removeHandler(IPC_CHANNELS.WORLD_UPDATE_PREFERENCES)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_GET_SYSTEM_HEALTH)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_GET_NETWORK_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_RUN_NETWORK_DIAGNOSTIC)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_CANCEL_NETWORK_DIAGNOSTIC)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_SEARCH_WEATHER_LOCATIONS)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_GET_WEATHER_FORECAST)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_GET_PREFERENCES)
  ipcMain.removeHandler(IPC_CHANNELS.WIDGETS_UPDATE_PREFERENCES)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_GET_OVERVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_SET_ENABLED)
  ipcMain.removeHandler(IPC_CHANNELS.PLUGINS_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.PLUGINS_SET_ENABLED)
  ipcMain.removeHandler(IPC_CHANNELS.CONNECTORS_CONNECT)
  ipcMain.removeHandler(IPC_CHANNELS.CONNECTORS_DISCONNECT)
  ipcMain.removeHandler(IPC_CHANNELS.CONNECTORS_UPDATE_SCOPES)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_GET)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_VALIDATE)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_DRY_RUN)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_SAVE)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_SET_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_DELETE)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_EXECUTE)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_COORDINATE_TASK)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_GET_COORDINATED_TASK)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_LIST_COORDINATED_TASKS)
  ipcMain.removeHandler(IPC_CHANNELS.AGENTS_CANCEL_COORDINATED_TASK)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_VALIDATE_STAGED)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_CREATE_VERSION)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_LIST_VERSIONS)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_GET_VERSION)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_COMPARE_VERSIONS)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_ROLLBACK_VERSION)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_CREATE_SCENARIO)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_LIST_SCENARIOS)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_DELETE_SCENARIO)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_RUN_SCENARIO)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_RUN_REGRESSION_TESTS)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_EXPORT_PACKAGE)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_PREVIEW_IMPORT)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_IMPORT_PACKAGE)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_GENERATE_AI_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.SKILLS_REFINE_AI_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_LIST_DOCUMENTS)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_GET_DOCUMENT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_SAVE_DOCUMENT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_DELETE_DOCUMENT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_LIST_TEMPLATES)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_CREATE_FROM_TEMPLATE)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_EXPORT_DOCUMENT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_IMPORT_DOCUMENT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_GENERATE_AI_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_REWRITE_TEXT_AI)
  ipcMain.removeHandler(IPC_CHANNELS.OFFICE_SUGGEST_FORMULA_AI)
  ipcMain.removeHandler(IPC_CHANNELS.INTEGRATIONS_LIST)
  ipcMain.removeHandler(IPC_CHANNELS.INTEGRATIONS_GET)
  ipcMain.removeHandler(IPC_CHANNELS.INTEGRATIONS_CONNECT)
  ipcMain.removeHandler(IPC_CHANNELS.INTEGRATIONS_DISCONNECT)
  ipcMain.removeHandler(IPC_CHANNELS.INTEGRATIONS_HEALTH_CHECK)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_LIST_MESSAGES)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_GET_MESSAGE)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_SEARCH_MESSAGES)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_CREATE_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_GET_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_UPDATE_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_DELETE_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_LIST_DRAFTS)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_REQUEST_SEND_CONFIRMATION)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_CONFIRM_AND_SEND)
  ipcMain.removeHandler(IPC_CHANNELS.COMMUNICATION_GENERATE_AI_DRAFT)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_INTEGRATION_SEARCH)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_INTEGRATION_GET_PLAYBACK_STATE)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_INTEGRATION_CONTROL_PLAYBACK)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_INTEGRATION_LIST_DEVICES)
  ipcMain.removeHandler(IPC_CHANNELS.MEDIA_INTEGRATION_LIST_PLAYLISTS)
  ipcMain.removeHandler(IPC_CHANNELS.DEVICES_LIST_ANDROID)
  ipcMain.removeHandler(IPC_CHANNELS.DEVICES_GET_ANDROID_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.DEVICES_PAIR_ANDROID)
  ipcMain.removeHandler(IPC_CHANNELS.DEVICES_DISCONNECT_ANDROID)
  ipcMain.removeHandler(IPC_CHANNELS.DEVICES_EXECUTE_ANDROID_ACTION)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_GET_HUB_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_CONNECT_HUB)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_DISCONNECT_HUB)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_LIST_ENTITIES)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_GET_ENTITY_STATE)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_REQUEST_SECURITY_CONFIRMATION)
  ipcMain.removeHandler(IPC_CHANNELS.SMART_HOME_EXECUTE_ACTION)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_GET_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_LIST_BACKUPS)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_CREATE_BACKUP)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_VERIFY_BACKUP)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_RESTORE_PREVIEW)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_EXECUTE_RESTORE)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_RUN_DIAGNOSTICS)
  ipcMain.removeHandler(IPC_CHANNELS.RECOVERY_EXECUTE_REPAIR)
  getAppRecoveryService().recordCleanShutdown()
  getAppRecoveryService().dispose()
  productivityService.dispose()
  mediaLibraryService.dispose()
  visualHubService.dispose()
  worldMonitorService.dispose()
  networkMonitorService.dispose()
  weatherService.dispose()
  agentTownService.dispose()
})
