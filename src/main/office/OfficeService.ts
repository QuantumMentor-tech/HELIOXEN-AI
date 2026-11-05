/**
 * HELIOXEN AI — Step 43: Authoritative Main-Process Office Document Service
 * Manages document storage, templates, native import/export, and AI drafting.
 * Strictly local-first with atomic disk persistence.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { dialog, BrowserWindow } from 'electron'
import {
  OfficeDocumentType,
  OfficeDocumentMetadata,
  WordDocumentModel,
  SpreadsheetWorkbookModel,
  PresentationModel,
  OfficeTemplate,
  OfficeAiDraftRequest,
  OfficeAiDraftResponse,
  OfficeExportRequest,
  OfficeExportResult,
  OfficeImportResult
} from '../../shared/office/types'
import {
  OfficeDocumentMetadataSchema,
  WordDocumentModelSchema,
  SpreadsheetWorkbookModelSchema,
  PresentationModelSchema
} from '../../shared/office/contracts'
import { DocxEngine } from './DocxEngine'
import { XlsxEngine } from './XlsxEngine'
import { PptxEngine } from './PptxEngine'
import { BUILTIN_OFFICE_TEMPLATES } from './OfficeTemplates'
import type { ProviderService } from '../ai/ProviderService'

export interface OfficeServiceOptions {
  storageDir: string
  nowFn?: () => number
  providerServiceGetter?: () => ProviderService | null
}

interface PersistedOfficeStore {
  schemaVersion: number
  updatedAt: number
  documents: Record<string, WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel>
}

export class OfficeService {
  private readonly storageDir: string
  private readonly storePath: string
  private readonly nowFn: () => number
  private providerServiceGetter?: () => ProviderService | null
  private documents: Map<string, WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel> = new Map()

  constructor(optionsOrDir: string | OfficeServiceOptions) {
    if (typeof optionsOrDir === 'string') {
      this.storageDir = optionsOrDir
      this.nowFn = () => Date.now()
    } else {
      this.storageDir = optionsOrDir.storageDir
      this.nowFn = optionsOrDir.nowFn ?? (() => Date.now())
      this.providerServiceGetter = optionsOrDir.providerServiceGetter
    }

    const officeDir = path.resolve(this.storageDir, 'office')
    if (!fs.existsSync(officeDir)) {
      fs.mkdirSync(officeDir, { recursive: true })
    }
    this.storePath = path.join(officeDir, 'office_documents_store.json')
    this.loadFromDisk()
  }

  public setProviderServiceGetter(getter: () => ProviderService | null): void {
    this.providerServiceGetter = getter
  }

  // ============================================================================
  // DISK PERSISTENCE (ATOMIC)
  // ============================================================================

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storePath)) return
      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as PersistedOfficeStore
      if (parsed?.documents && typeof parsed.documents === 'object') {
        for (const [id, doc] of Object.entries(parsed.documents)) {
          this.documents.set(id, doc)
        }
      }
    } catch {
      // In case of corrupted file, retain in-memory state
    }
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const docsObj: Record<string, any> = {}
      for (const [id, doc] of this.documents.entries()) {
        docsObj[id] = doc
      }

      const payload: PersistedOfficeStore = {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        documents: docsObj
      }

      const tmp = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8')
      try {
        fs.renameSync(tmp, this.storePath)
      } catch {
        try {
          fs.copyFileSync(tmp, this.storePath)
          fs.unlinkSync(tmp)
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to persist office documents store:', err)
    }
  }

  // ============================================================================
  // DOCUMENT CRUD & LIFECYCLE
  // ============================================================================

  public listDocuments(): OfficeDocumentMetadata[] {
    return Array.from(this.documents.values()).map((d) => d.metadata)
  }

  public getDocument(
    documentId: string
  ): WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel | null {
    return this.documents.get(documentId) ?? null
  }

  public saveDocument(
    doc: WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel
  ): OfficeDocumentMetadata {
    // Validate based on document type
    const now = this.nowFn()
    let validated: any

    if (doc.metadata.type === 'document') {
      validated = WordDocumentModelSchema.parse(doc)
    } else if (doc.metadata.type === 'spreadsheet') {
      validated = SpreadsheetWorkbookModelSchema.parse(doc)
    } else if (doc.metadata.type === 'presentation') {
      validated = PresentationModelSchema.parse(doc)
    } else {
      throw new Error(`OFFICE_ERROR: Unknown document type '${(doc as any).metadata?.type}'.`)
    }

    const updatedDoc = {
      ...validated,
      metadata: {
        ...validated.metadata,
        updatedAt: now,
        status: 'saved' as const
      }
    }

    this.documents.set(updatedDoc.id, updatedDoc)
    this.persistToDisk()
    return updatedDoc.metadata
  }

  public deleteDocument(documentId: string): boolean {
    if (!this.documents.has(documentId)) return false
    this.documents.delete(documentId)
    this.persistToDisk()
    return true
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  public listTemplates(): OfficeTemplate[] {
    return BUILTIN_OFFICE_TEMPLATES
  }

  public createFromTemplate(
    templateId: string,
    title?: string
  ): WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel {
    const tpl = BUILTIN_OFFICE_TEMPLATES.find(
      (t) => t.id === templateId || t.id === `tpl_${templateId}` || t.id.replace('tpl_', '') === templateId
    )
    if (!tpl) {
      throw new Error(`OFFICE_ERROR: Template '${templateId}' not found.`)
    }

    const now = this.nowFn()
    const newId = `doc_${now}_${crypto.randomBytes(3).toString('hex')}`
    const docTitle = title?.trim() || tpl.title

    const payloadClone = JSON.parse(JSON.stringify(tpl.defaultPayload))
    payloadClone.id = newId
    payloadClone.metadata = {
      ...payloadClone.metadata,
      id: newId,
      title: docTitle,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      isTemplate: false
    }

    this.documents.set(newId, payloadClone)
    this.persistToDisk()
    return payloadClone
  }

  // ============================================================================
  // IMPORT & EXPORT
  // ============================================================================

  public async exportDocument(
    request: OfficeExportRequest,
    window?: BrowserWindow | null
  ): Promise<OfficeExportResult> {
    const doc = this.documents.get(request.documentId)
    if (!doc) {
      throw new Error(`OFFICE_ERROR: Document '${request.documentId}' not found.`)
    }

    let targetFilePath = request.targetFilePath

    // Prompt native save dialog if requested
    if (request.promptSaveDialog && window && !window.isDestroyed()) {
      const ext = request.format
      const defaultName = `${request.suggestedFileName || doc.metadata.title || 'document'}.${ext}`
      const saveRes = await dialog.showSaveDialog(window, {
        title: `Export ${doc.metadata.type.toUpperCase()} as .${ext}`,
        defaultPath: defaultName,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
      })

      if (saveRes.canceled || !saveRes.filePath) {
        throw new Error('EXPORT_CANCELLED: User cancelled the file save dialog.')
      }
      targetFilePath = saveRes.filePath
    }

    if (!targetFilePath) {
      throw new Error('OFFICE_ERROR: Target file path must be specified.')
    }

    // Check if target file already exists and overwriteExisting is false
    if (fs.existsSync(targetFilePath) && !request.overwriteExisting && !request.promptSaveDialog) {
      throw new Error(`EXPORT_CONFLICT: Destination file '${targetFilePath}' already exists.`)
    }

    let binaryData: Buffer
    let escapedCsvCount: number | undefined
    const warnings: string[] = []

    if (request.format === 'docx' && doc.metadata.type === 'document') {
      binaryData = DocxEngine.generateDocx(doc as WordDocumentModel)
    } else if (request.format === 'md' && doc.metadata.type === 'document') {
      binaryData = Buffer.from(DocxEngine.exportToMarkdown(doc as WordDocumentModel), 'utf-8')
    } else if (request.format === 'txt' && doc.metadata.type === 'document') {
      binaryData = Buffer.from(DocxEngine.exportToPlainText(doc as WordDocumentModel), 'utf-8')
    } else if (request.format === 'xlsx' && doc.metadata.type === 'spreadsheet') {
      binaryData = XlsxEngine.generateXlsx(doc as SpreadsheetWorkbookModel)
    } else if (request.format === 'csv' && doc.metadata.type === 'spreadsheet') {
      const { csvContent, escapedCount } = XlsxEngine.exportToCsv(
        doc as SpreadsheetWorkbookModel,
        undefined,
        request.sanitizeCsvFormulas !== false
      )
      binaryData = Buffer.from(csvContent, 'utf-8')
      escapedCsvCount = escapedCount
      if (escapedCount > 0) {
        warnings.push(`CSV formula injection defense applied: escaped ${escapedCount} formula cell(s) with leading quote.`)
      }
    } else if (request.format === 'pptx' && doc.metadata.type === 'presentation') {
      binaryData = PptxEngine.generatePptx(doc as PresentationModel)
    } else {
      throw new Error(
        `OFFICE_ERROR: Unsupported export format '${request.format}' for document type '${doc.metadata.type}'.`
      )
    }

    // Write file safely
    const tmpFile = `${targetFilePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
    fs.writeFileSync(tmpFile, binaryData)
    try {
      fs.renameSync(tmpFile, targetFilePath)
    } catch {
      fs.copyFileSync(tmpFile, targetFilePath)
      fs.unlinkSync(tmpFile)
    }

    return {
      success: true,
      filePath: targetFilePath,
      format: request.format,
      byteSize: binaryData.length,
      exportedAt: this.nowFn(),
      sanitizedCsvEscapesCount: escapedCsvCount,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  public async importDocument(
    sourceFilePath?: string,
    window?: BrowserWindow | null
  ): Promise<OfficeImportResult> {
    let targetPath = sourceFilePath

    if (!targetPath && window && !window.isDestroyed()) {
      const openRes = await dialog.showOpenDialog(window, {
        title: 'Import Office Document, Spreadsheet, or Presentation',
        properties: ['openFile'],
        filters: [
          {
            name: 'All Supported Office Files',
            extensions: ['docx', 'xlsx', 'csv', 'pptx', 'txt', 'md']
          },
          { name: 'Word Documents (.docx)', extensions: ['docx'] },
          { name: 'Spreadsheets (.xlsx, .csv)', extensions: ['xlsx', 'csv'] },
          { name: 'Presentations (.pptx)', extensions: ['pptx'] },
          { name: 'Text / Markdown (.txt, .md)', extensions: ['txt', 'md'] }
        ]
      })

      if (openRes.canceled || openRes.filePaths.length === 0) {
        throw new Error('IMPORT_CANCELLED: User cancelled the open file dialog.')
      }
      targetPath = openRes.filePaths[0]
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error(`IMPORT_ERROR: Source file '${targetPath}' does not exist.`)
    }

    const stat = fs.statSync(targetPath)
    if (stat.size > 50 * 1024 * 1024) {
      throw new Error('IMPORT_SECURITY_ERROR: File size exceeds 50MB ceiling.')
    }

    const ext = path.extname(targetPath).toLowerCase().replace('.', '')
    const baseName = path.basename(targetPath, path.extname(targetPath))
    const now = this.nowFn()
    const newDocId = `doc_${now}_${crypto.randomBytes(3).toString('hex')}`

    const rawBuffer = fs.readFileSync(targetPath)
    let docType: OfficeDocumentType = 'document'
    let docModel: WordDocumentModel | undefined
    let workbookModel: SpreadsheetWorkbookModel | undefined
    let presentationModel: PresentationModel | undefined
    const warnings: string[] = []

    if (ext === 'docx') {
      docType = 'document'
      const res = DocxEngine.parseDocx(rawBuffer, newDocId, baseName)
      docModel = res.model
      warnings.push(...res.warnings)
      this.documents.set(newDocId, docModel)
    } else if (ext === 'xlsx') {
      docType = 'spreadsheet'
      const res = XlsxEngine.parseXlsx(rawBuffer, newDocId, baseName)
      workbookModel = res.model
      warnings.push(...res.warnings)
      this.documents.set(newDocId, workbookModel)
    } else if (ext === 'csv') {
      docType = 'spreadsheet'
      const csvStr = rawBuffer.toString('utf-8')
      workbookModel = XlsxEngine.parseCsv(csvStr, newDocId, baseName)
      this.documents.set(newDocId, workbookModel)
    } else if (ext === 'pptx') {
      docType = 'presentation'
      const res = PptxEngine.parsePptx(rawBuffer, newDocId, baseName)
      presentationModel = res.model
      warnings.push(...res.warnings)
      this.documents.set(newDocId, presentationModel)
    } else if (ext === 'txt' || ext === 'md') {
      docType = 'document'
      const text = rawBuffer.toString('utf-8')
      const paragraphs = text.split(/\r?\n\r?\n/).filter(Boolean)
      const blocks = paragraphs.map((p, idx) => ({
        id: `blk_${idx + 1}`,
        type: 'paragraph' as const,
        textRuns: [{ text: p }]
      }))

      docModel = {
        id: newDocId,
        metadata: {
          id: newDocId,
          title: baseName,
          type: 'document',
          createdAt: now,
          updatedAt: now,
          status: 'saved',
          author: 'Imported',
          sourceFilePath: targetPath,
          tags: ['imported', ext]
        },
        blocks: blocks.length > 0 ? blocks : [{ id: 'blk_1', type: 'paragraph', textRuns: [{ text: '' }] }]
      }
      this.documents.set(newDocId, docModel)
    } else {
      throw new Error(`IMPORT_ERROR: Unsupported office format '.${ext}'.`)
    }

    this.persistToDisk()

    return {
      success: true,
      documentId: newDocId,
      documentType: docType,
      title: baseName,
      sourceFilePath: targetPath,
      warnings,
      document: docModel,
      workbook: workbookModel,
      presentation: presentationModel
    }
  }

  // ============================================================================
  // AI-ASSISTED PRODUCTIVITY WORKFLOWS
  // ============================================================================

  public async generateAiDraft(request: OfficeAiDraftRequest): Promise<OfficeAiDraftResponse> {
    const providerService = this.providerServiceGetter?.()
    const now = this.nowFn()
    const draftId = `ai_${now}_${crypto.randomBytes(3).toString('hex')}`

    // If an active AI provider is connected, generate tailored structured content
    if (providerService) {
      try {
        const systemPrompt = `You are HELIOXEN's Office Intelligence Architect.
Generate structured JSON for an office document of type '${request.documentType}'.
Your response must strictly be valid JSON with fields:
- "title": concise document title
- "summary": brief executive summary
- For 'document': "blocks": array of { "type": "heading_1"|"heading_2"|"paragraph"|"bullet_item", "text": string }
- For 'spreadsheet': "sheets": array of { "name": string, "headers": string[], "rows": string[][] }
- For 'presentation': "slides": array of { "title": string, "bullets": string[] }`

        const response = await providerService.generateText({
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Create a ${request.documentType} based on instructions:\n${request.prompt}\nContext snippet:\n${request.contextSnippet || 'None provided'}`
            }
          ]
        })

        const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned)

        if (request.documentType === 'document' && Array.isArray(parsed.blocks)) {
          const blocks = parsed.blocks.map((b: any, i: number) => ({
            id: `blk_${i + 1}`,
            type: b.type || 'paragraph',
            textRuns: [{ text: String(b.text || '') }]
          }))

          const proposedDoc: WordDocumentModel = {
            id: draftId,
            metadata: {
              id: draftId,
              title: parsed.title || 'AI Document Draft',
              type: 'document',
              createdAt: now,
              updatedAt: now,
              status: 'draft',
              author: 'HELIOXEN AI',
              summary: parsed.summary
            },
            blocks
          }

          return {
            documentType: 'document',
            title: proposedDoc.metadata.title,
            summary: parsed.summary || 'AI-generated structured document draft',
            proposedDocument: proposedDoc,
            warnings: ['AI draft proposals must be reviewed and accepted by the user before applying.']
          }
        } else if (request.documentType === 'spreadsheet' && Array.isArray(parsed.sheets)) {
          const sheets = parsed.sheets.map((sh: any, sIdx: number) => {
            const cells: Record<string, any> = {}
            const headers = Array.isArray(sh.headers) ? sh.headers : []
            headers.forEach((h: any, c: number) => {
              cells[`0:${c}`] = { value: String(h), valueType: 'string', bold: true }
            })
            const rows = Array.isArray(sh.rows) ? sh.rows : []
            rows.forEach((r: any, rIdx: number) => {
              if (Array.isArray(r)) {
                r.forEach((val: any, c: number) => {
                  cells[`${rIdx + 1}:${c}`] = { value: val, valueType: typeof val === 'number' ? 'number' : 'string' }
                })
              }
            })
            return {
              id: `sheet_${sIdx + 1}`,
              name: sh.name || `Sheet${sIdx + 1}`,
              rowCount: Math.max(rows.length + 5, 20),
              columnCount: Math.max(headers.length + 2, 10),
              cells
            }
          })

          const proposedWb: SpreadsheetWorkbookModel = {
            id: draftId,
            metadata: {
              id: draftId,
              title: parsed.title || 'AI Spreadsheet Draft',
              type: 'spreadsheet',
              createdAt: now,
              updatedAt: now,
              status: 'draft',
              author: 'HELIOXEN AI',
              summary: parsed.summary
            },
            sheets: sheets.length > 0 ? sheets : [{ id: 'sheet_1', name: 'Data', rowCount: 20, columnCount: 10, cells: {} }],
            activeSheetId: 'sheet_1'
          }

          return {
            documentType: 'spreadsheet',
            title: proposedWb.metadata.title,
            summary: parsed.summary || 'AI-generated structured spreadsheet draft',
            proposedWorkbook: proposedWb,
            warnings: ['AI draft proposals must be reviewed and accepted by the user before applying.']
          }
        } else if (request.documentType === 'presentation' && Array.isArray(parsed.slides)) {
          const slides = parsed.slides.map((sl: any, sIdx: number) => ({
            id: `slide_${sIdx + 1}`,
            title: sl.title || `Slide ${sIdx + 1}`,
            layout: sIdx === 0 ? ('title_slide' as const) : ('title_and_content' as const),
            elements: Array.isArray(sl.bullets)
              ? [{ id: `elem_${sIdx + 1}_1`, type: 'bullet_list' as const, bulletPoints: sl.bullets.map(String) }]
              : []
          }))

          const proposedPres: PresentationModel = {
            id: draftId,
            metadata: {
              id: draftId,
              title: parsed.title || 'AI Presentation Draft',
              type: 'presentation',
              createdAt: now,
              updatedAt: now,
              status: 'draft',
              author: 'HELIOXEN AI',
              summary: parsed.summary
            },
            theme: 'cosmic_cyan',
            slides: slides.length > 0 ? slides : [{ id: 'slide_1', title: 'Title Slide', layout: 'title_slide', elements: [] }]
          }

          return {
            documentType: 'presentation',
            title: proposedPres.metadata.title,
            summary: parsed.summary || 'AI-generated structured slide deck',
            proposedPresentation: proposedPres,
            warnings: ['AI draft proposals must be reviewed and accepted by the user before applying.']
          }
        }
      } catch {
        // Fall back to template-based draft
      }
    }

    // Fallback deterministic draft when offline or provider unavailable
    const fallbackTitle = `Draft: ${request.prompt.slice(0, 36)}`
    if (request.documentType === 'document') {
      const doc: WordDocumentModel = {
        id: draftId,
        metadata: {
          id: draftId,
          title: fallbackTitle,
          type: 'document',
          createdAt: now,
          updatedAt: now,
          status: 'draft',
          author: 'HELIOXEN AI',
          summary: `Draft generated for: ${request.prompt}`
        },
        blocks: [
          { id: 'blk_1', type: 'heading_1', textRuns: [{ text: fallbackTitle, bold: true }] },
          { id: 'blk_2', type: 'paragraph', textRuns: [{ text: `Initial draft based on prompt: "${request.prompt}"` }] },
          { id: 'blk_3', type: 'heading_2', textRuns: [{ text: 'Key Considerations', bold: true }] },
          { id: 'blk_4', type: 'bullet_item', textRuns: [{ text: 'Structured outline generated locally.' }] },
          { id: 'blk_5', type: 'bullet_item', textRuns: [{ text: 'Review and refine in Document Studio.' }] }
        ]
      }
      return {
        documentType: 'document',
        title: fallbackTitle,
        summary: 'Local structured draft',
        proposedDocument: doc,
        warnings: ['AI draft proposals must be reviewed and accepted by the user before applying.']
      }
    } else if (request.documentType === 'spreadsheet') {
      const wb: SpreadsheetWorkbookModel = {
        id: draftId,
        metadata: {
          id: draftId,
          title: fallbackTitle,
          type: 'spreadsheet',
          createdAt: now,
          updatedAt: now,
          status: 'draft',
          author: 'HELIOXEN AI'
        },
        sheets: [
          {
            id: 'sheet_1',
            name: 'Dataset',
            rowCount: 20,
            columnCount: 6,
            cells: {
              '0:0': { value: 'Item', valueType: 'string', bold: true },
              '0:1': { value: 'Category', valueType: 'string', bold: true },
              '0:2': { value: 'Amount ($)', valueType: 'string', bold: true },
              '1:0': { value: 'Sample Alpha', valueType: 'string' },
              '1:1': { value: 'Operations', valueType: 'string' },
              '1:2': { value: 1250, valueType: 'number' },
              '2:0': { value: 'Sample Beta', valueType: 'string' },
              '2:1': { value: 'Engineering', valueType: 'string' },
              '2:2': { value: 2400, valueType: 'number' }
            }
          }
        ],
        activeSheetId: 'sheet_1'
      }
      return {
        documentType: 'spreadsheet',
        title: fallbackTitle,
        summary: 'Local workbook draft',
        proposedWorkbook: wb,
        warnings: ['AI draft proposals must be reviewed and accepted by the user before applying.']
      }
    } else {
      const pres: PresentationModel = {
        id: draftId,
        metadata: {
          id: draftId,
          title: fallbackTitle,
          type: 'presentation',
          createdAt: now,
          updatedAt: now,
          status: 'draft',
          author: 'HELIOXEN AI'
        },
        theme: 'cosmic_cyan',
        slides: [
          {
            id: 'slide_1',
            title: fallbackTitle,
            layout: 'title_slide',
            elements: [{ id: 'el_1', type: 'subtitle', text: `Generated from: "${request.prompt}"` }]
          },
          {
            id: 'slide_2',
            title: 'Overview & Key Pillars',
            layout: 'title_and_content',
            elements: [
              {
                id: 'el_2',
                type: 'bullet_list',
                bulletPoints: ['Pillar 1: Local-first persistence', 'Pillar 2: Bounded validation', 'Pillar 3: Human review']
              }
            ]
          }
        ]
      }
      return {
        documentType: 'presentation',
        title: fallbackTitle,
        summary: 'Local slide deck draft',
        proposedPresentation: pres,
        warnings: ['AI draft proposals must be reviewed and accepted by the user before applying.']
      }
    }
  }

  public async rewriteTextAi(text: string, instruction: string): Promise<string> {
    const providerService = this.providerServiceGetter?.()
    if (!providerService) {
      return text // Fallback
    }
    const response = await providerService.generateText({
      messages: [
        {
          role: 'user',
          content: `Rewrite the following text according to this instruction: "${instruction}".\nOriginal text:\n"""\n${text}\n"""\nProvide only the rewritten text.`
        }
      ]
    })
    return response.text.trim()
  }

  public async suggestFormulaAi(
    description: string,
    sampleDataSnippet?: string
  ): Promise<{ formula: string; explanation: string }> {
    const providerService = this.providerServiceGetter?.()
    if (providerService) {
      try {
        const response = await providerService.generateText({
          messages: [
            {
              role: 'user',
              content: `You are an Excel spreadsheet formula expert.
User asks: "${description}"
Context/Data: "${sampleDataSnippet || 'None'}"
Respond with JSON only: { "formula": "=FORMULA_HERE", "explanation": "Why this works" }`
            }
          ]
        })
        const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        if (parsed.formula) {
          return { formula: parsed.formula, explanation: parsed.explanation || 'Suggested formula' }
        }
      } catch {
        // Fallback
      }
    }
    return {
      formula: '=SUM(A1:A10)',
      explanation: 'Calculates the sum across selected cell range.'
    }
  }
}
