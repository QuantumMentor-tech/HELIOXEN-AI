/**
 * HELIOXEN AI — Step 43: Office Studio Curated Built-in Templates
 * Genuine, editable template payloads for Document, Spreadsheet, and Presentation Studios.
 */

import { OfficeTemplate } from '../../shared/office/types'

export const BUILTIN_OFFICE_TEMPLATES: OfficeTemplate[] = [
  // 1. Text Document: Executive Project Report
  {
    id: 'tpl_executive_report',
    title: 'Executive Project Report',
    description: 'Structured report format with executive summary, methodology, findings, and recommendations.',
    type: 'document',
    category: 'business',
    previewSummary: 'Word document (.docx) with structured headings, paragraphs, and recommendation tables.',
    defaultPayload: {
      id: 'doc_executive_report',
      metadata: {
        id: 'doc_executive_report',
        title: 'Executive Project Report',
        type: 'document',
        createdAt: 0,
        updatedAt: 0,
        status: 'draft',
        author: 'HELIOXEN Office Studio',
        isTemplate: true,
        tags: ['report', 'business']
      },
      blocks: [
        {
          id: 'blk_1',
          type: 'heading_1',
          textRuns: [{ text: 'Executive Project Report', bold: true }]
        },
        {
          id: 'blk_2',
          type: 'paragraph',
          textRuns: [
            { text: 'Prepared by: ', bold: true },
            { text: 'HELIOXEN AI Operations' },
            { text: ' | Status: ', bold: true },
            { text: 'Final Draft' }
          ]
        },
        { id: 'blk_3', type: 'divider' },
        {
          id: 'blk_4',
          type: 'heading_2',
          textRuns: [{ text: '1. Executive Summary', bold: true }]
        },
        {
          id: 'blk_5',
          type: 'paragraph',
          textRuns: [
            {
              text: 'This report synthesizes strategic operational objectives, progress milestones, and capability readiness metrics across active enterprise systems. Core foundations remain secure, local-first, and verified.'
            }
          ]
        },
        {
          id: 'blk_6',
          type: 'heading_2',
          textRuns: [{ text: '2. Key Findings & Strategic Insights', bold: true }]
        },
        {
          id: 'blk_7',
          type: 'bullet_item',
          textRuns: [{ text: 'Task throughput increased by 42% following automated DAG dependency orchestration.' }]
        },
        {
          id: 'blk_8',
          type: 'bullet_item',
          textRuns: [{ text: 'Zero security regressions identified across 113 automated verification suites.' }]
        },
        {
          id: 'blk_9',
          type: 'bullet_item',
          textRuns: [{ text: 'Resource limits and memory ceilings maintained within approved performance quotas.' }]
        },
        {
          id: 'blk_10',
          type: 'heading_2',
          textRuns: [{ text: '3. Next Steps & Recommended Actions', bold: true }]
        },
        {
          id: 'blk_11',
          type: 'numbered_item',
          textRuns: [{ text: 'Finalize phase validation and execute end-to-end integration checklist.' }]
        },
        {
          id: 'blk_12',
          type: 'numbered_item',
          textRuns: [{ text: 'Archive audit logs and synchronize productivity records.' }]
        }
      ]
    }
  },

  // 2. Text Document: Meeting Minutes
  {
    id: 'tpl_meeting_minutes',
    title: 'Executive Meeting Minutes',
    description: 'Clear meeting agenda, attendee roster, decision log, and assigned follow-up items.',
    type: 'document',
    category: 'project',
    previewSummary: 'Word document (.docx) optimized for capturing discussions, decisions, and action items.',
    defaultPayload: {
      id: 'doc_meeting_minutes',
      metadata: {
        id: 'doc_meeting_minutes',
        title: 'Executive Meeting Minutes',
        type: 'document',
        createdAt: 0,
        updatedAt: 0,
        status: 'draft',
        author: 'HELIOXEN Office Studio',
        isTemplate: true,
        tags: ['meeting', 'action-items']
      },
      blocks: [
        {
          id: 'blk_1',
          type: 'heading_1',
          textRuns: [{ text: 'Architecture Alignment Meeting Minutes', bold: true }]
        },
        {
          id: 'blk_2',
          type: 'paragraph',
          textRuns: [
            { text: 'Date: ', bold: true },
            { text: 'November 5, 2026' },
            { text: ' | Focus: ', bold: true },
            { text: 'Office Productivity Architecture' }
          ]
        },
        {
          id: 'blk_3',
          type: 'heading_2',
          textRuns: [{ text: 'Attendees & Stakeholders', bold: true }]
        },
        {
          id: 'blk_4',
          type: 'bullet_item',
          textRuns: [{ text: 'Senior Application Architect (Lead)' }]
        },
        {
          id: 'blk_5',
          type: 'bullet_item',
          textRuns: [{ text: 'Security & Privacy Systems Engineer' }]
        },
        {
          id: 'blk_6',
          type: 'bullet_item',
          textRuns: [{ text: 'Full-Stack Desktop Developer' }]
        },
        {
          id: 'blk_7',
          type: 'heading_2',
          textRuns: [{ text: 'Key Decisions Agreed Upon', bold: true }]
        },
        {
          id: 'blk_8',
          type: 'quote',
          textRuns: [
            {
              text: 'Approved: Office documents remain strictly local-first with pure OOXML ZIP generation and CSV formula injection defense.'
            }
          ]
        }
      ]
    }
  },

  // 3. Spreadsheet: Project Budget & Variance
  {
    id: 'tpl_project_budget',
    title: 'Project Budget & Variance Workbook',
    description: 'Multi-category expenditure tracker with budgeted, actual, and variance calculations.',
    type: 'spreadsheet',
    category: 'business',
    previewSummary: 'Excel workbook (.xlsx) with categorized expense rows and formula preservation.',
    defaultPayload: {
      id: 'sheet_project_budget',
      metadata: {
        id: 'sheet_project_budget',
        title: 'Project Budget & Variance Workbook',
        type: 'spreadsheet',
        createdAt: 0,
        updatedAt: 0,
        status: 'draft',
        author: 'HELIOXEN Office Studio',
        isTemplate: true,
        tags: ['budget', 'finance']
      },
      sheets: [
        {
          id: 'sheet_1',
          name: 'Q4 Budget',
          rowCount: 20,
          columnCount: 6,
          cells: {
            '0:0': { value: 'Category', valueType: 'string', bold: true },
            '0:1': { value: 'Item Description', valueType: 'string', bold: true },
            '0:2': { value: 'Budget ($)', valueType: 'string', bold: true },
            '0:3': { value: 'Actual ($)', valueType: 'string', bold: true },
            '0:4': { value: 'Variance ($)', valueType: 'string', bold: true },
            '0:5': { value: 'Status', valueType: 'string', bold: true },

            // Row 1: Infrastructure
            '1:0': { value: 'Infrastructure', valueType: 'string' },
            '1:1': { value: 'Local Storage & SSD Buffers', valueType: 'string' },
            '1:2': { value: 5000, valueType: 'number' },
            '1:3': { value: 4200, valueType: 'number' },
            '1:4': { value: 800, valueType: 'formula', formula: '=C2-D2' },
            '1:5': { value: 'Under Budget', valueType: 'string' },

            // Row 2: Software
            '2:0': { value: 'Software', valueType: 'string' },
            '2:1': { value: 'Model Inference Quotas', valueType: 'string' },
            '2:2': { value: 8000, valueType: 'number' },
            '2:3': { value: 7600, valueType: 'number' },
            '2:4': { value: 400, valueType: 'formula', formula: '=C3-D3' },
            '2:5': { value: 'Under Budget', valueType: 'string' },

            // Row 3: QA & Testing
            '3:0': { value: 'Testing', valueType: 'string' },
            '3:1': { value: 'Automated Test Harness', valueType: 'string' },
            '3:2': { value: 3000, valueType: 'number' },
            '3:3': { value: 3100, valueType: 'number' },
            '3:4': { value: -100, valueType: 'formula', formula: '=C4-D4' },
            '3:5': { value: 'Over Budget', valueType: 'string' },

            // Row 4: Total
            '4:0': { value: 'TOTAL', valueType: 'string', bold: true },
            '4:1': { value: 'All Categories', valueType: 'string', italic: true },
            '4:2': { value: 16000, valueType: 'formula', formula: '=SUM(C2:C4)', bold: true },
            '4:3': { value: 14900, valueType: 'formula', formula: '=SUM(D2:D4)', bold: true },
            '4:4': { value: 1100, valueType: 'formula', formula: '=SUM(E2:E4)', bold: true },
            '4:5': { value: 'Healthy', valueType: 'string', bold: true }
          }
        }
      ],
      activeSheetId: 'sheet_1'
    }
  },

  // 4. Presentation: Executive Project Pitch Deck
  {
    id: 'tpl_project_pitch',
    title: 'Executive Project Pitch Deck',
    description: 'Polished 4-slide presentation deck formatted with Cosmic Cyan palette.',
    type: 'presentation',
    category: 'business',
    previewSummary: 'PowerPoint (.pptx) deck with title, problem definition, solution, and roadmap.',
    defaultPayload: {
      id: 'pres_project_pitch',
      metadata: {
        id: 'pres_project_pitch',
        title: 'Executive Project Pitch Deck',
        type: 'presentation',
        createdAt: 0,
        updatedAt: 0,
        status: 'draft',
        author: 'HELIOXEN Office Studio',
        isTemplate: true,
        tags: ['pitch', 'deck', 'presentation']
      },
      theme: 'cosmic_cyan',
      slides: [
        {
          id: 'slide_1',
          title: 'HELIOXEN Desktop Intelligence',
          layout: 'title_slide',
          elements: [
            {
              id: 'el_1',
              type: 'subtitle',
              text: 'Autonomous pair-programming, multi-agent collaboration, and local-first office productivity'
            }
          ]
        },
        {
          id: 'slide_2',
          title: 'The Challenge & The Solution',
          layout: 'two_column',
          elements: [
            {
              id: 'el_2_1',
              type: 'bullet_list',
              bulletPoints: [
                'Problem: Cloud vendor lock-in and uncontrollable data leakage in traditional office suites',
                'Solution: Local-first Office Studio with pure OOXML generation and zero untrusted macro execution',
                'Privacy: Complete separation between working drafts and external provider queries'
              ]
            }
          ]
        },
        {
          id: 'slide_3',
          title: 'Core Architecture Pillars',
          layout: 'title_and_content',
          elements: [
            {
              id: 'el_3_1',
              type: 'bullet_list',
              bulletPoints: [
                'Document Studio: Structured Word (.docx), Markdown, and Plain Text authoring',
                'Spreadsheet Studio: Workbook grids, formula preservation, and CSV DDE injection defense',
                'Presentation Studio: Theme-guided slide authoring and verified PPTX generation',
                'Unified Productivity: Seamless integration with Notes, Tasks, and Media Gallery'
              ]
            }
          ]
        },
        {
          id: 'slide_4',
          title: 'Roadmap & Production Milestones',
          layout: 'title_and_content',
          elements: [
            {
              id: 'el_4_1',
              type: 'bullet_list',
              bulletPoints: [
                'Phase 12–14: Complete memory, media assets, VisualHub, Agent Town, and multi-agent coordination',
                'Phase 15 (Current): Office Studio integration with 100% verified test passes',
                'Next Steps: End-to-end verification and quality readiness for deployment'
              ]
            }
          ]
        }
      ]
    }
  }
]

export const EXECUTIVE_REPORT_TEMPLATE = BUILTIN_OFFICE_TEMPLATES[0]
export const MEETING_MINUTES_TEMPLATE = BUILTIN_OFFICE_TEMPLATES[1]
export const PROJECT_BUDGET_TEMPLATE = BUILTIN_OFFICE_TEMPLATES[2]
export const PROJECT_PITCH_DECK_TEMPLATE = BUILTIN_OFFICE_TEMPLATES[3]
