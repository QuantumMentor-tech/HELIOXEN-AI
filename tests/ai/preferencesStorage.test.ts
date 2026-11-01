import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { PreferencesStorage } from '../../src/main/ai/PreferencesStorage'
import { ModelRegistry } from '../../src/main/ai/ModelRegistry'
import { DEFAULT_AI_PREFERENCES } from '../../src/shared/ai/models'
import { IpcException } from '../../src/shared/ipc/errors'

describe('PreferencesStorage', () => {
  let tempDir: string
  let prefsFile: string
  let modelRegistry: ModelRegistry

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'helioxen-prefs-test-'))
    prefsFile = join(tempDir, 'ai_preferences.json')
    modelRegistry = new ModelRegistry()
    await modelRegistry.initialize()
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('initializes with default preferences when no storage file exists', async () => {
    const storage = new PreferencesStorage(prefsFile, modelRegistry)
    await storage.initialize()

    const prefs = storage.getPreferences()
    expect(prefs).toEqual(DEFAULT_AI_PREFERENCES)
    expect(prefs.activeProvider).toBe('google-gemini')
    expect(prefs.activeModel).toBe('gemini-3.8-flash')
  })

  it('persists and retrieves valid user preferences', async () => {
    const storage = new PreferencesStorage(prefsFile, modelRegistry)
    await storage.initialize()

    const updated = await storage.setPreferences({
      activeProvider: 'openai',
      activeModel: 'gpt-4o-mini',
      temperature: 0.2,
      stream: false
    })

    expect(updated.activeProvider).toBe('openai')
    expect(updated.activeModel).toBe('gpt-4o-mini')
    expect(updated.temperature).toBe(0.2)
    expect(updated.stream).toBe(false)

    // Re-read file to verify atomic persistence
    const fileContent = await fs.readFile(prefsFile, 'utf8')
    const parsed = JSON.parse(fileContent)
    expect(parsed.activeProvider).toBe('openai')
    expect(parsed.activeModel).toBe('gpt-4o-mini')
  })

  it('rejects cross-provider model mismatches during setPreferences', async () => {
    const storage = new PreferencesStorage(prefsFile, modelRegistry)
    await storage.initialize()

    // Request OpenAI provider with a Google Gemini model
    await expect(
      storage.setPreferences({
        activeProvider: 'openai',
        activeModel: 'gemini-3.8-flash',
        temperature: 0.7,
        stream: true
      })
    ).rejects.toThrow(IpcException)
  })

  it('rejects schema-violating preferences payloads', async () => {
    const storage = new PreferencesStorage(prefsFile, modelRegistry)
    await storage.initialize()

    await expect(
      storage.setPreferences({
        activeProvider: 'google-gemini',
        activeModel: 'gemini-3.8-flash',
        temperature: 5.0, // Invalid temperature
        stream: true
      })
    ).rejects.toThrow(IpcException)
  })

  it('recovers to default preferences if file is corrupted', async () => {
    await fs.writeFile(prefsFile, '{ corrupted json syntax', 'utf8')

    const storage = new PreferencesStorage(prefsFile, modelRegistry)
    await storage.initialize()

    const prefs = storage.getPreferences()
    expect(prefs).toEqual(DEFAULT_AI_PREFERENCES)
  })
})
