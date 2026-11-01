import { PlaybackStatus, AudioErrorDetails } from '../../../../shared/audio/types'

export type PlaybackStatusChangeCallback = (status: PlaybackStatus, error?: AudioErrorDetails) => void

export interface SpeechPlaybackOptions {
  rate?: number
  pitch?: number
  volume?: number
  voice?: SpeechSynthesisVoice
  onEnd?: () => void
  onError?: (err: Error) => void
}

/**
 * Service managing local speech synthesis playback and audio buffer playback.
 * Strictly uses local operating system / browser capabilities with zero third-party cloud data transmission.
 */
export class SpeechPlaybackService {
  private status: PlaybackStatus = 'idle'
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private onStatusChange?: PlaybackStatusChangeCallback
  private isDisposed = false

  constructor() {
    this.status = 'idle'
  }

  public getStatus(): PlaybackStatus {
    return this.status
  }

  public setStatusCallback(callback: PlaybackStatusChangeCallback): void {
    this.onStatusChange = callback
  }

  private setStatus(status: PlaybackStatus, error?: AudioErrorDetails): void {
    this.status = status
    this.onStatusChange?.(status, error)
  }

  private getSynth(): SpeechSynthesis | null {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return window.speechSynthesis
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis) {
      return (globalThis as unknown as { speechSynthesis: SpeechSynthesis }).speechSynthesis
    }
    return null
  }

  private getUtteranceClass(): typeof SpeechSynthesisUtterance | null {
    if (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) {
      return window.SpeechSynthesisUtterance
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance) {
      return (globalThis as unknown as { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance
    }
    return null
  }

  /**
   * Retrieves available operating system speech synthesis voices.
   */
  public getVoices(): SpeechSynthesisVoice[] {
    const synth = this.getSynth()
    if (!synth) {
      return []
    }
    return synth.getVoices()
  }

  /**
   * Plays text using local operating system speech synthesis (zero external network requests).
   */
  public async speakText(text: string, options: SpeechPlaybackOptions = {}): Promise<boolean> {
    if (!text || !text.trim()) {
      return false
    }

    const synth = this.getSynth()
    const UtteranceClass = this.getUtteranceClass()

    if (!synth || !UtteranceClass) {
      this.setStatus('error', {
        code: 'PLAYBACK_FAILED',
        message: 'Speech synthesis is unsupported on this system.',
        recoverable: false
      })
      return false
    }

    // Cancel any ongoing utterance before starting new speech
    this.stop()

    this.setStatus('loading')

    return new Promise((resolve) => {
      try {
        const utterance = new UtteranceClass(text.trim())
        this.currentUtterance = utterance

        utterance.rate = Math.max(0.5, Math.min(2.0, options.rate ?? 1.0))
        utterance.pitch = Math.max(0.5, Math.min(2.0, options.pitch ?? 1.0))
        utterance.volume = Math.max(0.0, Math.min(1.0, options.volume ?? 1.0))

        if (options.voice) {
          utterance.voice = options.voice
        }

        utterance.onstart = () => {
          this.setStatus('playing')
        }

        utterance.onend = () => {
          this.currentUtterance = null
          this.setStatus('idle')
          options.onEnd?.()
          resolve(true)
        }

        utterance.onerror = (event) => {
          // 'canceled' or 'interrupted' is expected on user stop
          if (event.error === 'canceled' || event.error === 'interrupted') {
            this.currentUtterance = null
            this.setStatus('stopped')
            resolve(true)
            return
          }

          const errorMsg = `Speech playback failed: ${event.error}`
          this.currentUtterance = null
          this.setStatus('error', {
            code: 'PLAYBACK_FAILED',
            message: errorMsg,
            recoverable: true
          })
          options.onError?.(new Error(errorMsg))
          resolve(false)
        }

        synth.speak(utterance)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        this.currentUtterance = null
        this.setStatus('error', {
          code: 'PLAYBACK_FAILED',
          message: errorMsg,
          recoverable: true
        })
        options.onError?.(new Error(errorMsg))
        resolve(false)
      }
    })
  }

  /**
   * Immediately stops active speech playback and releases synthesis locks.
   */
  public stop(): void {
    const synth = this.getSynth()
    if (synth) {
      if (synth.speaking || synth.pending) {
        synth.cancel()
      }
    }
    this.currentUtterance = null
    if (this.status !== 'idle') {
      this.setStatus('stopped')
    }
  }

  /**
   * Disposes playback service.
   */
  public dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    this.stop()
    this.onStatusChange = undefined
  }
}
