import { CapturedStillImage } from '../../../../shared/capture'
import { FileAttachment } from '../../../../shared/documents'

export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'sent' | 'pending' | 'delivered' | 'error'

export interface ConversationMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  status?: MessageStatus
  model?: string
  attachment?: CapturedStillImage
  fileAttachments?: FileAttachment[]
}

export interface ConversationPanelProps {
  messages?: ConversationMessage[]
  onSendMessage?: (
    content: string,
    attachment?: CapturedStillImage,
    fileAttachments?: FileAttachment[]
  ) => void
  onClearMessages?: () => void
  className?: string
  isStreaming?: boolean
}
