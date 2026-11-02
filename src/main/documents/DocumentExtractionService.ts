import * as fs from 'fs'
import {
  DocumentExtractionResult,
  DocumentFormat,
  DocumentLimits,
  DEFAULT_DOCUMENT_LIMITS,
  detectDocumentFormat,
  validateFileMetadata
} from '../../shared/documents'
import { PlainTextExtractor } from './PlainTextExtractor'
import { MarkdownExtractor } from './MarkdownExtractor'
import { DocxExtractor } from './DocxExtractor'
import { PdfExtractor } from './PdfExtractor'

export class DocumentExtractionService {
  private readonly limits: DocumentLimits
  private readonly txtExtractor: PlainTextExtractor
  private readonly mdExtractor: MarkdownExtractor
  private readonly docxExtractor: DocxExtractor
  private readonly pdfExtractor: PdfExtractor

  constructor(limits: DocumentLimits = DEFAULT_DOCUMENT_LIMITS) {
    this.limits = limits
    this.txtExtractor = new PlainTextExtractor(limits)
    this.mdExtractor = new MarkdownExtractor(limits)
    this.docxExtractor = new DocxExtractor(limits)
    this.pdfExtractor = new PdfExtractor(limits)
  }

  /**
   * Extracts text and structured metadata from a file path or in-memory buffer.
   */
  public async extract(
    attachmentId: string,
    fileName: string,
    input: string | Buffer | Uint8Array,
    formatOverride?: DocumentFormat
  ): Promise<DocumentExtractionResult> {
    let buffer: Buffer

    if (typeof input === 'string') {
      // Validate that file exists and is within bounds
      if (!fs.existsSync(input)) {
        throw new Error(`File does not exist: ${input}`)
      }
      const stat = await fs.promises.stat(input)
      if (stat.size > this.limits.maxFileSizeBytes) {
        const maxMb = Math.round(this.limits.maxFileSizeBytes / (1024 * 1024))
        throw new Error(`File size (${Math.round(stat.size / 1024)} KB) exceeds limit of ${maxMb} MB`)
      }
      buffer = await fs.promises.readFile(input)
    } else {
      buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
      if (buffer.length > this.limits.maxFileSizeBytes) {
        const maxMb = Math.round(this.limits.maxFileSizeBytes / (1024 * 1024))
        throw new Error(`File buffer size (${Math.round(buffer.length / 1024)} KB) exceeds limit of ${maxMb} MB`)
      }
    }

    if (buffer.length === 0) {
      throw new Error('File is empty (0 bytes)')
    }

    const format = formatOverride || detectDocumentFormat(fileName)
    if (!format) {
      throw new Error(`Unsupported document format for file: ${fileName}`)
    }

    switch (format) {
      case 'txt':
        return this.txtExtractor.extract(buffer, attachmentId)
      case 'md':
        return this.mdExtractor.extract(buffer, attachmentId)
      case 'docx':
        return this.docxExtractor.extract(buffer, attachmentId)
      case 'pdf':
        return this.pdfExtractor.extract(buffer, attachmentId)
      case 'image':
        return {
          attachmentId,
          format: 'image',
          text: '',
          wordCount: 0,
          characterCount: 0,
          isTruncated: false,
          warnings: ['Image files do not contain extractable plain text. Visual QA pipeline will inspect image.']
        }
      default:
        throw new Error(`Unsupported document extraction format: ${format}`)
    }
  }

  /**
   * Validates file size and format before reading or extracting.
   */
  public validate(
    name: string,
    sizeBytes: number,
    mimeType?: string
  ): { valid: boolean; format?: DocumentFormat; error?: string } {
    return validateFileMetadata(name, sizeBytes, mimeType)
  }
}
