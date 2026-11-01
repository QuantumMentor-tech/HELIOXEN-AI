import { describe, it, expect } from 'vitest'
import { checkVoiceSessionEligibility } from '../../src/shared/voice/capabilities'
import { CURATED_MODELS } from '../../src/shared/ai/models'

describe('Voice Session Capability Verification (Official Provider Capabilities)', () => {
  it('identifies Gemini 3.8 Flash as eligible for orchestrated voice sessions', () => {
    const model = CURATED_MODELS['gemini-3.8-flash']
    const result = checkVoiceSessionEligibility(model)

    expect(result.eligible).toBe(true)
    expect(result.mode).toBe('orchestrated-voice')
    expect(result.supportsStreamingTranscripts).toBe(true)
    expect(result.supportsAudioPlayback).toBe(true)
    expect(result.officialDocUrl).toContain('ai.google.dev')
    expect(result.verificationDate).toBe('2026-11-01')
  })

  it('identifies GPT-4o as eligible for orchestrated voice sessions', () => {
    const model = CURATED_MODELS['gpt-4o']
    const result = checkVoiceSessionEligibility(model)

    expect(result.eligible).toBe(true)
    expect(result.mode).toBe('orchestrated-voice')
    expect(result.supportsStreamingTranscripts).toBe(true)
    expect(result.supportsAudioPlayback).toBe(true)
  })

  it('correctly marks Gemini 3.5 Flash-Lite as unsupported for voice input sessions', () => {
    const model = CURATED_MODELS['gemini-3.5-flash-lite']
    const result = checkVoiceSessionEligibility(model)

    expect(result.eligible).toBe(false)
    expect(result.mode).toBe('unsupported')
    expect(result.reason).toContain('Flash-Lite is optimized for text-only')
  })

  it('correctly marks GPT-4o Mini as unsupported for real-time audio input', () => {
    const model = CURATED_MODELS['gpt-4o-mini']
    const result = checkVoiceSessionEligibility(model)

    expect(result.eligible).toBe(false)
    expect(result.mode).toBe('unsupported')
    expect(result.reason).toContain('real-time audio input is unsupported')
  })

  it('rejects deprecated or inactive models regardless of provider', () => {
    const deprecatedModel = {
      ...CURATED_MODELS['gemini-3.8-flash'],
      status: 'deprecated' as const
    }
    const result = checkVoiceSessionEligibility(deprecatedModel)

    expect(result.eligible).toBe(false)
    expect(result.mode).toBe('unsupported')
    expect(result.reason).toContain('status is \'deprecated\'')
  })
})
