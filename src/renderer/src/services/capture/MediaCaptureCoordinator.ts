/**
 * MediaCaptureCoordinator.ts
 *
 * Orchestrates camera and screen capture lifecycles, permissions, device selections,
 * live preview attachments, still snapshot confirmations, and memory-safe cleanup.
 */

import {
  CaptureSourceType,
  CaptureSessionStatus,
  CameraDeviceInfo,
  DesktopDisplaySource,
  CapturedStillImage,
  CaptureErrorDetails,
  CaptureLimits,
  DEFAULT_CAPTURE_LIMITS,
  CaptureCoordinatorCallbacks
} from '../../../../shared/capture';
import { CameraCaptureService } from './CameraCaptureService';
import { ScreenCaptureService } from './ScreenCaptureService';

export class MediaCaptureCoordinator {
  private status: CaptureSessionStatus = 'idle';
  private activeSourceType: CaptureSourceType | null = null;
  private cameraService: CameraCaptureService;
  private screenService: ScreenCaptureService;
  private stagedImage: CapturedStillImage | null = null;
  private callbacks: CaptureCoordinatorCallbacks;

  constructor(
    callbacks: CaptureCoordinatorCallbacks = {},
    limits: CaptureLimits = DEFAULT_CAPTURE_LIMITS
  ) {
    this.callbacks = callbacks;
    this.cameraService = new CameraCaptureService(limits);
    this.screenService = new ScreenCaptureService(limits);
  }

