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

/**
 * Approved local wake words for HELIOXEN.
 */
export type WakeWord = 'helioxen' | 'hey-helioxen'

/**
 * Detection sensitivity levels for local acoustic keyword spotter.
 */
export type WakeWordSensitivity = 'low' | 'balanced' | 'high'

/**
 * Post-detection activation policy.
 * Mode A ('confirm'): Notify user locally, require confirmation before opening external session.
 * Mode B ('auto-session'): Directly invoke VoiceSessionCoordinator on valid detection.
 */
export type WakeWordActivationMode = 'confirm' | 'auto-session'

/**
 * State machine for wake-word monitoring subsystem.
 */
export type WakeWordStatus =
  | 'disabled'
  | 'enabling'
  | 'awaiting-permission'
  | 'initializing-engine'
  | 'monitoring'
  | 'wake-word-detected'
  | 'handing-off'
  | 'temporarily-suspended'
  | 'stopping'
  | 'recoverable-error'
  | 'fatal-error'

/**
 * Detection event emitted when the wake word is spotted locally.
 */
export interface WakeWordDetectionEvent {
  wakeWord: WakeWord
  confidence: number
  timestamp: number
  energy: number
  durationMs?: number
}

/**
 * Audio quality analysis metrics produced by noise gate & quality processor.
 */
export interface AudioQualityMetrics {
  rmsEnergy: number
  peakAmplitude: number
  noiseFloorDb: number
  isClipping: boolean
  isSilent: boolean
}

/**
 * Persistent user voice and audio preferences.
 */
export interface UserVoicePreferences {
  /** Whether wake-word monitoring is enabled by user preference */
  wakeWordEnabled: boolean
  /** Target wake word model identifier */
  selectedWakeWord: WakeWord
  /** Sensitivity threshold */
  sensitivity: WakeWordSensitivity
  /** Action to take upon confirmed detection */
  activationMode: WakeWordActivationMode
  /** Automatically suspend monitoring while assistant speech is playing */
  pauseDuringPlayback: boolean
  /** Preferred input device ID */
  preferredInputDeviceId?: string
  /** Noise suppression preprocessing */
  noiseSuppression: boolean
  /** Echo cancellation preprocessing */
  echoCancellation: boolean
  /** Preferred synthesis voice name */
  outputVoice?: string
  /** Speech synthesis speed multiplier (0.5 to 2.0) */
  speechRate: number
  /** Speech synthesis pitch multiplier (0.5 to 2.0) */
  speechPitch: number
  /** Speech synthesis volume (0.0 to 1.0) */
  speechVolume: number
}

export const DEFAULT_VOICE_PREFERENCES: UserVoicePreferences = {
  wakeWordEnabled: false,
  selectedWakeWord: 'helioxen',
  sensitivity: 'balanced',
  activationMode: 'confirm',
  pauseDuringPlayback: true,
  noiseSuppression: true,
  echoCancellation: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  speechVolume: 1.0
}

/**
 * Callbacks for wake-word monitoring lifecycle.
 */
export interface WakeWordCallbacks {
  onStatusChange?: (status: WakeWordStatus, error?: string) => void
  onDetection?: (event: WakeWordDetectionEvent) => void
  onAudioQuality?: (metrics: AudioQualityMetrics) => void
}
