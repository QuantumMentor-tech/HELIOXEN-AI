import { AiProviderId } from '../ai/types'

/**
 * Valid states for real-time voice sessions.
 * Follows a deterministic state machine without ambiguous or overlapping booleans.
 */
export type VoiceSessionStatus =
  | 'idle'
  | 'preparing'
  | 'awaiting-permission'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'receiving-transcript'
  | 'generating-response'
  | 'playing-audio'
  | 'interrupted'
  | 'cancelling'
  | 'completed'
  | 'recoverable-error'
  | 'fatal-error'

/**
 * Speaker role in voice session transcripts.
 */
export type TranscriptSpeaker = 'user' | 'assistant'

/**
 * Structured transcript segment.
 * Clearly separates partial provisional hypotheses from finalized transcript text.
 */
export interface TranscriptSegment {
  /** Unique segment ID */
  id: string
  /** Owning session ID to prevent cross-session leaks */
  sessionId: string
  /** Speaker identification */
  speaker: TranscriptSpeaker
  /** Transcript text content */
  text: string
  /** Whether the text is finalized or a provisional in-flight hypothesis */
  isFinal: boolean
  /** Timestamp when the segment was created or updated */
  timestamp: number
  /** Optional audio start offset in milliseconds */
  startTimeMs?: number
  /** Optional audio end offset in milliseconds */
  endTimeMs?: number
  /** Indicates if the segment was halted mid-utterance by user interruption */
  wasInterrupted?: boolean
}

/**
 * Configuration options for starting a real-time voice session.
 */
export interface VoiceSessionConfig {
  /** Target AI provider */
  provider: AiProviderId
  /** Target model identifier */
  model: string
  /** Whether to play generated speech response through local audio playback */
  enableAudioPlayback?: boolean
  /** Desired audio sample rate (defaults to 16,000 Hz) */
  sampleRate?: number
  /** Optional custom system prompt or instructions */
  systemInstruction?: string
  /** Input audio device ID (defaults to system default) */
  deviceId?: string
}

/**
 * Metrics collected during a voice session.
 */
export interface VoiceSessionMetrics {
  sessionId: string
  startTime: number
  endTime?: number
  durationSeconds: number
  userSegmentCount: number
  assistantSegmentCount: number
  userWordCount: number
  assistantWordCount: number
  interruptionCount: number
}

/**
 * Error details for voice session failures.
 */
export interface VoiceSessionError {
  code:
    | 'PERMISSION_DENIED'
    | 'DEVICE_UNAVAILABLE'
    | 'CAPABILITY_UNSUPPORTED'
    | 'CONNECTION_FAILED'
    | 'PROVIDER_ERROR'
    | 'SESSION_TIMEOUT'
    | 'INTERRUPTED'
    | 'ABORTED'
    | 'INTERNAL_ERROR'
  message: string
  recoverable: boolean
  details?: Record<string, unknown>
}

/**
 * Voice session event listeners.
 */
export interface VoiceSessionCallbacks {
  onStatusChange?: (status: VoiceSessionStatus, error?: VoiceSessionError) => void
  onTranscriptUpdate?: (segments: TranscriptSegment[], activeSegment?: TranscriptSegment) => void
  onInterrupted?: (sessionId: string) => void
  onError?: (error: VoiceSessionError) => void
}
