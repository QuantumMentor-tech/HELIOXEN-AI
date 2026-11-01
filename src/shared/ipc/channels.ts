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
  AUDIO_GET_DEVICES: 'audio:getDevices'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
