import React from 'react'
import { User, Sparkles, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react'
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
          {/* Visual Attachment Preview (Step 22 Camera / Screen) */}
          {message.attachment && (
            <div className="mb-2.5 overflow-hidden rounded-hx-md border border-hx-border-panel bg-hx-space max-w-sm">
              <img
                src={message.attachment.dataUrl}
                alt="Visual input attachment"
                className="max-h-48 w-full object-contain"
              />
              <div className="flex items-center justify-between px-2.5 py-1 bg-hx-panel/80 border-t border-hx-border-subtle text-[10px] font-mono text-hx-text-muted">
                <span className="flex items-center space-x-1">
                  <ImageIcon className="w-3 h-3 text-hx-cyan" />
                  <span>
                    {message.attachment.sourceType === 'camera'
                      ? 'Camera Snapshot'
                      : 'Display Snapshot'}
                  </span>
                </span>
                <span>
                  {message.attachment.width}×{message.attachment.height} •{' '}
                  {Math.round(message.attachment.byteSize / 1024)} KB
                </span>
              </div>
            </div>
          )}

          {/* Document & Image File Attachments (Step 23) */}
          {message.fileAttachments && message.fileAttachments.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {message.fileAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-hx-sm bg-hx-space/80 border border-hx-border-subtle text-[11px] font-mono"
                >
                  {att.format === 'image' && att.imagePreviewUrl ? (
                    <div className="w-6 h-6 rounded overflow-hidden shrink-0 border border-hx-border-subtle">
                      <img src={att.imagePreviewUrl} alt={att.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <span className="text-hx-cyan font-bold uppercase text-[9px] px-1 py-0.5 rounded bg-hx-panel border border-hx-border-subtle">
                      {att.format}
                    </span>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-hx-text-primary font-medium truncate max-w-[140px]">{att.name}</span>
                    <span className="text-hx-text-muted text-[9px]">
                      {Math.round(att.sizeBytes / 1024)} KB
                      {att.extractionResult?.wordCount ? ` • ${att.extractionResult.wordCount} words` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {message.content && <div>{message.content}</div>}
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
