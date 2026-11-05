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
  RESEARCH_VALIDATE_CITATIONS: 'research:validateCitations',

  // Step 34: User Profile, Long-Term Memory & Consent-Based Personalization
  MEMORY_GET_STATE: 'memory:getState',
  MEMORY_SET_CONSENT: 'memory:setConsent',
  MEMORY_UPDATE_PROFILE: 'memory:updateProfile',
  MEMORY_CREATE: 'memory:create',
  MEMORY_LIST: 'memory:list',
  MEMORY_GET: 'memory:get',
  MEMORY_UPDATE: 'memory:update',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_CLEAR_ALL: 'memory:clearAll',
  MEMORY_RETRIEVE: 'memory:retrieve',
  MEMORY_PROPOSE_SUGGESTION: 'memory:proposeSuggestion',
  MEMORY_RESOLVE_SUGGESTION: 'memory:resolveSuggestion',

  // Step 35: Integrated Productivity System (Notes, Tasks, Reminders, Calendar, Daily Briefings)
  PRODUCTIVITY_GET_OVERVIEW: 'productivity:getOverview',
  PRODUCTIVITY_UPDATE_SETTINGS: 'productivity:updateSettings',
  PRODUCTIVITY_NOTE_CREATE: 'productivity:note:create',
  PRODUCTIVITY_NOTE_LIST: 'productivity:note:list',
  PRODUCTIVITY_NOTE_UPDATE: 'productivity:note:update',
  PRODUCTIVITY_NOTE_DELETE: 'productivity:note:delete',
  PRODUCTIVITY_TASK_CREATE: 'productivity:task:create',
  PRODUCTIVITY_TASK_LIST: 'productivity:task:list',
  PRODUCTIVITY_TASK_UPDATE: 'productivity:task:update',
  PRODUCTIVITY_TASK_COMPLETE_BY_TITLE: 'productivity:task:completeByTitle',
  PRODUCTIVITY_TASK_DELETE: 'productivity:task:delete',
  PRODUCTIVITY_REMINDER_CREATE: 'productivity:reminder:create',
  PRODUCTIVITY_REMINDER_LIST: 'productivity:reminder:list',
  PRODUCTIVITY_REMINDER_UPDATE: 'productivity:reminder:update',
  PRODUCTIVITY_REMINDER_SNOOZE: 'productivity:reminder:snooze',
  PRODUCTIVITY_REMINDER_DISMISS: 'productivity:reminder:dismiss',
  PRODUCTIVITY_REMINDER_CANCEL: 'productivity:reminder:cancel',
  PRODUCTIVITY_REMINDER_DELETE: 'productivity:reminder:delete',
  PRODUCTIVITY_CALENDAR_CREATE_EVENT: 'productivity:calendar:createEvent',
  PRODUCTIVITY_CALENDAR_LIST_EVENTS: 'productivity:calendar:listEvents',
  PRODUCTIVITY_CALENDAR_UPDATE_EVENT: 'productivity:calendar:updateEvent',
  PRODUCTIVITY_CALENDAR_DELETE_EVENT: 'productivity:calendar:deleteEvent',
  PRODUCTIVITY_CALENDAR_CONNECT_PROVIDER: 'productivity:calendar:connectProvider',
  PRODUCTIVITY_CALENDAR_DISCONNECT_PROVIDER: 'productivity:calendar:disconnectProvider',
  PRODUCTIVITY_CALENDAR_SYNC_PROVIDER: 'productivity:calendar:syncProvider',
  PRODUCTIVITY_BRIEFING_GENERATE: 'productivity:briefing:generate',
  PRODUCTIVITY_BRIEFING_GET_LATEST: 'productivity:briefing:getLatest',

  // Step 36: Media Gallery and Media Asset Management
  MEDIA_GET_OVERVIEW: 'media:getOverview',
  MEDIA_SELECT_AND_IMPORT_DIALOG: 'media:selectAndImportDialog',
  MEDIA_IMPORT_BATCH: 'media:importBatch',
  MEDIA_SAVE_CAPTURE: 'media:saveCapture',
  MEDIA_LIST_ASSETS: 'media:listAssets',
  MEDIA_GET_ASSET: 'media:getAsset',
  MEDIA_GET_PREVIEW: 'media:getPreview',
  MEDIA_UPDATE_METADATA: 'media:updateMetadata',
  MEDIA_RELINK_EXTERNAL: 'media:relinkExternal',
  MEDIA_CREATE_COLLECTION: 'media:createCollection',
  MEDIA_LIST_COLLECTIONS: 'media:listCollections',
  MEDIA_UPDATE_COLLECTION: 'media:updateCollection',
  MEDIA_DELETE_COLLECTION: 'media:deleteCollection',
  MEDIA_MODIFY_COLLECTION_MEMBERSHIP: 'media:modifyCollectionMembership',
  MEDIA_REMOVE_FROM_LIBRARY: 'media:removeFromLibrary',
  MEDIA_DELETE_MANAGED_PERMANENTLY: 'media:deleteManagedPermanently',
  MEDIA_BULK_OPERATION: 'media:bulkOperation',

  // Step 37: VisualHub, Mermaid Visualization, and AI Image Generation
  VISUAL_GET_OVERVIEW: 'visual:getOverview',
  VISUAL_RENDER_MERMAID: 'visual:renderMermaid',
  VISUAL_SAVE_DIAGRAM: 'visual:saveDiagram',
  VISUAL_LIST_DIAGRAMS: 'visual:listDiagrams',
  VISUAL_DELETE_DIAGRAM: 'visual:deleteDiagram',
  VISUAL_EXPORT_DIAGRAM: 'visual:exportDiagram',
  VISUAL_SAVE_DIAGRAM_TO_GALLERY: 'visual:saveDiagramToGallery',
  VISUAL_GET_IMAGE_MODELS: 'visual:getImageModels',
  VISUAL_GENERATE_IMAGE: 'visual:generateImage',
  VISUAL_CANCEL_IMAGE_GENERATION: 'visual:cancelImageGeneration',
  VISUAL_SAVE_IMAGE_TO_GALLERY: 'visual:saveImageToGallery',
  VISUAL_DISCARD_IMAGE_CANDIDATE: 'visual:discardImageCandidate',
  VISUAL_UPDATE_PREFERENCES: 'visual:updatePreferences',

  // Step 38: World Monitor, Interactive Globe, Geographic Maps, and News Intelligence
  WORLD_GET_OVERVIEW: 'world:getOverview',
  WORLD_QUERY_FEED: 'world:queryFeed',
  WORLD_REFRESH_FEED: 'world:refreshFeed',
  WORLD_SEARCH_LOCATIONS: 'world:searchLocations',
  WORLD_TOGGLE_BOOKMARK: 'world:toggleBookmark',
  WORLD_OPEN_SOURCE_URL: 'world:openSourceUrl',
  WORLD_UPDATE_PREFERENCES: 'world:updatePreferences',

  // Step 39: System Health, Network Monitoring, and Weather Widgets
  WIDGETS_GET_SYSTEM_HEALTH: 'widgets:getSystemHealth',
  WIDGETS_GET_NETWORK_STATUS: 'widgets:getNetworkStatus',
  WIDGETS_RUN_NETWORK_DIAGNOSTIC: 'widgets:runNetworkDiagnostic',
  WIDGETS_CANCEL_NETWORK_DIAGNOSTIC: 'widgets:cancelNetworkDiagnostic',
  WIDGETS_SEARCH_WEATHER_LOCATIONS: 'widgets:searchWeatherLocations',
  WIDGETS_GET_WEATHER_FORECAST: 'widgets:getWeatherForecast',
  WIDGETS_GET_PREFERENCES: 'widgets:getPreferences',
  WIDGETS_UPDATE_PREFERENCES: 'widgets:updatePreferences',

  // Step 40: Agent Town, Plugin Connectors, and Dynamic Skills Framework
  AGENTS_GET_OVERVIEW: 'agents:getOverview',
  AGENTS_LIST: 'agents:list',
  AGENTS_SET_ENABLED: 'agents:setEnabled',
  PLUGINS_LIST: 'plugins:list',
  PLUGINS_SET_ENABLED: 'plugins:setEnabled',
  CONNECTORS_CONNECT: 'connectors:connect',
  CONNECTORS_DISCONNECT: 'connectors:disconnect',
  CONNECTORS_UPDATE_SCOPES: 'connectors:updateScopes',
  SKILLS_LIST: 'skills:list',
  SKILLS_GET: 'skills:get',
  SKILLS_VALIDATE: 'skills:validate',
  SKILLS_DRY_RUN: 'skills:dryRun',
  SKILLS_SAVE: 'skills:save',
  SKILLS_SET_STATUS: 'skills:setStatus',
  SKILLS_DELETE: 'skills:delete',
  SKILLS_EXECUTE: 'skills:execute',

  // Step 41: Multi-Agent Collaboration, Delegation, and Coordinated Task Execution
  AGENTS_COORDINATE_TASK: 'agents:coordinateTask',
  AGENTS_GET_COORDINATED_TASK: 'agents:getCoordinatedTask',
  AGENTS_LIST_COORDINATED_TASKS: 'agents:listCoordinatedTasks',
  AGENTS_CANCEL_COORDINATED_TASK: 'agents:cancelCoordinatedTask',

  // Step 42: Advanced Dynamic Skill Studio, Validation, Testing, Versioning, and Safe Evolution
  SKILLS_VALIDATE_STAGED: 'skills:validateStaged',
  SKILLS_CREATE_VERSION: 'skills:createVersion',
  SKILLS_LIST_VERSIONS: 'skills:listVersions',
  SKILLS_GET_VERSION: 'skills:getVersion',
  SKILLS_COMPARE_VERSIONS: 'skills:compareVersions',
  SKILLS_ROLLBACK_VERSION: 'skills:rollbackVersion',
  SKILLS_CREATE_SCENARIO: 'skills:createScenario',
  SKILLS_LIST_SCENARIOS: 'skills:listScenarios',
  SKILLS_DELETE_SCENARIO: 'skills:deleteScenario',
  SKILLS_RUN_SCENARIO: 'skills:runScenario',
  SKILLS_RUN_REGRESSION_TESTS: 'skills:runRegressionTests',
  SKILLS_EXPORT_PACKAGE: 'skills:exportPackage',
  SKILLS_PREVIEW_IMPORT: 'skills:previewImport',
  SKILLS_IMPORT_PACKAGE: 'skills:importPackage',
  SKILLS_GENERATE_AI_DRAFT: 'skills:generateAiDraft',
  SKILLS_REFINE_AI_DRAFT: 'skills:refineAiDraft',

  // Step 43: Office Document Studio, Spreadsheets, Presentations, and AI Productivity
  OFFICE_LIST_DOCUMENTS: 'office:listDocuments',
  OFFICE_GET_DOCUMENT: 'office:getDocument',
  OFFICE_SAVE_DOCUMENT: 'office:saveDocument',
  OFFICE_DELETE_DOCUMENT: 'office:deleteDocument',
  OFFICE_LIST_TEMPLATES: 'office:listTemplates',
  OFFICE_CREATE_FROM_TEMPLATE: 'office:createFromTemplate',
  OFFICE_EXPORT_DOCUMENT: 'office:exportDocument',
  OFFICE_IMPORT_DOCUMENT: 'office:importDocument',
  OFFICE_GENERATE_AI_DRAFT: 'office:generateAiDraft',
  OFFICE_REWRITE_TEXT_AI: 'office:rewriteTextAi',
  OFFICE_SUGGEST_FORMULA_AI: 'office:suggestFormulaAi',

  // Step 44: Communication & Media Integrations
  INTEGRATIONS_LIST: 'integrations:list',
  INTEGRATIONS_GET: 'integrations:get',
  INTEGRATIONS_CONNECT: 'integrations:connect',
  INTEGRATIONS_DISCONNECT: 'integrations:disconnect',
  INTEGRATIONS_HEALTH_CHECK: 'integrations:healthCheck',

  COMMUNICATION_LIST_MESSAGES: 'communication:listMessages',
  COMMUNICATION_GET_MESSAGE: 'communication:getMessage',
  COMMUNICATION_SEARCH_MESSAGES: 'communication:searchMessages',
  COMMUNICATION_CREATE_DRAFT: 'communication:createDraft',
  COMMUNICATION_GET_DRAFT: 'communication:getDraft',
  COMMUNICATION_UPDATE_DRAFT: 'communication:updateDraft',
  COMMUNICATION_DELETE_DRAFT: 'communication:deleteDraft',
  COMMUNICATION_LIST_DRAFTS: 'communication:listDrafts',
  COMMUNICATION_REQUEST_SEND_CONFIRMATION: 'communication:requestSendConfirmation',
  COMMUNICATION_CONFIRM_AND_SEND: 'communication:confirmAndSend',
  COMMUNICATION_GENERATE_AI_DRAFT: 'communication:generateAiDraft',

  MEDIA_INTEGRATION_SEARCH: 'mediaIntegration:search',
  MEDIA_INTEGRATION_GET_PLAYBACK_STATE: 'mediaIntegration:getPlaybackState',
  MEDIA_INTEGRATION_CONTROL_PLAYBACK: 'mediaIntegration:controlPlayback',
  MEDIA_INTEGRATION_LIST_DEVICES: 'mediaIntegration:listDevices',
  MEDIA_INTEGRATION_LIST_PLAYLISTS: 'mediaIntegration:listPlaylists',

  // Step 45: Optional Android and Smart-Home Integrations
  DEVICES_LIST_ANDROID: 'devices:listAndroid',
  DEVICES_GET_ANDROID_STATUS: 'devices:getAndroidStatus',
  DEVICES_PAIR_ANDROID: 'devices:pairAndroid',
  DEVICES_DISCONNECT_ANDROID: 'devices:disconnectAndroid',
  DEVICES_EXECUTE_ANDROID_ACTION: 'devices:executeAndroidAction',

  SMART_HOME_GET_HUB_STATUS: 'smartHome:getHubStatus',
  SMART_HOME_CONNECT_HUB: 'smartHome:connectHub',
  SMART_HOME_DISCONNECT_HUB: 'smartHome:disconnectHub',
  SMART_HOME_LIST_ENTITIES: 'smartHome:listEntities',
  SMART_HOME_GET_ENTITY_STATE: 'smartHome:getEntityState',
  SMART_HOME_REQUEST_SECURITY_CONFIRMATION: 'smartHome:requestSecurityConfirmation',
  SMART_HOME_EXECUTE_ACTION: 'smartHome:executeAction',

  // Step 46: Crash Recovery, Verified Backups, Data Integrity, and Controlled Self-Repair Boundaries
  RECOVERY_GET_STATUS: 'recovery:getStatus',
  RECOVERY_LIST_BACKUPS: 'recovery:listBackups',
  RECOVERY_CREATE_BACKUP: 'recovery:createBackup',
  RECOVERY_VERIFY_BACKUP: 'recovery:verifyBackup',
  RECOVERY_RESTORE_PREVIEW: 'recovery:restorePreview',
  RECOVERY_EXECUTE_RESTORE: 'recovery:executeRestore',
  RECOVERY_RUN_DIAGNOSTICS: 'recovery:runDiagnostics',
  RECOVERY_EXECUTE_REPAIR: 'recovery:executeRepair'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
