import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText,
  Table,
  Presentation,
  Plus,
  Trash2,
  Download,
  Upload,
  Sparkles,
  RefreshCw,
  Save,
  FileSpreadsheet,
  Layers,
  Copy,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  FileCode,
  ShieldCheck,
  AlertCircle,
  Eye,
  FolderOpen,
  Edit3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  HelpCircle,
  FileCheck
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input } from '../ui/Input'
import {
  OfficeDocumentMetadata,
  WordDocumentModel,
  SpreadsheetWorkbookModel,
  PresentationModel,
  OfficeTemplate,
  DocumentBlock,
  DocumentBlockType,
  DocumentTextRun,
  SpreadsheetCell,
  SpreadsheetWorksheet,
  PresentationSlide,
  SlideElement,
  SlideLayoutType,
  PresentationThemeId,
  OfficeDocumentType,
  OfficeAiDraftResponse
} from '../../../../shared/office/types'
import { columnIndexToLetter, columnLetterToIndex } from '../../../../shared/office/contracts'

type OfficeStudioTab = 'document' | 'spreadsheet' | 'presentation' | 'templates' | 'library'

export const OfficeStudioPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OfficeStudioTab>('document')
  const [documentsList, setDocumentsList] = useState<OfficeDocumentMetadata[]>([])
  const [templatesList, setTemplatesList] = useState<OfficeTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // --------------------------------------------------------------------------
  // Document Studio State
  // --------------------------------------------------------------------------
  const [activeWordDoc, setActiveWordDoc] = useState<WordDocumentModel>({
    id: 'doc-' + Date.now(),
    metadata: {
      id: 'doc-' + Date.now(),
      title: 'Untitled Executive Document',
      type: 'document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      author: 'Helioxen User'
    },
    blocks: [
      {
        id: 'b1',
        type: 'heading_1',
        textRuns: [{ text: 'Project Strategic Overview', bold: true }]
      },
      {
        id: 'b2',
        type: 'paragraph',
        textRuns: [
          { text: 'This document provides a cohesive architectural and operational briefing prepared within the ' },
          { text: 'HELIOXEN Office Studio', bold: true },
          { text: '. It is fully local-first, safe from malicious macro payloads, and compatible with Microsoft Word.' }
        ]
      },
      {
        id: 'b3',
        type: 'heading_2',
        textRuns: [{ text: 'Key Operational Objectives' }]
      },
      {
        id: 'b4',
        type: 'bullet_item',
        textRuns: [{ text: 'Ensure strict confidentiality and zero unvetted cloud telemetry.' }]
      },
      {
        id: 'b5',
        type: 'bullet_item',
        textRuns: [{ text: 'Produce standard Office Open XML compliant (.docx) artifacts directly from memory.' }]
      }
    ]
  })

  // Document AI Drafting & Rewrite State
  const [docAiPrompt, setDocAiPrompt] = useState<string>('')
  const [isDocAiGenerating, setIsDocAiGenerating] = useState<boolean>(false)
  const [docAiDraftProposal, setDocAiDraftProposal] = useState<WordDocumentModel | null>(null)
  const [rewriteSelectedBlockId, setRewriteSelectedBlockId] = useState<string>('')
  const [rewriteInstruction, setRewriteInstruction] = useState<string>('Make more formal and concise')
  const [isRewriting, setIsRewriting] = useState<boolean>(false)
  const [rewriteProposal, setRewriteProposal] = useState<{ blockId: string; newText: string } | null>(null)

  // --------------------------------------------------------------------------
  // Spreadsheet Studio State
  // --------------------------------------------------------------------------
  const [activeWorkbook, setActiveWorkbook] = useState<SpreadsheetWorkbookModel>({
    id: 'wb-' + Date.now(),
    metadata: {
      id: 'wb-' + Date.now(),
      title: 'Operational Budget & Forecast',
      type: 'spreadsheet',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      author: 'Helioxen User'
    },
    sheets: [
      {
        id: 'sheet-1',
        name: 'Q1 Forecast',
        rowCount: 12,
        columnCount: 6,
        cells: {
          '0:0': { value: 'Category', valueType: 'string', bold: true },
          '0:1': { value: 'Jan ($)', valueType: 'string', bold: true },
          '0:2': { value: 'Feb ($)', valueType: 'string', bold: true },
          '0:3': { value: 'Mar ($)', valueType: 'string', bold: true },
          '0:4': { value: 'Q1 Total ($)', valueType: 'string', bold: true },
          '1:0': { value: 'Cloud Compute', valueType: 'string' },
          '1:1': { value: 1200, valueType: 'number' },
          '1:2': { value: 1400, valueType: 'number' },
          '1:3': { value: 1350, valueType: 'number' },
          '1:4': { value: 3950, valueType: 'formula', formula: '=SUM(B2:D2)' },
          '2:0': { value: 'API Integrations', valueType: 'string' },
          '2:1': { value: 850, valueType: 'number' },
          '2:2': { value: 920, valueType: 'number' },
          '2:3': { value: 910, valueType: 'number' },
          '2:4': { value: 2680, valueType: 'formula', formula: '=SUM(B3:D3)' },
          '3:0': { value: 'Total Operating', valueType: 'string', bold: true },
          '3:1': { value: 2050, valueType: 'formula', formula: '=SUM(B2:B3)', bold: true },
          '3:2': { value: 2320, valueType: 'formula', formula: '=SUM(C2:C3)', bold: true },
          '3:3': { value: 2260, valueType: 'formula', formula: '=SUM(D2:D3)', bold: true },
          '3:4': { value: 6630, valueType: 'formula', formula: '=SUM(E2:E3)', bold: true }
        }
      }
    ],
    activeSheetId: 'sheet-1'
  })

  const [selectedCellCoord, setSelectedCellCoord] = useState<{ row: number; col: number }>({ row: 0, col: 0 })
  const [cellFormulaInput, setCellFormulaInput] = useState<string>('Category')
  const [aiFormulaPrompt, setAiFormulaPrompt] = useState<string>('')
  const [isFormulaGenerating, setIsFormulaGenerating] = useState<boolean>(false)
  const [aiFormulaSuggestion, setAiFormulaSuggestion] = useState<{ formula: string; explanation: string } | null>(null)

  // --------------------------------------------------------------------------
  // Presentation Studio State
  // --------------------------------------------------------------------------
  const [activeDeck, setActiveDeck] = useState<PresentationModel>({
    id: 'deck-' + Date.now(),
    metadata: {
      id: 'deck-' + Date.now(),
      title: 'Executive Pitch Deck',
      type: 'presentation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      author: 'Helioxen User'
    },
    theme: 'cosmic_cyan',
    slides: [
      {
        id: 'slide-1',
        title: 'HELIOXEN AI Platform',
        layout: 'title_slide',
        elements: [
          { id: 'el-1', type: 'title', text: 'HELIOXEN AI Platform' },
          { id: 'el-2', type: 'subtitle', text: 'Local-First Autonomous Executive Architecture' }
        ],
        speakerNotes: 'Welcome everyone. Today we present the local-first intelligence architecture.'
      },
      {
        id: 'slide-2',
        title: 'Core Architectural Pillars',
        layout: 'title_and_content',
        elements: [
          { id: 'el-3', type: 'title', text: 'Core Architectural Pillars' },
          {
            id: 'el-4',
            type: 'bullet_list',
            bulletPoints: [
              'Zero-dependency OOXML generation for Word, Spreadsheets & Slides',
              'Strict CSV formula injection defense protecting downstream applications',
              'Quarantined AI drafting ensuring human oversight on all output',
              'Comprehensive cross-platform local file compatibility'
            ]
          }
        ],
        speakerNotes: 'Focus on privacy, security, and pure native standards compliance.'
      },
      {
        id: 'slide-3',
        title: 'Strategic Roadmap Delivery',
        layout: 'card_grid',
        elements: [
          { id: 'el-5', type: 'title', text: 'Strategic Roadmap Delivery' },
          { id: 'el-6', type: 'card', text: 'Phase 12: Memory & Productivity', color: 'cyan' },
          { id: 'el-7', type: 'card', text: 'Phase 13: Visual Intelligence & Globe', color: 'emerald' },
          { id: 'el-8', type: 'card', text: 'Phase 14: Dynamic Agent Town', color: 'amber' },
          { id: 'el-9', type: 'card', text: 'Phase 15: Office Document Studio', color: 'blue' }
        ]
      }
    ]
  })

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0)
  const [deckAiPrompt, setDeckAiPrompt] = useState<string>('')
  const [isDeckAiGenerating, setIsDeckAiGenerating] = useState<boolean>(false)
  const [deckAiProposal, setDeckAiProposal] = useState<PresentationModel | null>(null)

  // --------------------------------------------------------------------------
  // Data Fetching & Sync
  // --------------------------------------------------------------------------
  const loadDocuments = useCallback(async () => {
    try {
      if (window.helioxen?.office) {
        const docs = await window.helioxen.office.listDocuments()
        setDocumentsList(docs)
      }
    } catch (err: any) {
      console.error('[OfficeStudioPanel] Failed to list documents:', err)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    try {
      if (window.helioxen?.office) {
        const tmpls = await window.helioxen.office.listTemplates()
        setTemplatesList(tmpls)
      }
    } catch (err: any) {
      console.error('[OfficeStudioPanel] Failed to list templates:', err)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
    loadTemplates()
  }, [loadDocuments, loadTemplates])

  const notifySuccess = (msg: string) => {
    setStatusMessage(msg)
    setErrorMessage(null)
    setTimeout(() => setStatusMessage(null), 4000)
  }

  const notifyError = (msg: string) => {
    setErrorMessage(msg)
    setStatusMessage(null)
    setTimeout(() => setErrorMessage(null), 6000)
  }

  // --------------------------------------------------------------------------
  // Document Studio Handlers
  // --------------------------------------------------------------------------
  const handleSaveWordDoc = async () => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        const updatedDoc = {
          ...activeWordDoc,
          metadata: {
            ...activeWordDoc.metadata,
            updatedAt: Date.now(),
            status: 'saved' as const
          }
        }
        const savedMeta = await window.helioxen.office.saveDocument(updatedDoc)
        setActiveWordDoc(updatedDoc)
        await loadDocuments()
        notifySuccess(`Document "${savedMeta.title}" safely saved to local vault.`)
      }
    } catch (err: any) {
      notifyError(`Failed to save document: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportWordDoc = async (format: 'docx' | 'md' | 'txt') => {
    try {
      setLoading(true)
      // Save working copy first
      if (window.helioxen?.office) {
        await window.helioxen.office.saveDocument(activeWordDoc)
        const res = await window.helioxen.office.exportDocument({
          documentId: activeWordDoc.id,
          format,
          promptSaveDialog: true,
          suggestedFileName: `${activeWordDoc.metadata.title.replace(/\s+/g, '_')}.${format}`
        })
        if (res.success) {
          notifySuccess(`Exported successfully to ${res.filePath} (${res.byteSize} bytes)`)
        } else {
          notifyError('Export was cancelled or encountered an error.')
        }
      }
    } catch (err: any) {
      notifyError(`Export failed: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBlock = (type: DocumentBlockType) => {
    const newBlock: DocumentBlock = {
      id: 'b-' + Date.now(),
      type,
      textRuns: [{ text: type === 'heading_1' ? 'New Heading' : 'New text block...' }]
    }
    setActiveWordDoc({
      ...activeWordDoc,
      blocks: [...activeWordDoc.blocks, newBlock]
    })
  }

  const handleUpdateBlockText = (blockId: string, newText: string) => {
    setActiveWordDoc({
      ...activeWordDoc,
      blocks: activeWordDoc.blocks.map((b) => {
        if (b.id !== blockId) return b
        return {
          ...b,
          textRuns: [{ ...(b.textRuns?.[0] || {}), text: newText }]
        }
      })
    })
  }

  const handleDeleteBlock = (blockId: string) => {
    setActiveWordDoc({
      ...activeWordDoc,
      blocks: activeWordDoc.blocks.filter((b) => b.id !== blockId)
    })
  }

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= activeWordDoc.blocks.length) return
    const newBlocks = [...activeWordDoc.blocks]
    const temp = newBlocks[index]
    newBlocks[index] = newBlocks[targetIndex]
    newBlocks[targetIndex] = temp
    setActiveWordDoc({ ...activeWordDoc, blocks: newBlocks })
  }

  const handleToggleBlockFormatting = (blockId: string, key: 'bold' | 'italic' | 'underline') => {
    setActiveWordDoc({
      ...activeWordDoc,
      blocks: activeWordDoc.blocks.map((b) => {
        if (b.id !== blockId) return b
        const firstRun: DocumentTextRun = b.textRuns?.[0] || { text: '' }
        return {
          ...b,
          textRuns: [{ ...firstRun, [key]: !firstRun[key] }]
        }
      })
    })
  }

  const handleGenerateDocAiDraft = async () => {
    if (!docAiPrompt.trim()) return
    try {
      setIsDocAiGenerating(true)
      if (window.helioxen?.office) {
        const res: OfficeAiDraftResponse = await window.helioxen.office.generateAiDraft({
          documentType: 'document',
          prompt: docAiPrompt
        })
        if (res.proposedDocument) {
          setDocAiDraftProposal(res.proposedDocument)
          notifySuccess(`AI proposal generated: "${res.title}". Review before accepting.`)
        }
      }
    } catch (err: any) {
      notifyError(`AI drafting failed: ${err.message || String(err)}`)
    } finally {
      setIsDocAiGenerating(false)
    }
  }

  const handleAcceptDocAiDraft = () => {
    if (docAiDraftProposal) {
      setActiveWordDoc(docAiDraftProposal)
      setDocAiDraftProposal(null)
      setDocAiPrompt('')
      notifySuccess('AI document draft accepted and loaded into the editor.')
    }
  }

  const handleRequestRewrite = async () => {
    const targetBlock = activeWordDoc.blocks.find((b) => b.id === rewriteSelectedBlockId)
    if (!targetBlock) return
    const originalText = targetBlock.textRuns?.map((r) => r.text).join('') || ''
    try {
      setIsRewriting(true)
      if (window.helioxen?.office) {
        const rewritten = await window.helioxen.office.rewriteTextAi(originalText, rewriteInstruction)
        setRewriteProposal({ blockId: targetBlock.id, newText: rewritten })
        notifySuccess('Rewrite suggestion generated. Review below.')
      }
    } catch (err: any) {
      notifyError(`Rewrite failed: ${err.message || String(err)}`)
    } finally {
      setIsRewriting(false)
    }
  }

  const handleApplyRewrite = () => {
    if (rewriteProposal) {
      handleUpdateBlockText(rewriteProposal.blockId, rewriteProposal.newText)
      setRewriteProposal(null)
      notifySuccess('Rewrite suggestion applied to block.')
    }
  }

  // --------------------------------------------------------------------------
  // Spreadsheet Studio Handlers
  // --------------------------------------------------------------------------
  const currentSheet = useMemo(() => {
    return activeWorkbook.sheets.find((s) => s.id === activeWorkbook.activeSheetId) || activeWorkbook.sheets[0]
  }, [activeWorkbook])

  const handleSelectCell = (r: number, c: number) => {
    setSelectedCellCoord({ row: r, col: c })
    const key = `${r}:${c}`
    const cell = currentSheet?.cells[key]
    setCellFormulaInput(cell ? (cell.formula || String(cell.value ?? '')) : '')
  }

  const handleCellFormulaChange = (val: string) => {
    setCellFormulaInput(val)
    if (!currentSheet) return
    const key = `${selectedCellCoord.row}:${selectedCellCoord.col}`
    const isFormula = val.startsWith('=')
    const numeric = !isFormula && !isNaN(Number(val)) && val.trim() !== '' ? Number(val) : null

    const updatedCell: SpreadsheetCell = {
      value: isFormula ? val : numeric !== null ? numeric : val,
      valueType: isFormula ? 'formula' : numeric !== null ? 'number' : val ? 'string' : 'empty',
      formula: isFormula ? val : undefined
    }

    const updatedSheets = activeWorkbook.sheets.map((sheet) => {
      if (sheet.id !== currentSheet.id) return sheet
      return {
        ...sheet,
        cells: {
          ...sheet.cells,
          [key]: updatedCell
        }
      }
    })

    setActiveWorkbook({
      ...activeWorkbook,
      sheets: updatedSheets
    })
  }

  const handleSaveWorkbook = async () => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        const updated = {
          ...activeWorkbook,
          metadata: {
            ...activeWorkbook.metadata,
            updatedAt: Date.now(),
            status: 'saved' as const
          }
        }
        const savedMeta = await window.helioxen.office.saveDocument(updated)
        setActiveWorkbook(updated)
        await loadDocuments()
        notifySuccess(`Spreadsheet "${savedMeta.title}" safely saved.`)
      }
    } catch (err: any) {
      notifyError(`Failed to save spreadsheet: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportSpreadsheet = async (format: 'xlsx' | 'csv') => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        await window.helioxen.office.saveDocument(activeWorkbook)
        const res = await window.helioxen.office.exportDocument({
          documentId: activeWorkbook.id,
          format,
          promptSaveDialog: true,
          suggestedFileName: `${activeWorkbook.metadata.title.replace(/\s+/g, '_')}.${format}`,
          sanitizeCsvFormulas: true
        })
        if (res.success) {
          notifySuccess(
            `Exported ${format.toUpperCase()} to ${res.filePath} (${res.byteSize} bytes). ` +
              (res.sanitizedCsvEscapesCount ? `Protected ${res.sanitizedCsvEscapesCount} cells against CSV formula injection.` : '')
          )
        }
      }
    } catch (err: any) {
      notifyError(`Export failed: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSpreadsheetRow = () => {
    if (!currentSheet) return
    const updatedSheets = activeWorkbook.sheets.map((sheet) => {
      if (sheet.id !== currentSheet.id) return sheet
      return {
        ...sheet,
        rowCount: sheet.rowCount + 1
      }
    })
    setActiveWorkbook({ ...activeWorkbook, sheets: updatedSheets })
  }

  const handleAddSpreadsheetCol = () => {
    if (!currentSheet) return
    const updatedSheets = activeWorkbook.sheets.map((sheet) => {
      if (sheet.id !== currentSheet.id) return sheet
      return {
        ...sheet,
        columnCount: sheet.columnCount + 1
      }
    })
    setActiveWorkbook({ ...activeWorkbook, sheets: updatedSheets })
  }

  const handleSuggestFormulaAi = async () => {
    if (!aiFormulaPrompt.trim()) return
    try {
      setIsFormulaGenerating(true)
      if (window.helioxen?.office) {
        const sampleSnippet = `Active cell: ${columnIndexToLetter(selectedCellCoord.col)}${selectedCellCoord.row + 1}. Current Sheet: ${currentSheet.name}`
        const res = await window.helioxen.office.suggestFormulaAi(aiFormulaPrompt, sampleSnippet)
        setAiFormulaSuggestion(res)
        notifySuccess(`Formula suggested: ${res.formula}`)
      }
    } catch (err: any) {
      notifyError(`Formula suggestion error: ${err.message || String(err)}`)
    } finally {
      setIsFormulaGenerating(false)
    }
  }

  const handleApplyAiFormula = () => {
    if (aiFormulaSuggestion) {
      handleCellFormulaChange(aiFormulaSuggestion.formula)
      setAiFormulaSuggestion(null)
      setAiFormulaPrompt('')
      notifySuccess(`Inserted formula ${aiFormulaSuggestion.formula} into selected cell.`)
    }
  }

  // --------------------------------------------------------------------------
  // Presentation Studio Handlers
  // --------------------------------------------------------------------------
  const currentSlide = activeDeck.slides[activeSlideIndex] || activeDeck.slides[0]

  const handleSaveDeck = async () => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        const updated = {
          ...activeDeck,
          metadata: {
            ...activeDeck.metadata,
            updatedAt: Date.now(),
            status: 'saved' as const
          }
        }
        const savedMeta = await window.helioxen.office.saveDocument(updated)
        setActiveDeck(updated)
        await loadDocuments()
        notifySuccess(`Presentation deck "${savedMeta.title}" saved.`)
      }
    } catch (err: any) {
      notifyError(`Save failed: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportDeck = async () => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        await window.helioxen.office.saveDocument(activeDeck)
        const res = await window.helioxen.office.exportDocument({
          documentId: activeDeck.id,
          format: 'pptx',
          promptSaveDialog: true,
          suggestedFileName: `${activeDeck.metadata.title.replace(/\s+/g, '_')}.pptx`
        })
        if (res.success) {
          notifySuccess(`Exported presentation PPTX to ${res.filePath} (${res.byteSize} bytes)`)
        }
      }
    } catch (err: any) {
      notifyError(`Export failed: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSlide = () => {
    const newSlide: PresentationSlide = {
      id: 'slide-' + Date.now(),
      title: 'New Slide Topic',
      layout: 'title_and_content',
      elements: [
        { id: 'el-title', type: 'title', text: 'New Slide Topic' },
        { id: 'el-bullets', type: 'bullet_list', bulletPoints: ['Key takeaway point 1', 'Strategic observation 2'] }
      ]
    }
    setActiveDeck({
      ...activeDeck,
      slides: [...activeDeck.slides, newSlide]
    })
    setActiveSlideIndex(activeDeck.slides.length)
  }

  const handleDeleteSlide = (idx: number) => {
    if (activeDeck.slides.length <= 1) {
      notifyError('A presentation must have at least one slide.')
      return
    }
    const newSlides = activeDeck.slides.filter((_, i) => i !== idx)
    setActiveDeck({ ...activeDeck, slides: newSlides })
    setActiveSlideIndex(Math.max(0, idx - 1))
  }

  const handleMoveSlide = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= activeDeck.slides.length) return
    const newSlides = [...activeDeck.slides]
    const temp = newSlides[idx]
    newSlides[idx] = newSlides[targetIdx]
    newSlides[targetIdx] = temp
    setActiveDeck({ ...activeDeck, slides: newSlides })
    setActiveSlideIndex(targetIdx)
  }

  const handleUpdateSlideTitle = (newTitle: string) => {
    if (!currentSlide) return
    const updatedSlides = activeDeck.slides.map((s, idx) => {
      if (idx !== activeSlideIndex) return s
      return {
        ...s,
        title: newTitle,
        elements: s.elements.map((el) => (el.type === 'title' ? { ...el, text: newTitle } : el))
      }
    })
    setActiveDeck({ ...activeDeck, slides: updatedSlides })
  }

  const handleUpdateSlideBullets = (bulletIdx: number, newText: string) => {
    if (!currentSlide) return
    const updatedSlides = activeDeck.slides.map((s, idx) => {
      if (idx !== activeSlideIndex) return s
      return {
        ...s,
        elements: s.elements.map((el) => {
          if (el.type !== 'bullet_list' || !el.bulletPoints) return el
          const newBullets = [...el.bulletPoints]
          newBullets[bulletIdx] = newText
          return { ...el, bulletPoints: newBullets }
        })
      }
    })
    setActiveDeck({ ...activeDeck, slides: updatedSlides })
  }

  const handleAddSlideBullet = () => {
    if (!currentSlide) return
    const updatedSlides = activeDeck.slides.map((s, idx) => {
      if (idx !== activeSlideIndex) return s
      let foundList = false
      const newElements = s.elements.map((el) => {
        if (el.type === 'bullet_list') {
          foundList = true
          return {
            ...el,
            bulletPoints: [...(el.bulletPoints || []), 'New key insight point']
          }
        }
        return el
      })
      if (!foundList) {
        newElements.push({
          id: 'el-bullets',
          type: 'bullet_list',
          bulletPoints: ['New key insight point']
        })
      }
      return { ...s, elements: newElements }
    })
    setActiveDeck({ ...activeDeck, slides: updatedSlides })
  }

  const handleGenerateDeckAiDraft = async () => {
    if (!deckAiPrompt.trim()) return
    try {
      setIsDeckAiGenerating(true)
      if (window.helioxen?.office) {
        const res: OfficeAiDraftResponse = await window.helioxen.office.generateAiDraft({
          documentType: 'presentation',
          prompt: deckAiPrompt
        })
        if (res.proposedPresentation) {
          setDeckAiProposal(res.proposedPresentation)
          notifySuccess(`AI pitch deck proposal generated: "${res.title}". Review before applying.`)
        }
      }
    } catch (err: any) {
      notifyError(`Presentation AI drafting failed: ${err.message || String(err)}`)
    } finally {
      setIsDeckAiGenerating(false)
    }
  }

  const handleAcceptDeckAiDraft = () => {
    if (deckAiProposal) {
      setActiveDeck(deckAiProposal)
      setDeckAiProposal(null)
      setDeckAiPrompt('')
      setActiveSlideIndex(0)
      notifySuccess('AI slide deck accepted and applied to workspace.')
    }
  }

  // --------------------------------------------------------------------------
  // Templates & Document Library Handlers
  // --------------------------------------------------------------------------
  const handleInstantiateTemplate = async (templateId: string) => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        const newDoc = await window.helioxen.office.createFromTemplate(templateId)
        if (newDoc.metadata.type === 'document') {
          setActiveWordDoc(newDoc as WordDocumentModel)
          setActiveTab('document')
        } else if (newDoc.metadata.type === 'spreadsheet') {
          setActiveWorkbook(newDoc as SpreadsheetWorkbookModel)
          setActiveTab('spreadsheet')
        } else if (newDoc.metadata.type === 'presentation') {
          setActiveDeck(newDoc as PresentationModel)
          setActiveTab('presentation')
        }
        await loadDocuments()
        notifySuccess(`Instantiated template "${newDoc.metadata.title}".`)
      }
    } catch (err: any) {
      notifyError(`Template instantiation error: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleImportDocument = async () => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        const res = await window.helioxen.office.importDocument()
        if (res.success) {
          if (res.documentType === 'document' && res.document) {
            setActiveWordDoc(res.document)
            setActiveTab('document')
          } else if (res.documentType === 'spreadsheet' && res.workbook) {
            setActiveWorkbook(res.workbook)
            setActiveTab('spreadsheet')
          } else if (res.documentType === 'presentation' && res.presentation) {
            setActiveDeck(res.presentation)
            setActiveTab('presentation')
          }
          await loadDocuments()
          notifySuccess(`Imported document "${res.title}" cleanly without macro execution.`)
        }
      }
    } catch (err: any) {
      notifyError(`Import failed: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenExistingDoc = async (meta: OfficeDocumentMetadata) => {
    try {
      setLoading(true)
      if (window.helioxen?.office) {
        const doc = await window.helioxen.office.getDocument(meta.id)
        if (!doc) {
          notifyError('Could not find document payload in local store.')
          return
        }
        if (meta.type === 'document') {
          setActiveWordDoc(doc as WordDocumentModel)
          setActiveTab('document')
        } else if (meta.type === 'spreadsheet') {
          setActiveWorkbook(doc as SpreadsheetWorkbookModel)
          setActiveTab('spreadsheet')
        } else if (meta.type === 'presentation') {
          setActiveDeck(doc as PresentationModel)
          setActiveTab('presentation')
        }
        notifySuccess(`Loaded "${meta.title}".`)
      }
    } catch (err: any) {
      notifyError(`Open error: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExistingDoc = async (docId: string, title: string) => {
    try {
      if (window.helioxen?.office) {
        await window.helioxen.office.deleteDocument(docId)
        await loadDocuments()
        notifySuccess(`Deleted document "${title}".`)
      }
    } catch (err: any) {
      notifyError(`Delete failed: ${err.message || String(err)}`)
    }
  }

  // Theme color styling helper for slide decks
  const getThemePalette = (theme: PresentationThemeId) => {
    switch (theme) {
      case 'slate_minimal':
        return {
          bg: 'bg-slate-900 border-slate-700 text-slate-100',
          accent: 'text-slate-300',
          card: 'bg-slate-800/80 border-slate-700'
        }
      case 'emerald_executive':
        return {
          bg: 'bg-[#062016] border-[#0c402c] text-emerald-100',
          accent: 'text-emerald-400',
          card: 'bg-[#0a2e20]/90 border-emerald-800/60'
        }
      case 'amber_warmth':
        return {
          bg: 'bg-[#221606] border-[#472e0d] text-amber-100',
          accent: 'text-amber-400',
          card: 'bg-[#33200a]/90 border-amber-800/60'
        }
      case 'cosmic_cyan':
      default:
        return {
          bg: 'bg-hx-space border-hx-cyan/30 text-hx-text-primary',
          accent: 'text-hx-cyan',
          card: 'bg-hx-panel/80 border-hx-border-glow'
        }
    }
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Status & Alerts Bar */}
      {statusMessage && (
        <div className="p-3 bg-hx-cyan/10 border border-hx-cyan/40 rounded-lg flex items-center justify-between text-hx-cyan text-xs font-mono animate-hx-fade-in">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {statusMessage}
          </span>
          <button onClick={() => setStatusMessage(null)} className="text-hx-cyan hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg flex items-center justify-between text-red-200 text-xs font-mono animate-hx-fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            {errorMessage}
          </span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Studio Header & Tab Navigation */}
      <Card variant="panel" border="subtle" padding="sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-hx-panel border border-hx-border-panel text-hx-cyan shadow-hx-glow-cyan-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-display font-semibold text-hx-text-primary tracking-wide">
                  Office Document Studio
                </h1>
                <Badge variant="nominal" size="sm">
                  Step 43
                </Badge>
                <Badge variant="neutral" size="sm">
                  OOXML Native
                </Badge>
              </div>
              <p className="text-[11px] text-hx-text-secondary">
                Local-first documents, spreadsheets, presentations, and quarantined AI productivity.
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center flex-wrap gap-1 bg-hx-space/60 p-1 rounded-lg border border-hx-border-panel text-xs">
            <button
              onClick={() => setActiveTab('document')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'document' ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40' : 'text-hx-text-secondary hover:text-hx-text-primary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Document Studio
            </button>
            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'spreadsheet' ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40' : 'text-hx-text-secondary hover:text-hx-text-primary'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Spreadsheet Studio
            </button>
            <button
              onClick={() => setActiveTab('presentation')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'presentation' ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40' : 'text-hx-text-secondary hover:text-hx-text-primary'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              Presentation Studio
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'templates' ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40' : 'text-hx-text-secondary hover:text-hx-text-primary'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Templates
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'library' ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40' : 'text-hx-text-secondary hover:text-hx-text-primary'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Library ({documentsList.length})
            </button>
          </div>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* 1. DOCUMENT STUDIO                                                   */}
      {/* ==================================================================== */}
      {activeTab === 'document' && (
        <div className="space-y-4">
          {/* Document Top Bar */}
          <Card variant="default" border="subtle" padding="sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Input
                  value={activeWordDoc.metadata.title}
                  onChange={(e) =>
                    setActiveWordDoc({
                      ...activeWordDoc,
                      metadata: { ...activeWordDoc.metadata, title: e.target.value }
                    })
                  }
                  className="font-semibold text-sm max-w-sm"
                  placeholder="Document Title"
                />
                <Badge variant={activeWordDoc.metadata.status === 'saved' ? 'nominal' : 'warning'} size="sm">
                  {activeWordDoc.metadata.status.toUpperCase()}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleSaveWordDoc} disabled={loading} leftIcon={<Save className="w-3.5 h-3.5" />}>
                  Save
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleExportWordDoc('docx')} disabled={loading} leftIcon={<Download className="w-3.5 h-3.5" />}>
                  Export DOCX
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleExportWordDoc('md')} disabled={loading}>
                  MD
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleExportWordDoc('txt')} disabled={loading}>
                  TXT
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Drafting & Rewrite Control Accordion */}
          <Card variant="panel" border="subtle" padding="sm" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-hx-cyan flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Document Assistance (Quarantined Proposal Engine)
              </span>
              <span className="text-[10px] text-hx-text-secondary">Changes require explicit confirmation</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Generate Full Draft */}
              <div className="p-3 bg-hx-space/40 rounded-lg border border-hx-border-panel space-y-2">
                <label className="text-[11px] font-medium text-hx-text-primary block">
                  Generate Structured Document Draft
                </label>
                <div className="flex gap-2">
                  <Input
                    value={docAiPrompt}
                    onChange={(e) => setDocAiPrompt(e.target.value)}
                    placeholder="e.g. Executive report on quarterly AI infrastructure performance"
                    className="text-xs"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateDocAiDraft}
                    disabled={isDocAiGenerating || !docAiPrompt.trim()}
                    leftIcon={isDocAiGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  >
                    Draft
                  </Button>
                </div>
              </div>

              {/* Rewrite Selected Block */}
              <div className="p-3 bg-hx-space/40 rounded-lg border border-hx-border-panel space-y-2">
                <label className="text-[11px] font-medium text-hx-text-primary block">
                  Rewrite / Refine Text Block
                </label>
                <div className="flex gap-2">
                  <select
                    value={rewriteSelectedBlockId}
                    onChange={(e) => setRewriteSelectedBlockId(e.target.value)}
                    className="bg-hx-space text-hx-text-primary text-xs px-2 py-1 rounded border border-hx-border-panel"
                  >
                    <option value="">Select Block</option>
                    {activeWordDoc.blocks.map((b, i) => (
                      <option key={b.id} value={b.id}>
                        Block #{i + 1} ({b.type})
                      </option>
                    ))}
                  </select>
                  <Input
                    value={rewriteInstruction}
                    onChange={(e) => setRewriteInstruction(e.target.value)}
                    placeholder="Instruction (e.g. make concise)"
                    className="text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRequestRewrite}
                    disabled={isRewriting || !rewriteSelectedBlockId}
                    leftIcon={isRewriting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Edit3 className="w-3.5 h-3.5" />}
                  >
                    Rewrite
                  </Button>
                </div>
              </div>
            </div>

            {/* Quarantined AI Draft Preview Modal / Card */}
            {docAiDraftProposal && (
              <div className="p-3 bg-hx-cyan/10 border border-hx-cyan/40 rounded-lg space-y-2 animate-hx-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-hx-cyan flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-hx-cyan" />
                    Quarantined Draft Preview: &quot;{docAiDraftProposal.metadata.title}&quot;
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" onClick={handleAcceptDocAiDraft} leftIcon={<Check className="w-3.5 h-3.5" />}>
                      Accept Proposal
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setDocAiDraftProposal(null)} leftIcon={<X className="w-3.5 h-3.5" />}>
                      Discard
                    </Button>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto p-2 bg-hx-space/80 rounded border border-hx-border-panel text-xs text-hx-text-secondary space-y-1">
                  {docAiDraftProposal.blocks.map((b, i) => (
                    <div key={b.id} className="text-[11px]">
                      <span className="font-mono text-hx-cyan">[{b.type}]</span> {b.textRuns?.map((r) => r.text).join('')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quarantined Rewrite Preview */}
            {rewriteProposal && (
              <div className="p-3 bg-hx-panel border border-hx-border-glow rounded-lg space-y-2 animate-hx-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-hx-text-primary flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-hx-cyan" />
                    Proposed Rewrite
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" onClick={handleApplyRewrite} leftIcon={<Check className="w-3.5 h-3.5" />}>
                      Apply Rewrite
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setRewriteProposal(null)} leftIcon={<X className="w-3.5 h-3.5" />}>
                      Discard
                    </Button>
                  </div>
                </div>
                <p className="p-2 bg-hx-space rounded border border-hx-border-panel text-xs text-hx-cyan font-mono">
                  {rewriteProposal.newText}
                </p>
              </div>
            )}
          </Card>

          {/* Structured Document Editor Canvas */}
          <Card variant="panel" border="panel" padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-hx-border-panel pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-hx-text-secondary">
                Document Sections ({activeWordDoc.blocks.length} blocks)
              </span>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => handleAddBlock('paragraph')} leftIcon={<Plus className="w-3 h-3" />}>
                  Paragraph
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleAddBlock('heading_2')} leftIcon={<Plus className="w-3 h-3" />}>
                  Heading
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleAddBlock('bullet_item')} leftIcon={<Plus className="w-3 h-3" />}>
                  Bullet
                </Button>
              </div>
            </div>

            {/* Blocks List */}
            <div className="space-y-3">
              {activeWordDoc.blocks.map((block, idx) => {
                const text = block.textRuns?.map((r) => r.text).join('') || ''
                const firstRun: DocumentTextRun = block.textRuns?.[0] || { text: '' }

                return (
                  <div
                    key={block.id}
                    className="p-3 bg-hx-space/60 rounded-lg border border-hx-border-panel hover:border-hx-border-glow transition-colors group space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" size="sm">
                          {block.type.toUpperCase().replace('_', ' ')}
                        </Badge>
                        <span className="text-[10px] text-hx-text-secondary font-mono">#{idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        {/* Formatting controls */}
                        <button
                          onClick={() => handleToggleBlockFormatting(block.id, 'bold')}
                          className={`p-1 rounded ${firstRun.bold ? 'bg-hx-cyan/30 text-hx-cyan' : 'text-hx-text-secondary hover:text-hx-text-primary'}`}
                          title="Toggle Bold"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleToggleBlockFormatting(block.id, 'italic')}
                          className={`p-1 rounded ${firstRun.italic ? 'bg-hx-cyan/30 text-hx-cyan' : 'text-hx-text-secondary hover:text-hx-text-primary'}`}
                          title="Toggle Italic"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveBlock(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-hx-text-secondary hover:text-hx-text-primary disabled:opacity-30"
                          title="Move Block Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveBlock(idx, 'down')}
                          disabled={idx === activeWordDoc.blocks.length - 1}
                          className="p-1 text-hx-text-secondary hover:text-hx-text-primary disabled:opacity-30"
                          title="Move Block Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteBlock(block.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Delete Block"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Block Text Edit Input */}
                    {block.type.startsWith('heading') ? (
                      <input
                        type="text"
                        value={text}
                        onChange={(e) => handleUpdateBlockText(block.id, e.target.value)}
                        className={`w-full bg-hx-panel px-3 py-1.5 rounded border border-hx-border-panel text-hx-text-primary font-display font-semibold focus:outline-none focus:border-hx-cyan ${
                          block.type === 'heading_1' ? 'text-lg' : block.type === 'heading_2' ? 'text-base' : 'text-sm'
                        }`}
                      />
                    ) : (
                      <textarea
                        value={text}
                        onChange={(e) => handleUpdateBlockText(block.id, e.target.value)}
                        rows={Math.max(2, Math.ceil(text.length / 80))}
                        className="w-full bg-hx-panel px-3 py-1.5 rounded border border-hx-border-panel text-hx-text-primary text-xs leading-relaxed focus:outline-none focus:border-hx-cyan"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. SPREADSHEET STUDIO                                                */}
      {/* ==================================================================== */}
      {activeTab === 'spreadsheet' && (
        <div className="space-y-4">
          {/* Spreadsheet Header Bar */}
          <Card variant="default" border="subtle" padding="sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Input
                  value={activeWorkbook.metadata.title}
                  onChange={(e) =>
                    setActiveWorkbook({
                      ...activeWorkbook,
                      metadata: { ...activeWorkbook.metadata, title: e.target.value }
                    })
                  }
                  className="font-semibold text-sm max-w-sm"
                  placeholder="Workbook Title"
                />
                <Badge variant="nominal" size="sm">
                  {currentSheet?.name} ({currentSheet?.rowCount} x {currentSheet?.columnCount})
                </Badge>
                <div className="flex items-center gap-1 text-[11px] text-hx-cyan font-mono" title="CSV Formula Injection defense active">
                  <ShieldCheck className="w-4 h-4 text-hx-cyan" />
                  <span>DDE Defense Active</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleSaveWorkbook} disabled={loading} leftIcon={<Save className="w-3.5 h-3.5" />}>
                  Save
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleExportSpreadsheet('xlsx')} disabled={loading} leftIcon={<Download className="w-3.5 h-3.5" />}>
                  Export XLSX
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleExportSpreadsheet('csv')} disabled={loading} leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}>
                  Export CSV
                </Button>
              </div>
            </div>
          </Card>

          {/* Formula Bar & AI Suggester */}
          <Card variant="panel" border="subtle" padding="sm" className="space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Active Cell Reference Indicator */}
              <div className="px-3 py-1.5 bg-hx-space rounded border border-hx-border-panel font-mono text-xs text-hx-cyan font-semibold">
                {columnIndexToLetter(selectedCellCoord.col)}
                {selectedCellCoord.row + 1}
              </div>

              {/* Formula / Cell Value Input */}
              <div className="flex-1 w-full">
                <Input
                  value={cellFormulaInput}
                  onChange={(e) => handleCellFormulaChange(e.target.value)}
                  placeholder="Enter value or formula (e.g. =SUM(B2:D2))"
                  className="font-mono text-xs"
                />
              </div>

              {/* Grid Dimension Controls */}
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={handleAddSpreadsheetRow} leftIcon={<Plus className="w-3 h-3" />}>
                  Row
                </Button>
                <Button variant="secondary" size="sm" onClick={handleAddSpreadsheetCol} leftIcon={<Plus className="w-3 h-3" />}>
                  Column
                </Button>
              </div>
            </div>

            {/* AI Formula Assistant Section */}
            <div className="pt-2 border-t border-hx-border-panel/60 flex flex-col md:flex-row items-center gap-2">
              <span className="text-[11px] text-hx-cyan font-semibold flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                AI Formula Suggester:
              </span>
              <Input
                value={aiFormulaPrompt}
                onChange={(e) => setAiFormulaPrompt(e.target.value)}
                placeholder="Describe formula calculation (e.g. sum of column B where column A is 'Compute')"
                className="text-xs flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleSuggestFormulaAi}
                disabled={isFormulaGenerating || !aiFormulaPrompt.trim()}
                leftIcon={isFormulaGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              >
                Suggest
              </Button>
            </div>

            {/* Suggested Formula Card */}
            {aiFormulaSuggestion && (
              <div className="p-3 bg-hx-cyan/10 border border-hx-cyan/40 rounded-lg flex items-center justify-between gap-3 animate-hx-fade-in">
                <div className="text-xs">
                  <span className="font-mono font-bold text-hx-cyan text-sm">{aiFormulaSuggestion.formula}</span>
                  <p className="text-[11px] text-hx-text-secondary mt-0.5">{aiFormulaSuggestion.explanation}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="primary" size="sm" onClick={handleApplyAiFormula} leftIcon={<Check className="w-3.5 h-3.5" />}>
                    Insert
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setAiFormulaSuggestion(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Interactive Spreadsheet Grid */}
          <Card variant="panel" border="panel" padding="none" className="overflow-x-auto">
            <div className="min-w-[640px]">
              <table className="w-full border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-hx-space/80 border-b border-hx-border-panel">
                    <th className="w-12 p-2 border-r border-hx-border-panel text-hx-text-secondary text-center select-none">
                      #
                    </th>
                    {Array.from({ length: currentSheet?.columnCount || 0 }).map((_, c) => (
                      <th
                        key={c}
                        className={`p-2 border-r border-hx-border-panel text-center select-none min-w-[120px] ${
                          selectedCellCoord.col === c ? 'text-hx-cyan bg-hx-cyan/10 font-bold' : 'text-hx-text-secondary'
                        }`}
                      >
                        {columnIndexToLetter(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: currentSheet?.rowCount || 0 }).map((_, r) => (
                    <tr key={r} className="border-b border-hx-border-panel/40 hover:bg-hx-space/30">
                      <td
                        className={`p-1.5 border-r border-hx-border-panel text-center select-none text-[11px] ${
                          selectedCellCoord.row === r ? 'text-hx-cyan bg-hx-cyan/10 font-bold' : 'text-hx-text-secondary'
                        }`}
                      >
                        {r + 1}
                      </td>
                      {Array.from({ length: currentSheet?.columnCount || 0 }).map((_, c) => {
                        const cellKey = `${r}:${c}`
                        const cell = currentSheet?.cells[cellKey]
                        const isSelected = selectedCellCoord.row === r && selectedCellCoord.col === c
                        const displayVal = cell ? (cell.value !== null ? String(cell.value) : '') : ''

                        return (
                          <td
                            key={c}
                            onClick={() => handleSelectCell(r, c)}
                            className={`p-1.5 border-r border-hx-border-panel cursor-pointer truncate max-w-[180px] transition-colors ${
                              isSelected
                                ? 'bg-hx-cyan/20 ring-2 ring-hx-cyan z-10 font-semibold text-hx-text-primary'
                                : cell?.bold
                                ? 'font-bold text-hx-text-primary'
                                : 'text-hx-text-secondary'
                            }`}
                          >
                            {cell?.formula ? (
                              <span className="text-hx-cyan font-mono" title={`Formula: ${cell.formula}`}>
                                {displayVal}
                              </span>
                            ) : (
                              displayVal || <span className="opacity-0 select-none">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PRESENTATION STUDIO                                               */}
      {/* ==================================================================== */}
      {activeTab === 'presentation' && (
        <div className="space-y-4">
          {/* Deck Header & Theme Controls */}
          <Card variant="default" border="subtle" padding="sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Input
                  value={activeDeck.metadata.title}
                  onChange={(e) =>
                    setActiveDeck({
                      ...activeDeck,
                      metadata: { ...activeDeck.metadata, title: e.target.value }
                    })
                  }
                  className="font-semibold text-sm max-w-sm"
                  placeholder="Deck Title"
                />
                <select
                  value={activeDeck.theme}
                  onChange={(e) => setActiveDeck({ ...activeDeck, theme: e.target.value as PresentationThemeId })}
                  className="bg-hx-space text-hx-text-primary text-xs px-2 py-1.5 rounded border border-hx-border-panel"
                >
                  <option value="cosmic_cyan">Theme: Cosmic Cyan</option>
                  <option value="slate_minimal">Theme: Slate Minimal</option>
                  <option value="emerald_executive">Theme: Emerald Executive</option>
                  <option value="amber_warmth">Theme: Amber Warmth</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleSaveDeck} disabled={loading} leftIcon={<Save className="w-3.5 h-3.5" />}>
                  Save
                </Button>
                <Button variant="primary" size="sm" onClick={handleExportDeck} disabled={loading} leftIcon={<Download className="w-3.5 h-3.5" />}>
                  Export PPTX
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Deck Drafting Section */}
          <Card variant="panel" border="subtle" padding="sm" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-hx-cyan flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Slide Deck Generator
              </span>
              <span className="text-[10px] text-hx-text-secondary">Generates complete decks with outlined layouts</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={deckAiPrompt}
                onChange={(e) => setDeckAiPrompt(e.target.value)}
                placeholder="e.g. 4-slide strategic pitch for an enterprise cybersecurity AI assistant"
                className="text-xs flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateDeckAiDraft}
                disabled={isDeckAiGenerating || !deckAiPrompt.trim()}
                leftIcon={isDeckAiGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              >
                Generate Deck
              </Button>
            </div>

            {deckAiProposal && (
              <div className="p-3 bg-hx-cyan/10 border border-hx-cyan/40 rounded-lg space-y-2 animate-hx-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-hx-cyan flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-hx-cyan" />
                    AI Deck Proposal: &quot;{deckAiProposal.metadata.title}&quot; ({deckAiProposal.slides.length} slides)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" onClick={handleAcceptDeckAiDraft} leftIcon={<Check className="w-3.5 h-3.5" />}>
                      Accept Deck
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setDeckAiProposal(null)} leftIcon={<X className="w-3.5 h-3.5" />}>
                      Discard
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Two-Column Deck Editor (Left: Slides List, Right: Active Slide Canvas) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Slides List Panel */}
            <Card variant="panel" border="subtle" padding="sm" className="space-y-3">
              <div className="flex items-center justify-between border-b border-hx-border-panel pb-2">
                <span className="text-xs font-semibold text-hx-text-primary">
                  Slides ({activeDeck.slides.length})
                </span>
                <Button variant="secondary" size="sm" onClick={handleAddSlide} leftIcon={<Plus className="w-3 h-3" />}>
                  Slide
                </Button>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {activeDeck.slides.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      idx === activeSlideIndex
                        ? 'bg-hx-cyan/20 border-hx-cyan text-hx-text-primary shadow-hx-glow-cyan-sm'
                        : 'bg-hx-space/60 border-hx-border-panel text-hx-text-secondary hover:border-hx-border-glow'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-hx-cyan">Slide {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMoveSlide(idx, 'up')
                          }}
                          disabled={idx === 0}
                          className="p-0.5 text-hx-text-secondary hover:text-hx-text-primary disabled:opacity-20"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMoveSlide(idx, 'down')
                          }}
                          disabled={idx === activeDeck.slides.length - 1}
                          className="p-0.5 text-hx-text-secondary hover:text-hx-text-primary disabled:opacity-20"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSlide(idx)
                          }}
                          className="p-0.5 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="text-[10px] text-hx-text-secondary font-mono mt-0.5">{s.layout}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Active Slide Canvas & Live Preview */}
            <div className="md:col-span-3 space-y-4">
              {currentSlide && (
                <>
                  {/* Theme Live Preview Card */}
                  <div
                    className={`p-6 rounded-xl border min-h-[300px] flex flex-col justify-between transition-colors shadow-lg ${
                      getThemePalette(activeDeck.theme).bg
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="nominal" size="sm">
                          SLIDE {activeSlideIndex + 1} OF {activeDeck.slides.length}
                        </Badge>
                        <span className={`text-xs font-mono uppercase tracking-wider ${getThemePalette(activeDeck.theme).accent}`}>
                          {activeDeck.theme.replace('_', ' ')}
                        </span>
                      </div>
                      <h2 className={`text-2xl font-display font-bold mb-3 ${getThemePalette(activeDeck.theme).accent}`}>
                        {currentSlide.title}
                      </h2>

                      {/* Render Slide Elements */}
                      <div className="space-y-3 mt-4">
                        {currentSlide.elements.map((el) => {
                          if (el.type === 'subtitle') {
                            return (
                              <p key={el.id} className="text-sm opacity-90 italic">
                                {el.text}
                              </p>
                            )
                          }
                          if (el.type === 'bullet_list' && el.bulletPoints) {
                            return (
                              <ul key={el.id} className="space-y-2 list-disc list-inside text-sm">
                                {el.bulletPoints.map((pt, pIdx) => (
                                  <li key={pIdx} className="leading-relaxed">
                                    {pt}
                                  </li>
                                ))}
                              </ul>
                            )
                          }
                          if (el.type === 'card') {
                            return (
                              <div
                                key={el.id}
                                className={`inline-block mr-2 mb-2 p-3 rounded-lg border text-xs font-medium ${
                                  getThemePalette(activeDeck.theme).card
                                }`}
                              >
                                {el.text}
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] opacity-60">
                      <span>HELIOXEN Office Studio</span>
                      <span>Confidential Presentation</span>
                    </div>
                  </div>

                  {/* Active Slide Editor Controls */}
                  <Card variant="panel" border="subtle" padding="sm" className="space-y-3">
                    <span className="text-xs font-semibold text-hx-text-primary block">
                      Edit Slide Details
                    </span>

                    <div className="space-y-2">
                      <label className="text-[11px] text-hx-text-secondary block">Slide Title</label>
                      <Input
                        value={currentSlide.title}
                        onChange={(e) => handleUpdateSlideTitle(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    {/* Bullets List Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-hx-text-secondary">Slide Key Points</label>
                        <Button variant="secondary" size="sm" onClick={handleAddSlideBullet} leftIcon={<Plus className="w-3 h-3" />}>
                          Add Point
                        </Button>
                      </div>

                      {currentSlide.elements
                        .find((el) => el.type === 'bullet_list')
                        ?.bulletPoints?.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="text-xs text-hx-cyan font-mono">•</span>
                            <Input
                              value={bullet}
                              onChange={(e) => handleUpdateSlideBullets(bIdx, e.target.value)}
                              className="text-xs flex-1"
                            />
                          </div>
                        ))}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. TEMPLATES VIEW                                                    */}
      {/* ==================================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <Card variant="panel" border="subtle" padding="md">
            <h2 className="text-sm font-semibold text-hx-text-primary mb-1">
              Curated Production Templates
            </h2>
            <p className="text-xs text-hx-text-secondary mb-4">
              Instantiate standard executive documents, financial forecast workbooks, or presentation decks.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templatesList.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-4 bg-hx-space/60 rounded-xl border border-hx-border-panel hover:border-hx-border-glow transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-hx-cyan flex items-center gap-1.5">
                        {tmpl.type === 'document' ? (
                          <FileText className="w-3.5 h-3.5" />
                        ) : tmpl.type === 'spreadsheet' ? (
                          <Table className="w-3.5 h-3.5" />
                        ) : (
                          <Presentation className="w-3.5 h-3.5" />
                        )}
                        {tmpl.title}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {tmpl.type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-hx-text-secondary leading-relaxed">
                      {tmpl.description}
                    </p>
                    <p className="text-[11px] text-hx-text-tertiary italic pt-1">
                      {tmpl.previewSummary}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleInstantiateTemplate(tmpl.id)}
                    disabled={loading}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Instantiate Template
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. DOCUMENT LIBRARY VIEW                                             */}
      {/* ==================================================================== */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          <Card variant="panel" border="subtle" padding="md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-hx-text-primary">
                  Document Library ({documentsList.length})
                </h2>
                <p className="text-xs text-hx-text-secondary">
                  Local-first document records stored in atomic JSON store.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleImportDocument} disabled={loading} leftIcon={<Upload className="w-3.5 h-3.5" />}>
                  Import File
                </Button>
                <Button variant="secondary" size="sm" onClick={loadDocuments} disabled={loading} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Refresh
                </Button>
              </div>
            </div>

            {documentsList.length === 0 ? (
              <div className="p-8 text-center bg-hx-space/40 rounded-xl border border-hx-border-panel text-xs text-hx-text-secondary">
                No documents found in store. Save a document or instantiate a template to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {documentsList.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-hx-space/60 rounded-lg border border-hx-border-panel hover:border-hx-border-glow transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-hx-panel rounded border border-hx-border-panel text-hx-cyan">
                        {doc.type === 'document' ? (
                          <FileText className="w-4 h-4" />
                        ) : doc.type === 'spreadsheet' ? (
                          <Table className="w-4 h-4" />
                        ) : (
                          <Presentation className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-hx-text-primary">{doc.title}</div>
                        <div className="text-[11px] text-hx-text-secondary flex items-center gap-2 font-mono">
                          <span>{doc.type.toUpperCase()}</span>
                          <span>•</span>
                          <span>{new Date(doc.updatedAt).toLocaleString()}</span>
                          <span>•</span>
                          <span>{doc.author}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleOpenExistingDoc(doc)} leftIcon={<FolderOpen className="w-3.5 h-3.5" />}>
                        Open
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteExistingDoc(doc.id, doc.title)}
                        className="text-red-400 hover:text-red-300"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
