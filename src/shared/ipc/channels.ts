/**
 * Centralized, authoritative channel constants for HELIOXEN IPC operations.
 * Single source of truth for Main, Preload, and Renderer processes.
 */
export const IPC_CHANNELS = {
  // Window Request / Response Operations (Renderer -> Main)
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',

  // Window Event Push Operations (Main -> Renderer)
  WINDOW_MAXIMIZED_CHANGE: 'window:maximized-change',

  // AI Provider Text Generation Operations (Renderer -> Main)
  AI_GENERATE_TEXT: 'ai:generateText',
  AI_CANCEL: 'ai:cancel',

  // AI Streaming Event Push (Main -> Renderer)
  AI_STREAM_CHUNK: 'ai:streamChunk',

  // Secure Credential Management Operations (Renderer -> Main)
  CREDENTIALS_SET: 'credentials:set',
  CREDENTIALS_GET_STATUS: 'credentials:getStatus',
  CREDENTIALS_DELETE: 'credentials:delete',
  CREDENTIALS_TEST: 'credentials:test',

  // Model Registry & Capability Profile Operations (Renderer -> Main)
  MODELS_GET_CATALOG: 'models:getCatalog',
  MODELS_REFRESH: 'models:refresh',

  // User AI Preferences Operations (Renderer -> Main)
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set',

  // Provider Health & Routing Operations (Renderer -> Main)
  HEALTH_GET_STATUS: 'health:getStatus',
  ROUTING_GET_TASK_DEFINITIONS: 'routing:getTaskDefinitions',

  // Audio & Microphone Operations (Renderer -> Main)
  AUDIO_GET_PERMISSION_STATUS: 'audio:getPermissionStatus',
  AUDIO_GET_DEVICES: 'audio:getDevices',

  // Voice & Wake-Word Preferences Operations (Renderer -> Main)
  VOICE_PREFERENCES_GET: 'voice:preferencesGet',
  VOICE_PREFERENCES_SET: 'voice:preferencesSet',

  // Camera & Screen Capture Operations (Renderer -> Main, Phase 8 Step 22)
  CAPTURE_GET_DESKTOP_SOURCES: 'capture:getDesktopSources',
  CAPTURE_CHECK_PERMISSION: 'capture:checkPermission',

  // Document Extraction & File Attachment Operations (Renderer -> Main, Phase 8 Step 23)
  DOCUMENTS_SELECT_FILES: 'documents:selectFiles',
  DOCUMENTS_EXTRACT_FILE: 'documents:extractFile',
  DOCUMENTS_VALIDATE_FILE: 'documents:validateFile',

  // Tool Registry & Validation Operations (Renderer -> Main, Phase 9 Step 25)
  TOOLS_LIST: 'tools:list',
  TOOLS_GET: 'tools:get',
  TOOLS_VALIDATE_INPUT: 'tools:validateInput',

  // Task Planner & Agent Execution Operations (Renderer -> Main, Phase 9 Step 26-27)
  ORCHESTRATION_PLAN: 'orchestration:plan',
  ORCHESTRATION_EXECUTE: 'orchestration:execute',
  ORCHESTRATION_CANCEL: 'orchestration:cancel',
  ORCHESTRATION_GET_AUDIT: 'orchestration:getAudit',
  ORCHESTRATION_GET_TASK: 'orchestration:getTask',

  // Task Progress Event Push (Main -> Renderer, Phase 9 Step 27)
  ORCHESTRATION_PROGRESS_EVENT: 'orchestration:progressEvent',

  // System Telemetry & Desktop Awareness Operations (Renderer -> Main, Phase 10 Step 28)
  TELEMETRY_GET_SYSTEM_HEALTH: 'telemetry:getSystemHealth',
  TELEMETRY_GET_INSTALLED_APPS: 'telemetry:getInstalledApps',
  TELEMETRY_SEARCH_INSTALLED_APPS: 'telemetry:searchInstalledApps',
  TELEMETRY_GET_DESKTOP_WINDOWS: 'telemetry:getDesktopWindows',

  // Filesystem & Clipboard Operations (Renderer -> Main, Phase 10 Step 29)
  FILESYSTEM_LIST_DIRECTORY: 'filesystem:listDirectory',
  FILESYSTEM_GET_METADATA: 'filesystem:getMetadata',
  FILESYSTEM_SEARCH_FILES: 'filesystem:searchFiles',
  FILESYSTEM_READ_TEXT: 'filesystem:readText',
  FILESYSTEM_CREATE_FILE: 'filesystem:createFile',
  FILESYSTEM_COPY_FILE: 'filesystem:copyFile',
  FILESYSTEM_MOVE_FILE: 'filesystem:moveFile',
  FILESYSTEM_ORGANIZE_PREVIEW: 'filesystem:organizePreview',
  FILESYSTEM_ORGANIZE_APPLY: 'filesystem:organizeApply',
  FILESYSTEM_ORGANIZE_UNDO: 'filesystem:organizeUndo',
  CLIPBOARD_READ_TEXT: 'clipboard:readText',
  CLIPBOARD_WRITE_TEXT: 'clipboard:writeText',
  CLIPBOARD_READ_IMAGE: 'clipboard:readImage',

  // Step 30: Desktop Interaction & System Operations Channels
  DESKTOP_FOCUS_WINDOW: 'desktop:focusWindow',
  DESKTOP_EXECUTE_MOUSE: 'desktop:executeMouse',
  DESKTOP_EXECUTE_KEYBOARD: 'desktop:executeKeyboard',
  DESKTOP_SEND_TEXT: 'desktop:sendText',
  DESKTOP_EMERGENCY_STOP: 'desktop:emergencyStop',
  DESKTOP_UNDO_LAST_ACTION: 'desktop:undoLastAction',
  SYSTEM_OPEN_PATH: 'system:openPath',
  SYSTEM_SHOW_IN_FOLDER: 'system:showInFolder',
  SYSTEM_OPEN_URL: 'system:openUrl',
  SYSTEM_ALERT_BEEP: 'system:alertBeep',
  SYSTEM_GET_DISPLAY_METRICS: 'system:getDisplayMetrics',

  // Step 31: Browser Service, Sessions & Tab Channels
  BROWSER_CREATE_SESSION: 'browser:createSession',
  BROWSER_LIST_SESSIONS: 'browser:listSessions',
  BROWSER_CLOSE_SESSION: 'browser:closeSession',
  BROWSER_CLEAR_SESSION: 'browser:clearSession',
  BROWSER_CREATE_TAB: 'browser:createTab',
  BROWSER_NAVIGATE_TAB: 'browser:navigateTab',
  BROWSER_SWITCH_TAB: 'browser:switchTab',
  BROWSER_CLOSE_TAB: 'browser:closeTab',
  BROWSER_GET_TAB_STATE: 'browser:getTabState',
  BROWSER_LIST_TABS: 'browser:listTabs',
  BROWSER_RELOAD_TAB: 'browser:reloadTab',
  BROWSER_STOP_TAB: 'browser:stopTab',
  BROWSER_GO_BACK: 'browser:goBack',
  BROWSER_GO_FORWARD: 'browser:goForward',
  BROWSER_SET_BOUNDS: 'browser:setBounds',

  // Step 33: Browser Agent Automation, Forms & Downloads
  BROWSER_INSPECT_PAGE: 'browser:inspectPage',
  BROWSER_CLICK_ELEMENT: 'browser:clickElement',
  BROWSER_SCROLL_PAGE: 'browser:scrollPage',
  BROWSER_FILL_FIELD: 'browser:fillField',
  BROWSER_SELECT_OPTION: 'browser:selectOption',
  BROWSER_REVIEW_FORM: 'browser:reviewForm',
  BROWSER_SUBMIT_FORM: 'browser:submitForm',
  BROWSER_GET_DOWNLOADS: 'browser:getDownloads',
  BROWSER_LIST_DOWNLOADS: 'browser:listDownloads',
  BROWSER_APPROVE_DOWNLOAD: 'browser:approveDownload',
  BROWSER_CANCEL_DOWNLOAD: 'browser:cancelDownload',

  // Step 32: Web Research, Extraction & Screenshots
  RESEARCH_SEARCH: 'research:search',
  RESEARCH_EXTRACT_TAB: 'research:extractTab',
  RESEARCH_EXTRACT_URL: 'research:extractUrl',
  RESEARCH_CAPTURE_SCREENSHOT: 'research:captureScreenshot',
  RESEARCH_DISCARD_SCREENSHOT: 'research:discardScreenshot',
  RESEARCH_GET_COLLECTION: 'research:getCollection',
  RESEARCH_UPDATE_SOURCE_INCLUSION: 'research:updateSourceInclusion',
  RESEARCH_CLEAR_COLLECTION: 'research:clearCollection',
  RESEARCH_VALIDATE_CITATIONS: 'research:validateCitations'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
