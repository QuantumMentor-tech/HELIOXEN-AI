import {
  VoiceSessionStatus,
  VoiceSessionConfig,
  VoiceSessionMetrics,
  VoiceSessionError,
  TranscriptSegment,
  VoiceSessionCallbacks
} from '../../../../shared/voice/types'
import { MicrophoneCaptureService } from '../audio/MicrophoneCaptureService'
import { SpeechPlaybackService } from '../audio/SpeechPlaybackService'
import { AudioBufferManager } from '../audio/AudioBufferManager'
import { ModelDefinition } from '../../../../shared/ai/models'
import { checkVoiceSessionEligibility } from '../../../../shared/voice/capabilities'

export class VoiceSessionCoordinator {
  private status: VoiceSessionStatus = 'idle'
  private activeSessionId: string | null = null
  private config: VoiceSessionConfig | null = null
  private segments: TranscriptSegment[] = []
  private activeProvisionalSegment: TranscriptSegment | null = null
  private metrics: VoiceSessionMetrics | null = null

  private captureService: MicrophoneCaptureService
  private playbackService: SpeechPlaybackService
  private bufferManager: AudioBufferManager

  private callbacks: VoiceSessionCallbacks = {}
  private abortController: AbortController | null = null
  private isDisposed = false
  private isProcessingTurn = false

  // Speech recognition for browser/Electron environments
  private recognitionInstance: any = null

  constructor(
    captureService?: MicrophoneCaptureService,
    playbackService?: SpeechPlaybackService,
    bufferManager?: AudioBufferManager
  ) {
    this.bufferManager = bufferManager ?? new AudioBufferManager()
    this.captureService = captureService ?? new MicrophoneCaptureService(this.bufferManager)
    this.playbackService = playbackService ?? new SpeechPlaybackService()
  }

  public getStatus(): VoiceSessionStatus {
    return this.status
  }

  public getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  public getCaptureService(): MicrophoneCaptureService {
    return this.captureService
  }

  public getPlaybackService(): SpeechPlaybackService {
    return this.playbackService
  }

  public getBufferManager(): AudioBufferManager {
    return this.bufferManager
  }

  public getSegments(): TranscriptSegment[] {
    return [...this.segments]
  }

  public getMetrics(): VoiceSessionMetrics | null {
    if (!this.metrics) return null
    return {
      ...this.metrics,
      durationSeconds: Math.max(
        0,
        ((this.metrics.endTime || Date.now()) - this.metrics.startTime) / 1000
      )
    }
  }

  public setCallbacks(callbacks: VoiceSessionCallbacks): void {
    this.callbacks = callbacks
  }

  private setStatus(status: VoiceSessionStatus, error?: VoiceSessionError): void {
    this.status = status
    this.callbacks.onStatusChange?.(status, error)
  }

