import { describe, it, expect, beforeEach } from 'vitest'
import {
  LocalWakeWordEngine,
  SENSITIVITY_THRESHOLDS
} from '../../src/renderer/src/services/voice/LocalWakeWordEngine'
import { AudioQualityMetrics } from '../../src/shared/voice/types'

describe('LocalWakeWordEngine (Step 21 Acoustic Keyword Spotter)', () => {
  let engine: LocalWakeWordEngine

  beforeEach(async () => {
    engine = new LocalWakeWordEngine({
      targetWord: 'helioxen',
      sensitivity: 'balanced',
      cooldownMs: 2000
    })
    await engine.initialize()
  })

  it('initializes to ready state and cleans up on dispose', () => {
    expect(engine.isReady()).toBe(true)
    expect(engine.getTargetWord()).toBe('helioxen')
    expect(engine.getSensitivity()).toBe('balanced')

    engine.dispose()
    expect(engine.isReady()).toBe(false)
  })

  it('updates target wake word and sensitivity thresholds accurately', () => {
    engine.setWakeWord('hey-helioxen')
    expect(engine.getTargetWord()).toBe('hey-helioxen')

    engine.setSensitivity('high')
    expect(engine.getSensitivity()).toBe('high')
    expect(SENSITIVITY_THRESHOLDS['high']).toBe(0.52)
    expect(SENSITIVITY_THRESHOLDS['balanced']).toBe(0.68)
    expect(SENSITIVITY_THRESHOLDS['low']).toBe(0.82)
  })

  it('skips pattern matching when silence gating indicates silent chunk', () => {
    const silentMetrics: AudioQualityMetrics = {
      rmsEnergy: 0.001,
      peakAmplitude: 0.002,
      noiseFloorDb: -60,
      isClipping: false,
      isSilent: true
    }

    const chunk = new Float32Array(2048).fill(0.001)
    const result = engine.processFrame(chunk, silentMetrics)
    expect(result).toBeNull()
  })

  it('detects matching acoustic envelope profile for "helioxen"', () => {
    // Construct a synthetic 4-syllable speech envelope matching "he-li-o-xen"
    // Duration: ~800ms (12,800 samples at 16kHz)
    const sampleRate = 16000
    const totalSamples = Math.round(0.85 * sampleRate) // 13,600 samples
    const fullAudio = new Float32Array(totalSamples)

    // Syllable peak locations at roughly 15%, 40%, 65%, 88%
    const peakCenters = [
      Math.round(0.15 * totalSamples),
      Math.round(0.40 * totalSamples),
      Math.round(0.65 * totalSamples),
      Math.round(0.88 * totalSamples)
    ]
    const syllableWidth = Math.round(0.06 * totalSamples)

    for (let i = 0; i < totalSamples; i++) {
      let env = 0
      for (const center of peakCenters) {
        const dist = Math.abs(i - center)
        if (dist < syllableWidth) {
          const w = (1 + Math.cos((Math.PI * dist) / syllableWidth)) / 2
          env = Math.max(env, w)
        }
      }
      // Modulate with pseudo-speech harmonic carrier
      fullAudio[i] = env * 0.6 * Math.sin((2 * Math.PI * 300 * i) / sampleRate)
    }

    // Feed in 2048-sample chunks to simulate live audio stream
    const metrics: AudioQualityMetrics = {
      rmsEnergy: 0.25,
      peakAmplitude: 0.6,
      noiseFloorDb: -48,
      isClipping: false,
      isSilent: false
    }

    let detectedEvent = null
    const chunkSize = 2048
    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      const chunk = fullAudio.subarray(offset, Math.min(offset + chunkSize, totalSamples))
      const res = engine.processFrame(chunk, metrics)
      if (res) {
        detectedEvent = res
        break
      }
    }

    expect(detectedEvent).not.toBeNull()
    expect(detectedEvent?.wakeWord).toBe('helioxen')
    expect(detectedEvent?.confidence).toBeGreaterThanOrEqual(0.68)
  })

  it('enforces refractory cooldown to prevent double activation on continuous speech', () => {
    // Trigger detection with simulated audio
    const totalSamples = 13600
    const fullAudio = new Float32Array(totalSamples)
    const peakCenters = [0.15, 0.40, 0.65, 0.88].map((r) => Math.round(r * totalSamples))
    const syllableWidth = Math.round(0.06 * totalSamples)

    for (let i = 0; i < totalSamples; i++) {
      let env = 0
      for (const center of peakCenters) {
        const dist = Math.abs(i - center)
        if (dist < syllableWidth) {
          env = Math.max(env, (1 + Math.cos((Math.PI * dist) / syllableWidth)) / 2)
        }
      }
      fullAudio[i] = env * 0.6 * Math.sin((2 * Math.PI * 300 * i) / 16000)
    }

    const metrics: AudioQualityMetrics = {
      rmsEnergy: 0.25,
      peakAmplitude: 0.6,
      noiseFloorDb: -48,
      isClipping: false,
      isSilent: false
    }

    // First pass triggers detection
    let firstEvent = null
    for (let offset = 0; offset < totalSamples; offset += 2048) {
      const chunk = fullAudio.subarray(offset, Math.min(offset + 2048, totalSamples))
      const res = engine.processFrame(chunk, metrics)
      if (res) {
        firstEvent = res
        break
      }
    }
    expect(firstEvent).not.toBeNull()

    // Immediate second pass during cooldown period (< 2000ms) returns null
    let immediateSecondEvent = null
    for (let offset = 0; offset < totalSamples; offset += 2048) {
      const chunk = fullAudio.subarray(offset, Math.min(offset + 2048, totalSamples))
      const res = engine.processFrame(chunk, metrics)
      if (res) {
        immediateSecondEvent = res
        break
      }
    }
    expect(immediateSecondEvent).toBeNull()
  })
})
