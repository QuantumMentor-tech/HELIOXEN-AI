import { z } from 'zod'
import { DEFAULT_CAPTURE_LIMITS } from './types'

export const CaptureSourceTypeSchema = z.enum(['camera', 'screen', 'window'])

export const CapturePermissionStatusSchema = z.enum([
  'unsupported',
  'not-requested',
  'requesting',
  'granted',
  'denied',
  'restricted',
  'error'
])

export const CaptureSessionStatusSchema = z.enum([
  'idle',
  'awaiting-permission',
  'selecting-source',
  'previewing',
  'capturing',
  'staged',
  'stopping',
  'error'
])

export const CameraDeviceInfoSchema = z.object({
  deviceId: z.string().min(1, 'Device ID cannot be empty'),
  label: z.string(),
  groupId: z.string().optional()
})

export const DesktopDisplaySourceSchema = z.object({
  id: z.string().min(1, 'Source ID cannot be empty'),
  name: z.string().min(1, 'Source name cannot be empty'),
  thumbnailDataUrl: z.string().optional(),
  displayId: z.string().optional(),
  isAppWindow: z.boolean()
})

export const CapturedStillImageSchema = z.object({
  id: z.string().min(1, 'Capture ID cannot be empty'),
  sourceType: CaptureSourceTypeSchema,
  sourceLabel: z.string().optional(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  width: z
    .number()
    .int()
    .positive()
    .max(DEFAULT_CAPTURE_LIMITS.maxWidth, `Image width exceeds maximum limit (${DEFAULT_CAPTURE_LIMITS.maxWidth}px)`),
  height: z
    .number()
    .int()
    .positive()
    .max(DEFAULT_CAPTURE_LIMITS.maxHeight, `Image height exceeds maximum limit (${DEFAULT_CAPTURE_LIMITS.maxHeight}px)`),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(DEFAULT_CAPTURE_LIMITS.maxSizeBytes, `Payload size exceeds 4MB memory limit`),
  timestamp: z.number().positive(),
  dataUrl: z.string().startsWith('data:image/')
})

export type ValidatedCapturedStillImage = z.infer<typeof CapturedStillImageSchema>

export const CaptureErrorDetailsSchema = z.object({
  code: z.enum([
    'PERMISSION_DENIED',
    'DEVICE_UNAVAILABLE',
    'SOURCE_SELECTION_CANCELLED',
    'INITIALIZATION_FAILED',
    'IMAGE_ENCODING_FAILED',
    'PAYLOAD_OVERSIZED',
    'UNSUPPORTED_FORMAT'
  ]),
  message: z.string().min(1),
  recoverable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional()
})

export type ValidatedCaptureErrorDetails = z.infer<typeof CaptureErrorDetailsSchema>

export const DesktopSourcesRequestSchema = z.object({
  types: z.array(z.enum(['screen', 'window'])).min(1).default(['screen', 'window']),
  thumbnailWidth: z.number().int().positive().optional().default(320),
  thumbnailHeight: z.number().int().positive().optional().default(180)
})

export type ValidatedDesktopSourcesRequest = z.infer<typeof DesktopSourcesRequestSchema>

/**
 * Validates captured image payload according to strict dimension and memory boundary limits.
 */
export function validateCapturedImage(input: unknown): ValidatedCapturedStillImage {
  return CapturedStillImageSchema.parse(input)
}

/**
 * Validates desktop sources request payload.
 */
export function validateDesktopSourcesRequest(types?: unknown): ValidatedDesktopSourcesRequest {
  if (Array.isArray(types)) {
    return DesktopSourcesRequestSchema.parse({ types })
  }
  return DesktopSourcesRequestSchema.parse({})
}
