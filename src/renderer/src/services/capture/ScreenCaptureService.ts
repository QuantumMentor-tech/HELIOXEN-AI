/**
 * ScreenCaptureService.ts
 *
 * Provides on-demand, explicit user-initiated desktop screen and window capture.
 * Queries sources via the secure preload bridge and uses navigator.mediaDevices.getUserMedia
 * with chromeMediaSource desktop constraint.
 *
 * Guarantees:
 * - Never captures in the background or at startup.
 * - Captures only a single still frame onto an offscreen canvas.
 * - Cleanly stops all MediaStreamTracks immediately after capture or cancellation.
 * - Enforces dimension scaling (max 1920x1080) and memory limit (4 MB).
 */

import {
  DesktopDisplaySource,
  CapturedStillImage,
  CaptureLimits,
  CaptureErrorDetails,
  DEFAULT_CAPTURE_LIMITS
} from '../../../../shared/capture';

export class ScreenCaptureService {
  private activeStream: MediaStream | null = null;
  private readonly limits: CaptureLimits;

  constructor(limits: CaptureLimits = DEFAULT_CAPTURE_LIMITS) {
    this.limits = limits;
  }

  /**
   * Fetches the available display sources (screens and windows) via the typed IPC preload bridge.
   */
  async getAvailableSources(
    types: Array<'screen' | 'window'> = ['screen', 'window']
  ): Promise<DesktopDisplaySource[]> {
    if (typeof window === 'undefined' || !window.helioxen?.capture?.getDesktopSources) {
      const error: CaptureErrorDetails = {
        code: 'INITIALIZATION_FAILED',
        message: 'Desktop capturer is not available in this environment',
        recoverable: false
      };
      throw error;
    }

    try {
      const sources = await window.helioxen.capture.getDesktopSources(types);
      return sources;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const error: CaptureErrorDetails = {
        code: 'INITIALIZATION_FAILED',
        message: `Failed to enumerate desktop sources: ${message}`,
        recoverable: true
      };
      throw error;
    }
  }

  /**
   * Starts a display stream for a selected source ID.
   * Can be used to attach to a preview <video> element before committing a snapshot.
   */
  async startStream(sourceId: string): Promise<MediaStream> {
    this.stopActiveStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error: CaptureErrorDetails = {
        code: 'DEVICE_UNAVAILABLE',
        message: 'MediaDevices API is not supported in this environment',
        recoverable: false
      };
      throw error;
    }

    // In Electron renderer, desktop capture constraints use chromeMediaSource: 'desktop'
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: this.limits.maxWidth,
          maxHeight: this.limits.maxHeight
        }
      } as unknown as MediaTrackConstraints
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeStream = stream;
      return stream;
    } catch (err) {
      this.stopActiveStream();
      const message = err instanceof Error ? err.message : String(err);
      const isDenied = /Permission denied|NotAllowedError/i.test(message);
      const error: CaptureErrorDetails = {
        code: isDenied ? 'PERMISSION_DENIED' : 'INITIALIZATION_FAILED',
        message: `Failed to acquire screen stream: ${message}`,
        recoverable: true
      };
      throw error;
    }
  }

  /**
   * Captures a still snapshot from the currently active screen stream or starts a temporary one.
   */
  async captureStill(sourceId?: string): Promise<CapturedStillImage> {
    let stream = this.activeStream;
    let temporaryStream = false;

    if (!stream) {
      if (!sourceId) {
        const error: CaptureErrorDetails = {
          code: 'INITIALIZATION_FAILED',
          message: 'No active screen stream and no sourceId provided for capture',
          recoverable: true
        };
        throw error;
      }
      stream = await this.startStream(sourceId);
      temporaryStream = true;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      if (temporaryStream) this.stopActiveStream();
      const error: CaptureErrorDetails = {
        code: 'DEVICE_UNAVAILABLE',
        message: 'Screen stream does not contain any video tracks',
        recoverable: true
      };
      throw error;
    }

    return new Promise<CapturedStillImage>((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      const cleanup = () => {
        video.pause();
        video.srcObject = null;
        video.remove();
        if (temporaryStream) {
          this.stopActiveStream();
        }
      };

      const handleLoadedMetadata = () => {
        video.play().then(() => {
          // Allow frame to buffer
          setTimeout(() => {
            try {
              let width = video.videoWidth || 1280;
              let height = video.videoHeight || 720;

              // Scale down proportionally if exceeding limits
              if (width > this.limits.maxWidth || height > this.limits.maxHeight) {
                const ratio = Math.min(
                  this.limits.maxWidth / width,
                  this.limits.maxHeight / height
                );
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
              }

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                cleanup();
                const err: CaptureErrorDetails = {
                  code: 'IMAGE_ENCODING_FAILED',
                  message: 'Failed to create offscreen canvas context',
                  recoverable: false
                };
                reject(err);
                return;
              }

              ctx.drawImage(video, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

              // Calculate byte size roughly from base64 string
              const byteSize = Math.round((dataUrl.length * 3) / 4);
              if (byteSize > this.limits.maxSizeBytes) {
                cleanup();
                const err: CaptureErrorDetails = {
                  code: 'PAYLOAD_OVERSIZED',
                  message: `Captured screen image exceeds size limit (${Math.round(byteSize / 1024)} KB > ${Math.round(this.limits.maxSizeBytes / 1024)} KB)`,
                  recoverable: true
                };
                reject(err);
                return;
              }

              const still: CapturedStillImage = {
                id: `screen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sourceType: 'screen',
                mimeType: 'image/jpeg',
                width,
                height,
                dataUrl,
                byteSize,
                timestamp: Date.now()
              };

              cleanup();
              resolve(still);
            } catch (err) {
              cleanup();
              reject(err);
            }
          }, 150);
        }).catch((err) => {
          cleanup();
          reject(err);
        });
      };

      video.onloadedmetadata = handleLoadedMetadata;
      video.onerror = () => {
        cleanup();
        const err: CaptureErrorDetails = {
          code: 'INITIALIZATION_FAILED',
          message: 'Failed to load screen stream onto video element',
          recoverable: true
        };
        reject(err);
      };
    });
  }

  /**
   * Stops the active screen stream and terminates all media tracks.
   */
  stopActiveStream(): void {
    if (this.activeStream) {
      try {
        this.activeStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('[ScreenCaptureService] Error stopping screen tracks:', err);
      }
      this.activeStream = null;
    }
  }

  /**
   * Returns whether a screen stream is currently active.
   */
  isStreamActive(): boolean {
    return this.activeStream !== null && this.activeStream.active;
  }
}
