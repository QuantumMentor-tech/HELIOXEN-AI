import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MicrophoneCaptureService } from '../../src/renderer/src/services/audio/MicrophoneCaptureService'
import { AudioBufferManager } from '../../src/renderer/src/services/audio/AudioBufferManager'

describe('MicrophoneCaptureService (Lifecycle, Device Selection & Bounded Capture)', () => {
  let captureService: MicrophoneCaptureService
  let bufferManager: AudioBufferManager

  // Mock audio track
  let mockTrack: {
    stop: ReturnType<typeof vi.fn>
    onended: (() => void) | null
  }

  // Mock MediaStream
  let mockStream: {
    getTracks: () => any[]
    getAudioTracks: () => any[]
  }

  // Mock AudioContext and nodes
  let mockAudioContext: any

  beforeEach(() => {
    bufferManager = new AudioBufferManager()
    captureService = new MicrophoneCaptureService(bufferManager)

    mockTrack = {
      stop: vi.fn(),
      onended: null
    }

    mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack]
    }

    mockAudioContext = {
      state: 'running',
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 256,
        smoothingTimeConstant: 0.3,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      createScriptProcessor: vi.fn().mockReturnValue({
        onaudioprocess: null,
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      destination: {},
      close: vi.fn().mockResolvedValue(undefined)
    }

    // Mock global window and navigator
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockAudioContext))

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'default', label: 'Default Mic' },
          { kind: 'audioinput', deviceId: 'usb-mic-1', label: 'USB Cardioid Mic' },
          { kind: 'videoinput', deviceId: 'cam-1', label: 'HD Webcam' }
        ])
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'granted' })
      }
    })
  })

  afterEach(async () => {
    await captureService.dispose()
    vi.unstubAllGlobals()
  })

  it('initializes in idle status and starts capture on explicit invocation', async () => {
    expect(captureService.getStatus()).toBe('idle')

    const statusChanges: string[] = []
    captureService.setStatusCallback((status) => statusChanges.push(status))

    const success = await captureService.startCapture()

    expect(success).toBe(true)
    expect(captureService.getStatus()).toBe('capturing')
    expect(statusChanges).toContain('activating')
    expect(statusChanges).toContain('capturing')
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1
      },
      video: false
    })
  })

  it('enumerates available audio input hardware devices', async () => {
    const devices = await captureService.getAudioInputDevices()

    expect(devices).toHaveLength(2)
    expect(devices[0].deviceId).toBe('default')
    expect(devices[0].label).toBe('Default Mic')
    expect(devices[1].deviceId).toBe('usb-mic-1')
    expect(devices[1].label).toBe('USB Cardioid Mic')
  })

  it('passes selected deviceId when activating capture', async () => {
    await captureService.startCapture('usb-mic-1')

    expect(captureService.getSelectedDeviceId()).toBe('usb-mic-1')
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          deviceId: { exact: 'usb-mic-1' }
        })
      })
    )
  })

  it('idempotently stops capture and cleans up all audio tracks and nodes', async () => {
    await captureService.startCapture()
    expect(captureService.getStatus()).toBe('capturing')

    await captureService.stopCapture()

    expect(captureService.getStatus()).toBe('idle')
    expect(mockTrack.stop).toHaveBeenCalled()
    expect(mockAudioContext.close).toHaveBeenCalled()

    // Second call is safe and idempotent
    await captureService.stopCapture()
    expect(captureService.getStatus()).toBe('idle')
  })

  it('handles permission denied error and transitions to error state', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied by system'))
      }
    })

    let reportedError: any = null
    captureService.setStatusCallback((_status, err) => {
      if (err) reportedError = err
    })

    const success = await captureService.startCapture()

    expect(success).toBe(false)
    expect(captureService.getStatus()).toBe('error')
    expect(reportedError).toBeDefined()
    expect(reportedError.code).toBe('PERMISSION_DENIED')
  })

  it('handles device disconnection event gracefully', async () => {
    await captureService.startCapture()
    expect(captureService.getStatus()).toBe('capturing')

    let reportedError: any = null
    captureService.setStatusCallback((_status, err) => {
      if (err) reportedError = err
    })

    // Simulate hardware unplug
    if (mockTrack.onended) {
      mockTrack.onended()
    }

    // Allow async stop to complete
    await new Promise((r) => setTimeout(r, 10))

    expect(captureService.getStatus()).toBe('error')
    expect(reportedError?.code).toBe('DEVICE_DISCONNECTED')
  })
})
