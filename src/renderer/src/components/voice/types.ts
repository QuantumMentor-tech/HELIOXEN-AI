import { TranscriptSegment, VoiceSessionStatus } from '../../../../shared/voice/types'
import { AiProviderId } from '../../../../shared/ai/types'

export type { VoiceSessionStatus }

export interface VoiceDockProps {
  status?: VoiceSessionStatus
  onToggleVoice?: () => void
  onSessionTranscript?: (transcript: TranscriptSegment) => void
  onSessionStateChange?: (state: VoiceSessionStatus) => void
  activeProvider?: AiProviderId
  activeModel?: string
  className?: string
  isAudioConnected?: boolean
}
