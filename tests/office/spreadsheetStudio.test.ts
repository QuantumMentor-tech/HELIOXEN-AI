import { describe, it, expect } from 'vitest'
import { XlsxEngine } from '../../src/main/office/XlsxEngine'
import { SpreadsheetWorkbookModel } from '../../src/shared/office/types'
import {
  SpreadsheetWorkbookModelSchema,
  sanitizeCellValueForCsv,
  serializeToCsv,
  parseCsvText,
  columnIndexToLetter,
  columnLetterToIndex
} from '../../src/shared/office/contracts'
import { PROJECT_BUDGET_TEMPLATE } from '../../src/main/office/OfficeTemplates'

describe('Spreadsheet Studio (XLSX, CSV, Formulas, DDE Defense)', () => {
  const sampleWorkbook: SpreadsheetWorkbookModel = {
    id: 'test-wb-1',
    metadata: {
      id: 'test-wb-1',
      title: 'Quarterly Operating Budget',
      type: 'spreadsheet',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      author: 'Financial Controller'
    },
    sheets: [
      {
        id: 's1',
        name: 'Expenses',
        rowCount: 4,
        columnCount: 3,
        cells: {
          '0:0': { value: 'Item', valueType: 'string', bold: true },
          '0:1': { value: 'Cost', valueType: 'string', bold: true },
          '0:2': { value: 'Tax', valueType: 'string', bold: true },
          '1:0': { value: 'Servers', valueType: 'string' },
          '1:1': { value: 2500, valueType: 'number' },
          '1:2': { value: 250, valueType: 'number' },
          '2:0': { value: 'Bandwidth', valueType: 'string' },
          '2:1': { value: 600, valueType: 'number' },
          '2:2': { value: 60, valueType: 'number' },
          '3:0': { value: 'Total', valueType: 'string', bold: true },
          '3:1': { value: 3100, valueType: 'formula', formula: '=SUM(B2:B3)', bold: true },
          '3:2': { value: 310, valueType: 'formula', formula: '=SUM(C2:C3)', bold: true }
        }
      }
    ],
    activeSheetId: 's1'
  }

  it('validates workbook against SpreadsheetWorkbookModelSchema', () => {
    const parsed = SpreadsheetWorkbookModelSchema.safeParse(sampleWorkbook)
    expect(parsed.success).toBe(true)
  })

  it('generates valid OOXML (.xlsx) binary PKZIP archive', async () => {
    const xlsxBuffer = await XlsxEngine.generateXlsx(sampleWorkbook)
    expect(xlsxBuffer).toBeInstanceOf(Buffer)
    expect(xlsxBuffer.length).toBeGreaterThan(500)

    // Check PKZIP signature: 0x50 0x4B 0x03 0x04
    expect(xlsxBuffer[0]).toBe(0x50)
    expect(xlsxBuffer[1]).toBe(0x4b)
    expect(xlsxBuffer[2]).toBe(0x03)
    expect(xlsxBuffer[3]).toBe(0x04)
  })

  it('parses generated .xlsx archive back into structured SpreadsheetWorkbookModel', async () => {
    const xlsxBuffer = await XlsxEngine.generateXlsx(sampleWorkbook)
    const { model: parsedWorkbook } = await XlsxEngine.parseXlsx(xlsxBuffer, 'wb_test', 'Parsed Budget')

    expect(parsedWorkbook.metadata.title).toBe('Parsed Budget')
    expect(parsedWorkbook.metadata.type).toBe('spreadsheet')
    expect(parsedWorkbook.sheets.length).toBeGreaterThanOrEqual(1)

    const sheet = parsedWorkbook.sheets[0]
    expect(sheet.cells['0:0']?.value).toBe('Item')
    expect(sheet.cells['1:0']?.value).toBe('Servers')
    expect(sheet.cells['1:1']?.value).toBe(2500)
    expect(sheet.cells['3:1']?.formula).toBe('=SUM(B2:B3)')
  })

  it('correctly maps column indices to letters and vice versa', () => {
    expect(columnIndexToLetter(0)).toBe('A')
    expect(columnIndexToLetter(1)).toBe('B')
    expect(columnIndexToLetter(25)).toBe('Z')
    expect(columnIndexToLetter(26)).toBe('AA')

    expect(columnLetterToIndex('A')).toBe(0)
    expect(columnLetterToIndex('B')).toBe(1)
    expect(columnLetterToIndex('Z')).toBe(25)
    expect(columnLetterToIndex('AA')).toBe(26)
  })

  describe('CSV Export & Formula Injection (DDE) Defense', () => {
    it('escapes dangerous prefixes (=, +, -, @, \\t, \\r) with single quote in CSV export', () => {
      expect(sanitizeCellValueForCsv('=1+1').sanitized).toBe("'=1+1")
      expect(sanitizeCellValueForCsv('=1+1').wasEscaped).toBe(true)

      expect(sanitizeCellValueForCsv('+cmd|/c calc').sanitized).toBe("'+cmd|/c calc")
      expect(sanitizeCellValueForCsv('+cmd|/c calc').wasEscaped).toBe(true)

      expect(sanitizeCellValueForCsv('-5*10').sanitized).toBe("'-5*10")
      expect(sanitizeCellValueForCsv('-5*10').wasEscaped).toBe(true)

      expect(sanitizeCellValueForCsv('@SUM(A1:A5)').sanitized).toBe("'@SUM(A1:A5)")
      expect(sanitizeCellValueForCsv('@SUM(A1:A5)').wasEscaped).toBe(true)

      expect(sanitizeCellValueForCsv('\tDDE').sanitized).toBe("'\tDDE")
      expect(sanitizeCellValueForCsv('\tDDE').wasEscaped).toBe(true)
    })

    it('preserves safe values intact without escaping', () => {
      expect(sanitizeCellValueForCsv('Regular Text').sanitized).toBe('Regular Text')
      expect(sanitizeCellValueForCsv('Regular Text').wasEscaped).toBe(false)
      expect(sanitizeCellValueForCsv(4200).sanitized).toBe('4200')
      expect(sanitizeCellValueForCsv(true).sanitized).toBe('true')
    })

    it('serializes grid to CSV with formula injection defense active', () => {
      const grid = [
        ['Safe Item', 'Dangerous Formula', 'Safe Number'],
        ['Hardware', '=cmd|/c calc!A0', 1500]
      ]
      const { csvText, escapedCount } = serializeToCsv(grid, true)
      expect(escapedCount).toBe(1)
      expect(csvText).toContain("Hardware,'=cmd|/c calc!A0,1500")
    })

    it('parses CSV text into 2D row/col array handling quoted commas', () => {
      const rawCsv = 'Item,"Cost, Tax Included",Quantity\nLaptop,"$1,200",5'
      const rows = parseCsvText(rawCsv)
      expect(rows.length).toBe(2)
      expect(rows[0][1]).toBe('Cost, Tax Included')
      expect(rows[1][0]).toBe('Laptop')
      expect(rows[1][1]).toBe('$1,200')
      expect(rows[1][2]).toBe('5')
    })
  })

  it('verifies built-in Project Budget template conforms to schema', () => {
    expect(PROJECT_BUDGET_TEMPLATE.type).toBe('spreadsheet')
    const budgetParse = SpreadsheetWorkbookModelSchema.safeParse(PROJECT_BUDGET_TEMPLATE.defaultPayload)
    expect(budgetParse.success).toBe(true)
  })
})
