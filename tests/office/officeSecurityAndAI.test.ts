import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ZipContainer } from '../../src/main/office/ZipContainer'
import { OfficeService } from '../../src/main/office/OfficeService'
import { DocxEngine } from '../../src/main/office/DocxEngine'
import { WordDocumentModel } from '../../src/shared/office/types'

describe('Office Security, Persistence & Quarantined AI', () => {
  let tempDir: string
  let officeService: OfficeService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-office-test-'))
    officeService = new OfficeService(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('ZipContainer Security Defenses', () => {
    it('builds and extracts valid zip archives correctly', () => {
      const files = [
        { path: 'hello.txt', data: Buffer.from('Hello Office Engine!') },
        { path: 'nested/dir/info.xml', data: Buffer.from('<root><status>safe</status></root>') }
      ]
      const archive = ZipContainer.buildZipArchive(files)
      expect(archive).toBeInstanceOf(Buffer)

      const extracted = ZipContainer.extractZipArchive(archive)
      expect(extracted.get('hello.txt')?.toString('utf-8')).toBe('Hello Office Engine!')
      expect(extracted.get('nested/dir/info.xml')?.toString('utf-8')).toBe('<root><status>safe</status></root>')
    })

    it('rejects path traversal attempts with ../ in entry filenames', () => {
      // Craft an archive with dangerous path traversal
      const dangerousFiles = [
        { path: '../etc/passwd', data: Buffer.from('malicious payload') }
      ]
      const archive = ZipContainer.buildZipArchive(dangerousFiles)

      expect(() => {
        ZipContainer.extractZipArchive(archive)
      }).toThrow(/path traversal/i)
    })

    it('enforces total decompression ceiling to prevent ZIP bomb denial of service', () => {
      // A small file that claims an excessively large uncompressed size (e.g. > 50MB limit)
      // We test the guardrail with a custom low ceiling
      const files = [
        { path: 'large.txt', data: Buffer.alloc(1024 * 1024, 0x41) } // 1MB buffer
      ]
      const archive = ZipContainer.buildZipArchive(files)

      // Test with maxTotalDecompressedBytes set to 500KB
      expect(() => {
        ZipContainer.extractZipArchive(archive, { maxTotalDecompressedBytes: 500 * 1024 })
      }).toThrow(/threshold/i)
    })
  })

  describe('Macro Stripping & OOXML Sanitization', () => {
    it('discards VBA project and macro streams during document parsing', async () => {
      // Construct a valid OOXML docx container that also includes a vbaProject.bin
      const validDoc: WordDocumentModel = {
        id: 'macro-test',
        metadata: {
          id: 'macro-test',
          title: 'Macro Document Test',
          type: 'document',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'draft',
          author: 'Tester'
        },
        blocks: [
          {
            id: 'b1',
            type: 'heading_1',
            textRuns: [{ text: 'Benign Document Content' }]
          }
        ]
      }
      const rawDocx = await DocxEngine.generateDocx(validDoc)
      const extracted = ZipContainer.extractZipArchive(rawDocx)

      // Inject simulated malicious VBA macro binary
      extracted.set('word/vbaProject.bin', Buffer.from('MALICIOUS_VBA_BYTECODE'))
      extracted.set('word/vbaData.xml', Buffer.from('<vbaData>autoexec</vbaData>'))

      const entriesArray = Array.from(extracted.entries()).map(([entryPath, data]) => ({ path: entryPath, data }))
      const tamperedArchive = ZipContainer.buildZipArchive(entriesArray)

      // Parse the tampered archive through DocxEngine
      const { model: parsedDoc } = await DocxEngine.parseDocx(tamperedArchive, 'clean_doc', 'Cleaned Document')

      expect(parsedDoc.metadata.title).toBe('Cleaned Document')
      expect(parsedDoc.blocks.length).toBeGreaterThanOrEqual(1)
      expect(parsedDoc.blocks[0].textRuns?.[0]?.text).toContain('Benign Document Content')

      // Ensure regenerating docx does NOT carry over any VBA bin files
      const reGeneratedDocx = await DocxEngine.generateDocx(parsedDoc)
      const reExtracted = ZipContainer.extractZipArchive(reGeneratedDocx)

      expect(reExtracted.get('word/vbaProject.bin')).toBeUndefined()
      expect(reExtracted.get('word/vbaData.xml')).toBeUndefined()
    })
  })

  describe('OfficeService Local Persistence & Template CRUD', () => {
    it('persists and retrieves documents atomically in office_documents_store.json', async () => {
      const doc: WordDocumentModel = {
        id: 'persisted-doc-1',
        metadata: {
          id: 'persisted-doc-1',
          title: 'Atomic Storage Test',
          type: 'document',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'draft',
          author: 'Unit Tester'
        },
        blocks: [
          { id: 'b1', type: 'paragraph', textRuns: [{ text: 'Stored safely on disk.' }] }
        ]
      }

      await officeService.saveDocument(doc)
      const list = await officeService.listDocuments()
      expect(list.length).toBe(1)
      expect(list[0].id).toBe('persisted-doc-1')
      expect(list[0].title).toBe('Atomic Storage Test')

      const retrieved = await officeService.getDocument('persisted-doc-1')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('persisted-doc-1')

      // Verify the disk file exists
      const storeFile = path.join(tempDir, 'office', 'office_documents_store.json')
      expect(fs.existsSync(storeFile)).toBe(true)

      // Delete document
      const deleted = await officeService.deleteDocument('persisted-doc-1')
      expect(deleted).toBe(true)
      const listAfterDelete = await officeService.listDocuments()
      expect(listAfterDelete.length).toBe(0)
    })

    it('instantiates documents cleanly from built-in templates', async () => {
      const templates = await officeService.listTemplates()
      expect(templates.length).toBeGreaterThanOrEqual(4)

      const instantiatedDoc = await officeService.createFromTemplate('executive_report', 'Custom Executive Brief')
      expect(instantiatedDoc.metadata.title).toBe('Custom Executive Brief')
      expect(instantiatedDoc.metadata.type).toBe('document')

      const list = await officeService.listDocuments()
      expect(list.some((d) => d.title === 'Custom Executive Brief')).toBe(true)
    })

    it('exports document to target path safely preserving metadata', async () => {
      const instantiated = await officeService.createFromTemplate('project_budget', 'My Operational Budget')
      const targetPath = path.join(tempDir, 'Exported_Budget.xlsx')

      const result = await officeService.exportDocument({
        documentId: instantiated.id,
        format: 'xlsx',
        targetFilePath: targetPath,
        promptSaveDialog: false
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(targetPath)).toBe(true)
      expect(result.byteSize).toBeGreaterThan(500)
    })
  })

  describe('Quarantined AI Productivity', () => {
    it('returns quarantined AI draft response without overwriting documents directly', async () => {
      const draft = await officeService.generateAiDraft({
        documentType: 'document',
        prompt: 'Draft an architectural brief for zero-trust microsegmentation'
      })

      expect(draft.documentType).toBe('document')
      expect(draft.proposedDocument).toBeDefined()
      expect(draft.proposedDocument?.blocks.length).toBeGreaterThanOrEqual(1)
      expect(draft.warnings).toContain('AI draft proposals must be reviewed and accepted by the user before applying.')

      // Confirm no document was silently auto-persisted
      const list = await officeService.listDocuments()
      expect(list.length).toBe(0)
    })

    it('returns formula suggestions without modifying spreadsheet state', async () => {
      const suggestion = await officeService.suggestFormulaAi(
        'Calculate total expense sum across rows 2 through 10 in column B',
        'Col A: Name, Col B: Amount'
      )

      expect(suggestion.formula).toBeDefined()
      expect(suggestion.formula.startsWith('=')).toBe(true)
      expect(suggestion.explanation).toBeDefined()
    })
  })
})
