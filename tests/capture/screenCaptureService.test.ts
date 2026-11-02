import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScreenCaptureService } from '../../src/renderer/src/services/capture/ScreenCaptureService'

describe('ScreenCaptureService (Step 22)', () => {
  let service: ScreenCaptureService

  beforeEach(() => {
    service = new ScreenCaptureService()
  })

  afterEach(() => {
    service.stopActiveStream()
    vi.restoreAllMocks()
  })

  it('starts inactive without running any background capture streams', () => {
    expect(service.isStreamActive()).toBe(false)
  })

  it('queries desktop display sources via preload bridge', async () => {
    const mockSources = [
      { id: 'screen:0:0', name: 'Screen 1', isAppWindow: false },
      { id: 'window:999:0', name: 'Code Editor', isAppWindow: true }
    ]

    vi.stubGlobal('window', {
      helioxen: {
        capture: {
          getDesktopSources: vi.fn().mockResolvedValue(mockSources)
        }
      }
    })

    const sources = await service.getAvailableSources(['screen', 'window'])
    expect(sources).toHaveLength(2)
    expect(sources[0].id).toBe('screen:0:0')
    expect(sources[1].name).toBe('Code Editor')
  })

  it('starts desktop stream using chromeMediaSource desktop constraint', async () => {
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

    const stream = await service.startStream('screen:0:0')
    expect(stream).toBe(mockStream)
    expect(service.isStreamActive()).toBe(true)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: 'screen:0:0',
          maxWidth: 1920,
          maxHeight: 1080
        }
      }
    })
  })

  it('terminates desktop media tracks cleanly when stopped', async () => {
    const mockTrack = {
      stop: vi.fn()
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

    await service.startStream('screen:0:0')
    expect(service.isStreamActive()).toBe(true)

    service.stopActiveStream()
    expect(mockTrack.stop).toHaveBeenCalled()
    expect(service.isStreamActive()).toBe(false)
  })
})
