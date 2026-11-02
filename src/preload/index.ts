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
  HelioxenDocumentsApi
} from './types'
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

import { HelioxenToolsApi, HelioxenOrchestrationApi } from './types'
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
  orchestration: orchestrationApi
})

try {
  contextBridge.exposeInMainWorld('helioxen', helioxenApi)
} catch (error) {
  console.error('[Preload] Context bridge initialization failed:', error)
}
