import { describe, it, expect } from 'vitest'
import {
  VoiceSessionStatusSchema,
  TranscriptSegmentSchema,
  VoiceSessionConfigSchema,
  VoiceSessionMetricsSchema,
  VoiceSessionErrorSchema
} from '../../src/shared/voice/contracts'

describe('Voice Session Validation Contracts (Zod Schemas)', () => {
  it('validates valid voice session statuses and rejects invalid ones', () => {
    const validStatuses = [
      'idle',
      'preparing',
      'awaiting-permission',
      'connecting',
      'listening',
      'processing',
      'receiving-transcript',
      'generating-response',
      'playing-audio',
      'interrupted',
      'cancelling',
      'completed',
      'recoverable-error',
      'fatal-error'
    ]

    for (const status of validStatuses) {
      expect(VoiceSessionStatusSchema.safeParse(status).success).toBe(true)
    }

    expect(VoiceSessionStatusSchema.safeParse('unknown-state').success).toBe(false)
    expect(VoiceSessionStatusSchema.safeParse('').success).toBe(false)
  })

  it('validates structured transcript segments with provisional and finalized states', () => {
    const validFinalSegment = {
      id: 'seg-1',
      sessionId: 'sess-100',
      speaker: 'user',
      text: 'Hello Helioxen, what is the system status?',
      isFinal: true,
      timestamp: Date.now(),
      startTimeMs: 120,
      endTimeMs: 1500
    }

    const validProvisionalSegment = {
      id: 'seg-2',
      sessionId: 'sess-100',
      speaker: 'assistant',
      text: 'All core systems are nominal',
      isFinal: false,
      timestamp: Date.now(),
      wasInterrupted: false
    }

    expect(TranscriptSegmentSchema.safeParse(validFinalSegment).success).toBe(true)
    expect(TranscriptSegmentSchema.safeParse(validProvisionalSegment).success).toBe(true)

    // Rejects invalid speaker
    expect(
      TranscriptSegmentSchema.safeParse({
        ...validFinalSegment,
        speaker: 'hacker'
      }).success
    ).toBe(false)
  })

  it('validates voice session configuration with provider constraints', () => {
    const validConfig = {
      provider: 'google-gemini',
      model: 'gemini-3.8-flash',
      enableAudioPlayback: true,
      sampleRate: 16000
    }

    expect(VoiceSessionConfigSchema.safeParse(validConfig).success).toBe(true)

    // Rejects unapproved provider
    expect(
      VoiceSessionConfigSchema.safeParse({
        provider: 'unapproved-vendor',
        model: 'model-x'
      }).success
    ).toBe(false)
  })

  it('validates session metrics and error shapes', () => {
    const validMetrics = {
      sessionId: 'sess-42',
      startTime: 1000,
      endTime: 5000,
      durationSeconds: 4.0,
      userSegmentCount: 1,
      assistantSegmentCount: 1,
      userWordCount: 10,
      assistantWordCount: 15,
      interruptionCount: 0
    }

    const validError = {
      code: 'PERMISSION_DENIED',
      message: 'User rejected microphone access',
      recoverable: false
    }

    expect(VoiceSessionMetricsSchema.safeParse(validMetrics).success).toBe(true)
    expect(VoiceSessionErrorSchema.safeParse(validError).success).toBe(true)
  })
})
