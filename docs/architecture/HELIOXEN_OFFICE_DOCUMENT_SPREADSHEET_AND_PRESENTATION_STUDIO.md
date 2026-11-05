# HELIOXEN Architecture: Office Document Studio, Spreadsheets & Presentations

**Milestone:** Phase 15, Office and Productivity Integrations  
**Step:** 43 of 48  
**Scope:** Step 43 Only. Step 44 is not implemented.  
**Classification:** Core Subsystem Architectural Specification  

---

## 1. Executive Summary & Purpose

The **Office Document Studio** provides HELIOXEN with a local-first, privacy-respecting, zero-telemetry office productivity environment. It unifies three core creation engines:

1. **Document Studio (`.docx`, `.md`, `.txt`):** Structured word processing with headings, paragraphs, formatted text runs (bold, italic, underline), lists, tables, and AI drafting/rewriting with strict quarantine safeguards.
2. **Spreadsheet Studio (`.xlsx`, `.csv`):** Multi-sheet workbook management, formula persistence, cell coordinate referencing (`A1`, `B2`), formula evaluation metadata, natural-language AI formula suggestions, and strict CSV Dynamic Data Exchange (DDE) formula-injection defense.
3. **Presentation Studio (`.pptx`):** Theme-guided slide deck design, structured slide layouts (title, content, two-column, card grid), slide reordering, presentation themes (Cosmic Cyan, Slate Minimal, Emerald Executive, Amber Warmth), and outlined AI slide drafting.
4. **Unified Template & Persistence Subsystem:** Built-in curated production templates, atomic JSON disk storage (`office_documents_store.json`), native Electron dialog file importing/exporting, and original source file preservation.

---

## 2. Zero-Dependency OOXML Architecture & Security

Rather than introducing heavy, vulnerable, or complex external dependencies (such as SheetJS CE, Mammoth, Docx, or PptxGenJS), HELIOXEN utilizes a zero-dependency Office Open XML (OOXML) architecture built directly on Node.js 20's built-in `zlib` capabilities (`deflateRawSync`, `inflateRawSync`, and `zlib.crc32`).

