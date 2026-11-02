import { describe, it, expect } from 'vitest'
import {
  WakeWordSchema,
  WakeWordSensitivitySchema,
  WakeWordActivationModeSchema,
  WakeWordStatusSchema,
  WakeWordDetectionEventSchema,
  AudioQualityMetricsSchema,
  UserVoicePreferencesSchema
} from '../../src/shared/voice/contracts'
import { DEFAULT_VOICE_PREFERENCES } from '../../src/shared/voice/types'

describe('Wake-Word Contracts and Zod Validation Schemas (Step 21)', () => {
  it('validates supported wake words and rejects unapproved names', () => {
    expect(WakeWordSchema.safeParse('helioxen').success).toBe(true)
    expect(WakeWordSchema.safeParse('hey-helioxen').success).toBe(true)
    expect(WakeWordSchema.safeParse('alexa').success).toBe(false)
    expect(WakeWordSchema.safeParse('hey-siri').success).toBe(false)
    expect(WakeWordSchema.safeParse('').success).toBe(false)
  })

  it('validates detection sensitivity settings', () => {
    expect(WakeWordSensitivitySchema.safeParse('low').success).toBe(true)
    expect(WakeWordSensitivitySchema.safeParse('balanced').success).toBe(true)
    expect(WakeWordSensitivitySchema.safeParse('high').success).toBe(true)
    expect(WakeWordSensitivitySchema.safeParse('ultra').success).toBe(false)
  })

  it('validates activation modes', () => {
    expect(WakeWordActivationModeSchema.safeParse('confirm').success).toBe(true)
    expect(WakeWordActivationModeSchema.safeParse('auto-session').success).toBe(true)
    expect(WakeWordActivationModeSchema.safeParse('execute-command').success).toBe(false)
  })

  it('validates all 11 lifecycle statuses of the wake-word state machine', () => {
    const statuses = [
      'disabled',
      'enabling',
      'awaiting-permission',
      'initializing-engine',
      'monitoring',
      'wake-word-detected',
      'handing-off',
      'temporarily-suspended',
      'stopping',
      'recoverable-error',
      'fatal-error'
    ]

    for (const s of statuses) {
      expect(WakeWordStatusSchema.safeParse(s).success).toBe(true)
    }

    expect(WakeWordStatusSchema.safeParse('idle').success).toBe(false)
    expect(WakeWordStatusSchema.safeParse('listening').success).toBe(false)
  })

  it('validates structured detection events with required telemetry', () => {
    const validEvent = {
      wakeWord: 'helioxen',
      confidence: 0.88,
      timestamp: Date.now(),
      energy: 0.42,
      durationMs: 820
    }

    const result = WakeWordDetectionEventSchema.safeParse(validEvent)
    expect(result.success).toBe(true)

    // Rejects confidence > 1 or < 0
    expect(WakeWordDetectionEventSchema.safeParse({ ...validEvent, confidence: 1.5 }).success).toBe(
      false
    )
    expect(WakeWordDetectionEventSchema.safeParse({ ...validEvent, confidence: -0.2 }).success).toBe(
      false
    )
  })

  it('validates audio signal quality metrics', () => {
    const validMetrics = {
      rmsEnergy: 0.08,
      peakAmplitude: 0.45,
      noiseFloorDb: -52.4,
      isClipping: false,
      isSilent: false
    }

    const result = AudioQualityMetricsSchema.safeParse(validMetrics)
    expect(result.success).toBe(true)

    // Rejects missing required field
    expect(AudioQualityMetricsSchema.safeParse({ rmsEnergy: 0.08 }).success).toBe(false)
  })

  it('validates user voice preferences and enforces numeric bounds', () => {
    expect(UserVoicePreferencesSchema.safeParse(DEFAULT_VOICE_PREFERENCES).success).toBe(true)

    const customPrefs = {
      ...DEFAULT_VOICE_PREFERENCES,
      wakeWordEnabled: true,
      selectedWakeWord: 'hey-helioxen',
      sensitivity: 'high',
      activationMode: 'auto-session',
      speechRate: 1.25,
      speechPitch: 0.9,
      speechVolume: 0.8
    }

    expect(UserVoicePreferencesSchema.safeParse(customPrefs).success).toBe(true)

    // Speech rate out of bounds
    expect(UserVoicePreferencesSchema.safeParse({ ...customPrefs, speechRate: 3.5 }).success).toBe(
      false
    )
    // Speech volume out of bounds
    expect(UserVoicePreferencesSchema.safeParse({ ...customPrefs, speechVolume: -0.5 }).success).toBe(
      false
    )
  })
})
