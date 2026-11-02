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

export const WakeWordSchema = z.enum(['helioxen', 'hey-helioxen'])

export const WakeWordSensitivitySchema = z.enum(['low', 'balanced', 'high'])

export const WakeWordActivationModeSchema = z.enum(['confirm', 'auto-session'])

export const WakeWordStatusSchema = z.enum([
  'disabled',
  'enabling',
  'awaiting-permission',
  'initializing-engine',
  'monitoring',
  'wake-word-detected',
  'handing-off',
  'temporarily-suspended',
  'stopping',
  'recoverable-error',
  'fatal-error'
])

export const WakeWordDetectionEventSchema = z.object({
  wakeWord: WakeWordSchema,
  confidence: z.number().min(0).max(1),
  timestamp: z.number().positive(),
  energy: z.number().nonnegative(),
  durationMs: z.number().nonnegative().optional()
})

export const AudioQualityMetricsSchema = z.object({
  rmsEnergy: z.number().nonnegative(),
  peakAmplitude: z.number().nonnegative(),
  noiseFloorDb: z.number(),
  isClipping: z.boolean(),
  isSilent: z.boolean()
})

export const UserVoicePreferencesSchema = z.object({
  wakeWordEnabled: z.boolean().default(false),
  selectedWakeWord: WakeWordSchema.default('helioxen'),
  sensitivity: WakeWordSensitivitySchema.default('balanced'),
  activationMode: WakeWordActivationModeSchema.default('confirm'),
  pauseDuringPlayback: z.boolean().default(true),
  preferredInputDeviceId: z.string().optional(),
  noiseSuppression: z.boolean().default(true),
  echoCancellation: z.boolean().default(true),
  outputVoice: z.string().optional(),
  speechRate: z.number().min(0.5).max(2.0).default(1.0),
  speechPitch: z.number().min(0.5).max(2.0).default(1.0),
  speechVolume: z.number().min(0.0).max(1.0).default(1.0)
})

export type ValidatedUserVoicePreferences = z.infer<typeof UserVoicePreferencesSchema>