  /**
   * Starts a real-time voice session.
   * Explicitly user-initiated, validates capabilities, and initializes capture.
   */
  public async startSession(
    config: VoiceSessionConfig,
    modelDefinition?: ModelDefinition
  ): Promise<boolean> {
    if (this.status !== 'idle' && this.status !== 'completed' && this.status !== 'interrupted') {
      console.warn('[VoiceSessionCoordinator] Cannot start session; current status is', this.status)
      return false
    }

    // 1. Verify provider and model capabilities
    if (modelDefinition) {
      const eligibility = checkVoiceSessionEligibility(modelDefinition)
      if (!eligibility.eligible) {
        const error: VoiceSessionError = {
          code: 'CAPABILITY_UNSUPPORTED',
          message: eligibility.reason,
          recoverable: false
        }
        this.setStatus('fatal-error', error)
        this.callbacks.onError?.(error)
        return false
      }
    }

    const sessionId = `vsession-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    this.activeSessionId = sessionId
    this.config = config
    this.segments = []
    this.activeProvisionalSegment = null
    this.abortController = new AbortController()
    this.isProcessingTurn = false

    this.metrics = {
      sessionId,
      startTime: Date.now(),
      durationSeconds: 0,
      userSegmentCount: 0,
      assistantSegmentCount: 0,
      userWordCount: 0,
      assistantWordCount: 0,
      interruptionCount: 0
    }

    this.setStatus('preparing')

    try {
      // 2. Microphone permission verification
      this.setStatus('awaiting-permission')
      const permission = await this.captureService.checkPermission()
      if (permission === 'denied' || permission === 'restricted') {
        const err: VoiceSessionError = {
          code: 'PERMISSION_DENIED',
          message: 'Microphone permission denied by system or user preference.',
          recoverable: false
        }
        this.setStatus('fatal-error', err)
        this.callbacks.onError?.(err)
        return false
      }

      // Check if session was interrupted or cancelled while permission was queried
      if (this.activeSessionId !== sessionId || this.abortController?.signal.aborted) {
        return false
      }

      // 3. Connect to capture pipeline
      this.setStatus('connecting')
      const captureStarted = await this.captureService.startCapture(config.deviceId)
      if (!captureStarted) {
        const err: VoiceSessionError = {
          code: 'DEVICE_UNAVAILABLE',
          message: 'Failed to initialize audio capture device.',
          recoverable: true
        }
        this.setStatus('recoverable-error', err)
        this.callbacks.onError?.(err)
        return false
      }

      if (this.activeSessionId !== sessionId || this.abortController?.signal.aborted) {
        await this.captureService.stopCapture()
        return false
      }

      // 4. Initialize speech recognition if available in runtime
      this.initSpeechRecognition(sessionId)

      // 5. Transition to listening state
      this.setStatus('listening')
      return true
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const error: VoiceSessionError = {
        code: 'CONNECTION_FAILED',
        message: `Failed to initialize voice session: ${errorMsg}`,
        recoverable: true
      }
      this.setStatus('fatal-error', error)
      this.callbacks.onError?.(error)
      return false
    }
  }

  /**
   * Immediately interrupts the active voice session.
   * Halts playback, cancels in-flight provider generation, and releases audio resources.
   */
  public async interrupt(): Promise<void> {
    if (this.status === 'idle' || this.status === 'interrupted' || this.status === 'cancelling') {
      return
    }

    const sessionId = this.activeSessionId
    this.setStatus('cancelling')

    // 1. Abort local controller and pending network stream
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    if (typeof window !== 'undefined' && window.helioxen?.ai) {
      window.helioxen.ai.cancel().catch(() => {})
    }

    // 2. Stop speech playback immediately
    this.playbackService.stop()

    // 3. Stop microphone capture and speech recognition
    await this.captureService.stopCapture()
    this.stopSpeechRecognition()

    // 4. Invalidate or mark in-flight assistant segment as interrupted
    if (this.activeProvisionalSegment) {
      const interruptedSegment: TranscriptSegment = {
        ...this.activeProvisionalSegment,
        text: `${this.activeProvisionalSegment.text} [Interrupted]`.trim(),
        isFinal: true,
        wasInterrupted: true,
        timestamp: Date.now()
      }
      this.segments.push(interruptedSegment)
      this.activeProvisionalSegment = null
      this.callbacks.onTranscriptUpdate?.(this.segments, undefined)
    }

    // 5. Update metrics
    if (this.metrics) {
      this.metrics.interruptionCount += 1
      this.metrics.endTime = Date.now()
    }

    // 6. Invalidate active session identity to block any late asynchronous callbacks
    this.activeSessionId = null
    this.isProcessingTurn = false

    this.setStatus('interrupted')
    if (sessionId) {
      this.callbacks.onInterrupted?.(sessionId)
    }
  }

  /**
   * Processes a spoken user input turn.
   * Transcribes user input, queries AI provider, and streams response audio.
   */
  public async submitUserTurn(text: string): Promise<boolean> {
    const sessionId = this.activeSessionId
    if (!sessionId || !this.config || this.status === 'cancelling' || this.status === 'interrupted') {
      return false
    }

    const cleanText = text.trim()
    if (!cleanText) return false

    this.isProcessingTurn = true

    // 1. Append finalized user transcript segment
    const userSegment: TranscriptSegment = {
      id: `seg-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      speaker: 'user',
      text: cleanText,
      isFinal: true,
      timestamp: Date.now()
    }

    this.segments.push(userSegment)
    if (this.metrics) {
      this.metrics.userSegmentCount += 1
      this.metrics.userWordCount += cleanText.split(/\s+/).length
    }
    this.callbacks.onTranscriptUpdate?.(this.segments, undefined)

