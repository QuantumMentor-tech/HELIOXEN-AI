import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaCaptureCoordinator } from '../../src/renderer/src/services/capture/MediaCaptureCoordinator'
import { CapturedStillImage } from '../../src/shared/capture'

describe('MediaCaptureCoordinator State Orchestration (Step 22)', () => {
  let coordinator: MediaCaptureCoordinator
  const onStatusChange = vi.fn()
  const onImageCaptured = vi.fn()
  const onImageDiscarded = vi.fn()
  const onError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    coordinator = new MediaCaptureCoordinator({
      onStatusChange,
      onImageCaptured,
      onImageDiscarded,
      onError
    })
  })

  afterEach(() => {
    coordinator.dispose()
    vi.restoreAllMocks()
  })

  it('initializes in idle status without any active streams or staged images', () => {
    expect(coordinator.getStatus()).toBe('idle')
    expect(coordinator.getActiveSourceType()).toBeNull()
    expect(coordinator.getStagedImage()).toBeNull()
  })

  it('transitions through camera activation flow upon explicit request', async () => {
    const mockTrack = { stop: vi.fn() }
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

    const stream = await coordinator.startCamera('cam-1')
    expect(stream).toBe(mockStream)
    expect(coordinator.getActiveSourceType()).toBe('camera')
    expect(coordinator.getStatus()).toBe('previewing')
    expect(onStatusChange).toHaveBeenCalledWith('awaiting-permission', undefined)
    expect(onStatusChange).toHaveBeenCalledWith('previewing', undefined)
  })

  it('transitions through screen capture flow upon explicit source selection', async () => {
    const mockTrack = { stop: vi.fn() }
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

    const stream = await coordinator.startScreenStream('screen:0:0')
    expect(stream).toBe(mockStream)
    expect(coordinator.getActiveSourceType()).toBe('screen')
    expect(coordinator.getStatus()).toBe('previewing')
  })

  it('discards staged image and returns to idle cleanly', () => {
    // Manually stage an image
    const mockImage: CapturedStillImage = {
      id: 'img-1',
      sourceType: 'camera',
      mimeType: 'image/jpeg',
      width: 1280,
      height: 720,
      byteSize: 200000,
      timestamp: Date.now(),
      dataUrl: 'data:image/jpeg;base64,...'
    }

    // Set internal staged image for testing discard
    ;(coordinator as any).stagedImage = mockImage
    ;(coordinator as any).status = 'staged'

    expect(coordinator.getStagedImage()).toBe(mockImage)

    coordinator.discardStagedImage()
    expect(coordinator.getStagedImage()).toBeNull()
    expect(coordinator.getStatus()).toBe('idle')
    expect(onImageDiscarded).toHaveBeenCalled()
  })

  it('cancels active capture sessions and resets all state to idle', () => {
    ;(coordinator as any).activeSourceType = 'screen'
    ;(coordinator as any).status = 'previewing'

    coordinator.cancelCapture()
    expect(coordinator.getStatus()).toBe('idle')
    expect(coordinator.getActiveSourceType()).toBeNull()
    expect(coordinator.getStagedImage()).toBeNull()
  })
})
