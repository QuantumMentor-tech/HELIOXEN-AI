import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VoiceSessionCoordinator } from '../../src/renderer/src/services/voice/VoiceSessionCoordinator'
import { AudioBufferManager } from '../../src/renderer/src/services/audio/AudioBufferManager'
import { MicrophoneCaptureService } from '../../src/renderer/src/services/audio/MicrophoneCaptureService'
import { SpeechPlaybackService } from '../../src/renderer/src/services/audio/SpeechPlaybackService'
import { CURATED_MODELS } from '../../src/shared/ai/models'

describe('VoiceSessionCoordinator (Lifecycle, Streaming Transcripts & Interruption)', () => {
  let coordinator: VoiceSessionCoordinator
  let bufferManager: AudioBufferManager
  let mockCaptureService: any
  let mockPlaybackService: any

  beforeEach(() => {
    bufferManager = new AudioBufferManager()

    mockCaptureService = {
      checkPermission: vi.fn().mockResolvedValue('granted'),
      startCapture: vi.fn().mockResolvedValue(true),
      stopCapture: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue('idle')
    }

    mockPlaybackService = {
      speakText: vi.fn().mockImplementation((_text, options) => {
        // Simulate speech playback end after short delay
        setTimeout(() => options?.onEnd?.(), 10)
        return Promise.resolve(true)
      }),
      stop: vi.fn(),
      dispose: vi.fn()
    }

    coordinator = new VoiceSessionCoordinator(
      mockCaptureService as unknown as MicrophoneCaptureService,
      mockPlaybackService as unknown as SpeechPlaybackService,
      bufferManager
    )

    // Mock window.helioxen.ai
    vi.stubGlobal('window', {
      helioxen: {
        ai: {
          generateText: vi.fn().mockResolvedValue({
            text: 'Hello, this is the AI assistant response.',
            provider: 'google-gemini',
            model: 'gemini-3.8-flash'
          }),
          onStreamChunk: vi.fn().mockImplementation((callback) => {
            // Emulate streaming deltas
            setTimeout(() => callback({ textDelta: 'Hello, ' }), 5)
            setTimeout(() => callback({ textDelta: 'this is ' }), 10)
            setTimeout(() => callback({ textDelta: 'the AI assistant response.', isDone: true }), 15)
            return () => {}
          }),
          cancel: vi.fn().mockResolvedValue(undefined)
        }
      }
    })
  })

  afterEach(() => {
    coordinator.dispose()
    vi.unstubAllGlobals()
  })

  it('starts session cleanly when model is eligible and permission is granted', async () => {
    const statuses: string[] = []
    coordinator.setCallbacks({
      onStatusChange: (status) => statuses.push(status)
    })

    const started = await coordinator.startSession(
      {
        provider: 'google-gemini',
        model: 'gemini-3.8-flash'
      },
      CURATED_MODELS['gemini-3.8-flash']
    )

    expect(started).toBe(true)
    expect(coordinator.getStatus()).toBe('listening')
    expect(statuses).toContain('preparing')
    expect(statuses).toContain('awaiting-permission')
    expect(statuses).toContain('connecting')
    expect(statuses).toContain('listening')
    expect(mockCaptureService.startCapture).toHaveBeenCalled()
    expect(coordinator.getActiveSessionId()).toBeTruthy()
  })

  it('rejects voice session when model is ineligible', async () => {
    const errors: any[] = []
    coordinator.setCallbacks({
      onError: (err) => errors.push(err)
    })

    const started = await coordinator.startSession(
      {
        provider: 'google-gemini',
        model: 'gemini-3.5-flash-lite'
      },
      CURATED_MODELS['gemini-3.5-flash-lite']
    )

    expect(started).toBe(false)
    expect(coordinator.getStatus()).toBe('fatal-error')
    expect(errors[0].code).toBe('CAPABILITY_UNSUPPORTED')
    expect(mockCaptureService.startCapture).not.toHaveBeenCalled()
  })

  it('handles permission denial gracefully with fatal-error status', async () => {
    mockCaptureService.checkPermission.mockResolvedValueOnce('denied')

    const errors: any[] = []
    coordinator.setCallbacks({
      onError: (err) => errors.push(err)
    })

    const started = await coordinator.startSession(
      {
        provider: 'google-gemini',
        model: 'gemini-3.8-flash'
      },
      CURATED_MODELS['gemini-3.8-flash']
    )

    expect(started).toBe(false)
    expect(coordinator.getStatus()).toBe('fatal-error')
    expect(errors[0].code).toBe('PERMISSION_DENIED')
  })

  it('manages structured transcript segments and updates provisional interim text', async () => {
    await coordinator.startSession({
      provider: 'google-gemini',
      model: 'gemini-3.8-flash'
    })

    let lastActiveSegment: any = null
    coordinator.setCallbacks({
      onTranscriptUpdate: (_segments, active) => {
        lastActiveSegment = active
      }
    })

    coordinator.handlePartialTranscript('What is the weather', false)
    expect(lastActiveSegment).toBeTruthy()
    expect(lastActiveSegment.text).toBe('What is the weather')
    expect(lastActiveSegment.isFinal).toBe(false)
    expect(coordinator.getStatus()).toBe('receiving-transcript')
  })

  it('submits user turn, updates transcript, and plays spoken response', async () => {
    await coordinator.startSession({
      provider: 'google-gemini',
      model: 'gemini-3.8-flash',
      enableAudioPlayback: true
    })

    const success = await coordinator.submitUserTurn('What is the current flight status?')

    expect(success).toBe(true)
    const segments = coordinator.getSegments()
    expect(segments.length).toBe(2)
    expect(segments[0].speaker).toBe('user')
    expect(segments[0].text).toBe('What is the current flight status?')
    expect(segments[0].isFinal).toBe(true)

    expect(segments[1].speaker).toBe('assistant')
    expect(segments[1].text).toContain('Hello, this is the AI assistant response.')
    expect(segments[1].isFinal).toBe(true)

    expect(mockPlaybackService.speakText).toHaveBeenCalledWith(
      expect.stringContaining('Hello, this is the AI assistant response.'),
      expect.any(Object)
    )
  })

  it('immediately interrupts active session, stopping playback, capture, and marking transcript', async () => {
    await coordinator.startSession({
      provider: 'google-gemini',
      model: 'gemini-3.8-flash'
    })

    let interruptedSessionId: string | null = null
    coordinator.setCallbacks({
      onInterrupted: (id) => {
        interruptedSessionId = id
      }
    })

    // Simulate in-flight user turn and partial response
    coordinator.handlePartialTranscript('User spoke something', false)
    const activeSessionIdBeforeInterrupt = coordinator.getActiveSessionId()

    // Interrupt!
    await coordinator.interrupt()

    expect(coordinator.getStatus()).toBe('interrupted')
    expect(interruptedSessionId).toBe(activeSessionIdBeforeInterrupt)
    expect(mockPlaybackService.stop).toHaveBeenCalled()
    expect(mockCaptureService.stopCapture).toHaveBeenCalled()
    expect(coordinator.getActiveSessionId()).toBeNull()

    const metrics = coordinator.getMetrics()
    expect(metrics?.interruptionCount).toBe(1)
  })

  it('drops stale callbacks from an interrupted session if a new session starts', async () => {
    await coordinator.startSession({
      provider: 'google-gemini',
      model: 'gemini-3.8-flash'
    })

    const firstSessionId = coordinator.getActiveSessionId()
    await coordinator.interrupt()

    // Start a new session
    await coordinator.startSession({
      provider: 'google-gemini',
      model: 'gemini-3.8-flash'
    })

    const secondSessionId = coordinator.getActiveSessionId()
    expect(secondSessionId).not.toBe(firstSessionId)

    // Stale partial transcript with firstSessionId should be rejected
    coordinator.handlePartialTranscript('Late packet from session 1', false)
    const activeSeg = coordinator.getSegments().find((s) => s.text === 'Late packet from session 1')
    expect(activeSeg).toBeUndefined()
  })
})