    // 2. Prepare provisional assistant segment
    const assistantSegmentId = `seg-asst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    this.activeProvisionalSegment = {
      id: assistantSegmentId,
      sessionId,
      speaker: 'assistant',
      text: '',
      isFinal: false,
      timestamp: Date.now()
    }

    this.setStatus('generating-response')

    let accumulatedText = ''
    const currentAbortController = this.abortController

    try {
      if (typeof window !== 'undefined' && window.helioxen?.ai) {
        // Stream chunk listener with session isolation check
        const unsubscribe = window.helioxen.ai.onStreamChunk((chunk) => {
          if (this.activeSessionId !== sessionId || currentAbortController?.signal.aborted) {
            return
          }

          if (chunk.textDelta) {
            accumulatedText += chunk.textDelta
            if (this.activeProvisionalSegment) {
              this.activeProvisionalSegment = {
                ...this.activeProvisionalSegment,
                text: accumulatedText,
                timestamp: Date.now()
              }
              this.callbacks.onTranscriptUpdate?.(this.segments, this.activeProvisionalSegment)
            }
          }
        })

        const history = this.segments.map((s) => ({
          role: s.speaker === 'user' ? ('user' as const) : ('assistant' as const),
          content: s.text
        }))

        const response = await window.helioxen.ai.generateText({
          provider: this.config.provider,
          model: this.config.model,
          messages: history,
          stream: true,
          taskType: 'conversation'
        })

        unsubscribe()

        // Check again for cancellation during request
        if (this.activeSessionId !== sessionId || currentAbortController?.signal.aborted) {
          return false
        }

        const finalText = response.text || accumulatedText
        const finalAssistantSegment: TranscriptSegment = {
          id: assistantSegmentId,
          sessionId,
          speaker: 'assistant',
          text: finalText,
          isFinal: true,
          timestamp: Date.now()
        }

        this.segments.push(finalAssistantSegment)
        this.activeProvisionalSegment = null

        if (this.metrics) {
          this.metrics.assistantSegmentCount += 1
          this.metrics.assistantWordCount += finalText.split(/\s+/).length
        }
        this.callbacks.onTranscriptUpdate?.(this.segments, undefined)

        // 3. Play generated speech if enabled
        if (this.config.enableAudioPlayback !== false && finalText.trim()) {
          this.setStatus('playing-audio')
          await this.playbackService.speakText(finalText, {
            onEnd: () => {
              if (this.activeSessionId === sessionId) {
                this.setStatus('listening')
                this.isProcessingTurn = false
              }
            },
            onError: (err) => {
              console.warn('[VoiceSessionCoordinator] Speech playback error:', err)
              if (this.activeSessionId === sessionId) {
                this.setStatus('listening')
                this.isProcessingTurn = false
              }
            }
          })
        } else {
          this.setStatus('listening')
          this.isProcessingTurn = false
        }

        return true
      }

      // Fallback for tests/environments without full Electron preload
      const mockReply = `Response to: ${cleanText}`
      const finalAssistantSegment: TranscriptSegment = {
        id: assistantSegmentId,
        sessionId,
        speaker: 'assistant',
        text: mockReply,
        isFinal: true,
        timestamp: Date.now()
      }
      this.segments.push(finalAssistantSegment)
      this.activeProvisionalSegment = null
      this.callbacks.onTranscriptUpdate?.(this.segments, undefined)
      this.setStatus('listening')
      this.isProcessingTurn = false
      return true
    } catch (err: unknown) {
      if (currentAbortController?.signal.aborted || this.activeSessionId !== sessionId) {
        return false
      }

      const errorMsg = err instanceof Error ? err.message : String(err)
      const error: VoiceSessionError = {
        code: 'PROVIDER_ERROR',
        message: `Generation error: ${errorMsg}`,
        recoverable: true
      }
      this.setStatus('recoverable-error', error)
      this.callbacks.onError?.(error)
      this.isProcessingTurn = false
      return false
    }
  }

  /**
   * Appends an incremental partial transcript event.
   * Ensures partial hypotheses do not overwrite finalized segments.
   */
  public handlePartialTranscript(text: string, isFinal = false): void {
    if (!this.activeSessionId || this.status === 'cancelling' || this.status === 'interrupted') {
      return
    }

    if (isFinal) {
      this.activeProvisionalSegment = null
      this.submitUserTurn(text)
    } else {
      this.setStatus('receiving-transcript')
      this.activeProvisionalSegment = {
        id: `provisional-${Date.now()}`,
        sessionId: this.activeSessionId,
        speaker: 'user',
        text,
        isFinal: false,
        timestamp: Date.now()
      }
      this.callbacks.onTranscriptUpdate?.(this.segments, this.activeProvisionalSegment)
    }
  }

  /**
   * Initializes SpeechRecognition API if available.
   */
  private initSpeechRecognition(sessionId: string): void {
    const SpeechRecClass =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      (globalThis as any).SpeechRecognition ||
      (globalThis as any).webkitSpeechRecognition

    if (!SpeechRecClass) {
      return
    }

    try {
      const recognition = new SpeechRecClass()
      this.recognitionInstance = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        if (this.activeSessionId !== sessionId) return

        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        if (finalTranscript.trim()) {
          this.handlePartialTranscript(finalTranscript.trim(), true)
        } else if (interimTranscript.trim()) {
          this.handlePartialTranscript(interimTranscript.trim(), false)
        }
      }

      recognition.onerror = (event: any) => {
        if (this.activeSessionId !== sessionId) return
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[VoiceSessionCoordinator] Speech recognition notice:', event.error)
        }
      }

      recognition.start()
    } catch (e) {
      console.warn('[VoiceSessionCoordinator] SpeechRecognition init failed:', e)
    }
  }

  private stopSpeechRecognition(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.abort?.() || this.recognitionInstance.stop?.()
      } catch {}
      this.recognitionInstance = null
    }
  }

  /**
   * Concludes the session normally and returns to idle.
   */
  public async endSession(): Promise<void> {
    if (this.status === 'idle') return

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    this.playbackService.stop()
    await this.captureService.stopCapture()
    this.stopSpeechRecognition()

    if (this.metrics) {
      this.metrics.endTime = Date.now()
    }

    this.activeSessionId = null
    this.setStatus('completed')
    this.setStatus('idle')
  }

  /**
   * Releases all session resources.
   */
  public dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    this.interrupt()
    this.captureService.dispose()
    this.playbackService.dispose()
    this.bufferManager.clear()
    this.callbacks = {}
  }
}