  /**
   * Update registered callbacks.
   */
  setCallbacks(callbacks: CaptureCoordinatorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getStatus(): CaptureSessionStatus {
    return this.status;
  }

  getActiveSourceType(): CaptureSourceType | null {
    return this.activeSourceType;
  }

  getStagedImage(): CapturedStillImage | null {
    return this.stagedImage;
  }

  private setStatus(status: CaptureSessionStatus, error?: CaptureErrorDetails): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status, error);
  }

  private setError(error: CaptureErrorDetails): void {
    this.setStatus('error', error);
    this.callbacks.onError?.(error);
  }

  // ==========================================
  // Camera Workflow
  // ==========================================

  /**
   * Enumerate available video input devices.
   */
  async getCameraDevices(): Promise<CameraDeviceInfo[]> {
    try {
      return await this.cameraService.getCameraDevices();
    } catch (err: unknown) {
      const error: CaptureErrorDetails = {
        code: 'DEVICE_UNAVAILABLE',
        message: err instanceof Error ? err.message : String(err),
        recoverable: true
      };
      this.setError(error);
      return [];
    }
  }

  /**
   * Initiates camera capture flow with explicit user intent.
   * Starts live preview stream.
   */
  async startCamera(deviceId?: string): Promise<MediaStream | null> {
    this.cancelCapture();
    this.activeSourceType = 'camera';
    this.setStatus('awaiting-permission');

    try {
      const stream = await this.cameraService.startPreview(deviceId);
      this.setStatus('previewing');
      return stream;
    } catch (err: unknown) {
      const captureErr = err as Partial<CaptureErrorDetails>;
      const error: CaptureErrorDetails = {
        code: captureErr.code || 'INITIALIZATION_FAILED',
        message: captureErr.message || (err instanceof Error ? err.message : String(err)),
        recoverable: captureErr.recoverable ?? true
      };
      this.setError(error);
      this.activeSourceType = null;
      return null;
    }
  }

  // ==========================================
  // Screen Workflow
  // ==========================================

  /**
   * Enumerate available desktop screens and windows.
   */
  async getDesktopSources(types: Array<'screen' | 'window'> = ['screen', 'window']): Promise<DesktopDisplaySource[]> {
    this.setStatus('selecting-source');
    try {
      return await this.screenService.getAvailableSources(types);
    } catch (err: unknown) {
      const captureErr = err as Partial<CaptureErrorDetails>;
      const error: CaptureErrorDetails = {
        code: captureErr.code || 'INITIALIZATION_FAILED',
        message: captureErr.message || (err instanceof Error ? err.message : String(err)),
        recoverable: true
      };
      this.setError(error);
      return [];
    }
  }

  /**
   * Starts a preview stream for a chosen desktop source ID.
   */
  async startScreenStream(sourceId: string): Promise<MediaStream | null> {
    this.cancelCapture();
    this.activeSourceType = 'screen';
    this.setStatus('previewing');

    try {
      return await this.screenService.startStream(sourceId);
    } catch (err: unknown) {
      const captureErr = err as Partial<CaptureErrorDetails>;
      const error: CaptureErrorDetails = {
        code: captureErr.code || 'INITIALIZATION_FAILED',
        message: captureErr.message || (err instanceof Error ? err.message : String(err)),
        recoverable: true
      };
      this.setError(error);
      this.activeSourceType = null;
      return null;
    }
  }

  // ==========================================
  // Capture Snapshot Confirmation
  // ==========================================

  /**
   * Captures a still frame from the currently active camera or screen stream.
   * If camera, expects a videoElement reference or offscreen rendering.
   */
  async captureStill(sourceIdOrVideoElement?: string | HTMLVideoElement): Promise<CapturedStillImage | null> {
    if (!this.activeSourceType) {
      const error: CaptureErrorDetails = {
        code: 'INITIALIZATION_FAILED',
        message: 'Cannot capture still image without an active capture source',
        recoverable: true
      };
      this.setError(error);
      return null;
    }

    this.setStatus('capturing');

    try {
      let still: CapturedStillImage;
      if (this.activeSourceType === 'camera') {
        if (sourceIdOrVideoElement instanceof HTMLVideoElement) {
          still = this.cameraService.captureFrame(sourceIdOrVideoElement);
        } else {
          // Create offscreen video element with active stream
          const stream = this.cameraService.getActiveStream();
          if (!stream) {
            throw new Error('No active camera stream available for frame capture');
          }
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          await video.play();
          still = this.cameraService.captureFrame(video);
          video.pause();
          video.srcObject = null;
          video.remove();
        }
      } else {
        const sourceId = typeof sourceIdOrVideoElement === 'string' ? sourceIdOrVideoElement : undefined;
        still = await this.screenService.captureStill(sourceId);
      }

      this.stagedImage = still;
      this.setStatus('staged');
      this.callbacks.onImageCaptured?.(still);

      // Stop the active live stream immediately to release camera/display hardware!
      this.stopLiveStreams();

      return still;
    } catch (err: unknown) {
      const captureErr = err as Partial<CaptureErrorDetails>;
      const error: CaptureErrorDetails = {
        code: captureErr.code || 'IMAGE_ENCODING_FAILED',
        message: captureErr.message || (err instanceof Error ? err.message : String(err)),
        recoverable: captureErr.recoverable ?? true
      };
      this.setError(error);
      this.stopLiveStreams();
      return null;
    }
  }

  /**
   * Discards the currently staged still image from memory.
   */
  discardStagedImage(): void {
    this.stagedImage = null;
    this.activeSourceType = null;
    this.setStatus('idle');
    this.callbacks.onImageDiscarded?.();
  }

  /**
   * Stops live camera and screen streams without clearing a staged still image.
   */
  stopLiveStreams(): void {
    this.cameraService.stopPreview().catch(() => {});
    this.screenService.stopActiveStream();
  }

  /**
   * Completely cancels active capture sessions, terminates hardware streams,
   * discards any staged image, and resets to idle.
   */
  cancelCapture(): void {
    this.setStatus('stopping');
    this.stopLiveStreams();
    this.stagedImage = null;
    this.activeSourceType = null;
    this.setStatus('idle');
  }

  /**
   * Cleanup and dispose all resources.
   */
  dispose(): void {
    this.cancelCapture();
    this.cameraService.dispose();
    this.callbacks = {};
  }
}
