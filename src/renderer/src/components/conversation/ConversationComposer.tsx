import React, { useState, useRef, useEffect } from 'react'
import { Send, CornerDownLeft } from 'lucide-react'
import { Button } from '../ui/Button'

export interface ConversationComposerProps {
  onSendMessage: (content: string) => void
  isStreaming?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
}

export const ConversationComposer: React.FC<ConversationComposerProps> = ({
  onSendMessage,
  isStreaming = false,
  disabled = false,
  className = '',
  placeholder = 'Type assistant command, prompt, or query... (Enter to send, Shift+Enter for new line)'
}) => {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea height as user types up to max limit
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || isStreaming || disabled) return

    onSendMessage(trimmed)
    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex flex-col rounded-hx-md bg-hx-surface border border-hx-border-panel focus-within:border-hx-border-glow focus-within:shadow-hx-glow-cyan-sm transition-all duration-fast ${className}`}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        rows={1}
        aria-label="Conversation Message Input"
        className="w-full resize-none bg-transparent px-3.5 py-3 text-xs text-hx-text-primary placeholder:text-hx-text-muted focus:outline-none max-h-32 min-h-[44px]"
      />

      <div className="flex items-center justify-between px-3 py-2 border-t border-hx-border-subtle/50 bg-hx-panel/30">
        <div className="flex items-center space-x-1.5 text-[10px] font-mono text-hx-text-muted">
          <CornerDownLeft className="w-3 h-3 text-hx-cyan" />
          <span>Enter to submit • Shift+Enter for newline</span>
        </div>

        <div className="flex items-center space-x-2">
          {content.length > 0 && (
            <span className="text-[10px] font-mono text-hx-text-muted">
              {content.length} chars
            </span>
          )}
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={!content.trim() || disabled || isStreaming}
            isLoading={isStreaming}
            aria-label="Send message"
            rightIcon={<Send className="w-3.5 h-3.5" />}
          >
            Send
          </Button>
        </div>
      </div>
    </form>
  )
}
