import { z } from 'zod'

export const AudioPermissionStatusSchema = z.enum([
  'unknown',
  'requesting',
  'granted',
  'denied',
  'restricted',
  'unsupported'
])

export const CaptureStatusSchema = z.enum([
  'idle',
  'activating',
  'capturing',
  'stopping',
  'error'
])

export const PlaybackStatusSchema = z.enum([
  'idle',
  'loading',
  'playing',
  'paused',
  'stopped',
  'error'
])

export const AudioDeviceInfoSchema = z.object({
  deviceId: z.string().min(1),
  label: z.string(),
  isDefault: z.boolean()
})

export const StartCaptureRequestSchema = z.object({
  deviceId: z.string().optional()
})

export const PlaybackSpeechRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  rate: z.number().min(0.5).max(2.0).optional().default(1.0),
  pitch: z.number().min(0.5).max(2.0).optional().default(1.0),
  volume: z.number().min(0.0).max(1.0).optional().default(1.0)
})

export type StartCaptureRequest = z.infer<typeof StartCaptureRequestSchema>
export type PlaybackSpeechRequest = z.infer<typeof PlaybackSpeechRequestSchema>
