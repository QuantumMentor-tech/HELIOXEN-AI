import {
  DocumentExtractionResult,
  DocumentLimits,
  DEFAULT_DOCUMENT_LIMITS
} from '../../shared/documents/types'

/**
 * PlainTextExtractor
 *
 * Extracts and normalizes text from plain-text files (.txt).
 * - UTF-8 decoding with replacement of invalid sequences.
 * - Normalizes line endings (\r\n -> \n).
 * - Strips non-printable ASCII control characters (preserving \t, \n).
 * - Enforces character length boundaries with truncation reporting.
 */
export class PlainTextExtractor {
  private readonly limits: DocumentLimits

  constructor(limits: DocumentLimits = DEFAULT_DOCUMENT_LIMITS) {
    this.limits = limits
  }

  public extract(
    buffer: Buffer | Uint8Array,
    attachmentId: string
  ): DocumentExtractionResult {
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
    const rawText = decoder.decode(buffer)

    // Normalize line endings and strip control characters
    const normalized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    let isTruncated = false
    let text = normalized
    const warnings: string[] = []

    if (text.length > this.limits.maxExtractedChars) {
      text = text.slice(0, this.limits.maxExtractedChars)
      isTruncated = true
      warnings.push(
        `Document exceeded maximum character limit (${this.limits.maxExtractedChars.toLocaleString()} chars). Truncated at end.`
      )
    }

    const trimmed = text.trim()
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0

    return {
      attachmentId,
      format: 'txt',
      text,
      wordCount,
      characterCount: text.length,
      isTruncated,
      warnings,
      metadata: {
        characterCount: text.length,
        wordCount
      }
    }
  }
}
