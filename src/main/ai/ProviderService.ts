import {
  AiProviderId,
  AiGenerationRequest,
  AiGenerationResponse,
  AiStreamChunk,
  ProviderCredentialStatus,
  ProviderTestResult,
  AiProviderAdapter,
  AiProviderImageGenerationRequest,
  AiProviderImageGenerationResponse
} from '../../shared/ai/types'
import { ProviderDefinition, DEFAULT_AI_PREFERENCES } from '../../shared/ai/models'
import { ProviderHealthRecord } from '../../shared/ai/routing'
import { GeminiAdapter } from './adapters/GeminiAdapter'
import { OpenAiAdapter } from './adapters/OpenAiAdapter'
import { CredentialStorageService } from '../security/credentialStorage'
import { ModelRegistry } from './ModelRegistry'
import { ModelRouter } from './ModelRouter'
import { PreferencesStorage } from './PreferencesStorage'
import { authorizer } from '../security/authorizer'
import { securityLogger } from '../security/securityLogger'
import { AiProviderException } from './errors'
import { IpcException } from '../../shared/ipc/errors'

export class ProviderService {
  private adapters: Map<AiProviderId, AiProviderAdapter> = new Map()
  private credentialStorage: CredentialStorageService
  private modelRegistry: ModelRegistry
  private modelRouter: ModelRouter
  private preferencesStorage?: PreferencesStorage

  constructor(
    credentialStorage: CredentialStorageService,
    customAdapters?: Map<AiProviderId, AiProviderAdapter>,
    modelRegistry?: ModelRegistry,
    modelRouter?: ModelRouter,
    preferencesStorage?: PreferencesStorage
  ) {
    this.credentialStorage = credentialStorage
    this.modelRegistry = modelRegistry ?? new ModelRegistry()
    this.modelRouter = modelRouter ?? new ModelRouter(this.modelRegistry)
    this.preferencesStorage = preferencesStorage

    if (customAdapters) {
      this.adapters = customAdapters
    } else {
      this.adapters.set('google-gemini', new GeminiAdapter())
      this.adapters.set('openai', new OpenAiAdapter())
    }
  }

  public getModelRegistry(): ModelRegistry {
    return this.modelRegistry
  }

  public getModelRouter(): ModelRouter {
    return this.modelRouter
  }

  private getCredentialKey(provider: AiProviderId): string {
    return `provider:${provider}`
  }

  /**
   * Retrieves an API key from the secure DPAPI vault for the specified provider.
   * Strictly restricted to internal trusted main-process execution.
   */
  private async getApiKey(provider: AiProviderId): Promise<string> {
    const keyId = this.getCredentialKey(provider)
    const secret = await this.credentialStorage.retrieveSecret(keyId)

    if (!secret || !secret.trim()) {
      securityLogger.logEvent('CREDENTIAL_OPERATION', 'ai-service', 'DENIED', {
        capabilityId: 'credential:retrieve',
        reason: `API key not configured for provider '${provider}'`
      })
      throw new AiProviderException({
        code: 'MISSING_CREDENTIAL',
        provider,
        message: `API credential for ${provider} is not configured. Please set your key in Settings.`
      })
    }

    return secret
  }

  public getAdapter(provider: AiProviderId): AiProviderAdapter {
    const adapter = this.adapters.get(provider)
    if (!adapter) {
      throw new AiProviderException({
        code: 'PROVIDER_ERROR',
        provider,
        message: `No approved adapter available for provider '${provider}'`
      })
    }
    return adapter
  }

