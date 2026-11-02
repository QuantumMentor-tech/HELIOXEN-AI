import {
  CameraDeviceInfo,
  CapturedStillImage,
  CaptureErrorDetails,
  CaptureLimits,
  DEFAULT_CAPTURE_LIMITS
} from '../../../../shared/capture/types'

/**
 * Service managing user-authorized local camera access, device selection,
 * live video preview streams, and still-frame snapshots.
 * 
 * Strict Privacy Guarantees:
 * - Camera stream NEVER initiates automatically.
 * - Live stream is attached only during active preview and is stopped immediately upon snapshot or cancellation.
 * - Captured still frame resides strictly in volatile memory.
 */
export class CameraCaptureService {
  private mediaStream: MediaStream | null = null
  private activeDeviceId: string | null = null
  private limits: CaptureLimits

  constructor(limits: CaptureLimits = DEFAULT_CAPTURE_LIMITS) {
    this.limits = limits
  }

  public isActive(): boolean {
    return Boolean(this.mediaStream && this.mediaStream.active)
  }

  public getActiveStream(): MediaStream | null {
    return this.mediaStream
  }

  public getActiveDeviceId(): string | null {
    return this.activeDeviceId
  }

  /**
   * Enumerates available video input camera hardware devices.
   */
  public async getCameraDevices(): Promise<CameraDeviceInfo[]> {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (!nav?.mediaDevices?.enumerateDevices) {
      return []
    }

    try {
      const devices = await nav.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((d) => d.kind === 'videoinput')
      return videoInputs.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${index + 1}`,
        groupId: d.groupId
      }))
    } catch (err) {
      console.warn('[CameraCaptureService] Failed to enumerate camera devices:', err)
      return []
    }
  }

  /**
   * Starts user-authorized live camera preview stream.
   */
  public async startPreview(deviceId?: string): Promise<MediaStream> {
    // If a stream is already active on the same device, return it
    if (this.mediaStream && this.mediaStream.active && (!deviceId || this.activeDeviceId === deviceId)) {
      return this.mediaStream
    }

    // Stop any existing stream before opening a new one
    await this.stopPreview()

    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (!nav?.mediaDevices?.getUserMedia) {
      const error: CaptureErrorDetails = {
        code: 'DEVICE_UNAVAILABLE',
        message: 'Camera mediaDevices API is unsupported in this environment.',
        recoverable: false
      }
      throw error
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId
        ? {
            deviceId: { exact: deviceId },
            width: { ideal: this.limits.maxWidth },
            height: { ideal: this.limits.maxHeight }
          }
        : {
            width: { ideal: this.limits.maxWidth },
            height: { ideal: this.limits.maxHeight }
          }
    }

    try {
      const stream = await nav.mediaDevices.getUserMedia(constraints)
      this.mediaStream = stream
      this.activeDeviceId = deviceId || null

      // Handle unexpected track ending (e.g. unplugged USB camera)
      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = () => {
          this.stopPreview()
        }
      }

      return stream
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isDenied = /Permission denied|NotAllowedError/i.test(msg)
      const isNotFound = /NotFoundError|DevicesNotFoundError/i.test(msg)

      const error: CaptureErrorDetails = {
        code: isDenied
          ? 'PERMISSION_DENIED'
          : isNotFound
          ? 'DEVICE_UNAVAILABLE'
          : 'INITIALIZATION_FAILED',
        message: isDenied
          ? 'Camera access was denied by system or user.'
          : isNotFound
          ? 'No compatible camera device was found.'
          : `Failed to initialize camera stream: ${msg}`,
        recoverable: !isDenied
      }
      throw error
    }
  }

  /**
   * Captures a still snapshot frame from an HTMLVideoElement.
   */
  public captureFrame(videoElement: HTMLVideoElement, sourceLabel?: string): CapturedStillImage {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      const error: CaptureErrorDetails = {
        code: 'IMAGE_ENCODING_FAILED',
        message: 'Cannot capture frame from inactive or unready video element.',
        recoverable: true
      }
      throw error
    }

    let srcWidth = videoElement.videoWidth
    let srcHeight = videoElement.videoHeight

    // Compute scaled dimensions within max limits while maintaining aspect ratio
    let targetWidth = srcWidth
    let targetHeight = srcHeight

    if (targetWidth > this.limits.maxWidth || targetHeight > this.limits.maxHeight) {
      const widthRatio = this.limits.maxWidth / targetWidth
      const heightRatio = this.limits.maxHeight / targetHeight
      const scale = Math.min(widthRatio, heightRatio)
      targetWidth = Math.round(targetWidth * scale)
      targetHeight = Math.round(targetHeight * scale)
    }

    // Render frame to offscreen canvas
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      const error: CaptureErrorDetails = {
        code: 'IMAGE_ENCODING_FAILED',
        message: 'Could not obtain 2D canvas rendering context for still snapshot.',
        recoverable: false
      }
      throw error
    }

    ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight)

    // Encode to JPEG data URL with quality 0.88 for optimal visual fidelity and compactness
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    const byteSize = Math.round((dataUrl.length - 23) * 0.75) // Approximate base64 byte size

    if (byteSize > this.limits.maxSizeBytes) {
      const error: CaptureErrorDetails = {
        code: 'PAYLOAD_OVERSIZED',
        message: `Captured image exceeds the ${Math.round(this.limits.maxSizeBytes / (1024 * 1024))}MB ceiling.`,
        recoverable: true
      }
      throw error
    }

    return {
      id: `cam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sourceType: 'camera',
      sourceLabel: sourceLabel || 'Local Camera',
      mimeType: 'image/jpeg',
      width: targetWidth,
      height: targetHeight,
      byteSize,
      timestamp: Date.now(),
      dataUrl
    }
  }

  /**
   * Idempotently stops active camera tracks and detaches stream.
   */
  public async stopPreview(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // Ignore track stop error
        }
      })
      this.mediaStream = null
    }
    this.activeDeviceId = null
  }

  public dispose(): void {
    this.stopPreview().catch(() => {})
  }
}
