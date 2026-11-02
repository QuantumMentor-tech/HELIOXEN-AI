import {
  WakeWord,
  WakeWordSensitivity,
  WakeWordDetectionEvent,
  AudioQualityMetrics
} from '../../../../shared/voice/types'

export interface WakeWordEngineConfig {
  sampleRate: number
  targetWord: WakeWord
  sensitivity: WakeWordSensitivity
  cooldownMs: number
  windowDurationSeconds: number
}

export const DEFAULT_ENGINE_CONFIG: WakeWordEngineConfig = {
  sampleRate: 16000,
  targetWord: 'helioxen',
  sensitivity: 'balanced',
  cooldownMs: 2000,
  windowDurationSeconds: 1.5
}

/**
 * Sensitivity to confidence score threshold mapping:
 * - 'low': requires 0.82 confidence (avoids false activations in noisy settings)
 * - 'balanced': requires 0.68 confidence (optimal responsiveness)
 * - 'high': requires 0.52 confidence (maximum sensitivity)
 */
export const SENSITIVITY_THRESHOLDS: Record<WakeWordSensitivity, number> = {
  low: 0.82,
  balanced: 0.68,
  high: 0.52
}

/**
 * Syllabic profile definition for acoustic pattern matching.
 * Models relative envelope peak positions, normalized energy ratios, and zero-crossing distributions.
 */
interface AcousticTemplate {
  syllableCount: number
  expectedDurationMs: [number, number] // [minDuration, maxDuration]
  relativePeakPositions: number[] // Normalized temporal positions of energy peaks [0..1]
  expectedZcrProfile: number[] // Normalized zero-crossing density per temporal segment
}

const TEMPLATES: Record<WakeWord, AcousticTemplate> = {
  helioxen: {
    // 4 syllables: "he" - "li" - "o" - "xen"
    syllableCount: 4,
    expectedDurationMs: [450, 1400],
    relativePeakPositions: [0.15, 0.40, 0.65, 0.88],
    expectedZcrProfile: [0.35, 0.20, 0.15, 0.45] // high ZCR on initial /h/ and final /s/ /z/
  },
  'hey-helioxen': {
    // 5 syllables: "hey" - "he" - "li" - "o" - "xen"
    syllableCount: 5,
    expectedDurationMs: [700, 1800],
    relativePeakPositions: [0.12, 0.32, 0.52, 0.72, 0.90],
    expectedZcrProfile: [0.30, 0.35, 0.20, 0.15, 0.45]
  }
}

/**
 * On-device, privacy-preserving acoustic keyword-spotter engine.
 * Evaluates sliding window PCM audio buffers against phonotactic acoustic envelopes:
 * 1. Computes short-time windowed energy (STE) and zero-crossing rate (ZCR).
 * 2. Identifies syllabic crests and temporal duration.
 * 3. Compares envelope profile correlation with the target acoustic template.
 * 4. Applies refractory cooldown and sensitivity-scaled confidence thresholds.
 * Zero cloud dependency, zero external network transmission, zero audio storage.
 */
export class LocalWakeWordEngine {
  private config: WakeWordEngineConfig
  private isInitialized = false
  private slidingBuffer: Float32Array
  private bufferWriteIndex = 0
  private bufferFilled = false
  private bufferLength: number
  private lastDetectionTimestamp = 0

  constructor(config: Partial<WakeWordEngineConfig> = {}) {
    this.config = {
      ...DEFAULT_ENGINE_CONFIG,
      ...config
    }
    this.bufferLength = Math.round(this.config.sampleRate * this.config.windowDurationSeconds)
    this.slidingBuffer = new Float32Array(this.bufferLength)
  }

  public async initialize(): Promise<boolean> {
    this.reset()
    this.isInitialized = true
    return true
  }

  public dispose(): void {
    this.isInitialized = false
    this.reset()
  }

  public isReady(): boolean {
    return this.isInitialized
  }

  public getTargetWord(): WakeWord {
    return this.config.targetWord
  }

  public setTargetWord(word: WakeWord): void {
    this.config.targetWord = word
    this.reset()
  }

  public setWakeWord(word: WakeWord): void {
    this.setTargetWord(word)
  }

  public getSensitivity(): WakeWordSensitivity {
    return this.config.sensitivity
  }

  public setSensitivity(sensitivity: WakeWordSensitivity): void {
    this.config.sensitivity = sensitivity
  }

  public setCooldownMs(ms: number): void {
    this.config.cooldownMs = Math.max(500, ms)
  }

  /**
   * Resets internal sliding window buffer and refractory timer.
   */
  public reset(): void {
    this.slidingBuffer.fill(0)
    this.bufferWriteIndex = 0
    this.bufferFilled = false
  }

