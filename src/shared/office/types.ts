/**
 * HELIOXEN AI — Step 43: Office Document Studio Shared Domain Types
 * Defines data models for Document Studio, Spreadsheet Studio, and Presentation Studio.
 * Strictly local-first, declarative, and separate from raw binary storage.
 */

export const OFFICE_SCHEMA_VERSION = 1

export type OfficeDocumentType = 'document' | 'spreadsheet' | 'presentation'

export type OfficeDocumentStatus =
  | 'draft'
  | 'saved'
  | 'modified'
  | 'exporting'
  | 'exported'
  | 'error'

// ============================================================================
// 1. SHARED METADATA & PERSISTENCE
// ============================================================================

export interface OfficeDocumentMetadata {
  readonly id: string
  readonly title: string
  readonly type: OfficeDocumentType
  readonly createdAt: number
  readonly updatedAt: number
  readonly status: OfficeDocumentStatus
  readonly author: string
  readonly sourceFilePath?: string | null
  readonly isTemplate?: boolean
  readonly tags?: readonly string[]
  readonly summary?: string
}

// ============================================================================
// 2. DOCUMENT STUDIO (WORD / DOCX / TEXT / MARKDOWN)
// ============================================================================

export type DocumentBlockType =
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'paragraph'
  | 'bullet_item'
  | 'numbered_item'
  | 'table'
  | 'quote'
  | 'divider'

export interface DocumentTextRun {
  readonly text: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly code?: boolean
  readonly linkUrl?: string
}

export interface DocumentTableRow {
  readonly cells: readonly (readonly DocumentTextRun[])[]
}

export interface DocumentBlock {
  readonly id: string
  readonly type: DocumentBlockType
  readonly textRuns?: readonly DocumentTextRun[]
  readonly tableRows?: readonly DocumentTableRow[]
}

export interface WordDocumentModel {
  readonly id: string
  readonly metadata: OfficeDocumentMetadata
  readonly blocks: readonly DocumentBlock[]
  readonly pageSettings?: {
    readonly orientation?: 'portrait' | 'landscape'
    readonly marginMm?: number
  }
}

// ============================================================================
// 3. SPREADSHEET STUDIO (XLSX / CSV)
// ============================================================================

export type SpreadsheetCellValueType = 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'empty'

export interface SpreadsheetCell {
  readonly value: string | number | boolean | null
  readonly valueType: SpreadsheetCellValueType
  readonly formula?: string // e.g. "=SUM(A1:A10)"
  readonly formattedValue?: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly align?: 'left' | 'center' | 'right'
}

export interface SpreadsheetWorksheet {
  readonly id: string
  readonly name: string
  readonly rowCount: number
  readonly columnCount: number
  // Cells keyed by "row:col" (0-indexed) e.g. "0:0" for A1
  readonly cells: Record<string, SpreadsheetCell>
}

export interface SpreadsheetWorkbookModel {
  readonly id: string
  readonly metadata: OfficeDocumentMetadata
  readonly sheets: readonly SpreadsheetWorksheet[]
  readonly activeSheetId: string
}

// ============================================================================
// 4. PRESENTATION STUDIO (PPTX)
// ============================================================================

export type SlideLayoutType =
  | 'title_slide'
  | 'title_and_content'
  | 'section_header'
  | 'two_column'
  | 'comparison'
  | 'card_grid'
  | 'title_only'
  | 'blank'

export type PresentationThemeId = 'cosmic_cyan' | 'slate_minimal' | 'emerald_executive' | 'amber_warmth'

export interface SlideElement {
  readonly id: string
  readonly type: 'title' | 'subtitle' | 'body' | 'bullet_list' | 'card' | 'image'
  readonly text?: string
  readonly bulletPoints?: readonly string[]
  readonly mediaAssetId?: string
  readonly localImagePath?: string
  readonly color?: string
  readonly position?: {
    readonly x: number // percentage 0-100
    readonly y: number
    readonly width: number
    readonly height: number
  }
}

export interface PresentationSlide {
  readonly id: string
  readonly title: string
  readonly layout: SlideLayoutType
  readonly elements: readonly SlideElement[]
  readonly speakerNotes?: string
}

export interface PresentationModel {
  readonly id: string
  readonly metadata: OfficeDocumentMetadata
  readonly theme: PresentationThemeId
  readonly slides: readonly PresentationSlide[]
}

// ============================================================================
// 5. UNIFIED TEMPLATES & AI DRAFTING
// ============================================================================

export interface OfficeTemplate {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly type: OfficeDocumentType
  readonly category: 'business' | 'technical' | 'project' | 'personal'
  readonly previewSummary: string
  readonly defaultPayload: WordDocumentModel | SpreadsheetWorkbookModel | PresentationModel
}

export interface OfficeAiDraftRequest {
  readonly documentType: OfficeDocumentType
  readonly prompt: string
  readonly contextSnippet?: string
  readonly sourceTaskIds?: readonly string[]
  readonly sourceNoteIds?: readonly string[]
}

export interface OfficeAiDraftResponse {
  readonly documentType: OfficeDocumentType
  readonly title: string
  readonly summary: string
  readonly proposedDocument?: WordDocumentModel
  readonly proposedWorkbook?: SpreadsheetWorkbookModel
  readonly proposedPresentation?: PresentationModel
  readonly suggestedFormulas?: readonly {
    readonly cellCoordinate: string
    readonly formula: string
    readonly explanation: string
  }[]
  readonly warnings?: readonly string[]
}

export interface OfficeExportRequest {
  readonly documentId: string
  readonly format: 'docx' | 'txt' | 'md' | 'xlsx' | 'csv' | 'pptx'
  readonly targetFilePath?: string
  readonly promptSaveDialog?: boolean
  readonly suggestedFileName?: string
  readonly overwriteExisting?: boolean
  readonly sanitizeCsvFormulas?: boolean
}

export interface OfficeExportResult {
  readonly success: boolean
  readonly filePath: string
  readonly format: string
  readonly byteSize: number
  readonly exportedAt: number
  readonly sanitizedCsvEscapesCount?: number
  readonly warnings?: readonly string[]
}

export interface OfficeImportResult {
  readonly success: boolean
  readonly documentId: string
  readonly documentType: OfficeDocumentType
  readonly title: string
  readonly sourceFilePath: string
  readonly warnings: readonly string[]
  readonly document?: WordDocumentModel
  readonly workbook?: SpreadsheetWorkbookModel
  readonly presentation?: PresentationModel
}
