/**
 * HELIOXEN AI — Document Extraction & File Attachment Domain Types
 * Phase 8: Multimodal Input and Context (Step 23 of 48)
 *
 * Strict Privacy & Security Guarantees:
 * - Local-first extraction: documents are processed and parsed strictly within local boundaries.
 * - Zero automatic upload: attachments are never transmitted to AI providers without explicit message submission.
 * - Safe parsers: macros, embedded scripts, and active content are never executed.
 * - Bounded resource limits: file size, character count, and concurrent extraction are strictly capped.
 */

export type DocumentFormat = 'txt' | 'md' | 'pdf' | 'docx' | 'image'

export type AttachmentProcessingStatus =
  | 'selected'
  | 'validating'
  | 'validation-failed'
  | 'ready-for-extraction'
  | 'extracting'
  | 'extracted'
  | 'ready-for-submission'
  | 'submitting'
  | 'processing-failed'
  | 'cancelled'
  | 'removed'

export interface DocumentLimits {
  /** Maximum allowable single file size in bytes (10 MB) */
  readonly maxFileSizeBytes: number
  /** Maximum allowable aggregate files size in bytes (20 MB) */
  readonly maxAggregateSizeBytes: number
  /** Maximum number of attachments permitted concurrently (5) */
  readonly maxAttachmentCount: number
  /** Maximum extracted characters before bounded truncation (100,000 chars ~ 25,000 tokens) */
  readonly maxExtractedChars: number
  /** Maximum DOCX archive decompression size in bytes (50 MB) to prevent zip bombs */
  readonly maxDecompressedSizeBytes: number
  /** Supported filename extensions */
  readonly allowedExtensions: readonly string[]
}

export const DEFAULT_DOCUMENT_LIMITS: DocumentLimits = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxAggregateSizeBytes: 20 * 1024 * 1024, // 20 MB
  maxAttachmentCount: 5,
  maxExtractedChars: 100000,
  maxDecompressedSizeBytes: 50 * 1024 * 1024, // 50 MB
  allowedExtensions: ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'] as const
}

export interface DocumentSourceMetadata {
  readonly title?: string
  readonly author?: string
  readonly pageCount?: number
  readonly wordCount?: number
  readonly characterCount?: number
  readonly createdAt?: number
}

export interface DocumentExtractionResult {
  readonly attachmentId: string
  readonly format: DocumentFormat
  readonly text: string
  readonly pageCount?: number
  readonly wordCount: number
  readonly characterCount: number
  readonly isTruncated: boolean
  readonly warnings: string[]
  readonly metadata?: DocumentSourceMetadata
}

export interface FileAttachment {
  readonly id: string
  readonly name: string
  readonly format: DocumentFormat
  readonly mimeType: string
  readonly sizeBytes: number
  readonly status: AttachmentProcessingStatus
  readonly extractedText?: string
  readonly extractionResult?: DocumentExtractionResult
  readonly imagePreviewUrl?: string // For images or PDF first page thumbnail
  readonly errorDetails?: {
    readonly code: string
    readonly message: string
    readonly recoverable: boolean
  }
  readonly timestamp: number
  readonly filePath?: string // Local temporary or system path reference (main process only)
}

export interface DocumentValidationResult {
  readonly valid: boolean
  readonly format?: DocumentFormat
  readonly error?: string
  readonly sizeBytes: number
}
