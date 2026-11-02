import { z } from 'zod'
import {
  DocumentFormat,
  DEFAULT_DOCUMENT_LIMITS,
  DocumentExtractionResult,
  FileAttachment
} from './types'

export const DocumentFormatSchema = z.enum(['txt', 'md', 'pdf', 'docx', 'image'])

export const AttachmentProcessingStatusSchema = z.enum([
  'selected',
  'validating',
  'validation-failed',
  'ready-for-extraction',
  'extracting',
  'extracted',
  'ready-for-submission',
  'submitting',
  'processing-failed',
  'cancelled',
  'removed'
])

export const DocumentSourceMetadataSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  wordCount: z.number().int().nonnegative().optional(),
  characterCount: z.number().int().nonnegative().optional(),
  createdAt: z.number().positive().optional()
})

export const DocumentExtractionResultSchema = z.object({
  attachmentId: z.string().min(1),
  format: DocumentFormatSchema,
  text: z.string(),
  pageCount: z.number().int().positive().optional(),
  wordCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
  warnings: z.array(z.string()),
  metadata: DocumentSourceMetadataSchema.optional()
})

export const FileAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  format: DocumentFormatSchema,
  mimeType: z.string().min(1),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(DEFAULT_DOCUMENT_LIMITS.maxFileSizeBytes, `File size exceeds 10MB limit`),
  status: AttachmentProcessingStatusSchema,
  extractedText: z.string().optional(),
  extractionResult: DocumentExtractionResultSchema.optional(),
  imagePreviewUrl: z.string().optional(),
  errorDetails: z
    .object({
      code: z.string(),
      message: z.string(),
      recoverable: z.boolean()
    })
    .optional(),
  timestamp: z.number().positive(),
  filePath: z.string().optional()
})

export const SelectFilesRequestSchema = z.object({
  multiple: z.boolean().optional().default(true),
  maxCount: z.number().int().positive().optional().default(DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount)
})

export const ExtractFileRequestSchema = z.object({
  attachmentId: z.string().min(1),
  filePath: z.string().optional(),
  fileName: z.string().min(1),
  format: DocumentFormatSchema,
  fileBuffer: z.instanceof(Uint8Array).or(z.string()).optional()
})

export type ValidatedFileAttachment = z.infer<typeof FileAttachmentSchema>
export type ValidatedDocumentExtractionResult = z.infer<typeof DocumentExtractionResultSchema>

/**
 * Determines document format from filename extension and MIME type.
 */
export function detectDocumentFormat(fileName: string, mimeType?: string): DocumentFormat | null {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))

  if (ext === '.txt') return 'txt'
  if (ext === '.md' || ext === '.markdown') return 'md'
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'image'

  if (mimeType) {
    const lowerMime = mimeType.toLowerCase()
    if (lowerMime === 'text/plain') return 'txt'
    if (lowerMime === 'text/markdown') return 'md'
    if (lowerMime === 'application/pdf') return 'pdf'
    if (lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
    if (lowerMime.startsWith('image/')) return 'image'
  }

  return null
}

/**
 * Validates file metadata before ingestion into extraction engine.
 */
export function validateFileMetadata(
  name: string,
  sizeBytes: number,
  mimeType?: string
): { valid: boolean; format?: DocumentFormat; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'File name cannot be empty' }
  }

  if (sizeBytes <= 0) {
    return { valid: false, error: 'File is empty (0 bytes)' }
  }

  if (sizeBytes > DEFAULT_DOCUMENT_LIMITS.maxFileSizeBytes) {
    const maxMb = Math.round(DEFAULT_DOCUMENT_LIMITS.maxFileSizeBytes / (1024 * 1024))
    return { valid: false, error: `File exceeds maximum allowed size of ${maxMb}MB` }
  }

  const format = detectDocumentFormat(name, mimeType)
  if (!format) {
    return {
      valid: false,
      error: `Unsupported format. Supported extensions: ${DEFAULT_DOCUMENT_LIMITS.allowedExtensions.join(', ')}`
    }
  }

  return { valid: true, format }
}
