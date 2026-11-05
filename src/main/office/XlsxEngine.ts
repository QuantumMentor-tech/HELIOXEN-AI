/**
 * HELIOXEN AI — Step 43: Spreadsheet (.xlsx, .csv) Engine
 * Generates and parses valid Office Open XML Spreadsheets with zero third-party dependencies.
 * Implements strict CSV formula-injection defense and formula preservation.
 */

import { buildZipArchive, extractZipArchive, ZipEntry } from './ZipContainer'
import {
  SpreadsheetWorkbookModel,
  SpreadsheetWorksheet,
  SpreadsheetCell
} from '../../shared/office/types'
import {
  escapeXmlText,
  unescapeXmlText,
  columnIndexToLetter,
  columnLetterToIndex,
  serializeToCsv,
  parseCsvText
} from '../../shared/office/contracts'

export class XlsxEngine {
  /**
   * Generates a fully compliant Office Open XML (.xlsx) binary package from a SpreadsheetWorkbookModel.
   */
  public static generateXlsx(workbook: SpreadsheetWorkbookModel): Buffer {
    const entries: ZipEntry[] = []

    // 1. [Content_Types].xml
    const sheetOverrides = workbook.sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('\n  ')

    entries.push({
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`
    })

    // 2. _rels/.rels
    entries.push({
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    })

    // 3. xl/_rels/workbook.xml.rels
    const sheetRels = workbook.sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('\n  ')

    const stylesRelId = workbook.sheets.length + 1
    entries.push({
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    })

    // 4. xl/workbook.xml
    const sheetsXml = workbook.sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('\n    ')

    entries.push({
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetsXml}
  </sheets>
</workbook>`
    })

    // 5. xl/styles.xml
    entries.push({
      name: 'xl/styles.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font><name val="Calibri"/><sz val="11"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`
    })

    // 6. Each worksheet: xl/worksheets/sheet{N}.xml
    for (let i = 0; i < workbook.sheets.length; i++) {
      const sheet = workbook.sheets[i]
      const sheetDataXml = this.renderSheetDataXml(sheet)
      entries.push({
        name: `xl/worksheets/sheet${i + 1}.xml`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetDataXml}
  </sheetData>
</worksheet>`
      })
    }

    return buildZipArchive(entries)
  }

  private static renderSheetDataXml(sheet: SpreadsheetWorksheet): string {
    // Group cells by row index
    const rowsMap = new Map<number, { col: number; cell: SpreadsheetCell }[]>()

    for (const [coord, cell] of Object.entries(sheet.cells)) {
      const [rStr, cStr] = coord.split(':')
      const r = parseInt(rStr, 10)
      const c = parseInt(cStr, 10)
      if (isNaN(r) || isNaN(c)) continue

      if (!rowsMap.has(r)) rowsMap.set(r, [])
      rowsMap.get(r)!.push({ col: c, cell })
    }

    const sortedRowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b)
    const rowsXml: string[] = []

    for (const r of sortedRowIndices) {
      const rowNum = r + 1 // 1-indexed for Excel
      const cellsInRow = rowsMap.get(r)!.sort((a, b) => a.col - b.col)
      const cellsXml: string[] = []

      for (const { col, cell } of cellsInRow) {
        const colLetter = columnIndexToLetter(col)
        const cellRef = `${colLetter}${rowNum}`

        if (cell.formula) {
          const formulaStr = cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula
          const cachedVal = cell.value !== null && cell.value !== undefined ? `<v>${cell.value}</v>` : ''
          cellsXml.push(`<c r="${cellRef}"><f>${escapeXmlText(formulaStr)}</f>${cachedVal}</c>`)
        } else if (cell.valueType === 'number' && typeof cell.value === 'number') {
          cellsXml.push(`<c r="${cellRef}"><v>${cell.value}</v></c>`)
        } else if (cell.valueType === 'boolean') {
          cellsXml.push(`<c r="${cellRef}" t="b"><v>${cell.value ? 1 : 0}</v></c>`)
        } else if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          // Use inlineStr so sharedStrings.xml is not required
          cellsXml.push(
            `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXmlText(String(cell.value))}</t></is></c>`
          )
        }
      }

      if (cellsXml.length > 0) {
        rowsXml.push(`<row r="${rowNum}">${cellsXml.join('')}</row>`)
      }
    }

    return rowsXml.join('\n    ')
  }

  /**
   * Parses an imported XLSX binary archive into a SpreadsheetWorkbookModel.
   * Strips VBA macros and external data connections safely.
   */
  public static parseXlsx(
    xlsxBuffer: Buffer,
    documentId: string,
    title: string
  ): { model: SpreadsheetWorkbookModel; warnings: string[] } {
    const warnings: string[] = []
    const entries = extractZipArchive(xlsxBuffer)

    // Check for macro presence
    if (entries.has('xl/vbaProject.bin') || entries.has('vbaProject.bin')) {
      warnings.push('Workbook contained embedded VBA macro project. Macros were safely stripped and not executed.')
    }

    // Parse shared strings table if present
    const sharedStrings: string[] = []
    const sstBuf = entries.get('xl/sharedStrings.xml')
    if (sstBuf) {
      const sstXml = sstBuf.toString('utf-8')
      const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g
      let siMatch: RegExpExecArray | null
      while ((siMatch = siRegex.exec(sstXml)) !== null) {
        const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(siMatch[1])
        sharedStrings.push(tMatch ? unescapeXmlText(tMatch[1]) : '')
      }
    }

    // Parse sheets from xl/workbook.xml
    const workbookXmlBuf = entries.get('xl/workbook.xml')
    if (!workbookXmlBuf) {
      throw new Error('XLSX_PARSE_ERROR: xl/workbook.xml was not found inside container.')
    }

    const wbXml = workbookXmlBuf.toString('utf-8')
    const sheetRegex = /<sheet\b[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*>/g
    const sheetList: { name: string; sheetId: number }[] = []
    let sMatch: RegExpExecArray | null

    while ((sMatch = sheetRegex.exec(wbXml)) !== null) {
      sheetList.push({
        name: unescapeXmlText(sMatch[1]),
        sheetId: parseInt(sMatch[2], 10) || sheetList.length + 1
      })
    }

    if (sheetList.length === 0) {
      sheetList.push({ name: 'Sheet1', sheetId: 1 })
    }

    const worksheets: SpreadsheetWorksheet[] = []

    for (let i = 0; i < sheetList.length; i++) {
      const meta = sheetList[i]
      const sheetBuf = entries.get(`xl/worksheets/sheet${i + 1}.xml`)
      const cells: Record<string, SpreadsheetCell> = {}
      let maxRow = 10
      let maxCol = 10

      if (sheetBuf) {
        const sheetXml = sheetBuf.toString('utf-8')
        // Match <c r="A1" ...>...</c>
        const cellRegex = /<c\b[^>]*r="([A-Z]+)([0-9]+)"([^>]*)>([\s\S]*?)<\/c>/g
        let cMatch: RegExpExecArray | null

        while ((cMatch = cellRegex.exec(sheetXml)) !== null) {
          const colLetters = cMatch[1]
          const rowNumber = parseInt(cMatch[2], 10) - 1 // 0-indexed
          const colNumber = columnLetterToIndex(colLetters)
          const attrStr = cMatch[3]
          const contentStr = cMatch[4]

          const tTypeMatch = /\bt="([^"]+)"/i.exec(attrStr)
          const cellType = tTypeMatch ? tTypeMatch[1] : 'n'

          // Check formula
          const fMatch = /<f\b[^>]*>([\s\S]*?)<\/f>/i.exec(contentStr)
          const formula = fMatch ? `=${unescapeXmlText(fMatch[1])}` : undefined

          // Check value
          let value: string | number | boolean | null = null
          let valType: SpreadsheetCell['valueType'] = 'number'

          if (cellType === 's') {
            // Shared string index
            const vMatch = /<v\b[^>]*>([0-9]+)<\/v>/i.exec(contentStr)
            if (vMatch) {
              const idx = parseInt(vMatch[1], 10)
              value = sharedStrings[idx] ?? ''
              valType = 'string'
            }
          } else if (cellType === 'inlineStr') {
            const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(contentStr)
            value = tMatch ? unescapeXmlText(tMatch[1]) : ''
            valType = 'string'
          } else if (cellType === 'b') {
            const vMatch = /<v\b[^>]*>([0-9]+)<\/v>/i.exec(contentStr)
            value = vMatch ? vMatch[1] === '1' : false
            valType = 'boolean'
          } else {
            // Numeric or date
            const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(contentStr)
            if (vMatch) {
              const num = parseFloat(vMatch[1])
              value = isNaN(num) ? vMatch[1] : num
              valType = isNaN(num) ? 'string' : 'number'
            }
          }

          if (formula) valType = 'formula'

          cells[`${rowNumber}:${colNumber}`] = {
            value,
            valueType: valType,
            formula
          }

          if (rowNumber + 1 > maxRow) maxRow = rowNumber + 5
          if (colNumber + 1 > maxCol) maxCol = colNumber + 5
        }
      }

      worksheets.push({
        id: `sheet_${i + 1}`,
        name: meta.name,
        rowCount: Math.min(maxRow, 1000),
        columnCount: Math.min(maxCol, 50),
        cells
      })
    }

    const now = Date.now()
    const model: SpreadsheetWorkbookModel = {
      id: documentId,
      metadata: {
        id: documentId,
        title,
        type: 'spreadsheet',
        createdAt: now,
        updatedAt: now,
        status: 'saved',
        author: 'Imported',
        tags: ['imported', 'xlsx']
      },
      sheets: worksheets,
      activeSheetId: worksheets[0].id
    }

    return { model, warnings }
  }

  /**
   * Exports an active sheet from a SpreadsheetWorkbookModel to CSV.
   * Enforces strict formula-injection protection when sanitizeFormulas is true.
   */
  public static exportToCsv(
    workbook: SpreadsheetWorkbookModel,
    sheetId?: string,
    sanitizeFormulas: boolean = true
  ): { csvContent: string; escapedCount: number } {
    const targetSheet = workbook.sheets.find((s) => s.id === sheetId) || workbook.sheets[0]
    if (!targetSheet) {
      return { csvContent: '', escapedCount: 0 }
    }

    // Determine row and column boundaries
    let maxR = 0
    let maxC = 0

    for (const coord of Object.keys(targetSheet.cells)) {
      const [rStr, cStr] = coord.split(':')
      const r = parseInt(rStr, 10)
      const c = parseInt(cStr, 10)
      if (!isNaN(r) && r > maxR) maxR = r
      if (!isNaN(c) && c > maxC) maxC = c
    }

    const grid: (string | number | boolean | null)[][] = []
    for (let r = 0; r <= maxR; r++) {
      const row: (string | number | boolean | null)[] = []
      for (let c = 0; c <= maxC; c++) {
        const cell = targetSheet.cells[`${r}:${c}`]
        row.push(cell ? cell.value : '')
      }
      grid.push(row)
    }

    const { csvText, escapedCount } = serializeToCsv(grid, sanitizeFormulas)
    return { csvContent: csvText, escapedCount }
  }

  /**
   * Parses raw CSV content into a SpreadsheetWorkbookModel.
   */
  public static parseCsv(
    csvText: string,
    documentId: string,
    title: string
  ): SpreadsheetWorkbookModel {
    const rawRows = parseCsvText(csvText, { maxRows: 5000, maxCols: 100 })
    const cells: Record<string, SpreadsheetCell> = {}

    let maxR = 0
    let maxC = 0

    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r]
      for (let c = 0; c < row.length; c++) {
        const valStr = row[c]
        if (!valStr) continue

        let value: string | number | boolean = valStr
        let valueType: SpreadsheetCell['valueType'] = 'string'

        // Check if number
        if (/^-?\d+(\.\d+)?$/.test(valStr.trim())) {
          value = parseFloat(valStr.trim())
          valueType = 'number'
        } else if (valStr.trim().toLowerCase() === 'true') {
          value = true
          valueType = 'boolean'
        } else if (valStr.trim().toLowerCase() === 'false') {
          value = false
          valueType = 'boolean'
        }

        cells[`${r}:${c}`] = { value, valueType }
        if (r > maxR) maxR = r
        if (c > maxC) maxC = c
      }
    }

    const now = Date.now()
    return {
      id: documentId,
      metadata: {
        id: documentId,
        title,
        type: 'spreadsheet',
        createdAt: now,
        updatedAt: now,
        status: 'saved',
        author: 'Imported',
        tags: ['imported', 'csv']
      },
      sheets: [
        {
          id: 'sheet_1',
          name: 'CSV Data',
          rowCount: Math.max(maxR + 5, 20),
          columnCount: Math.max(maxC + 5, 10),
          cells
        }
      ],
      activeSheetId: 'sheet_1'
    }
  }
}

