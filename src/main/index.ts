import { app, BrowserWindow, shell, session, ipcMain, IpcMainInvokeEvent, systemPreferences } from 'electron'
import { join } from 'path'
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
import { authorizer, securityLogger, CredentialStorageService } from './security'
import { ProviderService, ModelRegistry, PreferencesStorage } from './ai'

// Global window reference
let mainWindow: BrowserWindow | null = null
let providerService: ProviderService | null = null
let modelRegistry: ModelRegistry | null = null
let preferencesStorage: PreferencesStorage | null = null
let activeStreamAbortController: AbortController | null = null

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
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
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

  // Permission handling: strictly allow only audio microphone capture for main window in Phase 7
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isMainWindow = Boolean(
      mainWindow && !mainWindow.isDestroyed() && webContents && webContents.id === mainWindow.webContents.id
    )
    if (isMainWindow && permission === 'media') {
      const mediaTypes = details && 'mediaTypes' in details ? details.mediaTypes : undefined
      const isAudioOnly =
        !mediaTypes ||
        (!mediaTypes.includes('video') && mediaTypes.includes('audio'))
      if (isAudioOnly) {
        securityLogger.logEvent('PERMISSION_REQUEST', 'session-default', 'PERMITTED', {
          permission,
          mediaTypes,
          reason: 'User-authorized microphone capture for HELIOXEN voice dock (Phase 7, Step 19)'
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
      if (!mediaType || mediaType === 'audio') {
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
  registerWindowIpcHandlers()
  registerAiAndCredentialIpcHandlers()
  createWindow()

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
})
