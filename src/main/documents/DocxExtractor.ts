import * as zlib from 'zlib'
import {
  DocumentExtractionResult,
  DocumentLimits,
  DEFAULT_DOCUMENT_LIMITS
} from '../../shared/documents/types'

/**
 * DocxExtractor
 *
 * Extracts structured text from Microsoft Word documents (.docx).
 * - Implements safe, pure in-memory OpenXML archive extraction.
 * - Zip-bomb protections: caps decompression size (50 MB) and archive entries (500).
 * - Macro-safe: ignores vbaProject.bin, macros, and embedded active content.
 * - Extracts headings, paragraphs (<w:p>), text runs (<w:t>), and table cells (<w:tc>).
 */
export class DocxExtractor {
  private readonly limits: DocumentLimits

  constructor(limits: DocumentLimits = DEFAULT_DOCUMENT_LIMITS) {
    this.limits = limits
  }

  public extract(
    buffer: Buffer | Uint8Array,
    attachmentId: string
  ): DocumentExtractionResult {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

    if (buf.length < 30) {
      throw new Error('DOCX file is too small or corrupt')
    }

    // Verify ZIP magic header: 0x04034b50 (PK\x03\x04)
    if (buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
      throw new Error('File does not appear to be a valid DOCX (OpenXML ZIP) container')
    }

    const documentXml = this.extractDocumentXmlFromZip(buf)
    if (!documentXml) {
      throw new Error('Invalid DOCX document: word/document.xml part was not found')
    }

    const extractedText = this.parseDocumentXml(documentXml)

    let isTruncated = false
    let text = extractedText
    const warnings: string[] = []

    if (text.length > this.limits.maxExtractedChars) {
      text = text.slice(0, this.limits.maxExtractedChars)
      isTruncated = true
      warnings.push(
        `DOCX document exceeded maximum character limit (${this.limits.maxExtractedChars.toLocaleString()} chars). Truncated at end.`
      )
    }

    const trimmed = text.trim()
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0

    return {
      attachmentId,
      format: 'docx',
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

  /**
   * Reads entries in a ZIP buffer looking for "word/document.xml".
   * Implements strict decompression bounds.
   */
  private extractDocumentXmlFromZip(buf: Buffer): string | null {
    let offset = 0
    let entryCount = 0
    let totalDecompressedBytes = 0

    while (offset < buf.length - 30) {
      // Local File Header signature: 0x04034b50
      if (
        buf[offset] !== 0x50 ||
        buf[offset + 1] !== 0x4b ||
        buf[offset + 2] !== 0x03 ||
        buf[offset + 3] !== 0x04
      ) {
        break
      }

      entryCount++
      if (entryCount > 500) {
        throw new Error('DOCX archive contains too many entries (zip bomb protection limit exceeded)')
      }

      const compressionMethod = buf.readUInt16LE(offset + 8)
      const compressedSize = buf.readUInt32LE(offset + 18)
      const uncompressedSize = buf.readUInt32LE(offset + 22)
      const fileNameLen = buf.readUInt16LE(offset + 26)
      const extraFieldLen = buf.readUInt16LE(offset + 28)

      const fileNameStart = offset + 30
      const fileNameEnd = fileNameStart + fileNameLen

      if (fileNameEnd > buf.length) {
        throw new Error('Corrupt ZIP local file header in DOCX')
      }

      const fileName = buf.toString('utf-8', fileNameStart, fileNameEnd)
      const dataStart = fileNameEnd + extraFieldLen
      const dataEnd = dataStart + compressedSize

      if (dataEnd > buf.length) {
        throw new Error('Corrupt ZIP entry data bounds in DOCX')
      }

      // If this is the main word/document.xml entry
      if (fileName === 'word/document.xml') {
        if (uncompressedSize > this.limits.maxDecompressedSizeBytes) {
          throw new Error(
            `DOCX document.xml exceeds maximum allowed decompressed size (${Math.round(
              this.limits.maxDecompressedSizeBytes / (1024 * 1024)
            )}MB)`
          )
        }

        const compressedData = buf.subarray(dataStart, dataEnd)
        let decompressed: Buffer

        if (compressionMethod === 0) {
          decompressed = compressedData
        } else if (compressionMethod === 8) {
          try {
            decompressed = zlib.inflateRawSync(compressedData)
          } catch (err) {
            throw new Error(`Failed to decompress word/document.xml: ${String(err)}`)
          }
        } else {
          throw new Error(`Unsupported DOCX compression method: ${compressionMethod}`)
        }

        totalDecompressedBytes += decompressed.length
        if (totalDecompressedBytes > this.limits.maxDecompressedSizeBytes) {
          throw new Error('Decompressed size exceeded zip-bomb ceiling')
        }

        return decompressed.toString('utf-8')
      }

      // Advance to next local file header
      offset = dataEnd
    }

    return null
  }

  /**
   * Parses word/document.xml into normalized plain text.
   */
  private parseDocumentXml(xml: string): string {
    const paragraphs: string[] = []

    // Match paragraph blocks <w:p ...>...</w:p>
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g
    let pMatch: RegExpExecArray | null

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[1]

      // Check heading style
      const isHeading1 = /<w:pStyle\b[^>]*w:val="Heading1"/i.test(pContent)
      const isHeading2 = /<w:pStyle\b[^>]*w:val="Heading2"/i.test(pContent)
      const isHeading3 = /<w:pStyle\b[^>]*w:val="Heading3"/i.test(pContent)

      // Match all text runs <w:t ...>...</w:t>
      const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
      let tMatch: RegExpExecArray | null
      let paragraphText = ''

      while ((tMatch = tRegex.exec(pContent)) !== null) {
        paragraphText += this.decodeXmlEntities(tMatch[1])
      }

      paragraphText = paragraphText.trim()
      if (paragraphText) {
        if (isHeading1) {
          paragraphs.push(`# ${paragraphText}`)
        } else if (isHeading2) {
          paragraphs.push(`## ${paragraphText}`)
        } else if (isHeading3) {
          paragraphs.push(`### ${paragraphText}`)
        } else {
          paragraphs.push(paragraphText)
        }
      }
    }

    return paragraphs.join('\n\n')
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  }
}
