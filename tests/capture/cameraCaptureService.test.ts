import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CameraCaptureService } from '../../src/renderer/src/services/capture/CameraCaptureService'

describe('CameraCaptureService (Step 22)', () => {
  let service: CameraCaptureService

  beforeEach(() => {
    service = new CameraCaptureService()
  })

  afterEach(() => {
    service.dispose()
    vi.restoreAllMocks()
  })

  it('starts inactive and does not initiate capture automatically', () => {
    expect(service.isActive()).toBe(false)
    expect(service.getActiveStream()).toBeNull()
    expect(service.getActiveDeviceId()).toBeNull()
  })

  it('enumerates available video input devices', async () => {
    const mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-1', label: 'Integrated Webcam', groupId: 'g1' },
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Microphone', groupId: 'g1' },
      { kind: 'videoinput', deviceId: 'cam-2', label: 'USB HD Camera', groupId: 'g2' }
    ]

    // Mock navigator.mediaDevices
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue(mockDevices)
      }
    })

    const cameras = await service.getCameraDevices()
    expect(cameras).toHaveLength(2)
    expect(cameras[0].deviceId).toBe('cam-1')
    expect(cameras[0].label).toBe('Integrated Webcam')
    expect(cameras[1].deviceId).toBe('cam-2')
  })

  it('starts live camera preview on explicit user invocation', async () => {
    const mockTrack = {
      stop: vi.fn(),
      onended: null
    }
    const mockStream = {
      active: true,
      getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      getTracks: vi.fn().mockReturnValue([mockTrack])
    }

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      }
    })

    const stream = await service.startPreview('cam-1')
    expect(stream).toBe(mockStream)
    expect(service.isActive()).toBe(true)
    expect(service.getActiveDeviceId()).toBe('cam-1')
  })

  it('stops camera stream and terminates all media tracks cleanly', async () => {
    const mockTrack = {
      stop: vi.fn(),
      onended: null
    }
    const mockStream = {
      active: true,
      getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      getTracks: vi.fn().mockReturnValue([mockTrack])
    }

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      }
    })

    await service.startPreview()
    expect(service.isActive()).toBe(true)

    await service.stopPreview()
    expect(mockTrack.stop).toHaveBeenCalled()
    expect(service.isActive()).toBe(false)
    expect(service.getActiveStream()).toBeNull()
  })

  it('handles permission denial gracefully with clear error code', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied by user'))
      }
    })

    await expect(service.startPreview()).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      recoverable: false
    })
    expect(service.isActive()).toBe(false)
  })

  it('captures a still frame and enforces resolution boundaries', () => {
    // Mock HTMLVideoElement
    const mockVideo = {
      videoWidth: 3840, // 4K input
      videoHeight: 2160
    } as unknown as HTMLVideoElement

    // Mock HTMLCanvasElement and 2d context
    const mockCtx = {
      drawImage: vi.fn()
    }
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockedImageData')
    }

    vi.stubGlobal('document', {
      createElement: vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas as any
        return {} as any
      })
    })

    const still = service.captureFrame(mockVideo, 'HD Test Cam')
    expect(still).toBeDefined()
    expect(still.sourceType).toBe('camera')
    expect(still.sourceLabel).toBe('HD Test Cam')
    // Aspect ratio 16:9 scaled down to 1920x1080
    expect(mockCanvas.width).toBe(1920)
    expect(mockCanvas.height).toBe(1080)
    expect(still.width).toBe(1920)
    expect(still.height).toBe(1080)
  })
})
