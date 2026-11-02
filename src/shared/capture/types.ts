/**
 * HELIOXEN AI — Camera and Screen Capture Domain Types
 * Phase 8: Multimodal Input and Context (Step 22 of 48)
 * 
 * Strict Privacy Guarantees:
 * - Capture is ALWAYS user-initiated; never starts on app launch or in background.
 * - Still image snapshots remain in volatile local memory only.
 * - Never persists raw image frames to disk, telemetry, or logs.
 */

export type CaptureSourceType = 'camera' | 'screen' | 'window'

export type CapturePermissionStatus =
  | 'unsupported'
  | 'not-requested'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'error'

export type CaptureSessionStatus =
  | 'idle'
  | 'awaiting-permission'
  | 'selecting-source'
  | 'previewing'
  | 'capturing'
  | 'staged'
  | 'stopping'
  | 'error'

export interface CameraDeviceInfo {
  deviceId: string
  label: string
  groupId?: string
}

export interface DesktopDisplaySource {
  id: string
  name: string
  thumbnailDataUrl?: string
  displayId?: string
  isAppWindow: boolean
}

export interface CapturedStillImage {
  id: string
  sourceType: CaptureSourceType
  sourceLabel?: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
  byteSize: number
  timestamp: number
  dataUrl: string // Temporary in-memory data URL, bounded to 4 MB
}

export interface CaptureErrorDetails {
  code:
    | 'PERMISSION_DENIED'
    | 'DEVICE_UNAVAILABLE'
    | 'SOURCE_SELECTION_CANCELLED'
    | 'INITIALIZATION_FAILED'
    | 'IMAGE_ENCODING_FAILED'
    | 'PAYLOAD_OVERSIZED'
    | 'UNSUPPORTED_FORMAT'
  message: string
  recoverable: boolean
  details?: Record<string, unknown>
}

export interface CaptureLimits {
  readonly maxWidth: number
  readonly maxHeight: number
  readonly maxSizeBytes: number
}

export const DEFAULT_CAPTURE_LIMITS: CaptureLimits = {
  maxWidth: 1920,
  maxHeight: 1080,
  maxSizeBytes: 4 * 1024 * 1024 // 4 MB hard cap
}

export interface CaptureCoordinatorCallbacks {
  onStatusChange?: (status: CaptureSessionStatus, error?: CaptureErrorDetails) => void
  onImageCaptured?: (image: CapturedStillImage) => void
  onImageDiscarded?: () => void
  onError?: (error: CaptureErrorDetails) => void
}
