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
  HelioxenAudioApi
} from './types'
import { AudioPermissionStatus, AudioDeviceInfo } from '../shared/audio/types'
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
  audio: audioApi
})

try {
  contextBridge.exposeInMainWorld('helioxen', helioxenApi)
} catch (error) {
  console.error('[Preload] Context bridge initialization failed:', error)
}
