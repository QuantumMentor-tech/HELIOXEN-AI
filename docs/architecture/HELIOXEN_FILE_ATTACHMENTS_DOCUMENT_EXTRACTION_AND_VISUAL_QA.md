# HELIOXEN AI — FILE ATTACHMENTS, DOCUMENT EXTRACTION AND VISUAL QUESTION ANSWERING
## Architecture Specification & Security Blueprint

**Project:** HELIOXEN  
**Roadmap:** Phase 8 · Multimodal Input and Context  
**Step:** 23 of 48  
**Status:** Implemented & Validated  
**Date:** November 2, 2026

---

## 1. Executive Summary & Purpose

Step 23 of 48 introduces secure, client-controlled document attachment, local text extraction, and visual question answering (VQA) to HELIOXEN.

Prior to Step 23, HELIOXEN supported text-based multi-turn conversation (Steps 1–18), real-time voice sessions and wake-word detection (Steps 19–21), and user-consented still image capture (Step 22). Step 23 unifies local document reading and image comprehension into the existing conversation workflow under strict privacy and resource boundaries:

- **Local Extraction First:** All document parsing (`.txt`, `.md`, `.pdf`, `.docx`) is executed locally within bounded Electron main process workers/parsers. No cloud parsing or third-party document processing APIs are ever queried.
- **Strict Separation of Extraction and Submission:** Attaching or extracting a file NEVER automatically transmits its contents to an external provider. Provider transmission occurs only when the user explicitly clicks or triggers message submission.
- **Bounded Resource Envelopes:** Enforces max 10 MB per file, max 20 MB total payload across up to 5 attachments, 50 MB archive expansion limits, and 100,000 character extraction budgets with deterministic truncation markers.
- **Executable & Macro Immunity:** Embedded scripts, VBA macros (`word/vbaProject.bin`), active controls, shell scripts, and remote hyperlink fetchers are strictly ignored and never executed.
- **Provider-Verified Visual Question Answering:** Attached images and Step 22 snapshots are validated against model registry vision capabilities (`modelLevel.imageInput === 'supported'`) before sending to verified adapters (`@google/genai` inlineData and `openai` image_url).

---

## 2. Attachment Acquisition Methods & Lifecycle

### 2.1 Acquisition Methods
1. **System File Selection Dialog:** Invoked via `window.helioxen.documents.selectFiles({ multiple: true })` using Electron's native `dialog.showOpenDialog` with allowlisted extensions (`txt`, `md`, `markdown`, `pdf`, `docx`, `png`, `jpg`, `jpeg`, `webp`, `gif`).
2. **Drag-and-Drop Dropzone:** The conversation composer acts as a drag-and-drop target. Dragged files are validated against size and format bounds before staging.
3. **Capture Handoff:** Still image snapshots captured via Step 22's camera or screen workflows seamlessly integrate as image attachments.

### 2.2 Attachment State Machine

```
[User Selects/Drops File]
           │
           ▼
     [validating]
      /         \
     /           \
[validation_failed] [ready_for_extraction]
                         │
                         ▼
                    [extracting]
                     /        \
                    /          \
            [extracted]    [extraction_failed]
                 │
                 ▼
        [ready_for_submission]
                 │
                 ▼
            [submitting]
                 │
                 ▼
            [completed]
```

At any stage before submission, the user may remove an attachment or cancel processing, immediately aborting active operations and freeing memory.

---

## 3. Data Model & Extraction Contracts

### 3.1 Types & Structures (`src/shared/documents/types.ts`)

```typescript
export type DocumentFormat = 'txt' | 'md' | 'pdf' | 'docx' | 'image' | 'unknown'
export type AttachmentProcessingStatus = 
  | 'selected'
  | 'validating'
  | 'validation_failed'
  | 'ready_for_extraction'
  | 'extracting'
  | 'extracted'
  | 'ready_for_submission'
  | 'submitting'
  | 'extraction_failed'
  | 'cancelled'
  | 'removed'

export interface FileAttachment {
  id: string
  name: string
  path?: string
  size: number
  format: DocumentFormat
  mimeType: string
  status: AttachmentProcessingStatus
  extractedText?: string
  pageCount?: number
  warning?: string
  error?: string
  dataUrl?: string
  createdAt: number
}
```

### 3.2 Resource Limits (`DEFAULT_DOCUMENT_LIMITS`)
- **Max File Size:** 10 MB (10,485,760 bytes)
- **Max Aggregate Size:** 20 MB (20,971,520 bytes)
- **Max Attachments:** 5 files per message
- **Max Extracted Characters:** 100,000 characters per document
- **Max Uncompressed Archive Size (DOCX):** 50 MB
- **Max Archive Entries:** 500 entries

