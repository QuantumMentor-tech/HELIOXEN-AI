import { describe, it, expect, beforeEach } from 'vitest'
import { AudioBufferManager } from '../../src/renderer/src/services/audio/AudioBufferManager'

describe('AudioBufferManager (Bounded PCM Chunk Buffer & Resource Ceilings)', () => {
  let manager: AudioBufferManager

  beforeEach(() => {
    manager = new AudioBufferManager({
      sampleRate: 16000,
      maxDurationSeconds: 5, // 5 seconds ceiling for testing = 80,000 samples
      maxBufferBytes: 50 * 1024, // 50 KB ceiling (~12,800 float samples)
      channelCount: 1
    })
  })

  it('initializes with empty buffer state', () => {
    expect(manager.getTotalSamples()).toBe(0)
    expect(manager.getTotalBytes()).toBe(0)
    expect(manager.getChunks()).toHaveLength(0)

    const metrics = manager.getMetrics()
    expect(metrics.rms).toBe(0)
    expect(metrics.peak).toBe(0)
    expect(metrics.durationSeconds).toBe(0)
    expect(metrics.samplesCount).toBe(0)
  })

  it('appends Float32Array chunks and computes metrics accurately', () => {
    // 1000 samples of 0.5 amplitude
    const chunk = new Float32Array(1000).fill(0.5)
    manager.appendChunk(chunk)

    expect(manager.getTotalSamples()).toBe(1000)
    expect(manager.getTotalBytes()).toBe(4000) // 1000 * 4 bytes
    expect(manager.getChunks()).toHaveLength(1)

    const metrics = manager.getMetrics()
    expect(metrics.rms).toBeCloseTo(0.5, 2)
    expect(metrics.peak).toBeCloseTo(0.5, 2)
    expect(metrics.durationSeconds).toBe(1000 / 16000)
    expect(metrics.samplesCount).toBe(1000)
  })

  it('enforces hard memory cap by evicting oldest chunks (bounded circular retention)', () => {
    // Each chunk is 1024 samples = 4096 bytes (4 KB)
    // Max buffer bytes is 50 KB, so ~12 chunks max
    for (let i = 0; i < 20; i++) {
      const chunk = new Float32Array(1024).fill(0.1 * (i + 1))
      manager.appendChunk(chunk)
    }

    expect(manager.getTotalBytes()).toBeLessThanOrEqual(50 * 1024)
    expect(manager.getOverflowCount()).toBeGreaterThan(0)

    // Verify recent chunks are retained
    const chunks = manager.getChunks()
    expect(chunks.length).toBeLessThan(20)
    // Last chunk should have amplitude ~2.0
    expect(chunks[chunks.length - 1][0]).toBeCloseTo(2.0, 1)
  })

  it('flattens multiple chunks into a contiguous Float32Array', () => {
    const chunk1 = new Float32Array([0.1, 0.2, 0.3])
    const chunk2 = new Float32Array([0.4, 0.5])

    manager.appendChunk(chunk1)
    manager.appendChunk(chunk2)

    const flattened = manager.getFlattenedBuffer()
    expect(flattened).toHaveLength(5)
    expect(Array.from(flattened)).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
      expect.closeTo(0.4),
      expect.closeTo(0.5)
    ])
  })

  it('zeroes memory and clears all chunk references on clear()', () => {
    const chunk = new Float32Array(500).fill(0.8)
    manager.appendChunk(chunk)

    expect(manager.getTotalSamples()).toBe(500)

    manager.clear()

    expect(manager.getTotalSamples()).toBe(0)
    expect(manager.getTotalBytes()).toBe(0)
    expect(manager.getChunks()).toHaveLength(0)
    expect(manager.getOverflowCount()).toBe(0)
    expect(manager.getMetrics().rms).toBe(0)
  })

  it('ignores empty or zero-length chunks safely', () => {
    manager.appendChunk(new Float32Array(0))
    expect(manager.getTotalSamples()).toBe(0)
    expect(manager.getTotalBytes()).toBe(0)
  })
})
