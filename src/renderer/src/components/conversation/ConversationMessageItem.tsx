import React from 'react'
import { User, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import { ConversationMessage } from './types'
import { Badge } from '../ui/Badge'
import helioxenLogo from '../../assets/brand/helioxen-orbital-logo.png'

export interface ConversationMessageItemProps {
  message: ConversationMessage
}

export const ConversationMessageItem: React.FC<ConversationMessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isSystem) {
    return (
      <div className="flex items-center justify-center my-2 text-xs font-mono text-hx-text-muted">
        <span className="px-3 py-1 rounded-full bg-hx-surface/60 border border-hx-border-subtle">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-start gap-3 my-3 animate-hx-fade-in ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar / Emblem */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-hx-surface border border-hx-border-subtle flex items-center justify-center text-hx-text-secondary">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-hx-space border border-hx-border-glow shadow-hx-glow-cyan-sm p-1 overflow-hidden flex items-center justify-center">
            <img
              src={helioxenLogo}
              alt="Helioxen Emblem"
              className="w-full h-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Header Meta */}
        <div className="flex items-center space-x-2 mb-1 px-1 text-[11px] font-mono text-hx-text-muted">
          <span className="font-semibold text-hx-text-primary">
            {isUser ? 'USER' : 'HELIOXEN AI'}
          </span>
          <span>•</span>
          <span>{formattedTime}</span>
          {!isUser && message.model && (
            <Badge variant="neutral" size="sm" className="opacity-70">
              {message.model}
            </Badge>
          )}
        </div>

        {/* Content Box */}
        <div
          className={`p-3.5 rounded-hx-md text-xs leading-relaxed select-text font-body whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-hx-surface border border-hx-border-glow/40 text-hx-text-primary rounded-tr-none shadow-sm'
              : 'bg-hx-panel border border-hx-border-panel text-hx-text-primary rounded-tl-none shadow-md'
          }`}
        >
          {message.content}
        </div>

        {/* Status indicator */}
        {message.status && (
          <div className="flex items-center space-x-1 mt-1 px-1 text-[10px] font-mono text-hx-text-muted">
            {message.status === 'delivered' && (
              <>
                <CheckCircle2 className="w-3 h-3 text-hx-nominal" />
                <span>Buffered Session</span>
              </>
            )}
            {message.status === 'error' && (
              <>
                <AlertCircle className="w-3 h-3 text-hx-danger" />
                <span className="text-hx-danger">Delivery Pending</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
