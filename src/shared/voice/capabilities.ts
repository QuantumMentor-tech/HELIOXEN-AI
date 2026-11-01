import { ModelDefinition } from '../ai/models'

export type VoiceSessionMode = 'native-bidirectional' | 'orchestrated-voice' | 'unsupported'

export interface VoiceEligibilityResult {
  eligible: boolean
  mode: VoiceSessionMode
  reason: string
  supportsStreamingTranscripts: boolean
  supportsAudioPlayback: boolean
  officialDocUrl: string
  verificationDate: string
}

/**
 * Validates a model's eligibility for real-time voice sessions.
 * Based on verified official provider documentation (November 1, 2026).
 */
export function checkVoiceSessionEligibility(model: ModelDefinition): VoiceEligibilityResult {
  // 1. Inactive or deprecated models are ineligible
  if (model.status !== 'active' && model.status !== 'preview') {
    return {
      eligible: false,
      mode: 'unsupported',
      reason: `Model '${model.id}' status is '${model.status}' and cannot be used for voice sessions.`,
      supportsStreamingTranscripts: false,
      supportsAudioPlayback: false,
      officialDocUrl: 'https://docs.helioxen.internal/ai/models',
      verificationDate: '2026-11-01'
    }
  }

  // 2. Google Gemini Models
  if (model.providerId === 'google-gemini') {
    if (model.id === 'gemini-3.8-live' || model.id.includes('live')) {
      return {
        eligible: true,
        mode: 'native-bidirectional',
        reason: 'Gemini Live API native bidirectional audio streaming and live transcription verified.',
        supportsStreamingTranscripts: true,
        supportsAudioPlayback: true,
        officialDocUrl: 'https://ai.google.dev/api/live',
        verificationDate: '2026-11-01'
      }
    }

    if (model.id === 'gemini-3.8-flash' || model.id === 'gemini-4-argon') {
      return {
        eligible: true,
        mode: 'orchestrated-voice',
        reason: 'Supports streaming generation with orchestrated local audio capture and speech playback.',
        supportsStreamingTranscripts: true,
        supportsAudioPlayback: true,
        officialDocUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini',
        verificationDate: '2026-11-01'
      }
    }

    if (model.id === 'gemini-3.5-flash-lite') {
      return {
        eligible: false,
        mode: 'unsupported',
        reason: 'Gemini 3.5 Flash-Lite is optimized for text-only rapid inference; real-time audio is unsupported.',
        supportsStreamingTranscripts: false,
        supportsAudioPlayback: false,
        officialDocUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini',
        verificationDate: '2026-11-01'
      }
    }
  }

  // 3. OpenAI Models
  if (model.providerId === 'openai') {
    if (model.id === 'gpt-4o-realtime-preview') {
      return {
        eligible: true,
        mode: 'native-bidirectional',
        reason: 'OpenAI Realtime API bidirectional streaming session supported.',
        supportsStreamingTranscripts: true,
        supportsAudioPlayback: true,
        officialDocUrl: 'https://platform.openai.com/docs/guides/realtime',
        verificationDate: '2026-11-01'
      }
    }

    if (model.id === 'gpt-4o') {
      return {
        eligible: true,
        mode: 'orchestrated-voice',
        reason: 'GPT-4o multimodal streaming generation with orchestrated audio capture and local playback.',
        supportsStreamingTranscripts: true,
        supportsAudioPlayback: true,
        officialDocUrl: 'https://platform.openai.com/docs/models/gpt-4o',
        verificationDate: '2026-11-01'
      }
    }

    if (model.id === 'gpt-4o-mini' || model.id === 'o3-mini') {
      return {
        eligible: false,
        mode: 'unsupported',
        reason: `Model '${model.id}' is optimized for text/reasoning; real-time audio input is unsupported.`,
        supportsStreamingTranscripts: false,
        supportsAudioPlayback: false,
        officialDocUrl: 'https://platform.openai.com/docs/models',
        verificationDate: '2026-11-01'
      }
    }
  }

  // 4. Fallback check based on declared capabilities
  if (
    model.capabilities.modelLevel.streaming === 'supported' &&
    model.capabilities.modelLevel.textGeneration === 'supported'
  ) {
    return {
      eligible: true,
      mode: 'orchestrated-voice',
      reason: 'Model supports text streaming suitable for orchestrated voice interaction.',
      supportsStreamingTranscripts: true,
      supportsAudioPlayback: true,
      officialDocUrl: 'https://docs.helioxen.internal/ai/models',
      verificationDate: '2026-11-01'
    }
  }

  return {
    eligible: false,
    mode: 'unsupported',
    reason: `Model '${model.id}' lacks streaming capabilities required for voice sessions.`,
    supportsStreamingTranscripts: false,
    supportsAudioPlayback: false,
    officialDocUrl: 'https://docs.helioxen.internal/ai/models',
    verificationDate: '2026-11-01'
  }
}
