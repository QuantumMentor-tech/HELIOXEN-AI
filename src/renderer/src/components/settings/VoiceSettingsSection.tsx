import React, { useState, useEffect, useCallback } from 'react'
import {
  Mic,
  Ear,
  Volume2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Info,
  RotateCcw
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
  UserVoicePreferences,
  DEFAULT_VOICE_PREFERENCES,
  WakeWord,
  WakeWordSensitivity,
  WakeWordActivationMode
} from '../../../../shared/voice/types'
import { SpeechPlaybackService } from '../../services/audio/SpeechPlaybackService'

export interface VoiceSettingsSectionProps {
  className?: string
  onPreferencesChanged?: (prefs: UserVoicePreferences) => void
}

export const VoiceSettingsSection: React.FC<VoiceSettingsSectionProps> = ({
  className = '',
  onPreferencesChanged
}) => {
  const [preferences, setPreferences] = useState<UserVoicePreferences>(DEFAULT_VOICE_PREFERENCES)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  )

  const playbackServiceRef = React.useRef<SpeechPlaybackService>(new SpeechPlaybackService())

  // Load persisted preferences and enumerate available synthesis voices
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        setIsLoading(true)
        if (window.helioxen?.voice) {
          const loaded = await window.helioxen.voice.getPreferences()
          if (isMounted && loaded) {
            setPreferences(loaded)
          }
        }

        // Enumerate local operating system speech voices
        const updateVoices = () => {
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            const voices = window.speechSynthesis.getVoices()
            if (isMounted && voices.length > 0) {
              setAvailableVoices(voices)
            }
          }
        }

        updateVoices()
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = updateVoices
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (isMounted) {
          setBanner({ type: 'error', text: `Failed to load voice preferences: ${msg}` })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  // Persist preference updates
  const handleSave = useCallback(
    async (updated: UserVoicePreferences) => {
      try {
        setIsSaving(true)
        setBanner(null)
        if (window.helioxen?.voice) {
          const saved = await window.helioxen.voice.setPreferences(updated)
          setPreferences(saved)
          onPreferencesChanged?.(saved)
          setBanner({
            type: 'success',
            text: 'Voice and wake-word preferences securely saved.'
          })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setBanner({ type: 'error', text: `Failed to save voice preferences: ${msg}` })
      } finally {
        setIsSaving(false)
      }
    },
    [onPreferencesChanged]
  )

  // Voice synthesis preview test
  const handleTestVoicePreview = useCallback(() => {
    const service = playbackServiceRef.current
    if (isPlayingPreview) {
      service.stop()
      setIsPlayingPreview(false)
      return
    }

    setIsPlayingPreview(true)
    const selectedVoiceObj = availableVoices.find(
      (v) => v.name === preferences.outputVoice
    )

    service
      .speakText(
        'HELIOXEN voice preferences verified. All audio processing runs locally on your device.',
        {
          voice: selectedVoiceObj,
          rate: preferences.speechRate,
          pitch: preferences.speechPitch,
          volume: preferences.speechVolume,
          onEnd: () => setIsPlayingPreview(false),
          onError: () => setIsPlayingPreview(false)
        }
      )
      .catch(() => setIsPlayingPreview(false))
  }, [isPlayingPreview, availableVoices, preferences])

  // Reset to defaults
  const handleResetDefaults = useCallback(() => {
    const defaults = { ...DEFAULT_VOICE_PREFERENCES }
    setPreferences(defaults)
    handleSave(defaults)
  }, [handleSave])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-hx-border-subtle">
        <div>
          <div className="flex items-center space-x-2">
            <Ear className="w-5 h-5 text-hx-cyan" />
            <h3 className="text-base font-display font-semibold text-hx-text-primary tracking-wide">
              Wake-Word Detection, Noise Handling &amp; Voice Preferences
            </h3>
          </div>
          <p className="text-xs text-hx-text-secondary mt-1">
            Privacy-first local keyword spotting, bounded audio filtering, and system speech synthesis preferences.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="nominal" size="sm" isDot>
            Step 21 Active
          </Badge>
          <Badge variant="info" size="sm">
            Phase 7
          </Badge>
        </div>
      </div>

      {/* Notification Banner */}
      {banner && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-3 rounded-hx-md border text-xs flex items-center justify-between transition-all animate-hx-fade-in ${
            banner.type === 'success'
              ? 'bg-hx-nominal/10 border-hx-nominal/40 text-hx-nominal'
              : banner.type === 'error'
              ? 'bg-hx-danger/10 border-hx-danger/40 text-hx-danger'
              : 'bg-hx-cyan/10 border-hx-border-glow text-hx-cyan'
          }`}
        >
          <div className="flex items-center space-x-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Card Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Local Wake-Word Engine */}
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-hx-cyan">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider">
                Wake-Word Engine
              </h4>
            </div>
            <Badge variant="nominal" size="sm">
              100% Local
            </Badge>
          </div>

          <div className="p-2.5 rounded-hx-sm bg-hx-space/60 border border-hx-border-subtle text-[11px] text-hx-text-secondary leading-relaxed">
            <span className="font-semibold text-hx-text-primary">Privacy Guarantee:</span> Keyword
            spotting operates strictly on-device using local acoustic envelope matching. Audio is never
            streamed to external clouds to detect the wake word.
          </div>

          {/* Wake Word Enable Toggle */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="pref-wake-word-enabled" className="text-xs font-mono text-hx-text-primary">
                Wake-Word Monitoring
              </label>
              <input
                id="pref-wake-word-enabled"
                type="checkbox"
                checked={preferences.wakeWordEnabled}
                onChange={(e) => {
                  const updated = { ...preferences, wakeWordEnabled: e.target.checked }
                  setPreferences(updated)
                  handleSave(updated)
                }}
                className="w-4 h-4 rounded border-hx-border-subtle bg-hx-space text-hx-cyan focus:ring-hx-cyan"
              />
            </div>
            <p className="text-[10px] text-hx-text-muted leading-normal">
              When checked, enables the wake-word listener option. Note: Per privacy policy, monitoring
              remains idle on application launch until explicitly activated.
            </p>
          </div>

          {/* Target Wake Word */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-hx-text-muted">Target Wake Word</label>
            <select
              value={preferences.selectedWakeWord}
              onChange={(e) => {
                const updated = { ...preferences, selectedWakeWord: e.target.value as WakeWord }
                setPreferences(updated)
                handleSave(updated)
              }}
              className="w-full bg-hx-space border border-hx-border-subtle rounded-hx-sm px-2.5 py-1.5 text-xs font-mono text-hx-text-primary focus:border-hx-cyan focus:outline-none"
            >
              <option value="helioxen">"Helioxen" (4 Syllables)</option>
              <option value="hey-helioxen">"Hey Helioxen" (5 Syllables)</option>
            </select>
          </div>

          {/* Detection Sensitivity */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-hx-text-muted flex justify-between">
              <span>Detection Sensitivity</span>
              <span className="text-hx-cyan uppercase text-[10px]">{preferences.sensitivity}</span>
            </label>
            <select
              value={preferences.sensitivity}
              onChange={(e) => {
                const updated = {
                  ...preferences,
                  sensitivity: e.target.value as WakeWordSensitivity
                }
                setPreferences(updated)
                handleSave(updated)
              }}
              className="w-full bg-hx-space border border-hx-border-subtle rounded-hx-sm px-2.5 py-1.5 text-xs font-mono text-hx-text-primary focus:border-hx-cyan focus:outline-none"
            >
              <option value="low">Low (Strictest, minimizes false activations)</option>
              <option value="balanced">Balanced (Recommended default)</option>
              <option value="high">High (Most responsive in quiet settings)</option>
            </select>
          </div>

          {/* Post-Detection Activation Mode */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-hx-text-muted">Activation Mode</label>
            <select
              value={preferences.activationMode}
              onChange={(e) => {
                const updated = {
                  ...preferences,
                  activationMode: e.target.value as WakeWordActivationMode
                }
                setPreferences(updated)
                handleSave(updated)
              }}
              className="w-full bg-hx-space border border-hx-border-subtle rounded-hx-sm px-2.5 py-1.5 text-xs font-mono text-hx-text-primary focus:border-hx-cyan focus:outline-none"
            >
              <option value="confirm">Mode A: Confirm Before Conversation (Default)</option>
              <option value="auto-session">Mode B: Automatic Voice Session</option>
            </select>
            <p className="text-[10px] text-hx-text-muted">
              {preferences.activationMode === 'confirm'
                ? 'Mode A alerts locally and requires user confirmation before any audio is sent to AI.'
                : 'Mode B automatically activates real-time session capture via VoiceSessionCoordinator.'}
            </p>
          </div>

          {/* Echo Suppression */}
          <div className="flex items-center justify-between pt-1">
            <label htmlFor="pref-pause-during-playback" className="text-xs font-mono text-hx-text-secondary">
              Pause during Assistant Playback
            </label>
            <input
              id="pref-pause-during-playback"
              type="checkbox"
              checked={preferences.pauseDuringPlayback}
              onChange={(e) => {
                const updated = {
                  ...preferences,
                  pauseDuringPlayback: e.target.checked
                }
                setPreferences(updated)
                handleSave(updated)
              }}
              className="w-4 h-4 rounded border-hx-border-subtle bg-hx-space text-hx-cyan focus:ring-hx-cyan"
            />
          </div>
        </Card>

        {/* Card 2: Audio Signal & Noise Quality */}
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-hx-cyan">
              <Mic className="w-4 h-4" />
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider">
                Noise &amp; Signal Quality
              </h4>
            </div>
            <Badge variant="info" size="sm">
              Hardware
            </Badge>
          </div>

          <div className="p-2.5 rounded-hx-sm bg-hx-space/60 border border-hx-border-subtle text-[11px] text-hx-text-secondary leading-relaxed">
            Automatic quality controls prevent distorted input and conserve CPU by gating idle silence.
          </div>

          {/* Noise Suppression Toggle */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="pref-noise-suppression" className="text-xs font-mono text-hx-text-primary">
                Local Noise Suppression
              </label>
              <input
                id="pref-noise-suppression"
                type="checkbox"
                checked={preferences.noiseSuppression}
                onChange={(e) => {
                  const updated = {
                    ...preferences,
                    noiseSuppression: e.target.checked
                  }
                  setPreferences(updated)
                  handleSave(updated)
                }}
                className="w-4 h-4 rounded border-hx-border-subtle bg-hx-space text-hx-cyan focus:ring-hx-cyan"
              />
            </div>
            <p className="text-[10px] text-hx-text-muted">
              Applies single-pole high-pass DC blocking and removes persistent background hum.
            </p>
          </div>

          {/* Noise Gating Specifications */}
          <div className="space-y-2 pt-2 border-t border-hx-border-subtle">
            <div className="text-[11px] font-mono text-hx-text-muted uppercase tracking-wider">
              Quality Pipeline Safeguards
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-hx-text-secondary">Silence Floor Gating:</span>
              <span className="text-hx-cyan">-45 dBFS RMS</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-hx-text-secondary">Distortion / Clipping Cap:</span>
              <span className="text-hx-warning">&ge; 0.98 Peak</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-hx-text-secondary">Refractory Cooldown:</span>
              <span className="text-hx-nominal">2,000 ms</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-hx-text-secondary">Max In-Memory Ring Buffer:</span>
              <span className="text-hx-text-primary">4 MB Circular</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Speech Synthesis Playback */}
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-hx-cyan">
              <Volume2 className="w-4 h-4" />
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider">
                Speech Playback
              </h4>
            </div>
            <Badge variant="info" size="sm">
              System TTS
            </Badge>
          </div>

          {/* Voice Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-hx-text-muted">Assistant Voice</label>
            <select
              value={preferences.outputVoice || ''}
              onChange={(e) => {
                const updated = {
                  ...preferences,
                  outputVoice: e.target.value || undefined
                }
                setPreferences(updated)
                handleSave(updated)
              }}
              className="w-full bg-hx-space border border-hx-border-subtle rounded-hx-sm px-2.5 py-1.5 text-xs font-mono text-hx-text-primary focus:border-hx-cyan focus:outline-none"
            >
              <option value="">System Default Voice</option>
              {availableVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Speech Rate Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-hx-text-muted">Speech Rate</span>
              <span className="text-hx-cyan">{preferences.speechRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={preferences.speechRate}
              onChange={(e) => {
                const updated = { ...preferences, speechRate: parseFloat(e.target.value) }
                setPreferences(updated)
              }}
              onMouseUp={() => handleSave(preferences)}
              className="w-full accent-hx-cyan h-1.5 bg-hx-space rounded cursor-pointer"
            />
          </div>

          {/* Speech Pitch Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-hx-text-muted">Speech Pitch</span>
              <span className="text-hx-cyan">{preferences.speechPitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={preferences.speechPitch}
              onChange={(e) => {
                const updated = { ...preferences, speechPitch: parseFloat(e.target.value) }
                setPreferences(updated)
              }}
              onMouseUp={() => handleSave(preferences)}
              className="w-full accent-hx-cyan h-1.5 bg-hx-space rounded cursor-pointer"
            />
          </div>

          {/* Speech Volume Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-hx-text-muted">Volume</span>
              <span className="text-hx-cyan">{Math.round(preferences.speechVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={preferences.speechVolume}
              onChange={(e) => {
                const updated = { ...preferences, speechVolume: parseFloat(e.target.value) }
                setPreferences(updated)
              }}
              onMouseUp={() => handleSave(preferences)}
              className="w-full accent-hx-cyan h-1.5 bg-hx-space rounded cursor-pointer"
            />
          </div>

          {/* Preview Button */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestVoicePreview}
              leftIcon={
                isPlayingPreview ? (
                  <Square className="w-3.5 h-3.5 fill-current text-hx-cyan" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-hx-cyan" />
                )
              }
              className="w-full"
            >
              {isPlayingPreview ? 'Stop Preview' : 'Test Speech Playback'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              title="Reset Voice Preferences to Default"
              className="text-hx-text-muted hover:text-hx-text-primary px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
