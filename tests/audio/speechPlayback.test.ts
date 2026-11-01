import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SpeechPlaybackService } from '../../src/renderer/src/services/audio/SpeechPlaybackService'

describe('SpeechPlaybackService (Local Speech Playback & Cancellation Lifecycle)', () => {
  let playbackService: SpeechPlaybackService
  let mockUtterance: any
  let mockSpeechSynthesis: any

  beforeEach(() => {
    playbackService = new SpeechPlaybackService()

    mockSpeechSynthesis = {
      speaking: false,
      pending: false,
      speak: vi.fn().mockImplementation((utterance) => {
        mockSpeechSynthesis.speaking = true
        // Simulate immediate utterance start
        setTimeout(() => {
          utterance.onstart?.()
          // Simulate end after short interval
          setTimeout(() => {
            mockSpeechSynthesis.speaking = false
            utterance.onend?.()
          }, 20)
        }, 5)
      }),
      cancel: vi.fn().mockImplementation(() => {
        mockSpeechSynthesis.speaking = false
        mockSpeechSynthesis.pending = false
      }),
      getVoices: vi.fn().mockReturnValue([
        { name: 'Microsoft David', lang: 'en-US', default: true },
        { name: 'Microsoft Zira', lang: 'en-US', default: false }
      ])
    }

    vi.stubGlobal('speechSynthesis', mockSpeechSynthesis)
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      vi.fn().mockImplementation((text) => {
        mockUtterance = {
          text,
          rate: 1,
          pitch: 1,
          volume: 1,
          onstart: null,
          onend: null,
          onerror: null
        }
        return mockUtterance
      })
    )
  })

  afterEach(() => {
    playbackService.dispose()
    vi.unstubAllGlobals()
  })

  it('initializes in idle state and enumerates local voices', () => {
    expect(playbackService.getStatus()).toBe('idle')

    const voices = playbackService.getVoices()
    expect(voices).toHaveLength(2)
    expect(voices[0].name).toBe('Microsoft David')
  })

  it('speaks text and transitions through loading -> playing -> idle lifecycle', async () => {
    const statuses: string[] = []
    playbackService.setStatusCallback((status) => statuses.push(status))

    const success = await playbackService.speakText('Hello HELIOXEN audio test')

    expect(success).toBe(true)
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
    expect(statuses).toContain('loading')
    expect(statuses).toContain('playing')
    expect(playbackService.getStatus()).toBe('idle')
  })

  it('cancels active playback when stop() is called', async () => {
    const speakPromise = playbackService.speakText('Long speech playback text')

    // Stop mid-flight
    playbackService.stop()

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled()
    expect(playbackService.getStatus()).toBe('stopped')

    await speakPromise
  })

  it('handles playback error event gracefully and transitions to error state', async () => {
    mockSpeechSynthesis.speak = vi.fn().mockImplementation((utterance) => {
      setTimeout(() => {
        utterance.onerror?.({ error: 'audio-busy' })
      }, 5)
    })

    let reportedError: any = null
    playbackService.setStatusCallback((_status, err) => {
      if (err) reportedError = err
    })

    const success = await playbackService.speakText('Failure prompt')

    expect(success).toBe(false)
    expect(playbackService.getStatus()).toBe('error')
    expect(reportedError).toBeDefined()
    expect(reportedError.code).toBe('PLAYBACK_FAILED')
    expect(reportedError.message).toContain('audio-busy')
  })

  it('rejects empty or whitespace-only text without initiating playback', async () => {
    const success = await playbackService.speakText('   ')
    expect(success).toBe(false)
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled()
  })
})
