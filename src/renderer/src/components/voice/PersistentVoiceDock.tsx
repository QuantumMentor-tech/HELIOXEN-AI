import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  AlertTriangle,
  Loader2,
  Play,
  Square,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  PhoneOff
} from 'lucide-react'
import { VoiceDockProps } from './types'
import { Badge } from '../ui/Badge'
import {
  AudioDeviceInfo,
  AudioPermissionStatus,
  CaptureStatus,
  PlaybackStatus
} from '../../../../shared/audio/types'
import {
  MicrophoneCaptureService,
  SpeechPlaybackService,
  AudioBufferManager
} from '../../services/audio'
import { VoiceSessionCoordinator } from '../../services/voice/VoiceSessionCoordinator'
import { VoiceSessionStatus, TranscriptSegment } from '../../../../shared/voice/types'
import { CURATED_MODELS } from '../../../../shared/ai/models'

export const PersistentVoiceDock: React.FC<VoiceDockProps> = ({
  className = '',
  onToggleVoice,
  onSessionTranscript,
  onSessionStateChange,
  activeProvider = 'google-gemini',
  activeModel = 'gemini-3.8-flash'
}) => {
  // Underlying Step 19 Audio Services
  const bufferManagerRef = useRef<AudioBufferManager>(new AudioBufferManager())
  const captureServiceRef = useRef<MicrophoneCaptureService>(
    new MicrophoneCaptureService(bufferManagerRef.current)
  )
  const playbackServiceRef = useRef<SpeechPlaybackService>(new SpeechPlaybackService())

  // Step 20 Voice Session Coordinator
  const coordinatorRef = useRef<VoiceSessionCoordinator>(
    new VoiceSessionCoordinator(
      captureServiceRef.current,
      playbackServiceRef.current,
      bufferManagerRef.current
    )
  )

  // Subsystem states
  const [sessionStatus, setSessionStatus] = useState<VoiceSessionStatus>('idle')
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle')
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle')
  const [permissionStatus, setPermissionStatus] = useState<AudioPermissionStatus>('unknown')
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default')
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Real-time VU meter & buffer
  const [vuLevel, setVuLevel] = useState<number>(0)
  const [bufferedSeconds, setBufferedSeconds] = useState<number>(0)

  // Live transcript preview
  const [provisionalTranscript, setProvisionalTranscript] = useState<string>('')

  // Initialize service callbacks and enumerate devices
  useEffect(() => {
    const captureService = captureServiceRef.current
    const playbackService = playbackServiceRef.current
    const bufferManager = bufferManagerRef.current
    const coordinator = coordinatorRef.current

    captureService.setStatusCallback((status, error) => {
      setCaptureStatus(status)
      if (error) {
        setErrorMessage(error.message)
      } else if (status === 'capturing') {
        setErrorMessage(null)
      }
    })

    captureService.setVuMeterCallback((level, _rms) => {
      setVuLevel(level)
      setBufferedSeconds(bufferManager.getMetrics().durationSeconds)
    })

    playbackService.setStatusCallback((status, error) => {
      setPlaybackStatus(status)
      if (error) {
        setErrorMessage(error.message)
      }
    })

    coordinator.setCallbacks({
      onStatusChange: (status, error) => {
        setSessionStatus(status)
        onSessionStateChange?.(status)
        if (error) {
          setErrorMessage(error.message)
        } else if (status === 'listening' || status === 'completed') {
          setErrorMessage(null)
        }
      },
      onTranscriptUpdate: (segments, activeSegment) => {
        if (activeSegment) {
          setProvisionalTranscript(activeSegment.text)
        } else {
          setProvisionalTranscript('')
        }

        // Notify parent if the newest segment was finalized
        const newest = segments[segments.length - 1]
        if (newest && newest.isFinal) {
          onSessionTranscript?.(newest)
        }
      },
      onInterrupted: () => {
        setErrorMessage(null)
        setProvisionalTranscript('')
      },
      onError: (err) => {
        setErrorMessage(err.message)
      }
    })

    // Query permission & devices
    captureService.checkPermission().then((perm) => {
      setPermissionStatus(perm)
    })

    captureService.getAudioInputDevices().then((devList) => {
      setDevices(devList)
      if (devList.length > 0) {
        const defaultDev = devList.find((d) => d.isDefault) || devList[0]
        setSelectedDeviceId(defaultDev.deviceId)
      }
    })

    // Global keyboard shortcut: Escape interrupts active voice session
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (coordinatorRef.current.getStatus() !== 'idle') {
          coordinatorRef.current.interrupt()
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown)
      }
      coordinator.dispose()
    }
  }, [onSessionTranscript, onSessionStateChange])

  // Explicit Toggle Voice Session (Step 20)
  const handleToggleVoiceSession = useCallback(async () => {
    onToggleVoice?.()
    setErrorMessage(null)
    const coordinator = coordinatorRef.current

    if (
      sessionStatus === 'listening' ||
      sessionStatus === 'generating-response' ||
      sessionStatus === 'playing-audio' ||
      sessionStatus === 'connecting' ||
      sessionStatus === 'preparing' ||
      sessionStatus === 'receiving-transcript'
    ) {
      // User requested interruption!
      await coordinator.interrupt()
    } else {
      // Start session with active provider and model
      const modelDef = CURATED_MODELS[activeModel]
      await coordinator.startSession(
        {
          provider: activeProvider,
          model: activeModel,
          enableAudioPlayback: true,
          deviceId: selectedDeviceId !== 'default' ? selectedDeviceId : undefined
        },
        modelDef
      )
    }
  }, [sessionStatus, activeProvider, activeModel, selectedDeviceId, onToggleVoice])

  // Standalone Microphone Capture Toggle (Step 19 preservation)
  const handleToggleRawCapture = useCallback(async () => {
    setErrorMessage(null)
    const captureService = captureServiceRef.current

    if (captureStatus === 'capturing' || captureStatus === 'activating') {
      await captureService.stopCapture()
      setVuLevel(0)
    } else {
      await captureService.startCapture(
        selectedDeviceId !== 'default' ? selectedDeviceId : undefined
      )
    }
  }, [captureStatus, selectedDeviceId])

  // Device selection handler
  const handleSelectDevice = async (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    setIsDeviceMenuOpen(false)
    captureServiceRef.current.setSelectedDeviceId(deviceId)

    if (captureStatus === 'capturing') {
      await captureServiceRef.current.stopCapture()
      await captureServiceRef.current.startCapture(deviceId)
    }
  }

  // Playback speech test handler
  const handleTestSpeech = useCallback(() => {
    const playbackService = playbackServiceRef.current
    if (playbackStatus === 'playing') {
      playbackService.stop()
    } else {
      playbackService.speakText(
        'HELIOXEN real-time voice session layer is active and verified for Step 20.'
      )
    }
  }, [playbackStatus])

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId)
  const deviceLabel = selectedDevice ? selectedDevice.label : 'Default Microphone'
  const isSessionActive =
    sessionStatus !== 'idle' &&
    sessionStatus !== 'completed' &&
    sessionStatus !== 'interrupted' &&
    sessionStatus !== 'fatal-error'

  return (
    <footer
      id="persistent-voice-dock"
      aria-label="Persistent Voice Controller Dock"
      className={`w-full bg-hx-panel border-t border-hx-border-panel px-6 py-2.5 flex items-center justify-between select-none z-hx-elevated relative shrink-0 ${className}`}
    >
      {/* Actionable Error / Permission Notification Toast */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="absolute left-1/2 -translate-x-1/2 -top-12 px-4 py-2 rounded-hx-md bg-hx-danger/20 border border-hx-danger/50 text-xs font-mono text-hx-danger flex items-center space-x-2 animate-hx-fade-in z-hx-modal shadow-hx-card"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-hx-danger" />
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[10px] underline ml-2 hover:opacity-100 opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Provisional Transcript Preview Toast */}
      {provisionalTranscript && isSessionActive && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-1/2 -translate-x-1/2 -top-10 px-3 py-1.5 rounded-hx-full bg-hx-space/90 border border-hx-cyan/60 text-xs font-mono text-hx-cyan flex items-center space-x-2 shadow-hx-glow-cyan-sm animate-pulse z-hx-modal"
        >
          <span className="w-2 h-2 rounded-full bg-hx-cyan animate-ping" />
          <span className="max-w-md truncate">{provisionalTranscript}</span>
        </div>
      )}

      {/* Left Slot: Audio Device & Input Selector */}
      <div className="flex items-center space-x-3 text-xs font-mono relative">
        <div className="flex items-center space-x-1.5 text-hx-text-secondary">
          <Volume2 className="w-3.5 h-3.5 text-hx-cyan" />
          <span className="hidden sm:inline">VOICE ENGINE:</span>
          <span
            className={`font-semibold ${
              isSessionActive
                ? 'text-hx-cyan'
                : captureStatus === 'capturing'
                ? 'text-hx-nominal'
                : 'text-hx-text-primary'
            }`}
          >
            {sessionStatus === 'listening'
              ? 'LISTENING'
              : sessionStatus === 'generating-response'
              ? 'THINKING'
              : sessionStatus === 'playing-audio'
              ? 'SPEAKING'
              : sessionStatus === 'interrupted'
              ? 'INTERRUPTED'
              : captureStatus === 'capturing'
              ? 'RAW CAPTURE'
              : 'STANDBY'}
          </span>
        </div>

        <span className="text-hx-text-muted hidden md:inline">•</span>

        {/* Input Device Dropdown Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
            className="flex items-center space-x-1 text-[11px] font-mono text-hx-text-secondary hover:text-hx-text-primary bg-hx-space/50 px-2 py-0.5 rounded border border-hx-border-subtle hover:border-hx-border-glow transition-all max-w-[180px] truncate"
            title="Select audio input hardware device"
            aria-expanded={isDeviceMenuOpen}
            aria-haspopup="listbox"
          >
            <span className="truncate">{deviceLabel}</span>
            <ChevronDown className="w-3 h-3 shrink-0 ml-1 opacity-70" />
          </button>

          {isDeviceMenuOpen && (
            <div
              role="listbox"
              className="absolute left-0 bottom-8 w-64 bg-hx-panel border border-hx-border-glow rounded-hx-md shadow-hx-glow-cyan-sm p-1 z-hx-popover space-y-0.5 text-xs font-mono animate-hx-fade-in"
            >
              <div className="px-2 py-1 text-[10px] text-hx-text-muted uppercase tracking-wider border-b border-hx-border-subtle">
                Input Hardware Devices
              </div>
              {devices.length === 0 ? (
                <div className="px-2 py-1.5 text-hx-text-muted text-[11px]">
                  No audio input devices detected
                </div>
              ) : (
                devices.map((dev) => (
                  <button
                    key={dev.deviceId}
                    type="button"
                    role="option"
                    aria-selected={dev.deviceId === selectedDeviceId}
                    onClick={() => handleSelectDevice(dev.deviceId)}
                    className={`w-full text-left px-2 py-1.5 rounded text-[11px] truncate flex items-center justify-between ${
                      dev.deviceId === selectedDeviceId
                        ? 'bg-hx-space text-hx-cyan font-semibold'
                        : 'text-hx-text-secondary hover:bg-hx-surface hover:text-hx-text-primary'
                    }`}
                  >
                    <span className="truncate">{dev.label}</span>
                    {dev.deviceId === selectedDeviceId && (
                      <CheckCircle2 className="w-3 h-3 text-hx-cyan shrink-0 ml-1" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center Slot: Real-Time Session Controller, Interrupt Button & VU Meter */}
      <div className="flex items-center space-x-3">
        {/* Real-time 8-Segment Audio VU Meter */}
        <div
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-hx-sm bg-hx-surface border border-hx-border-subtle h-8"
          title={`Audio VU Level: ${vuLevel}/8`}
          aria-label={`Audio level meter: ${vuLevel} of 8 segments active`}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((segIndex) => {
            const isActive =
              (captureStatus === 'capturing' || isSessionActive) && segIndex <= vuLevel
            const minHeight = 4
            const maxHeight = 18
            const scaledHeight = isActive
              ? Math.max(minHeight, Math.round((segIndex / 8) * maxHeight))
              : 4

            return (
              <span
                key={segIndex}
                style={{ height: `${scaledHeight}px` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isActive
                    ? segIndex > 6
                      ? 'bg-hx-warning shadow-hx-glow-amber-sm'
                      : 'bg-hx-cyan shadow-hx-glow-cyan-sm'
                    : 'bg-hx-cyan/20'
                }`}
              />
            )
          })}
        </div>

        {/* Primary Voice Session Action Button */}
        <button
          type="button"
          onClick={handleToggleVoiceSession}
          disabled={sessionStatus === 'cancelling' || sessionStatus === 'preparing'}
          aria-label={
            isSessionActive
              ? 'Interrupt and Stop Voice Session (Escape)'
              : 'Start Real-Time Voice Session'
          }
          title={
            isSessionActive
              ? 'Voice session active • Click or press Escape to Interrupt'
              : 'Click to start real-time AI voice session'
          }
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-hx-md border font-mono text-xs font-semibold tracking-wider uppercase transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hx-cyan ${
            isSessionActive
              ? 'bg-hx-danger/20 hover:bg-hx-danger/30 border-hx-danger text-hx-danger shadow-hx-glow-amber-sm'
              : 'bg-hx-surface hover:bg-hx-hover active:bg-hx-active border-hx-border-glow shadow-hx-glow-cyan-sm text-hx-cyan'
          }`}
        >
          {sessionStatus === 'cancelling' || sessionStatus === 'preparing' ? (
            <Loader2 className="w-4 h-4 animate-spin text-hx-cyan" />
          ) : isSessionActive ? (
            <PhoneOff className="w-4 h-4 text-hx-danger animate-pulse" />
          ) : (
            <Sparkles className="w-4 h-4 text-hx-cyan" />
          )}

          <span>
            {sessionStatus === 'preparing'
              ? 'Connecting'
              : sessionStatus === 'cancelling'
              ? 'Cancelling'
              : isSessionActive
              ? 'Interrupt (Esc)'
              : 'Voice Session'}
          </span>
        </button>

        {/* Secondary Raw Microphone Capture Trigger (Step 19 hardware isolation) */}
        <button
          type="button"
          onClick={handleToggleRawCapture}
          disabled={captureStatus === 'activating' || captureStatus === 'stopping'}
          aria-label={
            captureStatus === 'capturing'
              ? 'Stop Raw Microphone Capture'
              : 'Start Raw Microphone Capture'
          }
          title={
            captureStatus === 'capturing'
              ? 'Raw capture active • Click to stop'
              : 'Toggle raw microphone capture'
          }
          className={`p-1.5 rounded-hx-sm border transition-all ${
            captureStatus === 'capturing'
              ? 'bg-hx-nominal/20 border-hx-nominal text-hx-nominal animate-pulse'
              : 'bg-hx-surface hover:bg-hx-hover border-hx-border-subtle text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          {captureStatus === 'capturing' ? (
            <MicOff className="w-3.5 h-3.5 text-hx-nominal" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-hx-text-secondary" />
          )}
        </button>

        {/* Speech Playback Test / Control */}
        <button
          type="button"
          onClick={handleTestSpeech}
          aria-label={
            playbackStatus === 'playing'
              ? 'Stop Speech Playback'
              : 'Test Local Speech Playback'
          }
          title={
            playbackStatus === 'playing'
              ? 'Speech playing • Click to stop'
              : 'Test local offline speech playback'
          }
          className={`p-1.5 rounded-hx-sm border transition-all ${
            playbackStatus === 'playing'
              ? 'bg-hx-purple/20 border-hx-purple text-hx-purple animate-pulse'
              : 'bg-hx-surface hover:bg-hx-hover border-hx-border-subtle text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          {playbackStatus === 'playing' ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Right Slot: Buffer & Phase 7 Step 20 Status */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-[11px] text-hx-text-muted">
          <Radio
            className={`w-3 h-3 ${
              isSessionActive || captureStatus === 'capturing'
                ? 'text-hx-nominal animate-pulse'
                : 'text-hx-text-muted'
            }`}
          />
          <span className="hidden sm:inline">BUFFER:</span>
          <span
            className={`font-medium ${
              captureStatus === 'capturing' || isSessionActive
                ? 'text-hx-nominal'
                : 'text-hx-text-primary'
            }`}
          >
            {bufferedSeconds > 0 ? `${bufferedSeconds.toFixed(1)}s / 30s` : 'EMPTY'}
          </span>
        </div>

        <Badge
          variant={isSessionActive ? 'nominal' : captureStatus === 'capturing' ? 'info' : 'neutral'}
          size="sm"
        >
          {isSessionActive ? 'SESSION LIVE' : 'Phase 7 Active'}
        </Badge>
      </div>
    </footer>
  )
}
