import {
  CaptureStatus,
  AudioDeviceInfo,
  AudioPermissionStatus,
  AudioErrorDetails
} from '../../../../shared/audio/types'
import { AudioBufferManager } from './AudioBufferManager'

export type StatusChangeCallback = (status: CaptureStatus, error?: AudioErrorDetails) => void
export type VuMeterCallback = (level: number, rms: number) => void

/**
 * Service orchestrating microphone stream lifecycle, device selection,
 * real-time VU level monitoring, and bounded buffering.
 */
export class MicrophoneCaptureService {
  private status: CaptureStatus = 'idle'
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private mediaSource: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private processor: ScriptProcessorNode | null = null
  private bufferManager: AudioBufferManager
  private selectedDeviceId?: string
  private vuIntervalId: ReturnType<typeof setInterval> | null = null
  private onStatusChange?: StatusChangeCallback
  private onVuMeter?: VuMeterCallback
  private chunkListeners: Set<(chunk: Float32Array) => void> = new Set()
  private isDisposed = false

  constructor(bufferManager?: AudioBufferManager) {
    this.bufferManager = bufferManager ?? new AudioBufferManager()
  }

  public getStatus(): CaptureStatus {
    return this.status
  }

  public getBufferManager(): AudioBufferManager {
    return this.bufferManager
  }

  public addChunkListener(listener: (chunk: Float32Array) => void): () => void {
    this.chunkListeners.add(listener)
    return () => {
      this.chunkListeners.delete(listener)
    }
  }

  public setStatusCallback(callback: StatusChangeCallback): void {
    this.onStatusChange = callback
  }

  public setVuMeterCallback(callback: VuMeterCallback): void {
    this.onVuMeter = callback
  }

  public getSelectedDeviceId(): string | undefined {
    return this.selectedDeviceId
  }

  public setSelectedDeviceId(deviceId?: string): void {
    this.selectedDeviceId = deviceId
  }

  private setStatus(status: CaptureStatus, error?: AudioErrorDetails): void {
    this.status = status
    this.onStatusChange?.(status, error)
  }