  /**
   * Ingests a new live PCM chunk (Float32Array) and evaluates the sliding window for wake-word match.
   * If silence gating flags the chunk as silent, skips computationally intensive feature analysis.
   */
  public processFrame(
    chunk: Float32Array,
    metrics?: AudioQualityMetrics
  ): WakeWordDetectionEvent | null {
    if (!this.isInitialized || !chunk || chunk.length === 0) {
      return null
    }

    const now = Date.now()

    // 1. Refractory cooldown suppression
    if (now - this.lastDetectionTimestamp < this.config.cooldownMs) {
      return null
    }

    // 2. Silence gating: skip feature extraction if signal is silent or below -45 dBFS
    if (metrics?.isSilent) {
      return null
    }

    // 3. Append to ring buffer
    const chunkLen = chunk.length
    for (let i = 0; i < chunkLen; i++) {
      this.slidingBuffer[this.bufferWriteIndex] = chunk[i]
      this.bufferWriteIndex = (this.bufferWriteIndex + 1) % this.bufferLength
      if (this.bufferWriteIndex === 0) {
        this.bufferFilled = true
      }
    }

    // Need at least 50% buffer capacity before evaluating
    if (!this.bufferFilled && this.bufferWriteIndex < this.bufferLength * 0.5) {
      return null
    }

    // 4. Extract linear array in chronological order
    const linearBuffer = new Float32Array(this.bufferLength)
    if (this.bufferFilled) {
      const tail = this.slidingBuffer.subarray(this.bufferWriteIndex)
      const head = this.slidingBuffer.subarray(0, this.bufferWriteIndex)
      linearBuffer.set(tail, 0)
      linearBuffer.set(head, tail.length)
    } else {
      linearBuffer.set(this.slidingBuffer.subarray(0, this.bufferWriteIndex), 0)
    }

    // 5. Evaluate acoustic match
    const template = TEMPLATES[this.config.targetWord]
    const match = this.evaluateTemplate(linearBuffer, template)

    const threshold = SENSITIVITY_THRESHOLDS[this.config.sensitivity]

    if (match.confidence >= threshold) {
      this.lastDetectionTimestamp = now
      this.reset() // Clear buffer to prevent double triggers on residual decay

      return {
        wakeWord: this.config.targetWord,
        confidence: Math.round(match.confidence * 100) / 100,
        timestamp: now,
        energy: metrics?.rmsEnergy ?? 0.5,
        durationMs: (template.expectedDurationMs[0] + template.expectedDurationMs[1]) / 2
      }
    }

    return null
  }

  /**
   * Internal feature extraction & correlation against acoustic template.
   */
  private evaluateTemplate(
    samples: Float32Array,
    template: AcousticTemplate
  ): { confidence: number } {
    const frameSize = 320 // 20ms at 16kHz
    const hopSize = 160 // 10ms hop
    const numFrames = Math.floor((samples.length - frameSize) / hopSize)

    if (numFrames < 20) {
      return { confidence: 0 }
    }

    const energies = new Float32Array(numFrames)
    const zcrs = new Float32Array(numFrames)
    let maxEnergy = 0

    // Frame-level feature extraction
    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize
      let energy = 0
      let zcr = 0

      for (let i = 0; i < frameSize; i++) {
        const s = samples[offset + i]
        energy += s * s
        if (i > 0 && ((s >= 0 && samples[offset + i - 1] < 0) || (s < 0 && samples[offset + i - 1] >= 0))) {
          zcr++
        }
      }

      energies[f] = energy
      zcrs[f] = zcr / frameSize
      if (energy > maxEnergy) {
        maxEnergy = energy
      }
    }

    // If max energy in the window is negligible, no speech pattern
    if (maxEnergy < 0.005) {
      return { confidence: 0 }
    }

    // Find energy peaks (syllable candidates) above 25% of max energy
    const peakIndices: number[] = []
    const energyThreshold = maxEnergy * 0.25

    for (let f = 1; f < numFrames - 1; f++) {
      if (
        energies[f] > energyThreshold &&
        energies[f] > energies[f - 1] &&
        energies[f] >= energies[f + 1]
      ) {
        // Enforce minimal spacing between syllables (~70ms / 7 frames)
        if (peakIndices.length === 0 || f - peakIndices[peakIndices.length - 1] >= 6) {
          peakIndices.push(f)
        }
      }
    }

    // Check syllable count proximity
    const peakDiff = Math.abs(peakIndices.length - template.syllableCount)
    if (peakDiff > 2) {
      return { confidence: 0 }
    }

    // Temporal span of utterance
    if (peakIndices.length < 2) {
      return { confidence: 0 }
    }

    const startFrame = peakIndices[0]
    const endFrame = peakIndices[peakIndices.length - 1]
    const utteranceDurationMs = (endFrame - startFrame) * 10

    if (
      utteranceDurationMs < template.expectedDurationMs[0] ||
      utteranceDurationMs > template.expectedDurationMs[1]
    ) {
      return { confidence: 0 }
    }

    // Calculate temporal correlation score
    let temporalScore = 1.0 - peakDiff * 0.15

    // Normalized relative peak alignment
    const span = endFrame - startFrame
    let positionDeviationSum = 0
    const countToCompare = Math.min(peakIndices.length, template.relativePeakPositions.length)

    for (let i = 0; i < countToCompare; i++) {
      const actualRelPos = span > 0 ? (peakIndices[i] - startFrame) / span : 0
      const targetRelPos = template.relativePeakPositions[i]
      positionDeviationSum += Math.abs(actualRelPos - targetRelPos)
    }

    const avgDeviation = countToCompare > 0 ? positionDeviationSum / countToCompare : 1.0
    const alignmentScore = Math.max(0, 1.0 - avgDeviation * 2.0)

    // ZCR correlation check for consonant / fricative profile
    let zcrScore = 0.5
    if (startFrame < endFrame) {
      let zcrMatched = 0
      const segments = template.expectedZcrProfile.length
      const segLength = Math.max(1, Math.floor((endFrame - startFrame) / segments))

      for (let s = 0; s < segments; s++) {
        const segStart = startFrame + s * segLength
        let segZcrSum = 0
        for (let k = 0; k < segLength && segStart + k < numFrames; k++) {
          segZcrSum += zcrs[segStart + k]
        }
        const avgSegZcr = segZcrSum / segLength
        const expected = template.expectedZcrProfile[s]
        if (Math.abs(avgSegZcr - expected) < 0.25) {
          zcrMatched++
        }
      }
      zcrScore = zcrMatched / segments
    }

    const confidence = Math.min(
      1.0,
      Math.max(0, temporalScore * 0.4 + alignmentScore * 0.4 + zcrScore * 0.2)
    )

    return { confidence }
  }
}
