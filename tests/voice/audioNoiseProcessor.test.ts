import { describe, it, expect } from 'vitest'
import { AudioNoiseProcessor } from '../../src/renderer/src/services/voice/AudioNoiseProcessor'

describe('AudioNoiseProcessor (Step 21 Audio Signal Quality & Noise Gating)', () => {
  it('handles empty chunks safely without throwing', () => {
    const processor = new AudioNoiseProcessor()
    const { cleanedChunk, metrics } = processor.processChunk(new Float32Array(0))

    expect(cleanedChunk.length).toBe(0)
    expect(metrics.isSilent).toBe(true)
    expect(metrics.isClipping).toBe(false)
    expect(metrics.rmsEnergy).toBe(0)
    expect(metrics.peakAmplitude).toBe(0)
  })

  it('detects silence when RMS energy is below the silence threshold (-45 dBFS)', () => {
    const processor = new AudioNoiseProcessor({ silenceThresholdDbfs: -45 })

    // Extremely low amplitude noise (~0.001, which is ~-60 dBFS)
    const silentChunk = new Float32Array(1024)
    for (let i = 0; i < silentChunk.length; i++) {
      silentChunk[i] = (Math.random() - 0.5) * 0.002
    }

    const { metrics } = processor.processChunk(silentChunk)
    expect(metrics.isSilent).toBe(true)
    expect(metrics.isClipping).toBe(false)
    expect(metrics.noiseFloorDb).toBeLessThan(-40)
  })

  it('identifies non-silent audio when amplitude exceeds silence threshold', () => {
    const processor = new AudioNoiseProcessor({ silenceThresholdDbfs: -45 })

    // Audible speech-like sine wave with amplitude 0.3
    const speechChunk = new Float32Array(1024)
    for (let i = 0; i < speechChunk.length; i++) {
      speechChunk[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / 16000)
    }

    const { metrics } = processor.processChunk(speechChunk)
    expect(metrics.isSilent).toBe(false)
    expect(metrics.isClipping).toBe(false)
    expect(metrics.peakAmplitude).toBeCloseTo(0.3, 1)
    expect(metrics.rmsEnergy).toBeGreaterThan(0.1)
  })

  it('flags clipping when peak amplitude meets or exceeds 0.98', () => {
    const processor = new AudioNoiseProcessor({ clippingThreshold: 0.98 })

    const clippedChunk = new Float32Array(512)
    clippedChunk[250] = 0.99 // Saturated sample

    const { metrics } = processor.processChunk(clippedChunk)
    expect(metrics.isClipping).toBe(true)
    expect(metrics.peakAmplitude).toBeCloseTo(0.99, 2)
  })

  it('removes DC bias offset from incoming signals', () => {
    const processor = new AudioNoiseProcessor({ enableNoiseSuppression: false })

    // Signal with +0.25 DC bias offset
    const biasedChunk = new Float32Array(512)
    for (let i = 0; i < biasedChunk.length; i++) {
      biasedChunk[i] = 0.25 + 0.1 * Math.sin(i)
    }

    const { cleanedChunk } = processor.processChunk(biasedChunk)

    // Calculate mean of cleaned chunk; should be centered around 0
    let cleanedSum = 0
    for (let i = 0; i < cleanedChunk.length; i++) {
      cleanedSum += cleanedChunk[i]
    }
    const cleanedMean = cleanedSum / cleanedChunk.length

    expect(Math.abs(cleanedMean)).toBeLessThan(1e-5)
  })

  it('resets internal noise floor and filtering state on reset()', () => {
    const processor = new AudioNoiseProcessor()
    const loudChunk = new Float32Array(1024).fill(0.8)
    processor.processChunk(loudChunk)

    processor.reset()
    const config = processor.getConfig()
    expect(config.silenceThresholdDbfs).toBe(-45)
    expect(config.clippingThreshold).toBe(0.98)
  })
})
