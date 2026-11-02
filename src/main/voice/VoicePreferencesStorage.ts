import { promises as fs } from 'fs'
import {
  UserVoicePreferences,
  DEFAULT_VOICE_PREFERENCES
} from '../../shared/voice/types'
import {
  UserVoicePreferencesSchema,
  ValidatedUserVoicePreferences
} from '../../shared/voice/contracts'
import { securityLogger } from '../security/securityLogger'

export class VoicePreferencesStorage {
  private storageFilePath: string | null
  private preferences: UserVoicePreferences = { ...DEFAULT_VOICE_PREFERENCES }

  constructor(storageFilePath?: string) {
    this.storageFilePath = storageFilePath ?? null
  }

  /**
   * Initializes voice preferences from disk if present, falling back safely to defaults.
   */
  public async initialize(): Promise<void> {
    if (!this.storageFilePath) return

    try {
      const data = await fs.readFile(this.storageFilePath, 'utf8')
      const parsed = JSON.parse(data)
      const validated = UserVoicePreferencesSchema.safeParse(parsed)

      if (validated.success) {
        this.preferences = validated.data
        return
      }
    } catch {
      // Missing or invalid file - baseline defaults apply
    }

    this.preferences = { ...DEFAULT_VOICE_PREFERENCES }
  }

  /**
   * Returns a copy of the current voice preferences.
   * Note: The wakeWordEnabled preference reflects user configuration, but
   * does NOT authorize automatic background monitoring on startup.
   */
  public getPreferences(): UserVoicePreferences {
    return { ...this.preferences }
  }

  /**
   * Validates and persists updated voice preferences.
   */
  public async setPreferences(
    newPreferences: Partial<UserVoicePreferences>
  ): Promise<UserVoicePreferences> {
    const merged = {
      ...this.preferences,
      ...newPreferences
    }

    const validated = UserVoicePreferencesSchema.safeParse(merged)
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      throw new Error(`Invalid voice preferences payload: ${issues}`)
    }

    this.preferences = validated.data

    if (this.storageFilePath) {
      try {
        await fs.writeFile(this.storageFilePath, JSON.stringify(this.preferences, null, 2), 'utf8')
      } catch (err) {
        console.warn('[VoicePreferencesStorage] Failed to persist voice preferences to disk:', err)
      }
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'voice-service', 'PERMITTED', {
      capabilityId: 'voice:preferencesSet',
      wakeWord: this.preferences.selectedWakeWord,
      sensitivity: this.preferences.sensitivity,
      activationMode: this.preferences.activationMode
    })

    return { ...this.preferences }
  }

  /**
   * Resets stored preferences to clean defaults.
   */
  public async resetDefaults(): Promise<UserVoicePreferences> {
    return this.setPreferences({ ...DEFAULT_VOICE_PREFERENCES })
  }
}
