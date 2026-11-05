import { describe, it, expect } from 'vitest'
import { DocxEngine } from '../../src/main/office/DocxEngine'
import { WordDocumentModel } from '../../src/shared/office/types'
import { WordDocumentModelSchema } from '../../src/shared/office/contracts'
import { EXECUTIVE_REPORT_TEMPLATE, MEETING_MINUTES_TEMPLATE } from '../../src/main/office/OfficeTemplates'

describe('Document Studio (DOCX, Markdown, Text)', () => {
  const sampleDoc: WordDocumentModel = {
    id: 'test-doc-1',
    metadata: {
      id: 'test-doc-1',
      title: 'Confidential Strategy Report',
      type: 'document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      author: 'Security Architect'
    },
    blocks: [
      {
        id: 'b1',
        type: 'heading_1',
        textRuns: [{ text: 'Executive Summary', bold: true }]
      },
      {
        id: 'b2',
        type: 'paragraph',
        textRuns: [
          { text: 'This briefing details the ' },
          { text: 'local-first architecture', bold: true, italic: true },
          { text: ' of HELIOXEN.' }
        ]
      },
      {
        id: 'b3',
        type: 'heading_2',
        textRuns: [{ text: 'Security Guarantees' }]
      },
      {
        id: 'b4',
        type: 'bullet_item',
        textRuns: [{ text: 'Zero external telemetry without explicit user authorization.' }]
      },
      {
        id: 'b5',
        type: 'table',
        tableRows: [
          {
            cells: [
              [{ text: 'Metric', bold: true }],
              [{ text: 'Target', bold: true }]
            ]
          },
          {
            cells: [
              [{ text: 'Local Latency' }],
              [{ text: '< 50ms' }]
            ]
          }
        ]
      }
    ]
  }

  it('validates document model against WordDocumentModelSchema', () => {
    const parsed = WordDocumentModelSchema.safeParse(sampleDoc)
    expect(parsed.success).toBe(true)
  })

  it('generates valid OOXML (.docx) binary PKZIP archive', async () => {
    const docxBuffer = await DocxEngine.generateDocx(sampleDoc)
    expect(docxBuffer).toBeInstanceOf(Buffer)
    expect(docxBuffer.length).toBeGreaterThan(500)

    // Check PKZIP signature: 0x50 0x4B 0x03 0x04
    expect(docxBuffer[0]).toBe(0x50)
    expect(docxBuffer[1]).toBe(0x4b)
    expect(docxBuffer[2]).toBe(0x03)
    expect(docxBuffer[3]).toBe(0x04)
  })

  it('parses generated .docx archive back into structured WordDocumentModel', async () => {
    const docxBuffer = await DocxEngine.generateDocx(sampleDoc)
    const { model: parsedDoc } = await DocxEngine.parseDocx(docxBuffer, 'doc_test', 'Parsed Strategy Report')

    expect(parsedDoc.metadata.title).toBe('Parsed Strategy Report')
    expect(parsedDoc.metadata.type).toBe('document')
    expect(parsedDoc.blocks.length).toBeGreaterThanOrEqual(4)

    // Check that heading and paragraphs are extracted
    const headingBlock = parsedDoc.blocks.find((b) => b.type === 'heading_1')
    expect(headingBlock).toBeDefined()
    expect(headingBlock?.textRuns?.[0]?.text).toContain('Executive Summary')

    const bulletBlock = parsedDoc.blocks.find((b) => b.type === 'bullet_item')
    expect(bulletBlock).toBeDefined()
    expect(bulletBlock?.textRuns?.[0]?.text).toContain('Zero external telemetry')
  })

  it('exports structured document to Markdown cleanly', () => {
    const md = DocxEngine.exportToMarkdown(sampleDoc)
    expect(md).toContain('Executive Summary')
    expect(md).toContain('Security Guarantees')
    expect(md).toContain('- Zero external telemetry without explicit user authorization.')
    expect(md).toContain('| Metric | Target |')
  })

  it('exports structured document to Plain Text cleanly', () => {
    const txt = DocxEngine.exportToPlainText(sampleDoc)
    expect(txt).toContain('Executive Summary')
    expect(txt).toContain('Security Guarantees')
    expect(txt).toContain('Zero external telemetry')
  })

  it('verifies built-in document templates conform to schema', () => {
    expect(EXECUTIVE_REPORT_TEMPLATE.type).toBe('document')
    const reportParse = WordDocumentModelSchema.safeParse(EXECUTIVE_REPORT_TEMPLATE.defaultPayload)
    expect(reportParse.success).toBe(true)

    expect(MEETING_MINUTES_TEMPLATE.type).toBe('document')
    const minutesParse = WordDocumentModelSchema.safeParse(MEETING_MINUTES_TEMPLATE.defaultPayload)
    expect(minutesParse.success).toBe(true)
  })
})
