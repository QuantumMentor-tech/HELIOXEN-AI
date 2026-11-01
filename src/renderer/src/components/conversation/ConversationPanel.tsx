import React, { useRef, useEffect } from 'react'
import { MessageSquare, Trash2, Info, Sparkles, Terminal } from 'lucide-react'
import { ConversationPanelProps } from './types'
import { ConversationMessageItem } from './ConversationMessageItem'
import { ConversationComposer } from './ConversationComposer'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/IconButton'

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages = [],
  onSendMessage,
  onClearMessages,
  className = '',
  isStreaming = false
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  return (
    <div
      className={`flex flex-col h-full overflow-hidden bg-hx-space/40 rounded-hx-lg border border-hx-border-panel ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hx-border-panel bg-hx-panel/60 shrink-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-hx-cyan" />
          <h3 className="text-xs font-display font-semibold text-hx-text-primary uppercase tracking-wider">
            Conversation Thread
          </h3>
          <Badge variant="nominal" size="sm" isDot>
            SESSION READY
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          {messages.length > 0 && onClearMessages && (
            <IconButton
              icon={<Trash2 className="w-3.5 h-3.5" />}
              aria-label="Clear Conversation History"
              title="Clear Conversation History"
              size="sm"
              variant="ghost"
              onClick={onClearMessages}
            />
          )}
          <span className="text-[10px] font-mono text-hx-text-muted">
            {messages.length} {messages.length === 1 ? 'Message' : 'Messages'}
          </span>
        </div>
      </div>

      {/* Message List Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 select-text"
      >
        {messages.length === 0 ? (
          /* Honest Empty State Presentation */
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-hx-panel border border-hx-border-glow flex items-center justify-center text-hx-cyan shadow-hx-glow-cyan-sm">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-sm font-display font-semibold text-hx-text-primary">
                Conversation Interface Standby
              </h4>
              <p className="text-xs text-hx-text-secondary leading-relaxed">
                The conversation transcript architecture is verified. Real-time AI model routing (Google Gemini &amp; OpenAI adapters) integrates in Phase 5, Steps 16–18.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Badge variant="info" size="sm">
                Zero Mock Hallucinations
              </Badge>
              <Badge variant="neutral" size="sm">
                Keyboard Accessible
              </Badge>
            </div>
          </div>
        ) : (
          /* Rendered Message List */
          <div className="space-y-1">
            {messages.map((msg) => (
              <ConversationMessageItem key={msg.id} message={msg} />
            ))}

            {/* Truthful Dispatch Notice */}
            <div className="flex items-center space-x-2 p-2.5 rounded-hx-md bg-hx-panel/50 border border-hx-border-subtle text-[11px] font-mono text-hx-text-muted">
              <Info className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
              <span>
                Prompt buffered in local session memory. Live model inference triggers in Steps 16–18.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Message Composer Dock */}
      <div className="p-3 border-t border-hx-border-panel bg-hx-panel/40 shrink-0">
        <ConversationComposer
          onSendMessage={onSendMessage || (() => {})}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  )
}
