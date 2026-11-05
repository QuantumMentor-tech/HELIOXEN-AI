/**
 * HELIOXEN AI — Step 43: Office Document Studio Contracts & Security Helpers
 * Strict Zod validation schemas, CSV formula injection defense, and XML sanitization.
 */

import { z } from 'zod'
import {
  OfficeDocumentType,
  OfficeDocumentMetadata,
  WordDocumentModel,
  SpreadsheetWorkbookModel,
  PresentationModel
} from './types'

// ============================================================================
// 1. ZOD VALIDATION SCHEMAS
// ============================================================================

export const OfficeDocumentMetadataSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  type: z.enum(['document', 'spreadsheet', 'presentation']),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  status: z.enum(['draft', 'saved', 'modified', 'exporting', 'exported', 'error']),
  author: z.string().max(128).default('User'),
  sourceFilePath: z.string().nullable().optional(),
  isTemplate: z.boolean().default(false),
  tags: z.array(z.string().max(64)).default([]),
  summary: z.string().max(1024).optional()
})

// Document Studio Schemas
export const DocumentTextRunSchema = z.object({
  text: z.string().max(10000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  code: z.boolean().optional(),
  linkUrl: z.string().max(2048).optional()
})

export const DocumentTableRowSchema = z.object({
  cells: z.array(z.array(DocumentTextRunSchema))
})

export const DocumentBlockSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum([
    'heading_1',
    'heading_2',
    'heading_3',
    'paragraph',
    'bullet_item',
    'numbered_item',
    'table',
    'quote',
    'divider'
  ]),
  textRuns: z.array(DocumentTextRunSchema).optional(),
  tableRows: z.array(DocumentTableRowSchema).optional()
})

export const WordDocumentModelSchema = z.object({
  id: z.string().min(1).max(128),
  metadata: OfficeDocumentMetadataSchema,
  blocks: z.array(DocumentBlockSchema).max(1000),
  pageSettings: z
    .object({
      orientation: z.enum(['portrait', 'landscape']).optional(),
      marginMm: z.number().positive().max(100).optional()
    })
    .optional()
})

// Spreadsheet Studio Schemas
export const SpreadsheetCellSchema = z.object({
  value: z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]),
  valueType: z.enum(['string', 'number', 'boolean', 'date', 'formula', 'empty']),
  formula: z.string().max(1024).optional(),
  formattedValue: z.string().max(5000).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional()
})

export const SpreadsheetWorksheetSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  rowCount: z.number().int().min(1).max(10000),
  columnCount: z.number().int().min(1).max(256),
  cells: z.record(z.string(), SpreadsheetCellSchema)
})

export const SpreadsheetWorkbookModelSchema = z.object({
  id: z.string().min(1).max(128),
  metadata: OfficeDocumentMetadataSchema,
  sheets: z.array(SpreadsheetWorksheetSchema).min(1).max(50),
  activeSheetId: z.string().min(1).max(64)
})

// Presentation Studio Schemas
export const SlideElementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['title', 'subtitle', 'body', 'bullet_list', 'card', 'image']),
  text: z.string().max(5000).optional(),
  bulletPoints: z.array(z.string().max(1000)).optional(),
  mediaAssetId: z.string().max(128).optional(),
  localImagePath: z.string().max(1024).optional(),
  color: z.string().max(32).optional(),
  position: z
    .object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      width: z.number().min(0).max(100),
      height: z.number().min(0).max(100)
    })
    .optional()
})

export const PresentationSlideSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(256),
  layout: z.enum([
    'title_slide',
    'title_and_content',
    'section_header',
    'two_column',
    'comparison',
    'card_grid',
    'title_only',
    'blank'
  ]),
  elements: z.array(SlideElementSchema).max(50),
  speakerNotes: z.string().max(5000).optional()
})

export const PresentationModelSchema = z.object({
  id: z.string().min(1).max(128),
  metadata: OfficeDocumentMetadataSchema,
  theme: z.enum(['cosmic_cyan', 'slate_minimal', 'emerald_executive', 'amber_warmth']),
  slides: z.array(PresentationSlideSchema).min(1).max(100)
})

// Request Schemas
export const OfficeAiDraftRequestSchema = z.object({
  documentType: z.enum(['document', 'spreadsheet', 'presentation']),
  prompt: z.string().min(1).max(2048),
  contextSnippet: z.string().max(10000).optional(),
  sourceTaskIds: z.array(z.string()).optional(),
  sourceNoteIds: z.array(z.string()).optional()
})

