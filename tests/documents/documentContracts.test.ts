import { describe, it, expect } from 'vitest'
import {
  DocumentFormatSchema,
  AttachmentProcessingStatusSchema,
  FileAttachmentSchema,
  DocumentExtractionResultSchema,
  detectDocumentFormat,
  validateFileMetadata,
  DEFAULT_DOCUMENT_LIMITS
} from '../../src/shared/documents'

describe('Document Contracts and Validation (Step 23)', () => {
  it('validates supported document formats', () => {
    expect(DocumentFormatSchema.safeParse('txt').success).toBe(true)
    expect(DocumentFormatSchema.safeParse('md').success).toBe(true)
    expect(DocumentFormatSchema.safeParse('pdf').success).toBe(true)
    expect(DocumentFormatSchema.safeParse('docx').success).toBe(true)
    expect(DocumentFormatSchema.safeParse('image').success).toBe(true)
    expect(DocumentFormatSchema.safeParse('exe').success).toBe(false)
    expect(DocumentFormatSchema.safeParse('zip').success).toBe(false)
  })

  it('validates attachment processing lifecycle states', () => {
    expect(AttachmentProcessingStatusSchema.safeParse('selected').success).toBe(true)
    expect(AttachmentProcessingStatusSchema.safeParse('validating').success).toBe(true)
    expect(AttachmentProcessingStatusSchema.safeParse('extracting').success).toBe(true)
    expect(AttachmentProcessingStatusSchema.safeParse('extracted').success).toBe(true)
    expect(AttachmentProcessingStatusSchema.safeParse('processing-failed').success).toBe(true)
    expect(AttachmentProcessingStatusSchema.safeParse('cancelled').success).toBe(true)
    expect(AttachmentProcessingStatusSchema.safeParse('removed').success).toBe(true)
  })

  it('correctly detects document formats from extension and mime type', () => {
    expect(detectDocumentFormat('report.txt')).toBe('txt')
    expect(detectDocumentFormat('notes.md')).toBe('md')
    expect(detectDocumentFormat('README.markdown')).toBe('md')
    expect(detectDocumentFormat('paper.pdf')).toBe('pdf')
    expect(detectDocumentFormat('proposal.docx')).toBe('docx')
    expect(detectDocumentFormat('photo.png')).toBe('image')
    expect(detectDocumentFormat('chart.jpg')).toBe('image')
    expect(detectDocumentFormat('image.webp')).toBe('image')
    expect(detectDocumentFormat('binary.bin')).toBeNull()
    expect(detectDocumentFormat('unknown', 'text/plain')).toBe('txt')
    expect(detectDocumentFormat('unknown', 'application/pdf')).toBe('pdf')
  })

  it('validates file metadata against security bounds', () => {
    // Valid text file
    const validTxt = validateFileMetadata('notes.txt', 1024, 'text/plain')
    expect(validTxt.valid).toBe(true)
    expect(validTxt.format).toBe('txt')

    // Empty file rejection
    const emptyFile = validateFileMetadata('empty.md', 0)
    expect(emptyFile.valid).toBe(false)
    expect(emptyFile.error).toMatch(/empty/i)

    // Oversized file rejection (> 10MB)
    const oversized = validateFileMetadata('huge.pdf', 15 * 1024 * 1024)
    expect(oversized.valid).toBe(false)
    expect(oversized.error).toMatch(/exceeds maximum allowed size/i)

    // Unsupported format rejection
    const unsupported = validateFileMetadata('script.vbs', 1024)
    expect(unsupported.valid).toBe(false)
    expect(unsupported.error).toMatch(/unsupported format/i)
  })

  it('validates FileAttachment schema', () => {
    const validAttachment = {
      id: 'att-1',
      name: 'notes.txt',
      format: 'txt' as const,
      mimeType: 'text/plain',
      sizeBytes: 2048,
      status: 'extracted' as const,
      extractedText: 'Extracted content',
      timestamp: Date.now()
    }

    expect(FileAttachmentSchema.safeParse(validAttachment).success).toBe(true)
  })

  it('enforces default document resource limits', () => {
    expect(DEFAULT_DOCUMENT_LIMITS.maxFileSizeBytes).toBe(10 * 1024 * 1024)
    expect(DEFAULT_DOCUMENT_LIMITS.maxAggregateSizeBytes).toBe(20 * 1024 * 1024)
    expect(DEFAULT_DOCUMENT_LIMITS.maxAttachmentCount).toBe(5)
    expect(DEFAULT_DOCUMENT_LIMITS.maxExtractedChars).toBe(100000)
    expect(DEFAULT_DOCUMENT_LIMITS.maxDecompressedSizeBytes).toBe(50 * 1024 * 1024)
  })
})
