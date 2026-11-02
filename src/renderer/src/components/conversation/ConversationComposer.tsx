import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  CornerDownLeft,
  Camera,
  Monitor,
  Paperclip,
  FileText,
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Badge } from '../ui/Badge'
import { CapturedStillImage } from '../../../../shared/capture'
import {
  FileAttachment,
  DEFAULT_DOCUMENT_LIMITS,
  validateFileMetadata
} from '../../../../shared/documents'
import { MediaCaptureModal } from '../capture/MediaCaptureModal'

export interface ConversationComposerProps {
  onSendMessage: (
    content: string,
    attachment?: CapturedStillImage,
    fileAttachments?: FileAttachment[]
  ) => void
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
  const [stagedAttachment, setStagedAttachment] = useState<CapturedStillImage | null>(null)
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([])
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false)
  const [captureModalMode, setCaptureModalMode] = useState<'camera' | 'screen'>('screen')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
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
    // Can send if there's text OR visual snapshot OR file attachments
    const hasAnyContent = trimmed || stagedAttachment || fileAttachments.length > 0
    if (!hasAnyContent || isStreaming || disabled) return

    onSendMessage(
      trimmed,
      stagedAttachment || undefined,
      fileAttachments.length > 0 ? fileAttachments : undefined
    )
    setContent('')
    setStagedAttachment(null)
    setFileAttachments([])
    setAttachmentError(null)
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

  const handleOpenCapture = (mode: 'camera' | 'screen') => {
    setCaptureModalMode(mode)
    setIsCaptureModalOpen(true)
  }

  const handleAttachImage = (image: CapturedStillImage) => {
    setStagedAttachment(image)
  }

  const handleRemoveVisualAttachment = () => {
    setStagedAttachment(null)
  }

  const handleRemoveFileAttachment = (id: string) => {
    setFileAttachments((prev) => prev.filter((att) => att.id !== id))
  }

  // Handle system file dialog selection
  const handleSelectFiles = async () => {
    setAttachmentError(null)
    if (!window.helioxen?.documents?.selectFiles) return

    try {
      const selected = await window.helioxen.documents.selectFiles({
        multiple: true,
        maxCount: DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount
      })

      if (selected.length === 0) return

      // Enforce total count limit
      const combined = [...fileAttachments, ...selected]
      if (combined.length > DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount) {
        setAttachmentError(`Cannot attach more than ${DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount} files concurrently.`)
        return
      }

      setFileAttachments(combined)

      // Extract text content asynchronously for each document
      for (const att of selected) {
        if (att.status === 'validation-failed' || att.format === 'image') continue

        // Update status to extracting
        setFileAttachments((prev) =>
          prev.map((item) => (item.id === att.id ? { ...item, status: 'extracting' } : item))
        )

        try {
          const result = await window.helioxen.documents.extractFile(
            att.id,
            att.name,
            att.filePath
          )

          setFileAttachments((prev) =>
            prev.map((item) =>
              item.id === att.id
                ? {
                    ...item,
                    status: 'extracted',
                    extractedText: result.text,
                    extractionResult: result
                  }
                : item
            )
          )
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          setFileAttachments((prev) =>
            prev.map((item) =>
              item.id === att.id
                ? {
                    ...item,
                    status: 'processing-failed',
                    errorDetails: {
                      code: 'EXTRACTION_FAILED',
                      message: errMsg,
                      recoverable: true
                    }
                  }
                : item
            )
          )
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setAttachmentError(`File selection error: ${errMsg}`)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isStreaming) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    setAttachmentError(null)

    if (disabled || isStreaming) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length === 0) return

    if (fileAttachments.length + droppedFiles.length > DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount) {
      setAttachmentError(`Cannot exceed maximum of ${DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount} attachments.`)
      return
    }

    for (const file of droppedFiles) {
      const validation = validateFileMetadata(file.name, file.size, file.type)
      const attachmentId = `drop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

      if (!validation.valid || !validation.format) {
        setFileAttachments((prev) => [
          ...prev,
          {
            id: attachmentId,
            name: file.name,
            format: 'txt',
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            status: 'validation-failed',
            errorDetails: {
              code: 'VALIDATION_FAILED',
              message: validation.error || 'Unsupported file format',
              recoverable: false
            },
            timestamp: Date.now()
          }
        ])
        continue
      }

      const format = validation.format
      let imagePreviewUrl: string | undefined

      if (format === 'image') {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          setFileAttachments((prev) => [
            ...prev,
            {
              id: attachmentId,
              name: file.name,
              format,
              mimeType: file.type,
              sizeBytes: file.size,
              status: 'extracted',
              imagePreviewUrl: dataUrl,
              timestamp: Date.now()
            }
          ])
        }
        reader.readAsDataURL(file)
        continue
      }

      // Add document with extracting state
      const initialAtt: FileAttachment = {
        id: attachmentId,
        name: file.name,
        format,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        status: 'extracting',
        timestamp: Date.now()
      }

      setFileAttachments((prev) => [...prev, initialAtt])

      // Read buffer and extract via bridge
      const arrayBuf = await file.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuf)

      try {
        if (window.helioxen?.documents?.extractFile) {
          const result = await window.helioxen.documents.extractFile(
            attachmentId,
            file.name,
            undefined,
            uint8
          )
          setFileAttachments((prev) =>
            prev.map((item) =>
              item.id === attachmentId
                ? {
                    ...item,
                    status: 'extracted',
                    extractedText: result.text,
                    extractionResult: result
                  }
                : item
            )
          )
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        setFileAttachments((prev) =>
          prev.map((item) =>
            item.id === attachmentId
              ? {
                  ...item,
                  status: 'processing-failed',
                  errorDetails: {
                    code: 'EXTRACTION_FAILED',
                    message: errMsg,
                    recoverable: true
                  }
                }
              : item
          )
        )
      }
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col rounded-hx-md bg-hx-surface border transition-all duration-fast ${
          isDraggingOver
            ? 'border-hx-cyan bg-hx-hover/80 shadow-hx-glow-cyan-md'
            : 'border-hx-border-panel focus-within:border-hx-border-glow focus-within:shadow-hx-glow-cyan-sm'
        } ${className}`}
      >
        {/* Attachment Error Banner */}
        {attachmentError && (
          <div className="flex items-center justify-between mx-3 mt-2 px-2.5 py-1.5 rounded-hx-sm bg-hx-danger/10 border border-hx-danger/40 text-[11px] text-hx-danger animate-hx-fade-in font-mono">
            <span className="flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{attachmentError}</span>
            </span>
            <button
              type="button"
              onClick={() => setAttachmentError(null)}
              className="text-hx-danger hover:text-hx-text-primary ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Staged Visual Attachment Chip (Step 22 Camera / Screen) */}
        {stagedAttachment && (
          <div className="flex items-center justify-between mx-3 mt-2.5 p-2 rounded-hx-md bg-hx-panel/90 border border-hx-border-glow/40 animate-hx-fade-in">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded bg-hx-space border border-hx-border-subtle overflow-hidden shrink-0">
                <img
                  src={stagedAttachment.dataUrl}
                  alt="Staged attachment"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-mono font-medium text-hx-text-primary">
                    {stagedAttachment.sourceType === 'camera' ? 'Camera Snapshot' : 'Display Snapshot'}
                  </span>
                  <Badge variant="nominal" size="sm">
                    {Math.round(stagedAttachment.byteSize / 1024)} KB
                  </Badge>
                </div>
                <span className="text-[10px] font-mono text-hx-text-muted">
                  {stagedAttachment.width} × {stagedAttachment.height} • Ephemeral Memory
                </span>
              </div>
            </div>

            <IconButton
              icon={<X className="w-3.5 h-3.5" />}
              aria-label="Remove attached visual snapshot"
              title="Remove attached visual snapshot"
              size="sm"
              variant="ghost"
              onClick={handleRemoveVisualAttachment}
            />
          </div>
        )}

        {/* Staged Document & Image Files Tray (Step 23) */}
        {fileAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mx-3 mt-2.5 animate-hx-fade-in">
            {fileAttachments.map((att) => {
              const isExtracted = att.status === 'extracted'
              const isExtracting = att.status === 'extracting'
              const isFailed = att.status === 'validation-failed' || att.status === 'processing-failed'

              return (
                <div
                  key={att.id}
                  className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-hx-md border text-xs font-mono transition-all duration-fast ${
                    isFailed
                      ? 'border-hx-danger/50 bg-hx-danger/10 text-hx-danger'
                      : isExtracted
                      ? 'border-hx-border-glow/40 bg-hx-panel/90 text-hx-text-primary'
                      : 'border-hx-border-subtle bg-hx-surface text-hx-text-secondary'
                  }`}
                >
                  {/* File Icon or Image Thumbnail */}
                  {att.format === 'image' && att.imagePreviewUrl ? (
                    <div className="w-5 h-5 rounded overflow-hidden shrink-0 border border-hx-border-subtle">
                      <img
                        src={att.imagePreviewUrl}
                        alt={att.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <FileText className="w-4 h-4 text-hx-cyan shrink-0" />
                  )}

                  <div className="flex flex-col min-w-0 max-w-[160px]">
                    <span className="truncate font-medium text-[11px]" title={att.name}>
                      {att.name}
                    </span>
                    <span className="text-[9px] text-hx-text-muted">
                      {Math.round(att.sizeBytes / 1024)} KB
                      {att.extractionResult?.wordCount ? ` • ${att.extractionResult.wordCount} words` : ''}
                    </span>
                  </div>

                  {/* Processing Status Indicator */}
                  {isExtracting && (
                    <Loader2 className="w-3.5 h-3.5 text-hx-cyan animate-spin shrink-0" />
                  )}
                  {isExtracted && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-hx-nominal shrink-0" />
                  )}
                  {isFailed && (
                    <span title={att.errorDetails?.message}>
                      <AlertCircle className="w-3.5 h-3.5 text-hx-danger shrink-0" />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveFileAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                    className="text-hx-text-muted hover:text-hx-text-primary ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isDraggingOver
              ? 'Drop document or image files here...'
              : placeholder
          }
          disabled={disabled || isStreaming}
          rows={1}
          aria-label="Conversation Message Input"
          className="w-full resize-none bg-transparent px-3.5 py-3 text-xs text-hx-text-primary placeholder:text-hx-text-muted focus:outline-none max-h-32 min-h-[44px]"
        />

        <div className="flex items-center justify-between px-3 py-2 border-t border-hx-border-subtle/50 bg-hx-panel/30">
          <div className="flex items-center space-x-2">
            {/* File Attachment Trigger (Step 23) */}
            <IconButton
              icon={<Paperclip className="w-3.5 h-3.5" />}
              aria-label="Attach documents or images (.txt, .md, .pdf, .docx, images)"
              title="Attach documents or images (.txt, .md, .pdf, .docx, images)"
              size="sm"
              variant="secondary"
              disabled={disabled || isStreaming}
              onClick={handleSelectFiles}
            />

            {/* Visual Capture Action Triggers (Step 22) */}
            <IconButton
              icon={<Monitor className="w-3.5 h-3.5" />}
              aria-label="Capture screen or window"
              title="Capture screen or window"
              size="sm"
              variant="secondary"
              disabled={disabled || isStreaming}
              onClick={() => handleOpenCapture('screen')}
            />
            <IconButton
              icon={<Camera className="w-3.5 h-3.5" />}
              aria-label="Capture camera snapshot"
              title="Capture camera snapshot"
              size="sm"
              variant="secondary"
              disabled={disabled || isStreaming}
              onClick={() => handleOpenCapture('camera')}
            />

            <div className="hidden sm:flex items-center space-x-1.5 text-[10px] font-mono text-hx-text-muted pl-1 border-l border-hx-border-subtle/50">
              <CornerDownLeft className="w-3 h-3 text-hx-cyan" />
              <span>Enter to submit • Shift+Enter for newline</span>
            </div>
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
              disabled={
                (!content.trim() && !stagedAttachment && fileAttachments.length === 0) ||
                disabled ||
                isStreaming
              }
              isLoading={isStreaming}
              aria-label="Send message"
              rightIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send
            </Button>
          </div>
        </div>
      </form>

      {/* Visual Capture Modal */}
      <MediaCaptureModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onAttachImage={handleAttachImage}
        initialMode={captureModalMode}
      />
    </>
  )
}
