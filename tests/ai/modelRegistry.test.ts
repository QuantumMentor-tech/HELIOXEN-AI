import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { ModelRegistry } from '../../src/main/ai/ModelRegistry'
import { AiProviderException } from '../../src/main/ai/errors'

describe('ModelRegistry & Capability Profiles', () => {
  let tempDir: string
  let cacheFile: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'helioxen-models-test-'))
    cacheFile = join(tempDir, 'model_catalog.json')
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
    vi.restoreAllMocks()
  })

  it('loads curated catalog with verified providers and default models', async () => {
    const registry = new ModelRegistry(cacheFile)
    await registry.initialize()

    const catalog = registry.getCatalog()
    expect(catalog.length).toBe(2)

    const gemini = catalog.find((p) => p.id === 'google-gemini')
    expect(gemini).toBeDefined()
    expect(gemini?.defaultModelId).toBe('gemini-3.8-flash')
    expect(gemini?.models.some((m) => m.id === 'gemini-3.8-flash')).toBe(true)
    expect(gemini?.models.some((m) => m.id === 'gemini-3.5-flash-lite')).toBe(true)

    const openAi = catalog.find((p) => p.id === 'openai')
    expect(openAi).toBeDefined()
    expect(openAi?.defaultModelId).toBe('gpt-4o-mini')
    expect(openAi?.models.some((m) => m.id === 'gpt-4o-mini')).toBe(true)
  })

  it('asserts model ownership and rejects cross-provider model mismatches', async () => {
    const registry = new ModelRegistry(cacheFile)
    await registry.initialize()

    // Valid combinations
    expect(registry.isModelValidForProvider('google-gemini', 'gemini-3.8-flash')).toBe(true)
    expect(registry.isModelValidForProvider('openai', 'gpt-4o-mini')).toBe(true)

    // Cross-provider mismatches
    expect(registry.isModelValidForProvider('google-gemini', 'gpt-4o-mini')).toBe(false)
    expect(registry.isModelValidForProvider('openai', 'gemini-3.8-flash')).toBe(false)

    // Completely unknown model
    expect(registry.isModelValidForProvider('google-gemini', 'unknown-model-xyz')).toBe(false)
  })

  it('maintains strict distinction between model-level and HELIOXEN-level capabilities', async () => {
    const registry = new ModelRegistry(cacheFile)
    await registry.initialize()

    const geminiFlash = registry.getModel('google-gemini', 'gemini-3.8-flash')
    expect(geminiFlash).toBeDefined()

    // Model level has vision & audio support documented
    expect(geminiFlash?.capabilities.modelLevel.textGeneration).toBe('supported')
    expect(geminiFlash?.capabilities.modelLevel.streaming).toBe('supported')
    expect(geminiFlash?.capabilities.modelLevel.imageInput).toBe('supported')
    expect(geminiFlash?.capabilities.modelLevel.audioInput).toBe('supported')

    // But HELIOXEN runtime only integrates text generation & streaming at Step 17
    expect(geminiFlash?.capabilities.helioxenLevel.textGeneration).toBe('supported')
    expect(geminiFlash?.capabilities.helioxenLevel.streaming).toBe('supported')
    expect(geminiFlash?.capabilities.helioxenLevel.imageInput).toBe('unsupported')
    expect(geminiFlash?.capabilities.helioxenLevel.audioInput).toBe('unsupported')
    expect(geminiFlash?.capabilities.helioxenLevel.toolCalling).toBe('unsupported')
  })

  it('rejects dynamic discovery when API key is missing', async () => {
    const registry = new ModelRegistry(cacheFile)
    await registry.initialize()

    await expect(registry.refreshCatalog('google-gemini', '')).rejects.toThrow(
      AiProviderException
    )
  })

  it('performs dynamic discovery and merges discovered models without corrupting curated models', async () => {
    const registry = new ModelRegistry(cacheFile)
    await registry.initialize()

    // Mock global fetch for Google Gemini API
    const mockApiResponse = {
      models: [
        {
          name: 'models/gemini-3.8-flash',
          displayName: 'Gemini 3.8 Flash',
          supportedGenerationMethods: ['generateContent', 'countTokens']
        },
        {
          name: 'models/gemini-2.5-pro-experimental',
          displayName: 'Gemini 2.5 Pro Experimental',
          description: 'Newly discovered experimental model',
          inputTokenLimit: 2000000,
          outputTokenLimit: 8192,
          supportedGenerationMethods: ['generateContent']
        },
        {
          name: 'models/text-embedding-004',
          displayName: 'Embedding Model',
          supportedGenerationMethods: ['embedContent'] // Should be filtered out
        }
      ]
    }

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    } as unknown as Response)

    try {
      const refreshed = await registry.refreshCatalog('google-gemini', 'AIzaSyFakeKey')
      expect(refreshed.models.length).toBeGreaterThanOrEqual(4)

      // Verified curated model retains its curated capabilities and provenance
      const flash = registry.getModel('google-gemini', 'gemini-3.8-flash')
      expect(flash?.id).toBe('gemini-3.8-flash')
      expect(flash?.source).toBe('curated')

      // Newly discovered model has safe defaults with unknown model-level capabilities
      const expModel = registry.getModel('google-gemini', 'gemini-2.5-pro-experimental')
      expect(expModel).toBeDefined()
      expect(expModel?.source).toBe('discovered')
      expect(expModel?.capabilities.modelLevel.imageInput).toBe('unknown')
      expect(expModel?.capabilities.helioxenLevel.imageInput).toBe('unsupported')

      // Embedding model without generateContent is filtered out
      expect(registry.getModel('google-gemini', 'text-embedding-004')).toBeUndefined()

      // Cache file was written
      const cachedRaw = await fs.readFile(cacheFile, 'utf8')
      const parsed = JSON.parse(cachedRaw)
      expect(parsed.schema).toBe('helioxen.models.v1')
      expect(parsed.discoveredModels['google-gemini']).toBeDefined()
    } finally {
      global.fetch = originalFetch
    }
  })

  it('safely recovers and retains curated catalog when cache is corrupt', async () => {
    // Write corrupt JSON to cache file
    await fs.writeFile(cacheFile, '{ invalid json structure !!! }', 'utf8')

    const registry = new ModelRegistry(cacheFile)
    await registry.initialize()

    const catalog = registry.getCatalog()
    expect(catalog.length).toBe(2)
    expect(registry.isModelValidForProvider('google-gemini', 'gemini-3.8-flash')).toBe(true)
  })
})
