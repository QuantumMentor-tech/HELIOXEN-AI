import {
  DocumentExtractionResult,
  DocumentLimits,
  DEFAULT_DOCUMENT_LIMITS
} from '../../shared/documents/types'

/**
 * MarkdownExtractor
 *
 * Extracts text from Markdown documents (.md, .markdown).
 * - Preserves semantic markdown structures: headers (#), bullet/numbered lists, code fences (```), tables, quotes.
 * - Neutralizes and strips potentially dangerous HTML tags (<script>, <iframe>, <object>, <embed>, inline JS handlers).
 * - Enforces character length boundaries with truncation reporting.
 */
export class MarkdownExtractor {
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

    // Normalize line endings
    let sanitized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // Security: Strip dangerous executable HTML elements and script tags
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Strip on* event handlers (onclick=, etc.)

    let isTruncated = false
    let text = sanitized
    const warnings: string[] = []

    if (text.length > this.limits.maxExtractedChars) {
      text = text.slice(0, this.limits.maxExtractedChars)
      isTruncated = true
      warnings.push(
        `Markdown document exceeded maximum character limit (${this.limits.maxExtractedChars.toLocaleString()} chars). Truncated at end.`
      )
    }

    const trimmed = text.trim()
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0

    return {
      attachmentId,
      format: 'md',
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