  /**
   * Generates a complete text response through the routed provider adapter.
   * Dispatches to fallback candidates when eligible failures occur according to policy.
   */
  public async generateText(
    request: AiGenerationRequest,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse> {
    // 1. Authorize main-only provider invocation capability
    authorizer.authorize('ai:providerInvoke', { requester: 'main-only' })

    const preferences = this.preferencesStorage
      ? this.preferencesStorage.getPreferences()
      : {
          ...DEFAULT_AI_PREFERENCES,
          activeProvider: request.provider || DEFAULT_AI_PREFERENCES.activeProvider,
          activeModel: request.model || DEFAULT_AI_PREFERENCES.activeModel
        }

    const credStatuses = await this.getCredentialStatus()
    const decision = this.modelRouter.route(request, preferences, credStatuses)

    let currentProvider = decision.selectedProvider
    let currentModel = decision.selectedModel

    while (true) {
      const adapter = this.getAdapter(currentProvider)
      const apiKey = await this.getApiKey(currentProvider)

      securityLogger.logEvent('AUTHORIZATION_CHECK', 'ai-service', 'PERMITTED', {
        capabilityId: 'ai:providerInvoke',
        provider: currentProvider,
        model: currentModel
      })

      try {
        const response = await adapter.generateText(
          { ...request, provider: currentProvider, model: currentModel },
          apiKey,
          signal
        )

        this.modelRouter.getHealthService().recordSuccess(currentProvider)
        return {
          ...response,
          provider: currentProvider,
          model: currentModel
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          throw new AiProviderException({
            code: 'CANCELLED',
            provider: currentProvider,
            message: 'Generation cancelled by user'
          })
        }

        const errorCode =
          err instanceof AiProviderException ? err.code : 'PROVIDER_ERROR'
        const errorMessage = err instanceof Error ? err.message : String(err)

        this.modelRouter.getHealthService().recordFailure(currentProvider, errorCode, errorMessage)

        // Determine if an eligible fallback candidate is available
        const fallback = this.modelRouter.getNextFallback(
          decision,
          currentProvider,
          currentModel,
          errorCode,
          preferences
        )

        if (!fallback) {
          if (err instanceof AiProviderException) throw err
          throw new AiProviderException({
            code: errorCode,
            provider: currentProvider,
            message: errorMessage
          })
        }

        securityLogger.logEvent('ROUTING_DECISION', 'ai-service', 'PERMITTED', {
          reason: `Falling back from ${currentProvider}:${currentModel} to ${fallback.provider}:${fallback.model}`,
          fallbackReason: fallback.reason
        })

        decision.fallbackCandidates = decision.fallbackCandidates.filter(
          (c) => !(c.provider === fallback.provider && c.model === fallback.model)
        )
        currentProvider = fallback.provider
        currentModel = fallback.model
      }
    }
  }

  /**
   * Streams text chunks through the routed provider adapter.
   * Strictly avoids blending partial token streams across providers.
   */
  public async streamText(
    request: AiGenerationRequest,
    onChunk: (chunk: AiStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse> {
    authorizer.authorize('ai:providerInvoke', { requester: 'main-only' })

    const preferences = this.preferencesStorage
      ? this.preferencesStorage.getPreferences()
      : {
          ...DEFAULT_AI_PREFERENCES,
          activeProvider: request.provider || DEFAULT_AI_PREFERENCES.activeProvider,
          activeModel: request.model || DEFAULT_AI_PREFERENCES.activeModel
        }

    const credStatuses = await this.getCredentialStatus()
    const decision = this.modelRouter.route(request, preferences, credStatuses)

    let currentProvider = decision.selectedProvider
    let currentModel = decision.selectedModel

    while (true) {
      const adapter = this.getAdapter(currentProvider)
      const apiKey = await this.getApiKey(currentProvider)

      securityLogger.logEvent('AUTHORIZATION_CHECK', 'ai-service', 'PERMITTED', {
        capabilityId: 'ai:providerInvoke',
        provider: currentProvider,
        model: currentModel
      })

      let chunksEmitted = 0

      try {
        const response = await adapter.streamText(
          { ...request, provider: currentProvider, model: currentModel },
          apiKey,
          (chunk) => {
            chunksEmitted += 1
            onChunk({
              ...chunk,
              provider: currentProvider,
              model: currentModel
            })
          },
          signal
        )

        this.modelRouter.getHealthService().recordSuccess(currentProvider)
        return {
          ...response,
          provider: currentProvider,
          model: currentModel
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          throw new AiProviderException({
            code: 'CANCELLED',
            provider: currentProvider,
            message: 'Streaming cancelled by user'
          })
        }

        const errorCode =
          err instanceof AiProviderException ? err.code : 'PROVIDER_ERROR'
        const errorMessage = err instanceof Error ? err.message : String(err)

        this.modelRouter.getHealthService().recordFailure(currentProvider, errorCode, errorMessage)

        // Strict Requirement: Never blend partial stream chunks across providers
        if (chunksEmitted > 0) {
          if (err instanceof AiProviderException) throw err
          throw new AiProviderException({
            code: errorCode,
            provider: currentProvider,
            message: `Stream interrupted after ${chunksEmitted} chunk(s): ${errorMessage}`
          })
        }

        // Only evaluate fallback if zero chunks have reached the user
        const fallback = this.modelRouter.getNextFallback(
          decision,
          currentProvider,
          currentModel,
          errorCode,
          preferences
        )

        if (!fallback) {
          if (err instanceof AiProviderException) throw err
          throw new AiProviderException({
            code: errorCode,
            provider: currentProvider,
            message: errorMessage
          })
        }

        securityLogger.logEvent('ROUTING_DECISION', 'ai-service', 'PERMITTED', {
          reason: `Falling back from ${currentProvider}:${currentModel} to ${fallback.provider}:${fallback.model}`,
          fallbackReason: fallback.reason
        })

        decision.fallbackCandidates = decision.fallbackCandidates.filter(
          (c) => !(c.provider === fallback.provider && c.model === fallback.model)
        )
        currentProvider = fallback.provider
        currentModel = fallback.model
      }
    }
  }

  /**
   * Returns operational health records for all approved providers.
   */
  public getHealthStatus(): Record<AiProviderId, ProviderHealthRecord> {
    authorizer.authorize('health:getStatus', { requester: 'main-only' })
    return this.modelRouter.getHealthService().getAllHealth()
  }

  /**
   * Returns the authoritative list of providers and their registered models with capability profiles.
   */
  public getModelCatalog(): ProviderDefinition[] {
    authorizer.authorize('models:getCatalog', { requester: 'main-only' })
    return this.modelRegistry.getCatalog()
  }

  /**
   * Explicit user-triggered dynamic catalog discovery.
   */
  public async refreshCatalog(provider: AiProviderId): Promise<ProviderDefinition> {
    authorizer.authorize('models:refresh', { requester: 'main-only' })
    const apiKey = await this.getApiKey(provider)
    return this.modelRegistry.refreshCatalog(provider, apiKey)
  }

  /**
   * Returns non-sensitive credential configuration status for approved providers.
   * NEVER returns decrypted secret keys.
   */
  public async getCredentialStatus(): Promise<Record<AiProviderId, ProviderCredentialStatus>> {
    authorizer.authorize('credentials:listMetadata', { requester: 'main-only' })

    const metadataList = await this.credentialStorage.listMetadata()
    const metadataMap = new Map(metadataList.map((m) => [m.id, m]))

    const result: Record<AiProviderId, ProviderCredentialStatus> = {
      'google-gemini': {
        provider: 'google-gemini',
        configured: false
      },
      openai: {
        provider: 'openai',
        configured: false
      }
    }

    for (const provider of ['google-gemini', 'openai'] as const) {
      const keyId = this.getCredentialKey(provider)
      const record = metadataMap.get(keyId)
      if (record) {
        result[provider] = {
          provider,
          configured: true,
          label: record.label,
          updatedAt: record.updatedAt
        }
      }
    }

    return result
  }

  /**
   * Securely saves an API key into the DPAPI vault.
   */
  public async setCredential(
    provider: AiProviderId,
    apiKey: string,
    label?: string
  ): Promise<void> {
    authorizer.authorize('credential:store', { requester: 'main-only' })

    if (!apiKey || !apiKey.trim()) {
      throw new IpcException('VALIDATION_ERROR', 'API key cannot be empty')
    }

    const keyId = this.getCredentialKey(provider)
    const displayLabel = label || `${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} API Key`

    await this.credentialStorage.storeSecret(keyId, provider, displayLabel, apiKey.trim())

    securityLogger.logEvent('CREDENTIAL_OPERATION', 'ai-service', 'PERMITTED', {
      capabilityId: 'credential:store',
      provider,
      details: { keyId, label: displayLabel }
    })
  }

  /**
   * Securely deletes an API key from the DPAPI vault.
   */
  public async deleteCredential(provider: AiProviderId): Promise<boolean> {
    authorizer.authorize('credential:delete', { requester: 'main-only' })

    const keyId = this.getCredentialKey(provider)
    const deleted = await this.credentialStorage.deleteSecret(keyId)

    securityLogger.logEvent('CREDENTIAL_OPERATION', 'ai-service', 'PERMITTED', {
      capabilityId: 'credential:delete',
      provider,
      details: { keyId, deleted }
    })

    return deleted
  }

  /**
   * Performs an explicit, user-initiated connection test to the provider.
   * Dispatches a minimal single-word prompt ("ping") to verify authentication.
   */
  public async testConnection(provider: AiProviderId): Promise<ProviderTestResult> {
    authorizer.authorize('ai:providerInvoke', { requester: 'main-only' })

    const adapter = this.getAdapter(provider)
    const apiKey = await this.getApiKey(provider)
    const startTime = Date.now()

    try {
      await adapter.generateText(
        {
          provider,
          model: adapter.defaultModel,
          messages: [{ role: 'user', content: 'Respond with the single word: OK' }],
          maxTokens: 5,
          temperature: 0
        },
        apiKey
      )

      this.modelRouter.getHealthService().recordSuccess(provider)

      return {
        provider,
        success: true,
        model: adapter.defaultModel,
        latencyMs: Date.now() - startTime
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.modelRouter.getHealthService().recordFailure(provider, 'AUTHENTICATION_FAILED', message)

      return {
        provider,
        success: false,
        model: adapter.defaultModel,
        latencyMs: Date.now() - startTime,
        errorMessage: message
      }
    }
  }

  /**
   * Executes an explicit user-authorized image generation request through the approved provider adapter.
   * Enforces capability checks, DPAPI credential retrieval, and health tracking.
   */
  public async generateImage(
    request: AiProviderImageGenerationRequest,
    signal?: AbortSignal
  ): Promise<AiProviderImageGenerationResponse> {
    authorizer.authorize('ai:providerInvoke', { requester: 'main-only' })

    const adapter = this.getAdapter(request.provider)
    if (typeof adapter.generateImage !== 'function') {
      throw new AiProviderException({
        code: 'PROVIDER_ERROR',
        provider: request.provider,
        message: `Provider adapter '${request.provider}' does not support image generation.`
      })
    }

    const isHealthy = this.modelRouter.getHealthService().isProviderAvailable(request.provider)
    if (!isHealthy) {
      throw new AiProviderException({
        code: 'PROVIDER_ERROR',
        provider: request.provider,
        message: `Provider '${request.provider}' is currently unhealthy or rate-limited.`
      })
    }

    const apiKey = await this.getApiKey(request.provider)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'ai-service', 'PERMITTED', {
      capabilityId: 'ai:providerInvoke',
      provider: request.provider,
      model: request.model
    })

    try {
      const response = await adapter.generateImage(request, apiKey, signal)
      this.modelRouter.getHealthService().recordSuccess(request.provider)
      return response
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw new AiProviderException({
          code: 'CANCELLED',
          provider: request.provider,
          message: 'Image generation cancelled by user'
        })
      }
      const errorCode = err instanceof AiProviderException ? err.code : 'PROVIDER_ERROR'
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.modelRouter.getHealthService().recordFailure(request.provider, errorCode, errorMessage)
      if (err instanceof AiProviderException) throw err
      throw new AiProviderException({
        code: errorCode,
        provider: request.provider,
        message: errorMessage
      })
    }
  }
}
