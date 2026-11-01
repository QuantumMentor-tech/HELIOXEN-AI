export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'sent' | 'pending' | 'delivered' | 'error'

export interface ConversationMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  status?: MessageStatus
  model?: string
}

export interface ConversationPanelProps {
  messages?: ConversationMessage[]
  onSendMessage?: (content: string) => void
  onClearMessages?: () => void
  className?: string
  isStreaming?: boolean
}
