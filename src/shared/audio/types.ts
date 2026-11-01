/**
 * Authoritative types and interfaces for HELIOXEN Audio Infrastructure (Step 19).
 * Governs microphone capture, bounded audio buffering, and speech playback.
 */

export type AudioPermissionStatus =
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unsupported'

export type CaptureStatus =
  | 'idle'
  | 'activating'
  | 'capturing'
  | 'stopping'
  | 'error'

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'error'

export interface AudioDeviceInfo {
  readonly deviceId: string
  readonly label: string
  readonly isDefault: boolean
}

export interface AudioBufferConfig {
  /** Target sample rate in Hz (default: 16000 for standard voice) */
  readonly sampleRate: number
  /** Maximum duration of audio to retain in memory in seconds (default: 30) */
  readonly maxDurationSeconds: number
  /** Maximum memory allocation in bytes for buffered PCM chunks (default: 4MB) */
  readonly maxBufferBytes: number
  /** Number of audio channels (default: 1 for mono) */
  readonly channelCount: number
}

export interface AudioMetrics {
  /** Root-mean-square amplitude normalized from 0.0 to 1.0 */
  readonly rms: number
  /** Peak amplitude normalized from 0.0 to 1.0 */
  readonly peak: number
  /** Total duration of buffered audio in seconds */
  readonly durationSeconds: number
  /** Total number of samples currently buffered */
  readonly samplesCount: number
}

export interface AudioErrorDetails {
  readonly code:
    | 'PERMISSION_DENIED'
    | 'NO_INPUT_DEVICE'
    | 'DEVICE_DISCONNECTED'
    | 'UNSUPPORTED_FORMAT'
    | 'BUFFER_OVERFLOW'
    | 'STREAM_INIT_FAILED'
    | 'PLAYBACK_FAILED'
    | 'ALREADY_ACTIVE'
    | 'NOT_ACTIVE'
    | 'UNKNOWN_ERROR'
  readonly message: string
  readonly recoverable: boolean
}
