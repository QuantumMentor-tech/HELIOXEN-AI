import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { existsSync, unlinkSync, mkdirSync } from 'fs'
import { VoicePreferencesStorage } from '../../src/main/voice/VoicePreferencesStorage'
import { DEFAULT_VOICE_PREFERENCES } from '../../src/shared/voice/types'

describe('VoicePreferencesStorage (Step 21 Persistence & Atomic Safe-Writes)', () => {
  const testDir = join(__dirname, '../../test-scratch')
  const testFilePath = join(testDir, `test_voice_preferences_${Date.now()}.json`)
  let storage: VoicePreferencesStorage

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
    storage = new VoicePreferencesStorage(testFilePath)
    await storage.initialize()
  })

  afterEach(() => {
    if (existsSync(testFilePath)) {
      try {
        unlinkSync(testFilePath)
      } catch {
        // Ignore test cleanup error
      }
    }
  })

  it('initializes with default preferences when no file exists', () => {
    const prefs = storage.getPreferences()
    expect(prefs).toEqual(DEFAULT_VOICE_PREFERENCES)
    expect(prefs.wakeWordEnabled).toBe(false)
    expect(prefs.selectedWakeWord).toBe('helioxen')
    expect(prefs.sensitivity).toBe('balanced')
    expect(prefs.activationMode).toBe('confirm')
  })

  it('persists valid preferences atomically and reads them back accurately', async () => {
    const updated = await storage.setPreferences({
      ...DEFAULT_VOICE_PREFERENCES,
      wakeWordEnabled: true,
      selectedWakeWord: 'hey-helioxen',
      sensitivity: 'high',
      activationMode: 'auto-session',
      speechRate: 1.2,
      speechPitch: 0.95
    })

    expect(updated.wakeWordEnabled).toBe(true)
    expect(updated.selectedWakeWord).toBe('hey-helioxen')
    expect(updated.sensitivity).toBe('high')
    expect(updated.activationMode).toBe('auto-session')

    // Reload from disk in a fresh instance
    const freshStorage = new VoicePreferencesStorage(testFilePath)
    await freshStorage.initialize()
    const loaded = freshStorage.getPreferences()

    expect(loaded.selectedWakeWord).toBe('hey-helioxen')
    expect(loaded.speechRate).toBe(1.2)
  })

  it('rejects invalid or malformed preferences and preserves previous state', async () => {
    await storage.setPreferences({
      ...DEFAULT_VOICE_PREFERENCES,
      selectedWakeWord: 'hey-helioxen'
    })

    // Malformed rate out of schema bounds (> 2.0)
    await expect(
      storage.setPreferences({
        ...DEFAULT_VOICE_PREFERENCES,
        speechRate: 10.0
      })
    ).rejects.toThrow()

    // Previous valid configuration is preserved
    const current = storage.getPreferences()
    expect(current.selectedWakeWord).toBe('hey-helioxen')
  })

  it('resets to defaults cleanly', async () => {
    await storage.setPreferences({
      ...DEFAULT_VOICE_PREFERENCES,
      selectedWakeWord: 'hey-helioxen'
    })

    const reset = await storage.resetDefaults()
    expect(reset).toEqual(DEFAULT_VOICE_PREFERENCES)
    expect(storage.getPreferences().selectedWakeWord).toBe('helioxen')
  })
})