### 2.1 ZipContainer Architecture (`src/main/office/ZipContainer.ts`)
Office documents (`.docx`, `.xlsx`, `.pptx`) are standard PKZIP archives containing XML parts and relationships defined by the ECMA-376 / ISO/IEC 29500 standard. The `ZipContainer` implements:
- **Zip-Bomb Defense:** Enforces a maximum total decompression ceiling (50MB by default, configurable) and single-entry limits (15MB). Any decompression anomaly or explosive ratio aborts before consuming heap space.
- **Path-Traversal Defense:** Inspects every central directory and local file entry for directory traversal sequences (`../`, `..\`) or absolute paths (`/`, `C:\`), throwing security exceptions upon detection.
- **In-Memory Streaming:** Buffers are compressed and inflated synchronously without writing untrusted temporary files to the disk.

### 2.2 Macro Stripping & Code Execution Defense
External `.docm`, `.xlsm`, or `.pptm` files containing malicious Visual Basic for Applications (VBA) macro payloads (`word/vbaProject.bin`, `xl/vbaProject.bin`, `ppt/vbaProject.bin`) are sanitized upon import. The parsers explicitly ignore binary macro streams and extract only declarative structural XML nodes. Re-exported files never retain macro containers.

### 2.3 CSV Formula Injection (DDE) Defense
When users export tabular data to comma-separated values (CSV), spreadsheet programs (Excel, Calc, Numbers) can be tricked into executing arbitrary operating system commands via formula prefixes: `=`, `+`, `-`, `@`, `\t`, `\r`.
HELIOXEN implements `sanitizeCellValueForCsv()`:
- Inspects cell string values; if the text begins with a dangerous prefix, it prepends a single quotation mark (`'`), which instructs spreadsheet viewers to render the cell as plain text rather than executing a formula.
- The working in-memory workbook model remains intact; the sanitization occurs at the serialization boundary.
- Export results report the number of sanitized cells to the user.

---

## 3. Subsystem Domain Models

### 3.1 Document Studio (`WordDocumentModel`)
```typescript
export interface WordDocumentModel {
  readonly id: string
  readonly metadata: OfficeDocumentMetadata
  readonly blocks: readonly DocumentBlock[]
  readonly pageSettings?: {
    readonly orientation?: 'portrait' | 'landscape'
    readonly marginMm?: number
  }
}

export interface DocumentBlock {
  readonly id: string
  readonly type: DocumentBlockType // 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph' | 'bullet_item' | 'table' | 'quote' | 'divider'
  readonly textRuns?: readonly DocumentTextRun[]
  readonly tableRows?: readonly DocumentTableRow[]
}
```

### 3.2 Spreadsheet Studio (`SpreadsheetWorkbookModel`)
```typescript
export interface SpreadsheetWorkbookModel {
  readonly id: string
  readonly metadata: OfficeDocumentMetadata
  readonly sheets: readonly SpreadsheetWorksheet[]
  readonly activeSheetId: string
}

export interface SpreadsheetWorksheet {
  readonly id: string
  readonly name: string
  readonly rowCount: number
  readonly columnCount: number
  readonly cells: Record<string, SpreadsheetCell> // Keyed by "row:col" (e.g., "0:0" for A1)
}
```

### 3.3 Presentation Studio (`PresentationModel`)
```typescript
export interface PresentationModel {
  readonly id: string
  readonly metadata: OfficeDocumentMetadata
  readonly theme: PresentationThemeId // 'cosmic_cyan' | 'slate_minimal' | 'emerald_executive' | 'amber_warmth'
  readonly slides: readonly PresentationSlide[]
}
```

---

## 4. Quarantined AI Integration

All AI assistance operations are strictly quarantined and follow the **Human-in-the-Loop** model:
1. **Draft Generation (`OFFICE_GENERATE_AI_DRAFT`):** Prompts generate candidate proposals (`proposedDocument`, `proposedWorkbook`, or `proposedPresentation`). These proposals are returned in an unpersisted preview container. The working document is not modified until the user reviews and clicks **Accept**.
2. **Text Rewriting (`OFFICE_REWRITE_TEXT_AI`):** Rewrites are presented in an inline diff preview card. The user can apply or discard the rewrite.
3. **Formula Suggester (`OFFICE_SUGGEST_FORMULA_AI`):** Natural language prompts generate standard Excel/OOXML formulas with an explanation. The user clicks **Insert** to commit the formula into the active cell.

---

## 5. IPC Channels & Authorization Capabilities

| Channel | Capability Required | Risk Level | Description |
|---|---|---|---|
| `OFFICE_LIST_DOCUMENTS` | `office:read` | low | Lists saved document metadata |
| `OFFICE_GET_DOCUMENT` | `office:read` | low | Retrieves document model by ID |
| `OFFICE_SAVE_DOCUMENT` | `office:write` | low | Persists document model atomically |
| `OFFICE_DELETE_DOCUMENT` | `office:write` | low | Deletes document record from store |
| `OFFICE_LIST_TEMPLATES` | `office:read` | low | Returns curated built-in templates |
| `OFFICE_CREATE_FROM_TEMPLATE` | `office:write` | low | Instantiates document from template |
| `OFFICE_EXPORT_DOCUMENT` | `office:export` | moderate | Exports OOXML/MD/CSV with save dialog |
| `OFFICE_IMPORT_DOCUMENT` | `office:import` | low | Imports and parses user office file |
| `OFFICE_GENERATE_AI_DRAFT` | `office:write` | low | Produces quarantined AI proposal |
| `OFFICE_REWRITE_TEXT_AI` | `office:write` | low | Rewrites selected text with AI |
| `OFFICE_SUGGEST_FORMULA_AI` | `office:read` | low | Suggests formula based on prompt |

---

## 6. Verification & Test Metrics

- **Total Test Suites:** 4 test files (`documentStudio.test.ts`, `spreadsheetStudio.test.ts`, `presentationStudio.test.ts`, `officeSecurityAndAI.test.ts`).
- **Tests in Subsystem:** 29 passed out of 29.
- **Full Project Vitest Suite:** 117 passed test files, 721 passed tests out of 721 (100% pass rate).
- **TypeScript Typecheck:** 0 errors in both `typecheck:node` and `typecheck:web`.
- **Production Build:** `electron-vite build` succeeded with clean bundles.

