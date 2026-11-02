import * as zlib from 'zlib'
import {
  DocumentExtractionResult,
  DocumentLimits,
  DEFAULT_DOCUMENT_LIMITS
} from '../../shared/documents/types'

/**
 * PdfExtractor
 *
 * Extracts text content from text-based PDF documents (.pdf).
 * - Scans PDF objects and decompresses /FlateDecode streams using zlib.
 * - Extracts standard PDF text operators (Tj, TJ, ', ") and decodes character escapes.
 * - Detects password-protected/encrypted PDFs (/Encrypt).
 * - Detects scanned/image-only PDFs (where images exist but no text stream is found).
 * - Enforces character limits and provides clear warnings and page counts.
 */
export class PdfExtractor {
  private readonly limits: DocumentLimits

  constructor(limits: DocumentLimits = DEFAULT_DOCUMENT_LIMITS) {
    this.limits = limits
  }

  public extract(
    buffer: Buffer | Uint8Array,
    attachmentId: string
  ): DocumentExtractionResult {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

    if (buf.length < 8) {
      throw new Error('PDF file is too small or corrupt')
    }

    // Verify PDF header magic: %PDF-
    const header = buf.toString('ascii', 0, 8)
    if (!header.startsWith('%PDF-')) {
      throw new Error('File does not have a valid %PDF- header')
    }

    const pdfRaw = buf.toString('binary')

    // Check for encryption
    if (/\/Encrypt\s+/i.test(pdfRaw)) {
      throw new Error('PDF document is encrypted or password-protected')
    }

    // Count pages
    let pageCount = 0
    const pageMatches = pdfRaw.match(/\/Type\s*\/Page\b/g)
    if (pageMatches) {
      pageCount = pageMatches.length
    }

    // Extract text from stream objects
    const extractedPagesText: string[] = []
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
    let streamMatch: RegExpExecArray | null

    let streamIndex = 0
    let hasImageObjects = /\/Subtype\s*\/Image\b/i.test(pdfRaw)

    while ((streamMatch = streamRegex.exec(pdfRaw)) !== null) {
      streamIndex++
      const rawStream = streamMatch[1]
      const streamStart = streamMatch.index
      const preStreamText = pdfRaw.substring(Math.max(0, streamStart - 400), streamStart)

      let decompressedText = ''

      // Check if stream is FlateDecode compressed
      if (/\/Filter\s*(\/FlateDecode|\[\s*\/FlateDecode\s*\])/i.test(preStreamText)) {
        try {
          const streamBuf = Buffer.from(rawStream, 'binary')
          const decompressed = zlib.inflateSync(streamBuf)
          decompressedText = decompressed.toString('latin1')
        } catch {
          // Some streams might have raw headers or be corrupt, skip gracefully
        }
      } else {
        decompressedText = rawStream
      }

      if (decompressedText) {
        const textInStream = this.extractTextFromContentStream(decompressedText)
        if (textInStream.trim()) {
          extractedPagesText.push(textInStream.trim())
        }
      }
    }

    let combinedText = extractedPagesText.join('\n\n')
    const warnings: string[] = []

    if (!combinedText.trim()) {
      if (hasImageObjects) {
        warnings.push(
          'PDF contains no extractable text stream. Document may contain scanned images or rasterized pages (OCR required).'
        )
      } else {
        warnings.push('PDF contains no extractable text.')
      }
    }

    let isTruncated = false
    if (combinedText.length > this.limits.maxExtractedChars) {
      combinedText = combinedText.slice(0, this.limits.maxExtractedChars)
      isTruncated = true
      warnings.push(
        `PDF document exceeded maximum character limit (${this.limits.maxExtractedChars.toLocaleString()} chars). Truncated at end.`
      )
    }

    const trimmed = combinedText.trim()
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0

    return {
      attachmentId,
      format: 'pdf',
      text: combinedText,
      pageCount: pageCount || (extractedPagesText.length > 0 ? extractedPagesText.length : 1),
      wordCount,
      characterCount: combinedText.length,
      isTruncated,
      warnings,
      metadata: {
        pageCount: pageCount || 1,
        wordCount,
        characterCount: combinedText.length
      }
    }
  }

  /**
   * Parses PDF text operators (BT...ET blocks, Tj, TJ, ', ")
   */
  private extractTextFromContentStream(content: string): string {
    const textPieces: string[] = []

    // Match text blocks BT ... ET
    const btRegex = /BT[\s\S]*?ET/g
    let btMatch: RegExpExecArray | null

    while ((btMatch = btRegex.exec(content)) !== null) {
      const block = btMatch[0]

      // Match (string) Tj or '
      const tjRegex = /\((.*?)\)\s*Tj/g
      let tjMatch: RegExpExecArray | null
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textPieces.push(this.decodePdfString(tjMatch[1]))
      }

      // Match [(array of strings / spacing)] TJ
      const arrayTjRegex = /\[(.*?)\]\s*TJ/g
      let arrayTjMatch: RegExpExecArray | null
      while ((arrayTjMatch = arrayTjRegex.exec(block)) !== null) {
        const arrayContent = arrayTjMatch[1]
        const strRegex = /\((.*?)\)/g
        let strMatch: RegExpExecArray | null
        let word = ''
        while ((strMatch = strRegex.exec(arrayContent)) !== null) {
          word += this.decodePdfString(strMatch[1])
        }
        if (word) textPieces.push(word)
      }
    }

    return textPieces.join(' ')
  }

  private decodePdfString(str: string): string {
    return str
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
  }
}
