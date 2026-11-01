import { z } from 'zod'

export const VoiceSessionStatusSchema = z.enum([
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
])

export const TranscriptSpeakerSchema = z.enum(['user', 'assistant'])

export const TranscriptSegmentSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  speaker: TranscriptSpeakerSchema,
  text: z.string(),
  isFinal: z.boolean(),
  timestamp: z.number().positive(),
  startTimeMs: z.number().nonnegative().optional(),
  endTimeMs: z.number().nonnegative().optional(),
  wasInterrupted: z.boolean().optional()
})

export const VoiceSessionConfigSchema = z.object({
  provider: z.enum(['google-gemini', 'openai']),
  model: z.string().min(1),
  enableAudioPlayback: z.boolean().optional().default(true),
  sampleRate: z.number().positive().optional().default(16000),
  systemInstruction: z.string().optional(),
  deviceId: z.string().optional()
})

export const VoiceSessionMetricsSchema = z.object({
  sessionId: z.string().min(1),
  startTime: z.number().positive(),
  endTime: z.number().positive().optional(),
  durationSeconds: z.number().nonnegative(),
  userSegmentCount: z.number().int().nonnegative(),
  assistantSegmentCount: z.number().int().nonnegative(),
  userWordCount: z.number().int().nonnegative(),
  assistantWordCount: z.number().int().nonnegative(),
  interruptionCount: z.number().int().nonnegative()
})

export const VoiceSessionErrorSchema = z.object({
  code: z.enum([
    'PERMISSION_DENIED',
    'DEVICE_UNAVAILABLE',
    'CAPABILITY_UNSUPPORTED',
    'CONNECTION_FAILED',
    'PROVIDER_ERROR',
    'SESSION_TIMEOUT',
    'INTERRUPTED',
    'ABORTED',
    'INTERNAL_ERROR'
  ]),
  message: z.string().min(1),
  recoverable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional()
})
