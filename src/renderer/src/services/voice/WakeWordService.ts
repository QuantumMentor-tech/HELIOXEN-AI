import {
  WakeWordStatus,
  WakeWordDetectionEvent,
  WakeWordCallbacks,
  UserVoicePreferences,
  DEFAULT_VOICE_PREFERENCES,
  AudioQualityMetrics
} from '../../../../shared/voice/types'
import { MicrophoneCaptureService } from '../audio/MicrophoneCaptureService'
import { SpeechPlaybackService } from '../audio/SpeechPlaybackService'
import { VoiceSessionCoordinator } from './VoiceSessionCoordinator'
import { LocalWakeWordEngine } from './LocalWakeWordEngine'
import { AudioNoiseProcessor } from './AudioNoiseProcessor'
import { ModelDefinition } from '../../../../shared/ai/models'

export interface WakeWordServiceOptions {
  captureService?: MicrophoneCaptureService
  playbackService?: SpeechPlaybackService
  sessionCoordinator?: VoiceSessionCoordinator
  engine?: LocalWakeWordEngine
  noiseProcessor?: AudioNoiseProcessor
}

/**
 * Service orchestrating the complete wake-word detection lifecycle, audio noise gating,
 * echo suppression during speech synthesis playback, and safe handoff to voice sessions.
 * 
 * Strict Privacy & Safety Guarantees:
 * 1. Default state is ALWAYS 'disabled'. Monitoring never auto-starts on launch.
 * 2. All keyword spotting runs 100% locally on-device. Audio is never transmitted externally
 *    during wake-word monitoring.
 * 3. Mode A ('confirm') notifies the user and awaits manual confirmation before any session starts.
 * 4. Mode B ('auto-session') initiates a voice session through the existing VoiceSessionCoordinator.
 * 5. Bounded memory buffers and circular eviction prevent audio leaks.
 */
export class WakeWordService {
  private status: WakeWordStatus = 'disabled'
  private preferences: UserVoicePreferences = { ...DEFAULT_VOICE_PREFERENCES }
  private callbacks: WakeWordCallbacks = {}

  private captureService: MicrophoneCaptureService
  private playbackService: SpeechPlaybackService
  private sessionCoordinator: VoiceSessionCoordinator | null = null
  private engine: LocalWakeWordEngine
  private noiseProcessor: AudioNoiseProcessor

  private removeChunkListener: (() => void) | null = null
  private isCapturingOwned = false
  private isDisposed = false

  constructor(options: WakeWordServiceOptions = {}) {
    this.sessionCoordinator = options.sessionCoordinator ?? null
    this.captureService =
      options.captureService ??
      this.sessionCoordinator?.getCaptureService() ??
      new MicrophoneCaptureService()
    this.playbackService =
      options.playbackService ??
      this.sessionCoordinator?.getPlaybackService() ??
      new SpeechPlaybackService()
    this.noiseProcessor = options.noiseProcessor ?? new AudioNoiseProcessor()
    this.engine = options.engine ?? new LocalWakeWordEngine()
  }

  public getStatus(): WakeWordStatus {
    return this.status
  }

  public getPreferences(): UserVoicePreferences {
    return { ...this.preferences }
  }

  public setCallbacks(callbacks: WakeWordCallbacks): void {
    this.callbacks = callbacks
  }

  public setPreferences(preferences: Partial<UserVoicePreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...preferences
    }