---

## 4. Extraction Architecture & Format Parsers

Local parsing is isolated in `src/main/documents/`:

### 4.1 Plain Text & Markdown (`PlainTextExtractor.ts`, `MarkdownExtractor.ts`)
- Decodes buffer safely as UTF-8 while stripping non-printable ASCII control characters.
- Normalizes CRLF and CR line endings to LF.
- Preserves code blocks, headings, tables, and formatting without executing any markup or HTML.
- Never downloads remote images or follows Markdown URLs.

### 4.2 Microsoft Word (`DocxExtractor.ts`)
- DOCX files are standard OpenXML ZIP packages.
- Reads `word/document.xml` using Node's native `zlib.inflateRawSync` without third-party binary dependencies.
- Defends against decompression bombs by checking uncompressed entry sizes against a 50 MB cumulative ceiling and 500 max entries.
- Defends against macro execution: skips and ignores `word/vbaProject.bin`.
- Extracts XML text tags (`<w:t>`, `<w:tab>`, `<w:p>`) into coherent paragraphs and lists.

### 4.3 PDF Documents (`PdfExtractor.ts`)
- Parses cross-reference tables and decompress FlateDecode content streams using Node's native `zlib.inflateSync`.
- Extracts text operators (`BT`, `ET`, `Tj`, `TJ`, `'`, `"`).
- Detects encrypted PDFs (`/Encrypt`) and returns an informative error.
- Detects scanned/raster-only PDFs (`/Subtype /Image` without text streams) and informs the user that OCR is required.
- Preserves page boundary markers (`--- Page X ---`).

---

## 5. Visual Question Answering Integration

### 5.1 Model Capability Verification
Before sending a request with an image attachment or capture snapshot:
- Checks `model.capabilities.modelLevel.imageInput === 'supported'`.
- Verified vision models include:
  - `gemini-3.8-flash` (Google GenAI)
  - `gpt-4o-mini` (OpenAI)
  - `gpt-4o` (OpenAI)
- If an unsupported model is active, HELIOXEN halts submission and displays an actionable UI error rather than silently failing or falling back to an unapproved provider.

### 5.2 Provider Adapters Handoff
- **Gemini Adapter:** Formats the base64 image into an `inlineData` part:
  ```typescript
  {
    inlineData: {
      mimeType: image.mimeType,
      data: base64Data
    }
  }
  ```
- **OpenAI Adapter:** Formats the image into an `image_url` content item:
  ```typescript
  {
    type: 'image_url',
    image_url: {
      url: `data:${image.mimeType};base64,${base64Data}`
    }
  }
  ```
- Extracted document text is formatted into structured `documentContext` prompts with clear delimitation, preserving provenance and preventing prompt injection from overriding system instructions.

---

## 6. IPC Security & Privacy Architecture

- **Context Isolation:** The renderer has zero direct access to Node.js `fs`, `child_process`, or arbitrary filesystem paths.
- **Typed Channels:**
  - `DOCUMENTS_SELECT_FILES`: Opens native dialog.
  - `DOCUMENTS_EXTRACT_FILE`: Performs local parsing.
  - `DOCUMENTS_VALIDATE_FILE`: Validates file size and format.
- **Capability Authorizer:** All IPC requests verify `documents:select`, `documents:extract`, and `documents:validate` security capabilities.
- **Zero Passive Scanning:** Files are read exclusively when explicitly selected or dropped by the user.

---

## 7. Automated Test Suite

- `tests/documents/documentContracts.test.ts` (6 tests): Validates Zod schemas, format detection, and limit enforcement.
- `tests/documents/documentExtractors.test.ts` (11 tests): Tests `.txt`, `.md`, `.pdf`, `.docx`, decompression bounds, macro safety, and scanned PDF detection.
- `tests/documents/visualQuestionAnswering.test.ts` (4 tests): Tests Gemini and OpenAI multimodal payload formatting and model registry capability checks.
- Total test suite: 35 test files, 207 tests passing, 0 regressions.

---

## 8. Verified Documentation References
- **Electron `dialog.showOpenDialog`**: https://www.electronjs.org/docs/latest/api/dialog (Electron v33.4.11)
- **Google GenAI Multimodal Input**: `@google/genai` SDK reference (InlineData part specification)
- **OpenAI Vision API**: Vision Guide for Chat Completions (image_url specification)
- **ECMA-376 (Office Open XML File Formats)**: Part 1 - Fundamentals and Markup Language Reference
- **Adobe PDF 32000-1:2008**: Document management - Portable document format
