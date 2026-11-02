import { describe, it, expect } from 'vitest'
import {
  CaptureSourceTypeSchema,
  CapturePermissionStatusSchema,
  CaptureSessionStatusSchema,
  DesktopDisplaySourceSchema,
  CapturedStillImageSchema,
  DesktopSourcesRequestSchema,
  DEFAULT_CAPTURE_LIMITS,
  validateCapturedImage,
  validateDesktopSourcesRequest
} from '../../src/shared/capture'

describe('Capture Contracts and Schemas (Step 22)', () => {
  it('validates supported capture source types', () => {
    expect(CaptureSourceTypeSchema.safeParse('camera').success).toBe(true)
    expect(CaptureSourceTypeSchema.safeParse('screen').success).toBe(true)
    expect(CaptureSourceTypeSchema.safeParse('window').success).toBe(true)
    expect(CaptureSourceTypeSchema.safeParse('unauthorized').success).toBe(false)
  })

  it('validates capture permission statuses', () => {
    expect(CapturePermissionStatusSchema.safeParse('granted').success).toBe(true)
    expect(CapturePermissionStatusSchema.safeParse('denied').success).toBe(true)
    expect(CapturePermissionStatusSchema.safeParse('requesting').success).toBe(true)
    expect(CapturePermissionStatusSchema.safeParse('not-requested').success).toBe(true)
    expect(CapturePermissionStatusSchema.safeParse('unsupported').success).toBe(true)
    expect(CapturePermissionStatusSchema.safeParse('restricted').success).toBe(true)
    expect(CapturePermissionStatusSchema.safeParse('invalid-status').success).toBe(false)
  })

  it('validates capture session statuses', () => {
    expect(CaptureSessionStatusSchema.safeParse('idle').success).toBe(true)
    expect(CaptureSessionStatusSchema.safeParse('previewing').success).toBe(true)
    expect(CaptureSessionStatusSchema.safeParse('capturing').success).toBe(true)
    expect(CaptureSessionStatusSchema.safeParse('staged').success).toBe(true)
    expect(CaptureSessionStatusSchema.safeParse('stopping').success).toBe(true)
    expect(CaptureSessionStatusSchema.safeParse('error').success).toBe(true)
    expect(CaptureSessionStatusSchema.safeParse('recording').success).toBe(false) // Continuous recording prohibited!
  })

  it('validates desktop display sources', () => {
    const validScreen = {
      id: 'screen:0:0',
      name: 'Entire Screen 1',
      thumbnailDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      displayId: '0',
      isAppWindow: false
    }
    expect(DesktopDisplaySourceSchema.safeParse(validScreen).success).toBe(true)

    const validWindow = {
      id: 'window:1234:0',
      name: 'HELIOXEN Assistant',
      isAppWindow: true
    }
    expect(DesktopDisplaySourceSchema.safeParse(validWindow).success).toBe(true)

    const invalidSource = {
      name: 'Missing ID'
    }
    expect(DesktopDisplaySourceSchema.safeParse(invalidSource).success).toBe(false)
  })

  it('validates desktop sources request schema with safety defaults', () => {
    expect(DesktopSourcesRequestSchema.safeParse({}).success).toBe(true)
    expect(validateDesktopSourcesRequest(['screen', 'window'])).toEqual({
      types: ['screen', 'window'],
      thumbnailWidth: 320,
      thumbnailHeight: 180
    })

    expect(() => validateDesktopSourcesRequest(['invalid' as any])).toThrow()
  })

  it('validates a valid captured still image payload', () => {
    const validImage = {
      id: 'img-12345',
      sourceType: 'camera',
      sourceLabel: 'HD Webcam',
      mimeType: 'image/jpeg',
      width: 1280,
      height: 720,
      byteSize: 150000,
      timestamp: Date.now(),
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'
    }

    const validated = validateCapturedImage(validImage)
    expect(validated.id).toBe('img-12345')
    expect(validated.width).toBe(1280)
    expect(validated.height).toBe(720)
  })

  it('rejects oversized image payloads exceeding memory ceiling', () => {
    const oversizedImage = {
      id: 'img-oversized',
      sourceType: 'screen',
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
      byteSize: 5 * 1024 * 1024, // 5 MB > 4 MB limit
      timestamp: Date.now(),
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
    }

    expect(() => validateCapturedImage(oversizedImage)).toThrow(/Payload size exceeds 4MB memory limit/)
  })

  it('rejects image payloads exceeding maximum dimension limits', () => {
    const superResolutionImage = {
      id: 'img-4k',
      sourceType: 'screen',
      mimeType: 'image/jpeg',
      width: 3840, // 4K width exceeds 1920 max limit
      height: 2160,
      byteSize: 1000000,
      timestamp: Date.now(),
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
    }

    expect(() => validateCapturedImage(superResolutionImage)).toThrow(/Image width exceeds maximum limit/)
  })

  it('enforces default capture limits', () => {
    expect(DEFAULT_CAPTURE_LIMITS.maxWidth).toBe(1920)
    expect(DEFAULT_CAPTURE_LIMITS.maxHeight).toBe(1080)
    expect(DEFAULT_CAPTURE_LIMITS.maxSizeBytes).toBe(4 * 1024 * 1024)
  })
})
