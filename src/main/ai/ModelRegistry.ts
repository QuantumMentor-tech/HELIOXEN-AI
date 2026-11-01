import { promises as fs } from 'fs'
import {
  AiProviderId,
  ModelDefinition,
  ProviderDefinition,
  CURATED_PROVIDERS,
  CURATED_MODELS
} from '../../shared/ai/models'
import { securityLogger } from '../security/securityLogger'
import { AiProviderException } from './errors'

interface CachedCatalogFile {
  version: number
  schema: 'helioxen.models.v1'
  timestamp: number
  discoveredModels: Record<string, ModelDefinition[]>
}

export class ModelRegistry {
  private cacheFilePath: string | null
  private curatedProviders: ProviderDefinition[]
  private discoveredCache: Map<AiProviderId, ModelDefinition[]> = new Map()

  constructor(cacheFilePath?: string, customCuratedProviders?: ProviderDefinition[]) {
    this.cacheFilePath = cacheFilePath ?? null
    this.curatedProviders = customCuratedProviders ?? CURATED_PROVIDERS
  }

  /**
   * Initializes the registry by loading any persisted discovered models from cache.
   * Does NOT make any network calls.
   */
  public async initialize(): Promise<void> {
    if (!this.cacheFilePath) return

    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf8')
      const parsed: CachedCatalogFile = JSON.parse(data)
      if (parsed.schema === 'helioxen.models.v1' && parsed.discoveredModels) {
        for (const [providerId, models] of Object.entries(parsed.discoveredModels)) {
          if (Array.isArray(models)) {
            // Validate model objects before trusting cache
            const validModels = models.filter(
              (m) =>
                m &&
                typeof m.id === 'string' &&
                m.providerId === providerId &&
                typeof m.displayName === 'string'
            )
            this.discoveredCache.set(providerId as AiProviderId, validModels)
          }
        }
      }
    } catch {
      // Missing or invalid cache file - curated catalog remains active baseline
    }
  }

  /**
   * Returns the authoritative list of providers and their registered models.
   * Merges curated catalog with any cached discovered models.
   */
  public getCatalog(): ProviderDefinition[] {
    return this.curatedProviders.map((provider) => {
      const discovered = this.discoveredCache.get(provider.id) || []
      const knownModelIds = new Set(provider.models.map((m) => m.id))

      // Append discovered models that aren't already represented in curated models
      const combinedModels = [...provider.models]
      for (const disc of discovered) {
        if (!knownModelIds.has(disc.id)) {
          combinedModels.push(disc)
          knownModelIds.add(disc.id)
        }
      }

      return {
        ...provider,
        models: combinedModels
      }
    })
  }

  /**
   * Retrieves a specific model definition for a given provider.
   */
  public getModel(providerId: AiProviderId, modelId: string): ModelDefinition | undefined {
    const catalog = this.getCatalog()
    const provider = catalog.find((p) => p.id === providerId)
    if (!provider) return undefined
    return provider.models.find((m) => m.id === modelId)
  }

  /**
   * Asserts whether a model ID belongs to the specified provider.
   */
  public isModelValidForProvider(providerId: AiProviderId, modelId: string): boolean {
    return this.getModel(providerId, modelId) !== undefined
  }

  /**
   * Explicit user-initiated dynamic model discovery for an approved provider.
   * Contacts official provider listing APIs, validates external metadata, and updates cache.
   * NEVER called automatically at startup.
   */
  public async refreshCatalog(
    providerId: AiProviderId,
    apiKey: string
  ): Promise<ProviderDefinition> {
    if (!apiKey || !apiKey.trim()) {
      throw new AiProviderException({
        code: 'MISSING_CREDENTIAL',
        provider: providerId,
        message: `Cannot refresh catalog for ${providerId}: API key is missing.`
      })
    }

    try {
      let discovered: ModelDefinition[] = []

      if (providerId === 'google-gemini') {
        discovered = await this.discoverGoogleGeminiModels(apiKey)
      } else if (providerId === 'openai') {
        discovered = await this.discoverOpenAiModels(apiKey)
      } else {
        throw new AiProviderException({
          code: 'PROVIDER_ERROR',
          provider: providerId,
          message: `Dynamic discovery is not supported for provider '${providerId}'`
        })
      }

      // Store in memory cache
      this.discoveredCache.set(providerId, discovered)

      // Persist to file cache
      await this.persistCache()

      securityLogger.logEvent('CATALOG_OPERATION', 'model-registry', 'PERMITTED', {
        provider: providerId,
        discoveredCount: discovered.length
      })

      const fullCatalog = this.getCatalog()
      const updatedProvider = fullCatalog.find((p) => p.id === providerId)
      if (!updatedProvider) {
        throw new Error(`Provider definition missing after refresh for ${providerId}`)
      }

      return updatedProvider
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      securityLogger.logEvent('CATALOG_OPERATION', 'model-registry', 'DENIED', {
        provider: providerId,
        error: message
      })

      if (err instanceof AiProviderException) {
        throw err
      }

      throw new AiProviderException({
        code: 'NETWORK_ERROR',
        provider: providerId,
        message: `Failed to refresh catalog for ${providerId}: ${message}`
      })
    }
  }

  /**
   * Queries Google Gemini models API.
   * GET https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}
   */
  private async discoverGoogleGeminiModels(apiKey: string): Promise<ModelDefinition[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        },
        signal: controller.signal
      })

      if (!res.ok) {
        throw new Error(`Google API returned status ${res.status}: ${res.statusText}`)
      }

      const json = (await res.json()) as {
        models?: Array<{
          name?: string
          displayName?: string
          description?: string
          inputTokenLimit?: number
          outputTokenLimit?: number
          supportedGenerationMethods?: string[]
        }>
      }

      if (!json.models || !Array.isArray(json.models)) {
        return []
      }

      const now = Date.now()
      const results: ModelDefinition[] = []

      for (const item of json.models) {
        if (!item.name) continue
        // Strip prefix "models/"
        const modelId = item.name.replace(/^models\//, '')

        // Only include models supporting generateContent
        if (
          item.supportedGenerationMethods &&
          !item.supportedGenerationMethods.includes('generateContent')
        ) {
          continue
        }

        // If we have curated verified metadata for this model, preserve verified capabilities
        const curated = CURATED_MODELS[modelId]
        if (curated && curated.providerId === 'google-gemini') {
          results.push({
            ...curated,
            source: 'discovered',
            lastVerified: now
          })
        } else {
          // Safe fallback for newly discovered, unverified models
          results.push({
            id: modelId,
            providerId: 'google-gemini',
            displayName: item.displayName || modelId,
            description: item.description || 'Discovered Gemini model from official API catalog.',
            isDefault: false,
            source: 'discovered',
            status: 'active',
            lastVerified: now,
            capabilities: {
              contextWindow: item.inputTokenLimit || 1048576,
              maxOutputTokens: item.outputTokenLimit || 8192,
              tier: 'balanced',
              modelLevel: {
                textGeneration: 'supported',
                streaming: 'supported',
                imageInput: 'unknown',
                audioInput: 'unknown',
                audioOutput: 'unknown',
                toolCalling: 'unknown',
                structuredOutput: 'unknown'
              },
              helioxenLevel: {
                textGeneration: 'supported',
                streaming: 'supported',
                imageInput: 'unsupported',
                audioInput: 'unsupported',
                audioOutput: 'unsupported',
                toolCalling: 'unsupported',
                structuredOutput: 'supported'
              }
            }
          })
        }
      }

      return results
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Queries OpenAI models API.
   * GET https://api.openai.com/v1/models
   */
  private async discoverOpenAiModels(apiKey: string): Promise<ModelDefinition[]> {
    const url = 'https://api.openai.com/v1/models'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      })

      if (!res.ok) {
        throw new Error(`OpenAI API returned status ${res.status}: ${res.statusText}`)
      }

      const json = (await res.json()) as {
        data?: Array<{
          id?: string
          owned_by?: string
        }>
      }

      if (!json.data || !Array.isArray(json.data)) {
        return []
      }

      const now = Date.now()
      const results: ModelDefinition[] = []

      for (const item of json.data) {
        if (!item.id) continue
        const modelId = item.id

        // Filter to standard GPT and reasoning chat models
        const isChatModel =
          modelId.startsWith('gpt-') ||
          modelId.startsWith('o1-') ||
          modelId.startsWith('o3-') ||
          modelId.startsWith('chatgpt-')

        if (!isChatModel) continue

        const curated = CURATED_MODELS[modelId]
        if (curated && curated.providerId === 'openai') {
          results.push({
            ...curated,
            source: 'discovered',
            lastVerified: now
          })
        } else {
          results.push({
            id: modelId,
            providerId: 'openai',
            displayName: modelId,
            description: 'Discovered OpenAI model from official API catalog.',
            isDefault: false,
            source: 'discovered',
            status: 'active',
            lastVerified: now,
            capabilities: {
              contextWindow: 128000,
              maxOutputTokens: 4096,
              tier: 'balanced',
              modelLevel: {
                textGeneration: 'supported',
                streaming: 'supported',
                imageInput: 'unknown',
                audioInput: 'unknown',
                audioOutput: 'unknown',
                toolCalling: 'unknown',
                structuredOutput: 'unknown'
              },
              helioxenLevel: {
                textGeneration: 'supported',
                streaming: 'supported',
                imageInput: 'unsupported',
                audioInput: 'unsupported',
                audioOutput: 'unsupported',
                toolCalling: 'unsupported',
                structuredOutput: 'supported'
              }
            }
          })
        }
      }

      return results
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Persists discovered cache atomically.
   */
  private async persistCache(): Promise<void> {
    if (!this.cacheFilePath) return

    const cacheData: CachedCatalogFile = {
      version: 1,
      schema: 'helioxen.models.v1',
      timestamp: Date.now(),
      discoveredModels: Object.fromEntries(this.discoveredCache.entries())
    }

    const tempPath = `${this.cacheFilePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(cacheData, null, 2), 'utf8')
    await fs.rename(tempPath, this.cacheFilePath)
  }
}
