import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WakeWordService } from '../../src/renderer/src/services/voice/WakeWordService'
import { LocalWakeWordEngine } from '../../src/renderer/src/services/voice/LocalWakeWordEngine'
import { AudioNoiseProcessor } from '../../src/renderer/src/services/voice/AudioNoiseProcessor'
import {
  WakeWordStatus,
  WakeWordDetectionEvent,
  AudioQualityMetrics
} from '../../src/shared/voice/types'

describe('WakeWordService (Step 21 State Machine & Session Handoff)', () => {
  let mockCaptureService: any
  let mockPlaybackService: any
  let mockCoordinator: any
  let mockEngine: any
  let mockNoiseProcessor: any
  let chunkListener: ((chunk: Float32Array) => void) | null = null

  beforeEach(() => {
    chunkListener = null

    mockCaptureService = {
      getStatus: vi.fn().mockReturnValue('idle'),
      checkPermission: vi.fn().mockResolvedValue('granted'),
      startCapture: vi.fn().mockResolvedValue(true),
      stopCapture: vi.fn().mockResolvedValue(undefined),
      addChunkListener: vi.fn((listener) => {
        chunkListener = listener
        return () => {
          chunkListener = null
        }
      })
    }

    mockPlaybackService = {
      getStatus: vi.fn().mockReturnValue('idle'),
      setStatusCallback: vi.fn()
    }

    mockCoordinator = {
      getStatus: vi.fn().mockReturnValue('idle'),
      getCaptureService: () => mockCaptureService,
      getPlaybackService: () => mockPlaybackService,
      startSession: vi.fn().mockResolvedValue(true)
    }

    mockEngine = {
      initialize: vi.fn().mockResolvedValue(true),
      dispose: vi.fn(),
      reset: vi.fn(),
      setWakeWord: vi.fn(),
      setSensitivity: vi.fn(),
      processFrame: vi.fn().mockReturnValue(null)
    }

    mockNoiseProcessor = {
      processChunk: vi.fn((chunk: Float32Array) => ({
        cleanedChunk: chunk,
        metrics: {
          rmsEnergy: 0.2,
          peakAmplitude: 0.5,
          noiseFloorDb: -50,
          isClipping: false,
          isSilent: false
        }
      })),
      setNoiseSuppression: vi.fn(),
      reset: vi.fn()
    }
  })

  it('initializes to "disabled" status by default and never auto-activates', () => {
    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    expect(service.getStatus()).toBe('disabled')
    expect(mockCaptureService.startCapture).not.toHaveBeenCalled()
    expect(mockEngine.initialize).not.toHaveBeenCalled()
  })

  it('transitions to "monitoring" upon explicit user activation', async () => {
    const statusHistory: WakeWordStatus[] = []
    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    service.setCallbacks({
      onStatusChange: (status) => statusHistory.push(status)
    })

    const started = await service.enableMonitoring()
    expect(started).toBe(true)
    expect(service.getStatus()).toBe('monitoring')
    expect(statusHistory).toContain('enabling')
    expect(statusHistory).toContain('awaiting-permission')
    expect(statusHistory).toContain('initializing-engine')
    expect(statusHistory).toContain('monitoring')
    expect(mockCaptureService.addChunkListener).toHaveBeenCalled()
  })

  it('safely handles permission denial and enters "fatal-error"', async () => {
    mockCaptureService.checkPermission.mockResolvedValue('denied')

    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    const started = await service.enableMonitoring()
    expect(started).toBe(false)
    expect(service.getStatus()).toBe('fatal-error')
    expect(mockCaptureService.startCapture).not.toHaveBeenCalled()
  })

  it('cleanly stops monitoring and releases listeners upon disableMonitoring()', async () => {
    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    await service.enableMonitoring()
    expect(service.getStatus()).toBe('monitoring')
    expect(chunkListener).not.toBeNull()

    await service.disableMonitoring()
    expect(service.getStatus()).toBe('disabled')
    expect(chunkListener).toBeNull()
  })

  it('Mode A: alerts on detection without starting external voice session', async () => {
    const detectedEvents: WakeWordDetectionEvent[] = []
    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    service.setPreferences({ activationMode: 'confirm' })
    service.setCallbacks({
      onDetection: (evt) => detectedEvents.push(evt)
    })

    await service.enableMonitoring()

    // Simulate positive wake-word detection from engine
    const event: WakeWordDetectionEvent = {
      wakeWord: 'helioxen',
      confidence: 0.85,
      timestamp: Date.now(),
      energy: 0.3
    }
    mockEngine.processFrame.mockReturnValue(event)

    // Send chunk through registered listener
    expect(chunkListener).not.toBeNull()
    chunkListener!(new Float32Array(1024).fill(0.3))

    expect(service.getStatus()).toBe('wake-word-detected')
    expect(detectedEvents.length).toBe(1)
    expect(detectedEvents[0].wakeWord).toBe('helioxen')
    // Mode A must NOT start an external voice session automatically!
    expect(mockCoordinator.startSession).not.toHaveBeenCalled()
  })

  it('Mode B: automatically hands off to VoiceSessionCoordinator on valid detection', async () => {
    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    service.setPreferences({ activationMode: 'auto-session' })
    await service.enableMonitoring()

    const event: WakeWordDetectionEvent = {
      wakeWord: 'helioxen',
      confidence: 0.9,
      timestamp: Date.now(),
      energy: 0.4
    }
    mockEngine.processFrame.mockReturnValue(event)

    chunkListener!(new Float32Array(1024).fill(0.4))

    expect(mockCoordinator.startSession).toHaveBeenCalled()
  })

  it('echo suppression: suspends monitoring when assistant playback is active', async () => {
    let playbackCallback: ((status: string) => void) | null = null
    mockPlaybackService.setStatusCallback.mockImplementation((cb) => {
      playbackCallback = cb
    })

    const service = new WakeWordService({
      captureService: mockCaptureService,
      playbackService: mockPlaybackService,
      sessionCoordinator: mockCoordinator,
      engine: mockEngine,
      noiseProcessor: mockNoiseProcessor
    })

    service.setPreferences({ pauseDuringPlayback: true })
    await service.enableMonitoring()
    expect(service.getStatus()).toBe('monitoring')

    // Assistant speech starts
    playbackCallback!('playing')
    expect(service.getStatus()).toBe('temporarily-suspended')

    // Assistant speech finishes
    playbackCallback!('idle')
    expect(service.getStatus()).toBe('monitoring')
  })
})
