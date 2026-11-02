import { describe, it, expect } from 'vitest'
import * as zlib from 'zlib'
import { PlainTextExtractor } from '../../src/main/documents/PlainTextExtractor'
import { MarkdownExtractor } from '../../src/main/documents/MarkdownExtractor'
import { DocxExtractor } from '../../src/main/documents/DocxExtractor'
import { PdfExtractor } from '../../src/main/documents/PdfExtractor'
import { DocumentExtractionService } from '../../src/main/documents/DocumentExtractionService'

describe('Document Extractors Engine (Step 23)', () => {
  describe('PlainTextExtractor', () => {
    const extractor = new PlainTextExtractor({
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxAggregateSizeBytes: 20 * 1024 * 1024,
      maxAttachmentCount: 5,
      maxExtractedChars: 50, // Small limit for truncation test
      maxDecompressedSizeBytes: 50 * 1024 * 1024,
      allowedExtensions: ['.txt']
    })

    it('extracts and normalizes line breaks and control characters', () => {
      const input = Buffer.from('Line 1\r\nLine 2\rLine 3\x00\x07')
      const result = extractor.extract(input, 'att-txt-1')

      expect(result.text).toBe('Line 1\nLine 2\nLine 3')
      expect(result.format).toBe('txt')
      expect(result.isTruncated).toBe(false)
      expect(result.wordCount).toBe(6)
    })

    it('reports truncation when text exceeds maximum character bound', () => {
      const longInput = Buffer.from('A'.repeat(100))
      const result = extractor.extract(longInput, 'att-txt-2')

      expect(result.text.length).toBe(50)
      expect(result.isTruncated).toBe(true)
      expect(result.warnings[0]).toMatch(/exceeded maximum character limit/i)
    })
  })

  describe('MarkdownExtractor', () => {
    const extractor = new MarkdownExtractor()

    it('preserves semantic markdown elements and strips dangerous scripts', () => {
      const mdContent = `
# System Architecture
Here is a list:
- Item 1
- Item 2

\`\`\`typescript
const safe = true
\`\`\`

<script>alert("malicious execution")</script>
<p onclick="stealCookies()">Paragraph</p>
`
      const result = extractor.extract(Buffer.from(mdContent), 'att-md-1')

      expect(result.text).toContain('# System Architecture')
      expect(result.text).toContain('- Item 1')
      expect(result.text).toContain('const safe = true')
      expect(result.text).not.toContain('<script>')
      expect(result.text).not.toContain('alert("malicious execution")')
      expect(result.text).not.toContain('onclick=')
    })
  })

  describe('DocxExtractor', () => {
    const extractor = new DocxExtractor()

    /**
     * Helper to construct a minimal valid ZIP buffer containing word/document.xml
     */
    function createMockDocxZip(documentXml: string): Buffer {
      const fileName = 'word/document.xml'
      const fileNameBuf = Buffer.from(fileName, 'utf-8')
      const uncompressedData = Buffer.from(documentXml, 'utf-8')
      const compressedData = zlib.deflateRawSync(uncompressedData)

      // Construct Local File Header
      const header = Buffer.alloc(30)
      header.writeUInt32LE(0x04034b50, 0) // Signature
      header.writeUInt16LE(20, 4) // Version needed
      header.writeUInt16LE(0, 6) // Flags
      header.writeUInt16LE(8, 8) // Compression method: Deflate
      header.writeUInt16LE(0, 10) // Mod time
      header.writeUInt16LE(0, 12) // Mod date
      header.writeUInt32LE(0x12345678, 14) // CRC32 (mock)
      header.writeUInt32LE(compressedData.length, 18) // Compressed size
      header.writeUInt32LE(uncompressedData.length, 22) // Uncompressed size
      header.writeUInt16LE(fileNameBuf.length, 26) // File name length
      header.writeUInt16LE(0, 28) // Extra field length

      return Buffer.concat([header, fileNameBuf, compressedData])
    }

    it('extracts paragraphs and headings from OpenXML DOCX archive', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Project Milestone 23</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is the document body text.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`

      const docxBuf = createMockDocxZip(xml)
      const result = extractor.extract(docxBuf, 'att-docx-1')

      expect(result.format).toBe('docx')
      expect(result.text).toContain('# Project Milestone 23')
      expect(result.text).toContain('This is the document body text.')
      expect(result.wordCount).toBeGreaterThan(5)
    })

    it('rejects corrupt or non-ZIP files with structured error', () => {
      const corruptBuf = Buffer.from('Not a zip file')
      expect(() => extractor.extract(corruptBuf, 'att-docx-err')).toThrow(
        /too small or corrupt/i
      )

      const nonZipBuf = Buffer.alloc(40, 0x41)
      expect(() => extractor.extract(nonZipBuf, 'att-docx-nonzip')).toThrow(
        /does not appear to be a valid DOCX/i
      )
    })
  })

  describe('PdfExtractor', () => {
    const extractor = new PdfExtractor()

    it('extracts text from standard uncompressed PDF streams', () => {
      const pdf = `%PDF-1.4
1 0 obj
<< /Type /Page >>
endobj
2 0 obj
<< /Length 45 >>
stream
BT
/F1 12 Tf
(HELIOXEN Architecture Manual) Tj
ET
endstream
endobj
xref
trailer << /Root 1 0 R >>
%%EOF`

      const result = extractor.extract(Buffer.from(pdf), 'att-pdf-1')
      expect(result.format).toBe('pdf')
      expect(result.text).toContain('HELIOXEN Architecture Manual')
    })

    it('extracts text from FlateDecode compressed PDF streams', () => {
      const streamContent = 'BT (Compressed PDF Text Chapter 1) Tj ET'
      const compressedStream = zlib.deflateSync(Buffer.from(streamContent))

      const pdf = Buffer.concat([
        Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n2 0 obj\n<< /Filter /FlateDecode /Length ${compressedStream.length} >>\nstream\n`, 'binary'),
        compressedStream,
        Buffer.from('\nendstream\nendobj\nxref\ntrailer << /Root 1 0 R >>\n%%EOF', 'binary')
      ])

      const result = extractor.extract(pdf, 'att-pdf-2')
      expect(result.format).toBe('pdf')
      expect(result.text).toContain('Compressed PDF Text Chapter 1')
    })

    it('rejects password-protected / encrypted PDFs', () => {
      const encryptedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Encrypt 2 0 R >>
endobj
trailer << /Root 1 0 R >>
%%EOF`

      expect(() => extractor.extract(Buffer.from(encryptedPdf), 'att-pdf-enc')).toThrow(
        /encrypted or password-protected/i
      )
    })

    it('detects scanned/image-only PDFs and provides a truthful warning', () => {
      const scannedPdf = `%PDF-1.4
1 0 obj
<< /Type /Page /Resources << /XObject << /Im1 2 0 R >> >> >>
endobj
2 0 obj
<< /Type /XObject /Subtype /Image >>
stream
[raster image bytes]
endstream
endobj
%%EOF`

      const result = extractor.extract(Buffer.from(scannedPdf), 'att-pdf-scanned')
      expect(result.text).toBe('')
      expect(result.warnings[0]).toMatch(/OCR required/i)
    })
  })

  describe('DocumentExtractionService', () => {
    const service = new DocumentExtractionService()

    it('routes file formats dynamically to the correct extractor', async () => {
      const mdBuf = Buffer.from('# Hello World\nTesting service routing')
      const result = await service.extract('att-svc-1', 'doc.md', mdBuf)

      expect(result.format).toBe('md')
      expect(result.text).toContain('# Hello World')
    })

    it('handles image files by designating format as image and zero plain text', async () => {
      const imgBuf = Buffer.from('fake-image-bytes')
      const result = await service.extract('att-svc-2', 'photo.png', imgBuf)

      expect(result.format).toBe('image')
      expect(result.text).toBe('')
      expect(result.warnings[0]).toMatch(/Visual QA pipeline will inspect image/i)
    })
  })
})
