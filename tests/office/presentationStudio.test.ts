import { describe, it, expect } from 'vitest'
import { PptxEngine } from '../../src/main/office/PptxEngine'
import { PresentationModel } from '../../src/shared/office/types'
import { PresentationModelSchema } from '../../src/shared/office/contracts'
import { PROJECT_PITCH_DECK_TEMPLATE } from '../../src/main/office/OfficeTemplates'

describe('Presentation Studio (PPTX, Slide Layouts, Themes)', () => {
  const sampleDeck: PresentationModel = {
    id: 'test-deck-1',
    metadata: {
      id: 'test-deck-1',
      title: 'Helioxen Next-Gen Pitch',
      type: 'presentation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      author: 'Product Architect'
    },
    theme: 'cosmic_cyan',
    slides: [
      {
        id: 's1',
        title: 'Helioxen AI Assistant',
        layout: 'title_slide',
        elements: [
          { id: 'el1', type: 'title', text: 'Helioxen AI Assistant' },
          { id: 'el2', type: 'subtitle', text: 'Local-First Autonomous Intelligence Platform' }
        ],
        speakerNotes: 'Introduce the core thesis.'
      },
      {
        id: 's2',
        title: 'Platform Capabilities',
        layout: 'title_and_content',
        elements: [
          { id: 'el3', type: 'title', text: 'Platform Capabilities' },
          {
            id: 'el4',
            type: 'bullet_list',
            bulletPoints: [
              'Zero-dependency OOXML document generation',
              'Strict CSV injection prevention',
              'Quarantined AI drafting with human oversight'
            ]
          }
        ],
        speakerNotes: 'Elaborate on security features.'
      },
      {
        id: 's3',
        title: 'Milestone Delivery',
        layout: 'card_grid',
        elements: [
          { id: 'el5', type: 'title', text: 'Milestone Delivery' },
          { id: 'el6', type: 'card', text: 'Step 43: Office Studio', color: 'cyan' },
          { id: 'el7', type: 'card', text: 'Step 42: Dynamic Skills', color: 'emerald' }
        ]
      }
    ]
  }

  it('validates presentation deck against PresentationModelSchema', () => {
    const parsed = PresentationModelSchema.safeParse(sampleDeck)
    expect(parsed.success).toBe(true)
  })

  it('generates valid OOXML (.pptx) binary PKZIP archive', async () => {
    const pptxBuffer = await PptxEngine.generatePptx(sampleDeck)
    expect(pptxBuffer).toBeInstanceOf(Buffer)
    expect(pptxBuffer.length).toBeGreaterThan(500)

    // Check PKZIP signature: 0x50 0x4B 0x03 0x04
    expect(pptxBuffer[0]).toBe(0x50)
    expect(pptxBuffer[1]).toBe(0x4b)
    expect(pptxBuffer[2]).toBe(0x03)
    expect(pptxBuffer[3]).toBe(0x04)
  })

  it('parses generated .pptx archive back into structured PresentationModel', async () => {
    const pptxBuffer = await PptxEngine.generatePptx(sampleDeck)
    const { model: parsedDeck } = await PptxEngine.parsePptx(pptxBuffer, 'deck_test', 'Parsed Helioxen Pitch')

    expect(parsedDeck.metadata.title).toBe('Parsed Helioxen Pitch')
    expect(parsedDeck.metadata.type).toBe('presentation')
    expect(parsedDeck.slides.length).toBe(3)

    expect(parsedDeck.slides[0].title).toContain('Helioxen AI Assistant')
    expect(parsedDeck.slides[1].title).toContain('Platform Capabilities')

    const bullets = parsedDeck.slides[1].elements.find((el) => el.type === 'bullet_list')
    expect(bullets?.bulletPoints?.length).toBeGreaterThanOrEqual(1)
  })

  it('supports all 4 visual themes: cosmic_cyan, slate_minimal, emerald_executive, amber_warmth', async () => {
    const themes: ('cosmic_cyan' | 'slate_minimal' | 'emerald_executive' | 'amber_warmth')[] = [
      'cosmic_cyan',
      'slate_minimal',
      'emerald_executive',
      'amber_warmth'
    ]

    for (const theme of themes) {
      const themedDeck: PresentationModel = {
        ...sampleDeck,
        id: `deck-${theme}`,
        theme
      }
      const buffer = await PptxEngine.generatePptx(themedDeck)
      expect(buffer.length).toBeGreaterThan(500)
    }
  })

  it('verifies built-in Pitch Deck template conforms to schema', () => {
    expect(PROJECT_PITCH_DECK_TEMPLATE.type).toBe('presentation')
    const pitchParse = PresentationModelSchema.safeParse(PROJECT_PITCH_DECK_TEMPLATE.defaultPayload)
    expect(pitchParse.success).toBe(true)
  })
})
