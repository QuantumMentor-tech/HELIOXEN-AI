import { AudioBufferConfig, AudioMetrics } from '../../../../shared/audio/types'

export const DEFAULT_AUDIO_CONFIG: AudioBufferConfig = {
  sampleRate: 16000,
  maxDurationSeconds: 30,
  maxBufferBytes: 4 * 1024 * 1024, // 4 MB hard memory cap
  channelCount: 1
}

/**
 * High-performance, bounded in-memory audio buffer manager.
 * Stores raw Float32Array PCM chunks with hard memory ceilings and circular eviction.
 * Never persists audio to disk, database, or network.
 */
export class AudioBufferManager {
  private chunks: Float32Array[] = []
  private totalSamples = 0
  private totalBytes = 0
  private config: AudioBufferConfig
  private overflowCount = 0

  constructor(config: Partial<AudioBufferConfig> = {}) {
    this.config = {
      ...DEFAULT_AUDIO_CONFIG,
      ...config
    }
  }

  public getConfig(): AudioBufferConfig {
    return { ...this.config }
  }

  /**
   * Appends an incoming audio chunk (Float32Array PCM samples).
   * Enforces buffer ceilings by evicting oldest chunks if memory or duration limits are exceeded.
   */
  public appendChunk(chunk: Float32Array): void {
    if (!chunk || chunk.length === 0) return

    // Clone the chunk to detach from any underlying shared Web Audio buffer
    const copy = new Float32Array(chunk)
    const chunkBytes = copy.byteLength

    this.chunks.push(copy)
    this.totalSamples += copy.length
    this.totalBytes += chunkBytes

    const maxSamples = this.config.sampleRate * this.config.maxDurationSeconds

    // Bounded eviction policy: drop oldest chunks to preserve recent audio within hard limits
    while (
      this.chunks.length > 0 &&
      (this.totalBytes > this.config.maxBufferBytes || this.totalSamples > maxSamples)
    ) {
      const removed = this.chunks.shift()
      if (removed) {
        this.totalSamples -= removed.length
        this.totalBytes -= removed.byteLength
        this.overflowCount += 1
      }
    }
  }

  /**
   * Computes real-time Root-Mean-Square (RMS) and peak amplitude from recent samples.
   * Scaled from 0.0 (silence) to 1.0 (clipping).
   */
  public getMetrics(): AudioMetrics {
    if (this.chunks.length === 0 || this.totalSamples === 0) {
      return { rms: 0, peak: 0, durationSeconds: 0, samplesCount: 0 }
    }

    // Inspect the latest chunk or last 2048 samples for instantaneous VU response
    const lastChunk = this.chunks[this.chunks.length - 1]
    let sumSquares = 0
    let peak = 0

    for (let i = 0; i < lastChunk.length; i++) {
      const absVal = Math.abs(lastChunk[i])
      if (absVal > peak) peak = absVal
      sumSquares += lastChunk[i] * lastChunk[i]
    }

    const rms = Math.min(1.0, Math.sqrt(sumSquares / lastChunk.length))
    const durationSeconds = this.totalSamples / this.config.sampleRate

    return {
      rms,
      peak: Math.min(1.0, peak),
      durationSeconds,
      samplesCount: this.totalSamples
    }
  }

  /**
   * Returns all retained chunks concatenated into a single contiguous Float32Array.
   */
  public getFlattenedBuffer(): Float32Array {
    if (this.chunks.length === 0) {
      return new Float32Array(0)
    }

    const flattened = new Float32Array(this.totalSamples)
    let offset = 0
    for (const chunk of this.chunks) {
      flattened.set(chunk, offset)
      offset += chunk.length
    }
    return flattened
  }

  public getChunks(): Float32Array[] {
    return [...this.chunks]
  }

  public getTotalSamples(): number {
    return this.totalSamples
  }

  public getTotalBytes(): number {
    return this.totalBytes
  }

  public getOverflowCount(): number {
    return this.overflowCount
  }

  /**
   * Completely clears and zeroes out all audio data from memory.
   */
  public clear(): void {
    for (const chunk of this.chunks) {
      chunk.fill(0)
    }
    this.chunks = []
    this.totalSamples = 0
    this.totalBytes = 0
    this.overflowCount = 0
  }
}
