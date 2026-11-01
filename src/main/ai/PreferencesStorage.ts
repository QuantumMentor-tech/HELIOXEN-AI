import { promises as fs } from 'fs'
import {
  UserAiPreferences,
  DEFAULT_AI_PREFERENCES
} from '../../shared/ai/models'
import {
  UserAiPreferencesSchema,
  ValidatedUserAiPreferences
} from '../../shared/ai/contracts'
import { ModelRegistry } from './ModelRegistry'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

export class PreferencesStorage {
  private storageFilePath: string | null
  private modelRegistry: ModelRegistry
  private preferences: UserAiPreferences = { ...DEFAULT_AI_PREFERENCES }

  constructor(storageFilePath?: string, modelRegistry?: ModelRegistry) {
    this.storageFilePath = storageFilePath ?? null
    this.modelRegistry = modelRegistry ?? new ModelRegistry()
  }

  /**
   * Initializes preferences from disk if available, with safe fallback to defaults.
   */
  public async initialize(): Promise<void> {
    if (!this.storageFilePath) return

    try {
      const data = await fs.readFile(this.storageFilePath, 'utf8')
      const parsed = JSON.parse(data)
      const validated = UserAiPreferencesSchema.safeParse(parsed)

      if (validated.success) {
        // Validate that model exists for provider
        if (
          this.modelRegistry.isModelValidForProvider(
            validated.data.activeProvider,
            validated.data.activeModel
          )
        ) {
          this.preferences = validated.data
          return
        }
      }
    } catch {
      // Missing or corrupt preferences file - use safe defaults
    }

    this.preferences = { ...DEFAULT_AI_PREFERENCES }
  }

  /**
   * Returns the current valid user AI preferences.
   */
  public getPreferences(): UserAiPreferences {
    return { ...this.preferences }
  }

  /**
   * Validates and persists new user AI preferences.
   * Atomic file write via temporary file rename.
   */
  public async setPreferences(newPrefs: unknown): Promise<UserAiPreferences> {
    const parseResult = UserAiPreferencesSchema.safeParse(newPrefs)
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message).join('; ')
      throw new IpcException('VALIDATION_ERROR', `Invalid preferences payload: ${issues}`)
    }

    const valid = parseResult.data

    // Check provider-model consistency
    if (!this.modelRegistry.isModelValidForProvider(valid.activeProvider, valid.activeModel)) {
      throw new IpcException(
        'VALIDATION_ERROR',
        `Model '${valid.activeModel}' does not belong to provider '${valid.activeProvider}'`
      )
    }

    this.preferences = valid

    if (this.storageFilePath) {
      try {
        const tempPath = `${this.storageFilePath}.tmp`
        await fs.writeFile(tempPath, JSON.stringify(valid, null, 2), 'utf8')
        await fs.rename(tempPath, this.storageFilePath)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        securityLogger.logEvent('PREFERENCES_OPERATION', 'preferences-storage', 'DENIED', {
          error: `Failed to persist preferences: ${message}`
        })
        throw new IpcException('INTERNAL_ERROR', `Failed to persist preferences: ${message}`)
      }
    }

    securityLogger.logEvent('PREFERENCES_OPERATION', 'preferences-storage', 'PERMITTED', {
      activeProvider: valid.activeProvider,
      activeModel: valid.activeModel
    })

    return { ...this.preferences }
  }
}
