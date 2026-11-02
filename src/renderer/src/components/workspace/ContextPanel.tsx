import React from 'react'
import {
  PanelRightClose,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
  FileText,
  Image as ImageIcon,
  Mic,
  Camera,
  Monitor,
  MessageSquare,
  Bot,
  Trash2,
  CheckCircle2,
  MinusCircle,
  Eye,
  AlertTriangle
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/IconButton'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { MultimodalContextItem } from '../../../../shared/context/types'

export interface ContextPanelProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
  conversationId?: string
  activeProvider?: string
  activeModel?: string
  contextItems?: MultimodalContextItem[]
  onToggleInclusion?: (itemId: string) => void
  onRemoveItem?: (itemId: string) => void
  onClearTransient?: () => void
  onClearConversation?: () => void
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onToggle,
  className = '',
  activeProvider = 'Google Gemini',
  activeModel = 'gemini-3.8-flash',
  contextItems = [],
  onToggleInclusion,
  onRemoveItem,
  onClearTransient,
  onClearConversation
}) => {
  if (!isOpen) {
    return null
  }

  const activeCount = contextItems.filter((i) => i.status === 'active').length
  const transientCount = contextItems.filter((i) => i.retentionPolicy === 'transient_buffer').length

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'extracted_document':
        return <FileText className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
      case 'image_attachment':
        return <ImageIcon className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
      case 'camera_capture':
        return <Camera className="w-3.5 h-3.5 text-hx-nominal shrink-0" />
      case 'screen_capture':
        return <Monitor className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
      case 'voice_transcript':
        return <Mic className="w-3.5 h-3.5 text-hx-nominal shrink-0" />
      case 'assistant_response':
        return <Bot className="w-3.5 h-3.5 text-hx-text-muted shrink-0" />
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-hx-text-secondary shrink-0" />
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <aside
      id="contextual-workspace"
      aria-label="Contextual Intelligence Panel"
      className={`h-full w-80 shrink-0 flex flex-col bg-hx-panel border-l border-hx-border-panel transition-all duration-deliberate ease-standard select-none z-hx-base overflow-hidden ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hx-border-panel bg-hx-surface/40">
        <div className="flex items-center space-x-2 min-w-0">
          <Layers className="w-4 h-4 text-hx-cyan shrink-0" />
          <h2 className="text-xs font-display font-semibold text-hx-text-primary uppercase tracking-wider truncate">
            Contextual Intelligence
          </h2>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <Badge variant={activeCount > 0 ? 'nominal' : 'neutral'} size="sm" isDot>
            {activeCount > 0 ? `${activeCount} ACTIVE` : 'STANDBY'}
          </Badge>
          <IconButton
            icon={<PanelRightClose className="w-4 h-4" />}
            aria-label="Collapse Contextual Panel"
            size="sm"
            variant="ghost"
            onClick={onToggle}
          />
        </div>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* External Provider Disclosure Notice */}
        <Card variant="panel" border="subtle" padding="sm">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium text-hx-text-muted uppercase tracking-wider">
                Target AI Provider
              </span>
              <Badge variant="info" size="sm">
                {activeProvider}
              </Badge>
            </div>
            <p className="text-[11px] text-hx-text-secondary leading-relaxed">
              Included context items will be dispatched to model <code className="text-hx-cyan font-mono text-[10px]">{activeModel}</code> only when you submit a message.
            </p>
          </div>
        </Card>

        {/* Active Context Items List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono font-medium text-hx-text-muted uppercase tracking-wider">
              Multimodal Sources ({contextItems.length})
            </span>
            {transientCount > 0 && onClearTransient && (
              <button
                type="button"
                onClick={onClearTransient}
                className="text-[10px] font-mono text-hx-cyan hover:underline transition-colors"
                title="Discard temporary image buffers and extracted documents from session memory"
              >
                Clear Transient
              </button>
            )}
          </div>

          {contextItems.length === 0 ? (
            <Card variant="default" border="subtle" padding="sm">
              <p className="text-xs text-hx-text-secondary leading-relaxed">
                No active documents, images, or transcripts staged in current session context.
              </p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {contextItems.map((item) => {
                const isIncluded = item.status === 'active'
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded-hx-md border transition-all text-xs ${
                      isIncluded
                        ? 'bg-hx-surface/70 border-hx-border-subtle'
                        : 'bg-hx-space/50 border-hx-border-subtle opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        {getSourceIcon(item.sourceType)}
                        <span className="font-medium text-hx-text-primary truncate" title={item.title}>
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {onToggleInclusion && (
                          <button
                            type="button"
                            onClick={() => onToggleInclusion(item.id)}
                            className="p-1 text-hx-text-muted hover:text-hx-text-primary rounded"
                            title={isIncluded ? 'Exclude from next request' : 'Include in next request'}
                          >
                            {isIncluded ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-hx-nominal" />
                            ) : (
                              <MinusCircle className="w-3.5 h-3.5 text-hx-text-muted" />
                            )}
                          </button>
                        )}
                        {onRemoveItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1 text-hx-text-muted hover:text-hx-critical rounded"
                            title="Remove from context"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-hx-text-muted">
                      <span>{formatSize(item.sizeBytes)}</span>
                      <span
                        className={`capitalize ${
                          item.trustLevel === 'external_untrusted'
                            ? 'text-hx-warning'
                            : 'text-hx-cyan'
                        }`}
                      >
                        {item.trustLevel === 'external_untrusted' ? 'untrusted input' : item.trustLevel}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Transient Context Cleanup Control */}
        {onClearConversation && contextItems.length > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs text-hx-critical border-hx-critical/30 hover:bg-hx-critical/10"
              onClick={onClearConversation}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Reset Conversation Context
            </Button>
          </div>
        )}

        {/* Environment Security Status */}
        <div className="space-y-2 pt-2 border-t border-hx-border-subtle">
          <div className="flex items-center space-x-1.5 px-1">
            <ShieldCheck className="w-3.5 h-3.5 text-hx-nominal" />
            <span className="text-[11px] font-mono font-medium text-hx-text-muted uppercase tracking-wider">
              Privacy &amp; Security Boundary
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle">
              <span className="text-hx-text-secondary">Context Isolation</span>
              <span className="text-hx-nominal font-medium">Thread Bound</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle">
              <span className="text-hx-text-secondary">Volatile Retention</span>
              <span className="text-hx-nominal font-medium">In-Memory Only</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle">
              <span className="text-hx-text-secondary">Window IPC Bridge</span>
              <span className="text-hx-cyan font-medium">Validated Safe</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-hx-border-panel bg-hx-surface/30 flex items-center justify-between text-[10px] font-mono text-hx-text-muted">
        <span>STEP 24 CONTEXT</span>
        <span className="text-hx-cyan">{activeCount} ACTIVE SOURCES</span>
      </div>
    </aside>
  )
}