    this.engine.setWakeWord(this.preferences.selectedWakeWord)
    this.engine.setSensitivity(this.preferences.sensitivity)
    this.noiseProcessor.setNoiseSuppression(this.preferences.noiseSuppression)
  }

  private setStatus(status: WakeWordStatus, error?: string): void {
    if (this.status === status) return
    this.status = status
    this.callbacks.onStatusChange?.(status, error)
  }

  /**
   * Explicitly enables wake-word monitoring.
   * Requires explicit user action; never executed automatically on application startup.
   */
  public async enableMonitoring(): Promise<boolean> {
    if (this.status === 'monitoring' || this.status === 'enabling') {
      return true
    }

    this.setStatus('enabling')

    try {
      // 1. Permission check
      this.setStatus('awaiting-permission')
      const permission = await this.captureService.checkPermission()
      if (permission === 'denied' || permission === 'restricted') {
        const errorMsg = 'Microphone permission denied by system or user preference.'
        this.setStatus('fatal-error', errorMsg)
        return false
      }

      // 2. Initialize local keyword-spotting engine
      this.setStatus('initializing-engine')
      await this.engine.initialize()
      this.engine.setWakeWord(this.preferences.selectedWakeWord)
      this.engine.setSensitivity(this.preferences.sensitivity)
      this.noiseProcessor.setNoiseSuppression(this.preferences.noiseSuppression)

      // 3. Acquire / share microphone capture stream
      if (this.captureService.getStatus() !== 'capturing') {
        const captureStarted = await this.captureService.startCapture(this.preferences.preferredInputDeviceId)
        if (!captureStarted) {
          const errorMsg = 'Failed to acquire audio input stream for wake-word monitoring.'
          this.setStatus('recoverable-error', errorMsg)
          return false
        }
        this.isCapturingOwned = true
      } else {
        this.isCapturingOwned = false
      }

      // 4. Attach PCM chunk listener
      this.detachChunkListener()
      this.removeChunkListener = this.captureService.addChunkListener((chunk) => {
        this.handleIncomingPcmChunk(chunk)
      })

      // 5. Setup playback status listener for echo suppression
      if (this.preferences.pauseDuringPlayback) {
        this.playbackService.setStatusCallback((playbackStatus) => {
          if (playbackStatus === 'playing') {
            if (this.status === 'monitoring') {
              this.setStatus('temporarily-suspended')
            }
          } else if (this.status === 'temporarily-suspended') {
            this.setStatus('monitoring')
          }
        })
      }

      this.setStatus('monitoring')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.cleanupResources()
      this.setStatus('fatal-error', msg)
      return false
    }
  }

  /**
   * Explicitly disables wake-word monitoring and cleanly releases audio handles.
   */
  public async disableMonitoring(): Promise<void> {
    if (this.status === 'disabled' || this.status === 'stopping') {
      return
    }

    this.setStatus('stopping')
    await this.cleanupResources()
    this.setStatus('disabled')
  }

  /**
   * Resumes monitoring after a voice session or temporary suspension ends.
   */
  public resumeMonitoring(): void {
    if (
      this.status === 'temporarily-suspended' ||
      this.status === 'wake-word-detected' ||
      this.status === 'handing-off'
    ) {
      if (this.captureService.getStatus() === 'capturing') {
        this.setStatus('monitoring')
      } else {
        // Re-enable capture if it was stopped
        this.enableMonitoring().catch((err) => {
          console.error('[WakeWordService] Failed to resume monitoring:', err)
        })
      }
    }
  }

  /**
   * Incoming live PCM audio chunk handler from MicrophoneCaptureService.
   */
  private handleIncomingPcmChunk(chunk: Float32Array): void {
    if (this.status !== 'monitoring') {
      return
    }

    // Check echo suppression: skip if assistant speech is currently playing
    if (
      this.preferences.pauseDuringPlayback &&
      this.playbackService.getStatus() === 'playing'
    ) {
      return
    }

    // 1. Audio noise reduction, DC offset removal, and quality metrics extraction
    const { cleanedChunk, metrics } = this.noiseProcessor.processChunk(chunk)
    this.callbacks.onAudioQuality?.(metrics)

    // 2. Evaluate keyword spotting template
    const detection = this.engine.processFrame(cleanedChunk, metrics)
    if (detection) {
      this.handleDetectionEvent(detection)
    }
  }

  /**
   * Dispatches detection event and executes post-detection activation policy.
   */
  private handleDetectionEvent(event: WakeWordDetectionEvent): void {
    this.setStatus('wake-word-detected')
    this.callbacks.onDetection?.(event)

    if (this.preferences.activationMode === 'confirm') {
      // Mode A: Local alert only. Await explicit user action before streaming or connecting to AI.
    } else if (this.preferences.activationMode === 'auto-session') {
      // Mode B: Automatically request VoiceSessionCoordinator to start a session.
      this.handoffToVoiceSession()
    }
  }

  /**
   * Safely hands off capture resources to Step 20 VoiceSessionCoordinator.
   */
  public async handoffToVoiceSession(modelDefinition?: ModelDefinition): Promise<boolean> {
    if (!this.sessionCoordinator) {
      console.warn('[WakeWordService] No VoiceSessionCoordinator attached for handoff.')
      this.setStatus('monitoring')
      return false
    }

    this.setStatus('handing-off')

    try {
      const started = await this.sessionCoordinator.startSession(
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          deviceId: this.preferences.preferredInputDeviceId
        },
        modelDefinition
      )

      if (!started) {
        console.warn('[WakeWordService] Voice session could not be started; resuming monitoring.')
        this.setStatus('monitoring')
        return false
      }

      return true
    } catch (err) {
      console.error('[WakeWordService] Error handing off to voice session:', err)
      this.setStatus('recoverable-error', 'Failed to start voice session after wake word.')
      return false
    }
  }

  private detachChunkListener(): void {
    if (this.removeChunkListener) {
      this.removeChunkListener()
      this.removeChunkListener = null
    }
  }

  private async cleanupResources(): Promise<void> {
    this.detachChunkListener()
    this.engine.reset()
    this.noiseProcessor.reset()

    // If this service was the sole initiator of capture and no session is active, stop capture
    if (this.isCapturingOwned && (!this.sessionCoordinator || this.sessionCoordinator.getStatus() === 'idle')) {
      await this.captureService.stopCapture()
      this.isCapturingOwned = false
    }
  }

  public dispose(): void {
    this.isDisposed = true
    this.cleanupResources().catch(() => {})
    this.engine.dispose()
    this.status = 'disabled'
  }
}