export const OfficeExportRequestSchema = z.object({
  documentId: z.string().min(1).max(128),
  format: z.enum(['docx', 'txt', 'md', 'xlsx', 'csv', 'pptx']),
  targetFilePath: z.string().max(2048).optional(),
  promptSaveDialog: z.boolean().default(false),
  suggestedFileName: z.string().max(256).optional(),
  overwriteExisting: z.boolean().default(false),
  sanitizeCsvFormulas: z.boolean().default(true)
})

// ============================================================================
// 2. CSV FORMULA INJECTION DEFENSE (DDE / FORMULA ESCAPING)
// ============================================================================

/**
 * Characters that spreadsheet processors (Excel, Calc, Google Sheets) treat as formula prefixes.
 * If untrusted cell content begins with any of these characters, opening a CSV can execute formulas.
 */
export const FORMULA_PREFIX_CHARS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Sanitizes a single cell value for CSV export according to the security policy.
 * If value starts with a formula trigger, prepends a single quote (') to neutralize it,
 * preventing formula execution while preserving raw viewable text.
 */
export function sanitizeCellValueForCsv(value: string | number | boolean | null): {
  sanitized: string
  wasEscaped: boolean
} {
  if (value === null || value === undefined) {
    return { sanitized: '', wasEscaped: false }
  }

  const str = String(value)
  if (str.length === 0) {
    return { sanitized: '', wasEscaped: false }
  }

  const firstChar = str.charAt(0)
  if (FORMULA_PREFIX_CHARS.includes(firstChar)) {
    return {
      sanitized: `'${str}`,
      wasEscaped: true
    }
  }

  return { sanitized: str, wasEscaped: false }
}

/**
 * Encodes a 2D array of string/number values into safe CSV format.
 * Automatically wraps cells in quotes if they contain commas, newlines, or double quotes.
 */
export function serializeToCsv(
  rows: (string | number | boolean | null)[][],
  sanitizeFormulas: boolean = true
): { csvText: string; escapedCount: number } {
  let escapedCount = 0
  const lines: string[] = []

  for (const row of rows) {
    const formattedCells: string[] = []
    for (const cell of row) {
      let cellText: string
      if (sanitizeFormulas) {
        const { sanitized, wasEscaped } = sanitizeCellValueForCsv(cell)
        if (wasEscaped) escapedCount++
        cellText = sanitized
      } else {
        cellText = cell === null || cell === undefined ? '' : String(cell)
      }

      // Check if quotes are required
      if (
        cellText.includes(',') ||
        cellText.includes('"') ||
        cellText.includes('\n') ||
        cellText.includes('\r')
      ) {
        formattedCells.push(`"${cellText.replace(/"/g, '""')}"`)
      } else {
        formattedCells.push(cellText)
      }
    }
    lines.push(formattedCells.join(','))
  }

  return {
    csvText: lines.join('\r\n'),
    escapedCount
  }
}

/**
 * Parses raw CSV text into a 2D array of string cells.
 * Bounded by maxRows and maxCols to protect memory.
 */
export function parseCsvText(
  csvContent: string,
  limits: { maxRows?: number; maxCols?: number } = {}
): string[][] {
  const maxRows = limits.maxRows ?? 10000
  const maxCols = limits.maxCols ?? 256

  const rows: string[][] = []
  const lines = csvContent.split(/\r?\n/)

  for (let r = 0; r < lines.length && rows.length < maxRows; r++) {
    const line = lines[r]
    if (!line.trim() && r === lines.length - 1) continue // Skip trailing empty line

    const rowCells: string[] = []
    let inQuotes = false
    let currentCell = ''

    for (let c = 0; c < line.length; c++) {
      const char = line[c]
      if (char === '"') {
        if (inQuotes && line[c + 1] === '"') {
          currentCell += '"'
          c++ // skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        if (rowCells.length < maxCols) {
          rowCells.push(currentCell)
        }
        currentCell = ''
      } else {
        currentCell += char
      }
    }

    if (rowCells.length < maxCols) {
      rowCells.push(currentCell)
    }

    rows.push(rowCells)
  }

  return rows
}

// ============================================================================
// 3. XML ESCAPING & TEXT HELPERS
// ============================================================================

export function escapeXmlText(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function unescapeXmlText(str: string): string {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Converts a 0-indexed column integer to Excel column letters (0 -> A, 25 -> Z, 26 -> AA).
 */
export function columnIndexToLetter(colIndex: number): string {
  let letter = ''
  let temp = colIndex
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

/**
 * Converts Excel column letters to a 0-indexed column integer ("A" -> 0, "Z" -> 25, "AA" -> 26).
 */
export function columnLetterToIndex(columnLetters: string): number {
  let index = 0
  const upper = columnLetters.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64)
  }
  return index - 1
}
