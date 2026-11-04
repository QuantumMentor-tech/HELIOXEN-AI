/**
 * Authoritative capability definitions and risk tiers for HELIOXEN AI.
 * Enforces least-privilege execution across process boundaries.
 */

export type RiskTier = 'low' | 'moderate' | 'high' | 'prohibited'

export type AllowedRequester = 'renderer-main-window' | 'main-only' | 'none'

export type CapabilityStatus = 'active' | 'deferred' | 'prohibited'

export interface CapabilityDefinition {
  /** Unique stable capability identifier */
  readonly id: string
  /** Human-readable display name */
  readonly name: string
  /** Description of what this capability grants */
  readonly description: string
  /** Risk classification tier */
  readonly riskTier: RiskTier
  /** Authorized execution origin */
  readonly allowedRequester: AllowedRequester
  /** Whether explicit human confirmation is required prior to execution */
  readonly requiresHumanConsent: boolean
  /** Implementation status in current roadmap */
  readonly status: CapabilityStatus
}

export const CAPABILITIES: Record<string, CapabilityDefinition> = {
  // --- Active Low-Risk Window Controls ---
  'window:minimize': {
    id: 'window:minimize',
    name: 'Minimize Window',
    description: 'Minimizes the primary application desktop window to the taskbar.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'window:maximize': {
    id: 'window:maximize',
    name: 'Maximize / Restore Window',
    description: 'Toggles between maximized and restored window geometry.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'window:close': {
    id: 'window:close',
    name: 'Close Window',
    description: 'Terminates and closes the primary application desktop window.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'window:isMaximized': {
    id: 'window:isMaximized',
    name: 'Query Maximize State',
    description: 'Queries whether the desktop window is currently in maximized state.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Main-Only Credential Vault Capabilities ---
  'credential:store': {
    id: 'credential:store',
    name: 'Store Encrypted Credential',
    description: 'Encrypts and persists an API key or secret via native DPAPI safeStorage.',
    riskTier: 'moderate',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:storeSecret': {
    id: 'credentials:storeSecret',
    name: 'Store Encrypted Credential (Alias)',
    description: 'Encrypts and persists an API key or secret via native DPAPI safeStorage.',
    riskTier: 'moderate',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credential:retrieve': {
    id: 'credential:retrieve',
    name: 'Retrieve Decrypted Credential',
    description: 'Decrypts an API key for internal main-process provider dispatch.',
    riskTier: 'high',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:retrieveSecret': {
    id: 'credentials:retrieveSecret',
    name: 'Retrieve Decrypted Credential (Alias)',
    description: 'Decrypts an API key for internal main-process provider dispatch.',
    riskTier: 'high',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credential:delete': {
    id: 'credential:delete',
    name: 'Delete Credential',
    description: 'Permanently removes an encrypted credential from the secure vault.',
    riskTier: 'moderate',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:deleteSecret': {
    id: 'credentials:deleteSecret',
    name: 'Delete Credential (Alias)',
    description: 'Permanently removes an encrypted credential from the secure vault.',
    riskTier: 'moderate',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credential:list': {
    id: 'credential:list',
    name: 'List Credential Metadata',
    description: 'Lists non-sensitive metadata (labels, providers, dates) without secrets.',
    riskTier: 'low',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:listMetadata': {
    id: 'credentials:listMetadata',
    name: 'List Credential Metadata (Alias)',
    description: 'Lists non-sensitive metadata (labels, providers, dates) without secrets.',
    riskTier: 'low',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:deleteAllSecrets': {
    id: 'credentials:deleteAllSecrets',
    name: 'Purge All Credentials',
    description: 'Destructively wipes all stored credentials. High-risk, requires Two-Tier Human Confirmation Gate.',
    riskTier: 'high',
    allowedRequester: 'main-only',
    requiresHumanConsent: true,
    status: 'active'
  },

  // --- Deferred High-Risk Tool Execution (Roadmap Phase 5 & 6) ---
  'tool:execute': {
    id: 'tool:execute',
    name: 'Execute Desktop Tool',
    description: 'Dispatches structured desktop agent tools under Two-Tier Human Approval Gate.',
    riskTier: 'high',
    allowedRequester: 'main-only',
    requiresHumanConsent: true,
    status: 'deferred'
  },
  // --- Active AI Provider & Conversation Capabilities (Phase 6, Step 16) ---
  'ai:providerInvoke': {
    id: 'ai:providerInvoke',
    name: 'Invoke AI Provider',
    description: 'Dispatches prompts to external LLM provider APIs (Step 16+).',
    riskTier: 'moderate',
    allowedRequester: 'main-only',
    requiresHumanConsent: false,
    status: 'active'
  },
  'ai:chat': {
    id: 'ai:chat',
    name: 'AI Chat Generation',
    description: 'Requests text generation or streaming response from approved AI providers.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:set': {
    id: 'credentials:set',
    name: 'Set Provider Credential',
    description: 'Stores or updates an API key securely in the DPAPI vault.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:getStatus': {
    id: 'credentials:getStatus',
    name: 'Query Credential Status',
    description: 'Queries whether approved provider credentials exist in the vault without revealing secrets.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:delete': {
    id: 'credentials:delete',
    name: 'Delete Provider Credential',
    description: 'Deletes an API key from the secure DPAPI vault.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'credentials:test': {
    id: 'credentials:test',
    name: 'Test Provider Connection',
    description: 'Executes an explicit, user-initiated test call to an approved provider.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'models:getCatalog': {
    id: 'models:getCatalog',
    name: 'Get Model Catalog',
    description: 'Retrieves the authoritative provider and model catalog with capability profiles.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'models:refresh': {
    id: 'models:refresh',
    name: 'Refresh Model Catalog',
    description: 'Performs explicit user-initiated discovery of available models from an approved provider.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'preferences:get': {
    id: 'preferences:get',
    name: 'Get AI Preferences',
    description: 'Retrieves persisted user AI preferences including active provider and model.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'preferences:set': {
    id: 'preferences:set',
    name: 'Set AI Preferences',
    description: 'Persists user AI preferences (active provider, model, generation settings).',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'health:getStatus': {
    id: 'health:getStatus',
    name: 'Get Provider Health Status',
    description: 'Retrieves evidence-based operational health status for registered AI providers.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'routing:getTaskDefinitions': {
    id: 'routing:getTaskDefinitions',
    name: 'Get Routing Task Definitions',
    description: 'Retrieves supported task classification definitions and required capability profiles.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'audio:getPermissionStatus': {
    id: 'audio:getPermissionStatus',
    name: 'Get Audio Permission Status',
    description: 'Queries OS and application microphone access permission status.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'audio:getDevices': {
    id: 'audio:getDevices',
    name: 'Enumerate Audio Input Devices',
    description: 'Lists connected microphone hardware devices.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'audio:microphoneCapture': {
    id: 'audio:microphoneCapture',
    name: 'Microphone Audio Capture',
    description: 'Captures local hardware microphone audio stream for STT and voice dock (Phase 7, Step 19).',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'voice:preferencesGet': {
    id: 'voice:preferencesGet',
    name: 'Query Voice Preferences',
    description: 'Retrieves persisted voice, audio quality, and wake-word preferences.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'voice:preferencesSet': {
    id: 'voice:preferencesSet',
    name: 'Update Voice Preferences',
    description: 'Persists user voice settings, audio quality parameters, and wake-word configuration.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'voice:wakeWordMonitoring': {
    id: 'voice:wakeWordMonitoring',
    name: 'Local Wake-Word Monitoring',
    description: 'Executes on-device acoustic keyword spotting for explicit wake-word activation (Phase 7, Step 21).',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },

  // --- Multimodal Input & Context (Phase 8, Step 22-23) ---
  'capture:getSources': {
    id: 'capture:getSources',
    name: 'Enumerate Desktop Display Sources',
    description: 'Enumerates active screens and windows for explicit user-initiated display capture.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'capture:checkPermission': {
    id: 'capture:checkPermission',
    name: 'Query Media Capture Permission',
    description: 'Queries OS media access permission for camera or screen capture.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'documents:select': {
    id: 'documents:select',
    name: 'Select Document Files',
    description: 'Opens native file selection dialog for user-approved document attachments.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'documents:extract': {
    id: 'documents:extract',
    name: 'Extract Document Content',
    description: 'Safely extracts normalized text from authorized document formats (.txt, .md, .pdf, .docx).',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'documents:validate': {
    id: 'documents:validate',
    name: 'Validate Document File',
    description: 'Validates document size, format, and structure against security bounds.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Tool Registry & Schema Capabilities (Phase 9, Step 25) ---
  'tools:list': {
    id: 'tools:list',
    name: 'Query Tool Registry',
    description: 'Queries available tool definitions and capability requirements.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'tools:get': {
    id: 'tools:get',
    name: 'Resolve Tool Definition',
    description: 'Retrieves complete metadata for an approved registered tool identifier.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'tools:validate': {
    id: 'tools:validate',
    name: 'Validate Tool Payload',
    description: 'Validates candidate tool input or output payloads against registered typed schemas.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'workspace:readContext': {
    id: 'workspace:readContext',
    name: 'Read Workspace Context Summary',
    description: 'Reads aggregated conversation context statistics and active source metrics.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Task Planner & Orchestration Capabilities (Phase 9, Step 26) ---
  'orchestration:plan': {
    id: 'orchestration:plan',
    name: 'Plan Agent Task',
    description: 'Analyzes user requests and constructs structured, dependency-checked task plans.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'orchestration:execute': {
    id: 'orchestration:execute',
    name: 'Execute Multi-Step Plan',
    description: 'Coordinates and dispatches validated multi-step tool plans under capability and consent gates.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'orchestration:cancel': {
    id: 'orchestration:cancel',
    name: 'Cancel Agent Task',
    description: 'Requests cooperative cancellation and resource cleanup for active tasks.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'orchestration:audit': {
    id: 'orchestration:audit',
    name: 'Inspect Execution Audit Trail',
    description: 'Queries sanitized execution lifecycle events and verification history.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 28: Desktop Awareness & Telemetry Capabilities ---
  'telemetry:readSystemHealth': {
    id: 'telemetry:readSystemHealth',
    name: 'Read System Health Telemetry',
    description: 'Retrieves non-invasive host and process CPU, memory, uptime, and storage capacity metrics.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'telemetry:readInstalledApps': {
    id: 'telemetry:readInstalledApps',
    name: 'Read Installed Applications Inventory',
    description: 'Enumerates registered desktop application names, publishers, and categories from Start Menu metadata.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'telemetry:readDesktopWindows': {
    id: 'telemetry:readDesktopWindows',
    name: 'Read Desktop Windows Metadata',
    description: 'Lists permitted top-level desktop windows and application associations without screen content capture.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 29: Filesystem & Clipboard Operations Capabilities ---
  'filesystem:read': {
    id: 'filesystem:read',
    name: 'Read Files and Directories',
    description: 'Permits bounded directory listing, metadata inspection, file searching, and text reading in authorized roots.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'filesystem:write': {
    id: 'filesystem:write',
    name: 'Create, Copy and Move Files',
    description: 'Permits creating, copying, moving, and renaming individual files within authorized root scopes.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'filesystem:organize': {
    id: 'filesystem:organize',
    name: 'Apply Reversible File Organization',
    description: 'Executes multi-file organization plans under verified transaction manifest tracking.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'clipboard:read': {
    id: 'clipboard:read',
    name: 'Read System Clipboard',
    description: 'Retrieves current clipboard text or image content on explicit user request.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'clipboard:write': {
    id: 'clipboard:write',
    name: 'Write to System Clipboard',
    description: 'Copies user-approved text or content into the system clipboard.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 30: Desktop Interaction & System Operations Capabilities ---
  'desktop:focusWindow': {
    id: 'desktop:focusWindow',
    name: 'Focus Desktop Window',
    description: 'Brings an explicitly verified application or desktop window into focused state.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'desktop:mouseAction': {
    id: 'desktop:mouseAction',
    name: 'Execute Controlled Mouse Action',
    description: 'Dispatches bounded pointer movements, clicks, and scroll actions to a verified target window.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'desktop:keyAction': {
    id: 'desktop:keyAction',
    name: 'Execute Controlled Keyboard Action',
    description: 'Invokes named, allowlisted keyboard shortcuts on a verified focused target.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'desktop:sendText': {
    id: 'desktop:sendText',
    name: 'Enter Approved Text',
    description: 'Types user-approved text into a verified target input context without implicit submission.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'desktop:emergencyStop': {
    id: 'desktop:emergencyStop',
    name: 'Emergency Stop Desktop Interaction',
    description: 'Immediately halts active desktop automation sequences and releases held modifiers.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'desktop:undo': {
    id: 'desktop:undo',
    name: 'Undo Desktop Interaction',
    description: 'Performs verified undo on reversible desktop interactions.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'system:openPath': {
    id: 'system:openPath',
    name: 'Open Path in Default Application',
    description: 'Opens a verified, authorized file or directory using the operating system default handler.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'system:showInFolder': {
    id: 'system:showInFolder',
    name: 'Show Item in File Manager',
    description: 'Reveals a verified file or directory in Windows File Explorer.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'system:openExternalUrl': {
    id: 'system:openExternalUrl',
    name: 'Open External URL in Default Browser',
    description: 'Opens a validated HTTP or HTTPS web address in the user default browser.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'system:systemAlert': {
    id: 'system:systemAlert',
    name: 'Trigger System Alert Sound',
    description: 'Triggers the standard operating system notification beep.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'system:getDisplayMetrics': {
    id: 'system:getDisplayMetrics',
    name: 'Get Display Metrics',
    description: 'Retrieves primary and active display dimensions, scale factors, and work areas.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 31: Browser Services & Web Interaction Capabilities ---
  'browser:createSession': {
    id: 'browser:createSession',
    name: 'Create Browser Session Profile',
    description: 'Creates or configures an isolated in-memory or persistent browser session partition.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:manageTabs': {
    id: 'browser:manageTabs',
    name: 'Manage Browser Tabs',
    description: 'Creates, switches, closes, and inspects browser tabs within an authorized session.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:navigate': {
    id: 'browser:navigate',
    name: 'Navigate Browser Tab',
    description: 'Navigates an isolated browser tab to a validated HTTP or HTTPS web address.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:clearSession': {
    id: 'browser:clearSession',
    name: 'Clear Browser Session Storage',
    description: 'Clears cookies, cache, and web storage data for a specific browser session profile.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:closeSession': {
    id: 'browser:closeSession',
    name: 'Close Browser Session',
    description: 'Disposes a browser session and closes all associated tabs.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 33: Browser Agent Automation & Download Capabilities ---
  'browser:inspectPage': {
    id: 'browser:inspectPage',
    name: 'Inspect Browser Page Elements',
    description: 'Discovers visible interactive controls, inputs, and form definitions on an authorized page.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:interact': {
    id: 'browser:interact',
    name: 'Browser Interaction (Click & Scroll)',
    description: 'Executes verified clicks and viewport scrolling on an authorized browser tab.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:fillForm': {
    id: 'browser:fillForm',
    name: 'Fill Non-Sensitive Form Fields',
    description: 'Enters user-provided data into non-sensitive form inputs without implicit submission.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'browser:submitForm': {
    id: 'browser:submitForm',
    name: 'Submit Browser Form',
    description: 'Submits an online web form to external endpoints under explicit human confirmation.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'browser:download': {
    id: 'browser:download',
    name: 'Browser Download Management',
    description: 'Intercepts, approves, or cancels downloads with path traversal and dangerous extension protection.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 32: Web Research Capabilities ---
  'research:webSearch': {
    id: 'research:webSearch',
    name: 'Web Search',
    description: 'Executes approved web search queries and normalizes results.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'research:extractContent': {
    id: 'research:extractContent',
    name: 'Webpage Content Extraction',
    description: 'Extracts structured, read-only text and headings from authorized browser tabs or URLs.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'research:captureScreenshot': {
    id: 'research:captureScreenshot',
    name: 'Browser Viewport Screenshot',
    description: 'Captures a temporary viewport screenshot of an authorized browser tab.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'research:manageResults': {
    id: 'research:manageResults',
    name: 'Manage Research Results & Citations',
    description: 'Manages task-scoped research collections, context inclusion, and citation verification.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 34: User Profile, Long-Term Memory & Consent-Based Personalization ---
  'memory:read': {
    id: 'memory:read',
    name: 'Read User Profile & Long-Term Memory',
    description: 'Reads user profile preferences, consent settings, and stored long-term memories.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'memory:write': {
    id: 'memory:write',
    name: 'Create & Update Long-Term Memory',
    description: 'Creates, edits, or proposes user-approved long-term memories and personalization preferences.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'memory:delete': {
    id: 'memory:delete',
    name: 'Delete Individual Memory Record',
    description: 'Permanently removes an individual stored memory record and invalidates retrieval caches.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'memory:clearAll': {
    id: 'memory:clearAll',
    name: 'Clear All Stored Memories',
    description: 'Destructively clears all stored memories for a profile under explicit human confirmation.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'memory:manageConsent': {
    id: 'memory:manageConsent',
    name: 'Manage Long-Term Memory Consent',
    description: 'Enables, disables, or updates user consent settings for persistent memory and cloud disclosure.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 35: Integrated Productivity System (Notes, Tasks, Reminders, Calendar, Daily Briefings) ---
  'productivity:notes': {
    id: 'productivity:notes',
    name: 'Manage Productivity Notes',
    description: 'Creates, searches, updates, pins, archives, and deletes user notes.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'productivity:tasks': {
    id: 'productivity:tasks',
    name: 'Manage Productivity Tasks',
    description: 'Creates, lists, updates, completes, and deletes user task items.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'productivity:reminders': {
    id: 'productivity:reminders',
    name: 'Schedule & Manage Reminders',
    description: 'Schedules, snoozes, dismisses, and cancels local and recurring reminders.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'productivity:calendarLocal': {
    id: 'productivity:calendarLocal',
    name: 'Manage Local Calendar Events',
    description: 'Reads, creates, updates, and deletes local calendar events.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'productivity:calendarExternalWrite': {
    id: 'productivity:calendarExternalWrite',
    name: 'Modify External Connected Calendar',
    description: 'Creates, modifies, or deletes events on an external connected calendar provider under explicit human confirmation.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },
  'productivity:briefing': {
    id: 'productivity:briefing',
    name: 'Generate & View Daily Briefings',
    description: 'Assembles grounded daily briefings from notes, tasks, reminders, and calendar events.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 36: Media Gallery and Media Asset Management ---
  'media:read': {
    id: 'media:read',
    name: 'Browse & Preview Media Assets',
    description: 'Lists, searches, and previews authorized media assets and collections in the Media Gallery.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'media:import': {
    id: 'media:import',
    name: 'Import Media Assets',
    description: 'Validates and imports user-selected image, video, and audio files or approved captures into the Media Gallery.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'media:organize': {
    id: 'media:organize',
    name: 'Organize Media Metadata, Tags & Collections',
    description: 'Updates asset display names, tags, favorites, and collection memberships.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'media:remove': {
    id: 'media:remove',
    name: 'Remove Media Entry from Library',
    description: 'Removes a media entry from the gallery while preserving any external user source file.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'media:deletePermanent': {
    id: 'media:deletePermanent',
    name: 'Permanently Delete Managed Media Asset',
    description: 'Permanently deletes an application-managed media copy and its thumbnail under explicit human confirmation.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: true,
    status: 'active'
  },

  // --- Step 37: VisualHub, Mermaid Visualization, and AI Image Generation ---
  'visual:mermaid': {
    id: 'visual:mermaid',
    name: 'Validate, Render & Manage Mermaid Diagrams',
    description: 'Validates, renders, and persists Mermaid diagrams inside VisualHub with strict SVG security controls.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'visual:exportDiagram': {
    id: 'visual:exportDiagram',
    name: 'Export Mermaid Diagram (.mmd, .svg, .png)',
    description: 'Exports a validated Mermaid diagram to an approved destination path or Media Gallery.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'visual:generateImage': {
    id: 'visual:generateImage',
    name: 'Generate AI Image via Approved Provider',
    description: 'Submits an explicit user-confirmed image generation prompt to a verified AI provider adapter.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'visual:saveToGallery': {
    id: 'visual:saveToGallery',
    name: 'Save Generated Visual Asset to Media Gallery',
    description: 'Persists a user-approved generated image or exported diagram into the Step 36 Media Gallery with provenance metadata.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 38: World Monitor, Interactive Globe, Geographic Maps, and News Intelligence ---
  'world:read': {
    id: 'world:read',
    name: 'Browse World Monitor Globe, Map & News Feed',
    description: 'Queries cached news records, geographic markers, story clusters, and gazetteer locations in World Monitor.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'world:refreshFeed': {
    id: 'world:refreshFeed',
    name: 'Refresh Authorized News Intelligence Feeds',
    description: 'Fetches bounded metadata updates from approved public news and science feeds while respecting rate limits.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'world:openSource': {
    id: 'world:openSource',
    name: 'Open Validated Original News Source Link',
    description: 'Opens an explicitly validated HTTPS/HTTP original article link in the default system browser.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 39: System Health, Network Monitoring, and Weather Widgets ---
  'widgets:readSystemHealth': {
    id: 'widgets:readSystemHealth',
    name: 'Read Local System Health Metrics',
    description: 'Allows reading local OS memory, CPU, battery, and process health telemetry.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'widgets:runNetworkDiagnostic': {
    id: 'widgets:runNetworkDiagnostic',
    name: 'Run Bounded Network Diagnostics',
    description: 'Allows executing a user-initiated bounded HTTPS test to an approved diagnostic endpoint.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'widgets:readWeather': {
    id: 'widgets:readWeather',
    name: 'Read Weather Forecast & Locations',
    description: 'Allows searching weather locations and retrieving normalized forecast data from authorized providers.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'widgets:managePreferences': {
    id: 'widgets:managePreferences',
    name: 'Manage Widget Preferences',
    description: 'Allows reading and updating local widget display preferences and settings.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 40: Agent Town, Plugin Connectors, and Dynamic Skills ---
  'agents:read': {
    id: 'agents:read',
    name: 'Read Agent Town Overview & Agents',
    description: 'Allows querying registered agents, plugin status, and skills catalog.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'agents:manage': {
    id: 'agents:manage',
    name: 'Manage Agent Configuration',
    description: 'Allows enabling or disabling registered agents and updating agent preferences.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'plugins:manage': {
    id: 'plugins:manage',
    name: 'Manage Plugin Connectors',
    description: 'Allows toggling plugin activation, connecting/disconnecting external connectors, and managing scopes.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'skills:author': {
    id: 'skills:author',
    name: 'Author Dynamic Skills',
    description: 'Allows creating, editing, validating, dry-running, and managing declarative dynamic skills.',
    riskTier: 'low',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },
  'skills:execute': {
    id: 'skills:execute',
    name: 'Execute Dynamic Skills',
    description: 'Allows executing composed declarative skills through the authoritative task execution engine.',
    riskTier: 'high',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Step 41: Multi-Agent Collaboration, Delegation, and Coordinated Task Execution ---
  'agents:coordinate': {
    id: 'agents:coordinate',
    name: 'Coordinate Multi-Agent Collaboration',
    description: 'Allows dispatching, inspecting, and cancelling coordinated multi-agent delegation plans and tasks.',
    riskTier: 'moderate',
    allowedRequester: 'renderer-main-window',
    requiresHumanConsent: false,
    status: 'active'
  },

  // --- Permanently Prohibited Capabilities ---
  'shell:execute': {
    id: 'shell:execute',
    name: 'Arbitrary Shell Execution',
    description: 'Direct execution of raw bash, cmd, or powershell commands. Permanently banned per ADR-013.',
    riskTier: 'prohibited',
    allowedRequester: 'none',
    requiresHumanConsent: false,
    status: 'prohibited'
  },
  'shell:executeCommand': {
    id: 'shell:executeCommand',
    name: 'Arbitrary Shell Command Execution',
    description: 'Execution of arbitrary OS shell commands. Permanently banned per ADR-013.',
    riskTier: 'prohibited',
    allowedRequester: 'none',
    requiresHumanConsent: false,
    status: 'prohibited'
  },
  'os:runScript': {
    id: 'os:runScript',
    name: 'Arbitrary Script Execution',
    description: 'Execution of arbitrary scripts directly on the host OS. Permanently prohibited.',
    riskTier: 'prohibited',
    allowedRequester: 'none',
    requiresHumanConsent: false,
    status: 'prohibited'
  }
} as const
