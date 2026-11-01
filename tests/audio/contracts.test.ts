import { describe, it, expect } from 'vitest'
import {
  AudioPermissionStatusSchema,
  CaptureStatusSchema,
  PlaybackStatusSchema,
  AudioDeviceInfoSchema,
  PlaybackSpeechRequestSchema,
  StartCaptureRequestSchema
} from '../../src/shared/audio/contracts'

describe('Audio Contracts & Runtime Schemas (Step 19)', () => {
  it('validates AudioPermissionStatusSchema', () => {
    expect(AudioPermissionStatusSchema.safeParse('granted').success).toBe(true)
    expect(AudioPermissionStatusSchema.safeParse('denied').success).toBe(true)
    expect(AudioPermissionStatusSchema.safeParse('unsupported').success).toBe(true)
    expect(AudioPermissionStatusSchema.safeParse('arbitrary-state').success).toBe(false)
  })

  it('validates CaptureStatusSchema and PlaybackStatusSchema', () => {
    expect(CaptureStatusSchema.safeParse('idle').success).toBe(true)
    expect(CaptureStatusSchema.safeParse('capturing').success).toBe(true)
    expect(CaptureStatusSchema.safeParse('stopping').success).toBe(true)
    expect(CaptureStatusSchema.safeParse('invalid-status').success).toBe(false)

    expect(PlaybackStatusSchema.safeParse('playing').success).toBe(true)
    expect(PlaybackStatusSchema.safeParse('stopped').success).toBe(true)
    expect(PlaybackStatusSchema.safeParse('unknown-status').success).toBe(false)
  })

  it('validates AudioDeviceInfoSchema', () => {
    const validDevice = {
      deviceId: 'device-id-123',
      label: 'Realtek High Definition Audio',
      isDefault: true
    }
    expect(AudioDeviceInfoSchema.safeParse(validDevice).success).toBe(true)

    const emptyDeviceId = {
      deviceId: '',
      label: 'Invalid Mic',
      isDefault: false
    }
    expect(AudioDeviceInfoSchema.safeParse(emptyDeviceId).success).toBe(false)
  })

  it('validates StartCaptureRequestSchema and PlaybackSpeechRequestSchema', () => {
    expect(StartCaptureRequestSchema.safeParse({}).success).toBe(true)
    expect(StartCaptureRequestSchema.safeParse({ deviceId: 'mic-1' }).success).toBe(true)

    expect(PlaybackSpeechRequestSchema.safeParse({ text: 'Speech synthesis test' }).success).toBe(true)
    expect(PlaybackSpeechRequestSchema.safeParse({ text: '' }).success).toBe(false)
    expect(
      PlaybackSpeechRequestSchema.safeParse({
        text: 'Test',
        rate: 1.2,
        pitch: 0.9,
        volume: 0.8
      }).success
    ).toBe(true)
    expect(
      PlaybackSpeechRequestSchema.safeParse({
        text: 'Test',
        rate: 5.0 // Exceeds max 2.0
      }).success
    ).toBe(false)
  })
})
