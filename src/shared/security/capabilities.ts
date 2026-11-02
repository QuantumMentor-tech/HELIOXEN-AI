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
