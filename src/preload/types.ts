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
 * Authoritative type definitions for the HELIOXEN Preload Bridge.
 * Shared between the preload script and renderer environment declarations.
 */

export interface HelioxenWindowApi {
  /** Minimize the primary application window */
  minimize: () => Promise<void>
  /** Toggle between maximized and restored window geometry */
  maximize: () => Promise<void>
  /** Close the primary application window */
  close: () => Promise<void>
  /** Query whether the window is currently maximized */
  isMaximized: () => Promise<boolean>
  /**
   * Subscribe to native maximize / restore state changes.
   * Returns an unsubscribe function to remove the listener.
   */
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

export interface HelioxenAiApi {
  /**
   * Requests text generation or streaming response from the configured AI provider.
   */
  generateText: (request: AiGenerationRequest) => Promise<AiGenerationResponse>
  /**
   * Cancels an ongoing text generation or streaming request.
   */
  cancel: () => Promise<void>
  /**
   * Subscribes to real-time streaming chunks from the AI provider.
   */
  onStreamChunk: (callback: (chunk: AiStreamChunk) => void) => () => void
}

export interface HelioxenCredentialsApi {
  /**
   * Securely saves an API key into the native DPAPI vault.
   */
  set: (params: { provider: AiProviderId; apiKey: string; label?: string }) => Promise<void>
  /**
   * Queries whether credentials are configured for approved providers without leaking secrets.
   */
  getStatus: () => Promise<Record<AiProviderId, ProviderCredentialStatus>>
  /**
   * Deletes a credential from the secure vault.
   */
  delete: (provider: AiProviderId) => Promise<boolean>
  /**
   * Explicitly tests provider connectivity. Only initiated by user action.
   */
  test: (provider: AiProviderId) => Promise<ProviderTestResult>
}

export interface HelioxenModelsApi {
  /**
   * Retrieves the authoritative model catalog with capability profiles.
   */
  getCatalog: () => Promise<ProviderDefinition[]>
  /**
   * Explicit user-initiated dynamic discovery refresh for an approved provider.
   */
  refresh: (provider: AiProviderId) => Promise<ProviderDefinition>
}

export interface HelioxenPreferencesApi {
  /**
   * Retrieves persisted user AI preferences.
   */
  get: () => Promise<UserAiPreferences>
  /**
   * Validates and persists user AI preferences.
   */
  set: (preferences: UserAiPreferences) => Promise<UserAiPreferences>
}

export interface HelioxenHealthApi {
  /**
   * Retrieves evidence-based operational health status for registered providers.
   */
  getStatus: () => Promise<Record<AiProviderId, ProviderHealthRecord>>
}

export interface HelioxenRoutingApi {
  /**
   * Retrieves supported task classifications and required capability profiles.
   */
  getTaskDefinitions: () => Promise<Record<AiTaskType, TaskRequirement>>
}

import { AudioPermissionStatus, AudioDeviceInfo } from '../shared/audio/types'

export interface HelioxenAudioApi {
  /**
   * Queries OS and application microphone access permission status.
   */
  getPermissionStatus: () => Promise<AudioPermissionStatus>
  /**
   * Enumerates connected microphone hardware input devices.
   */
  getDevices: () => Promise<AudioDeviceInfo[]>
}

export interface HelioxenApi {
  /** Operating system platform (e.g., 'win32', 'darwin', 'linux') */
  readonly platform: string
  /** Runtime environment (e.g., 'development' or 'production') */
  readonly environment: string
  /** Application semver version */
  readonly version: string
  /** Narrow native window control operations */
  readonly window: HelioxenWindowApi
  /** AI Provider text generation operations */
  readonly ai: HelioxenAiApi
  /** Secure credential management operations */
  readonly credentials: HelioxenCredentialsApi
  /** Model catalog and capability profiles */
  readonly models: HelioxenModelsApi
  /** User AI preferences persistence */
  readonly preferences: HelioxenPreferencesApi
  /** Provider health monitoring status */
  readonly health: HelioxenHealthApi
  /** Task-based model routing definitions */
  readonly routing: HelioxenRoutingApi
  /** Local audio device discovery and permission operations */
  readonly audio: HelioxenAudioApi
}
