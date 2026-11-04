/**
 * HELIOXEN AI — Step 37 Test Suite
 * Mermaid Diagram Validation, Strict Security Controls, Rendering, Local Persistence, and Safe Exports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  BUILTIN_MERMAID_TEMPLATES,
  DEFAULT_MERMAID_SECURITY_CONFIG,
  validateAndRenderMermaidDiagram,
  renderBoundedPngBuffer
} from '../../src/shared/visual'
import { inspectMediaFileBuffer } from '../../src/shared/media'
import { MediaLibraryService } from '../../src/main/media/MediaLibraryService'
import { VisualHubService } from '../../src/main/visual/VisualHubService'
import { ProviderService } from '../../src/main/ai/ProviderService'

describe('Step 37 — Mermaid Diagram Validation, Strict Security & Export Lifecycle', () => {
  let tempDir: string
  let mediaService: MediaLibraryService
  let visualHubService: VisualHubService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step37-mermaid-'))
    mediaService = new MediaLibraryService({ storageDir: tempDir })
    visualHubService = new VisualHubService({
      storageDir: tempDir,
      mediaLibraryService: mediaService,
      providerServiceGetter: () => ({} as unknown as ProviderService)
    })
  })

  afterEach(() => {
    visualHubService.dispose()
    mediaService.dispose()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors on Windows
    }
  })

  describe('1. Starter Templates & Supported Mermaid Diagram Types (Section 17.1)', () => {
    it('provides valid starter templates for all 7 supported Mermaid diagram types', () => {
      const expectedTypes = [
        'flowchart',
        'sequenceDiagram',
        'classDiagram',
        'stateDiagram',
        'erDiagram',
        'gantt',
        'mindmap'
      ]
      expect(BUILTIN_MERMAID_TEMPLATES.length).toBe(expectedTypes.length)

      for (const expectedType of expectedTypes) {
        const template = BUILTIN_MERMAID_TEMPLATES.find((t) => t.diagramType === expectedType)
        expect(template).toBeDefined()
        const result = validateAndRenderMermaidDiagram(template!.source)
        expect(result.valid).toBe(true)
        expect(result.diagramType).toBe(expectedType)
        expect(result.diagnostics).toHaveLength(0)
        expect(result.svgMarkup).toBeTruthy()
        expect(result.svgMarkup).toContain('<svg')
        expect(result.svgMarkup).toContain('</svg>')
      }
    })

    it('gracefully rejects empty or whitespace-only Mermaid input with structured diagnostic', () => {
      const result = validateAndRenderMermaidDiagram('   \n  \t  ')
      expect(result.valid).toBe(false)
      expect(result.diagnostics[0]?.code).toBe('EMPTY_SOURCE')
      expect(result.svgMarkup).toBeNull()
    })

    it('rejects unrecognized diagram declarations with line diagnostic while preserving source', () => {
      const badSource = 'pie title Pets\n  "Dogs" : 42\n  "Cats" : 58'
      const result = validateAndRenderMermaidDiagram(badSource)
      expect(result.valid).toBe(false)
      expect(result.diagramType).toBeNull()
      expect(result.diagnostics.some((d) => d.code === 'UNSUPPORTED_DIAGRAM_TYPE')).toBe(true)
    })

    it('detects syntax errors such as unclosed quotes in Mermaid definitions', () => {
      const brokenFlowchart = 'flowchart TD\n  A["Unclosed Node] --> B["Target"]'
      const result = validateAndRenderMermaidDiagram(brokenFlowchart)
      expect(result.valid).toBe(false)
      expect(result.diagnostics.some((d) => d.code === 'SYNTAX_ERROR')).toBe(true)
    })
  })

  describe('2. Mermaid Security & Complexity Bounds (Section 17.2)', () => {
    it('enforces strict security configuration defaults', () => {
      expect(DEFAULT_MERMAID_SECURITY_CONFIG.securityLevel).toBe('strict')
      expect(DEFAULT_MERMAID_SECURITY_CONFIG.startOnLoad).toBe(false)
      expect(DEFAULT_MERMAID_SECURITY_CONFIG.allowInitDirectiveOverrides).toBe(false)
      expect(DEFAULT_MERMAID_SECURITY_CONFIG.allowClickEvents).toBe(false)
      expect(DEFAULT_MERMAID_SECURITY_CONFIG.allowExternalLinks).toBe(false)
    })

    it('blocks %%{init: ...}%% directive overrides attempting to weaken securityLevel', () => {
      const maliciousInit = `%%{init: {'securityLevel': 'loose'}}%%\nflowchart TD\n  A --> B`
      const result = validateAndRenderMermaidDiagram(maliciousInit)
      expect(result.valid).toBe(false)
      expect(
        result.diagnostics.some((d) => d.code === 'PROHIBITED_DIRECTIVE_OVERRIDE')
      ).toBe(true)
      expect(result.svgMarkup).toBeNull()
    })

    it('blocks <script>, <iframe>, inline event handlers, and javascript: URIs', () => {
      const xssPayloads = [
        `flowchart TD\n  A["<script>alert(1)</script>"] --> B`,
        `flowchart TD\n  A["<img src=x onerror=alert(1)>"] --> B`,
        `flowchart TD\n  A["<iframe src='evil'></iframe>"] --> B`,
        `sequenceDiagram\n  Alice->>Bob: javascript:alert(document.cookie)`
      ]

      for (const payload of xssPayloads) {
        const result = validateAndRenderMermaidDiagram(payload)
        expect(result.valid).toBe(false)
        expect(result.diagnostics.some((d) => d.code === 'PROHIBITED_SCRIPT_OR_HTML')).toBe(true)
        expect(result.svgMarkup).toBeNull()
      }
    })

    it('blocks Mermaid click callbacks and external URL navigation links', () => {
      const clickCallbackSource = `flowchart TD\n  A["Node A"] --> B["Node B"]\n  click A call maliciousCallback()`
      const res1 = validateAndRenderMermaidDiagram(clickCallbackSource)
      expect(res1.valid).toBe(false)
      expect(res1.diagnostics.some((d) => d.code === 'PROHIBITED_CLICK_OR_LINK')).toBe(true)

      const externalUrlSource = `flowchart TD\n  A["Node A"] --> B["https://evil.example.com/phish"]`
      const res2 = validateAndRenderMermaidDiagram(externalUrlSource)
      expect(res2.valid).toBe(false)
      expect(res2.diagnostics.some((d) => d.code === 'PROHIBITED_CLICK_OR_LINK')).toBe(true)
    })

    it('enforces maxTextSize, maxNodes, and maxEdges complexity limits to prevent UI freeze', () => {
      const oversizedSource = 'flowchart TD\n' + '  A --> B\n'.repeat(7000)
      const sizeRes = validateAndRenderMermaidDiagram(oversizedSource)
      expect(sizeRes.valid).toBe(false)
      expect(sizeRes.diagnostics.some((d) => d.code === 'SOURCE_TOO_LARGE')).toBe(true)

      // Custom lower node limit test
      const manyNodesSource =
        'flowchart TD\n' +
        Array.from({ length: 12 }, (_, i) => `  N${i}["Node ${i}"] --> N${i + 1}["Node ${i + 1}"]`).join('\n')
      const nodeRes = validateAndRenderMermaidDiagram(manyNodesSource, {
        ...DEFAULT_MERMAID_SECURITY_CONFIG,
        maxNodes: 5
      })
      expect(nodeRes.valid).toBe(false)
      expect(nodeRes.diagnostics.some((d) => d.code === 'EXCESSIVE_NODE_COUNT')).toBe(true)
    })
  })

  describe('3. Diagram Persistence & Safe Exports (.mmd, .svg, .png, Media Gallery)', () => {
    it('saves, lists, updates, and deletes Mermaid diagram documents locally', () => {
      const source = `flowchart LR\n  Start["Input"] --> End["Output"]`
      const saved = visualHubService.saveDiagramDocument({
        title: 'Data Pipeline Diagram',
        description: 'Core ingestion pipeline',
        source,
        tags: ['pipeline', 'data']
      })

      expect(saved.id).toMatch(/^diag_/)
      expect(saved.diagramType).toBe('flowchart')
      expect(saved.title).toBe('Data Pipeline Diagram')

      const listed = visualHubService.listDiagramDocuments({ query: 'pipeline' })
      expect(listed).toHaveLength(1)
      expect(listed[0]?.id).toBe(saved.id)

      const updated = visualHubService.saveDiagramDocument({
        id: saved.id,
        title: 'Updated Pipeline Diagram',
        source,
        tags: ['pipeline', 'v2']
      })
      expect(updated.id).toBe(saved.id)
      expect(updated.title).toBe('Updated Pipeline Diagram')

      const del = visualHubService.deleteDiagramDocument({ id: saved.id })
      expect(del.deleted).toBe(true)
      expect(visualHubService.listDiagramDocuments({})).toHaveLength(0)
    })

    it('exports valid .mmd, .svg, and .png files and protects against accidental overwrite', () => {
      const source = `sequenceDiagram\n  Client->>Server: Request\n  Server-->>Client: Response`
      const targetMmd = path.join(tempDir, 'Auth-Sequence.mmd')

      const mmdExport = visualHubService.exportDiagram({
        source,
        format: 'mmd',
        suggestedFileName: 'Auth Sequence',
        targetFilePath: targetMmd,
        overwriteExisting: false
      })
      expect(mmdExport.exported).toBe(true)
      expect(mmdExport.filePath).toBe(targetMmd)
      expect(fs.existsSync(targetMmd)).toBe(true)
      expect(fs.readFileSync(targetMmd, 'utf-8')).toContain('sequenceDiagram')

      // Exporting again to the same targetFilePath with overwriteExisting: false returns FILE_EXISTS_CONFLICT
      const mmdConflict = visualHubService.exportDiagram({
        source,
        format: 'mmd',
        targetFilePath: targetMmd,
        overwriteExisting: false
      })
      expect(mmdConflict.exported).toBe(false)
      expect(mmdConflict.errorCode).toBe('FILE_EXISTS_CONFLICT')

      const svgExport = visualHubService.exportDiagram({
        source,
        format: 'svg',
        suggestedFileName: 'Auth Sequence'
      })
      expect(svgExport.exported).toBe(true)
      expect(svgExport.filePath).toBeTruthy()
      const svgContent = fs.readFileSync(svgExport.filePath!, 'utf-8')
      expect(svgContent).toContain('<svg')
      expect(svgContent).not.toContain('<script')

      const pngExport = visualHubService.exportDiagram({
        source,
        format: 'png',
        suggestedFileName: 'Auth Sequence'
      })
      expect(pngExport.exported).toBe(true)
      expect(pngExport.filePath).toBeTruthy()
      const pngBytes = fs.readFileSync(pngExport.filePath!)
      const inspection = inspectMediaFileBuffer( path.basename(pngExport.filePath!), pngBytes)
      expect(inspection.valid).toBe(true)
      expect(inspection.mimeType).toBe('image/png')
    })

    it('blocks path traversal attempts in diagram export destination paths', () => {
      const source = `flowchart TD\n  A --> B`
      const res = visualHubService.exportDiagram({
        source,
        format: 'svg',
        targetFilePath: `${tempDir}/../../etc/evil.svg`,
        overwriteExisting: true
      })
      expect(res.exported).toBe(false)
      expect(res.errorCode).toBe('INVALID_EXPORT_PATH')
    })

    it('saves a rendered Mermaid diagram PNG directly into the Step 36 Media Gallery with provenance', async () => {
      const source = `flowchart TD\n  A["VisualHub"] --> B["Media Gallery"]`
      const asset = await visualHubService.saveDiagramPngToGallery({
        displayName: 'VisualHub Architecture PNG',
        source,
        tags: ['architecture', 'diagram']
      })

      expect(asset.id).toMatch(/^media_/)
      expect(asset.sourceType).toBe('exported_diagram')
      expect(asset.mimeType).toBe('image/png')
      expect(asset.tags).toContain('diagram')

      const galleryList = mediaService.listAssets({})
      expect(galleryList.totalCount).toBe(1)
      expect(galleryList.assets[0]?.id).toBe(asset.id)
    })

    it('produces valid PNG binary headers and dimensions from renderBoundedPngBuffer', () => {
      const buf = renderBoundedPngBuffer(64, 48)
      const check = inspectMediaFileBuffer('test.png', buf)
      expect(check.valid).toBe(true)
      expect(check.width).toBe(64)
      expect(check.height).toBe(48)
    })
  })
})