  /**
   * Enumerate available microphone input hardware devices.
   */
  public async getAudioInputDevices(): Promise<AudioDeviceInfo[]> {
    const nav = typeof navigator !== 'undefined' ? navigator : (globalThis as unknown as { navigator: Navigator }).navigator
    if (!nav?.mediaDevices?.enumerateDevices) {
      return []
    }

    try {
      const devices = await nav.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter((d) => d.kind === 'audioinput')

      return audioInputs.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${index + 1}`,
        isDefault: d.deviceId === 'default' || index === 0
      }))
    } catch (err) {
      console.warn('[MicrophoneCaptureService] Failed to enumerate devices:', err)
      return []
    }
  }

  /**
   * Queries OS and application microphone permission status.
   */
  public async checkPermission(): Promise<AudioPermissionStatus> {
    if (typeof window !== 'undefined' && window.helioxen?.audio) {
      try {
        const sysStatus = await window.helioxen.audio.getPermissionStatus()
        if (sysStatus === 'denied' || sysStatus === 'restricted') {
          return 'denied'
        }
        if (sysStatus === 'granted') {
          return 'granted'
        }
      } catch (e) {
        console.warn('[MicrophoneCaptureService] System permission query fallback:', e)
      }
    }

    const nav = typeof navigator !== 'undefined' ? navigator : (globalThis as unknown as { navigator: Navigator }).navigator
    if (nav?.permissions?.query) {
      try {
        const result = await nav.permissions.query({ name: 'microphone' as PermissionName })
        if (result.state === 'granted') return 'granted'
        if (result.state === 'denied') return 'denied'
        return 'requesting'
      } catch {
        return 'unknown'
      }
    }

    return 'unknown'
  }

  /**
   * Explicitly activates microphone capture.
   * Prompts user for permission if not yet granted.
   */
  public async startCapture(deviceId?: string): Promise<boolean> {
    if (this.status === 'capturing' || this.status === 'activating') {
      return true
    }

    this.setStatus('activating')

    if (deviceId) {
      this.selectedDeviceId = deviceId
    }

    try {
      const nav = typeof navigator !== 'undefined' ? navigator : (globalThis as unknown as { navigator: Navigator }).navigator
      if (!nav?.mediaDevices?.getUserMedia) {
        throw new Error('Web Audio mediaDevices API is unsupported in this environment.')
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        },
        video: false
      }

      const stream = await nav.mediaDevices.getUserMedia(constraints)
      this.mediaStream = stream

      // Handle external device disconnection / track termination
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.onended = () => {
          this.handleDeviceDisconnected()
        }
      }

      // Initialize Web Audio pipeline
      const AudioCtxClass =
        (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
        (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext

      if (!AudioCtxClass) {
        throw new Error('Web Audio AudioContext is unsupported in this environment.')
      }

      this.audioContext = new AudioCtxClass({ sampleRate: 16000 })
      this.mediaSource = this.audioContext.createMediaStreamSource(stream)

      // Analyser node for frequency and RMS VU meter
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.3
      this.mediaSource.connect(this.analyser)

      // ScriptProcessor for PCM chunk extraction into bounded buffer
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (this.status === 'capturing') {
          const inputData = event.inputBuffer.getChannelData(0)
          this.bufferManager.appendChunk(inputData)
          for (const listener of this.chunkListeners) {
            try {
              listener(inputData)
            } catch (err) {
              console.error('[MicrophoneCaptureService] Error in chunk listener:', err)
            }
          }
        }
      }

      this.mediaSource.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      // Start VU Meter polling (every 50ms)
      this.startVuMeterPolling()

      this.setStatus('capturing')
      return true
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      let code: AudioErrorDetails['code'] = 'STREAM_INIT_FAILED'
      let recoverable = true

      if (/Permission denied|NotAllowedError/i.test(errorMsg)) {
        code = 'PERMISSION_DENIED'
        recoverable = false
      } else if (/NotFoundError|DevicesNotFoundError/i.test(errorMsg)) {
        code = 'NO_INPUT_DEVICE'
        recoverable = false
      }

      await this.stopCapture()
      this.setStatus('error', {
        code,
        message: errorMsg,
        recoverable
      })
      return false
    }
  }

  /**
   * Idempotently stops capture and cleanly releases all hardware tracks and audio nodes.
   */
  public async stopCapture(): Promise<void> {
    if (this.status === 'idle' && !this.mediaStream && !this.audioContext) {
      return
    }

    this.setStatus('stopping')

    // 1. Stop VU meter polling
    if (this.vuIntervalId) {
      clearInterval(this.vuIntervalId)
      this.vuIntervalId = null
    }
    this.onVuMeter?.(0, 0)

    // 2. Disconnect and release ScriptProcessor
    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
      this.processor = null
    }

    // 3. Disconnect Analyser and MediaSource
    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.mediaSource) {
      this.mediaSource.disconnect()
      this.mediaSource = null
    }

    // 4. Close and release AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close()
      } catch (e) {
        console.warn('[MicrophoneCaptureService] AudioContext close warning:', e)
      }
      this.audioContext = null
    }

    // 5. Stop all MediaStreamTracks to turn off hardware mic LED
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop()
        track.onended = null
      }
      this.mediaStream = null
    }

    this.setStatus('idle')
  }

  private startVuMeterPolling(): void {
    if (this.vuIntervalId) {
      clearInterval(this.vuIntervalId)
    }

    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 128)

    this.vuIntervalId = setInterval(() => {
      if (!this.analyser || this.status !== 'capturing') {
        return
      }

      this.analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const avg = sum / dataArray.length
      const normalized = Math.min(1.0, avg / 128) // 0.0 to 1.0

      // Map to 8 visual VU segments (0 to 8)
      const segments = Math.min(8, Math.round(normalized * 8))
      this.onVuMeter?.(segments, normalized)
    }, 50)
  }

  private handleDeviceDisconnected(): void {
    this.stopCapture().then(() => {
      this.setStatus('error', {
        code: 'DEVICE_DISCONNECTED',
        message: 'The selected microphone was disconnected.',
        recoverable: true
      })
    })
  }

  /**
   * Complete service disposal.
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return
    this.isDisposed = true
    await this.stopCapture()
    this.bufferManager.clear()
    this.onStatusChange = undefined
    this.onVuMeter = undefined
  }
}
