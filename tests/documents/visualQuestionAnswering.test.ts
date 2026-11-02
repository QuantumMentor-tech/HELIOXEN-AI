import { describe, it, expect, vi } from 'vitest'
import { GeminiAdapter } from '../../src/main/ai/adapters/GeminiAdapter'
import { OpenAiAdapter } from '../../src/main/ai/adapters/OpenAiAdapter'
import { CURATED_MODELS } from '../../src/shared/ai/models'
import { AiGenerationRequest } from '../../src/shared/ai/types'

describe('Visual Question Answering & Multimodal Integration (Step 23)', () => {
  describe('GeminiAdapter Visual QA & Document Context Preparation', () => {
    it('prepares inlineData content part for image attachments', async () => {
      let capturedPayload: any = null

      const mockClient = {
        models: {
          generateContent: vi.fn().mockImplementation((payload) => {
            capturedPayload = payload
            return Promise.resolve({
              text: 'The image shows an architectural blueprint.',
              candidates: [{ finishReason: 'STOP' }]
            })
          })
        }
      }

      const adapter = new GeminiAdapter(() => mockClient as any)

      const request: AiGenerationRequest = {
        provider: 'google-gemini',
        model: 'gemini-3.8-flash',
        messages: [{ role: 'user', content: 'What is shown in this image?' }],
        imageAttachment: {
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,mockedBase64ImageData=='
        }
      }

      const response = await adapter.generateText(request, 'test-key')
      expect(response.text).toBe('The image shows an architectural blueprint.')
      expect(capturedPayload).toBeDefined()

      const userContent = capturedPayload.contents.find((c: any) => c.role === 'user')
      expect(userContent).toBeDefined()
      expect(userContent.parts).toHaveLength(2)

      // Text part
      expect(userContent.parts[0].text).toBe('What is shown in this image?')

      // Inline image data part
      expect(userContent.parts[1].inlineData).toBeDefined()
      expect(userContent.parts[1].inlineData.mimeType).toBe('image/jpeg')
      expect(userContent.parts[1].inlineData.data).toBe('mockedBase64ImageData==')
    })

    it('prepends document attachment context block to user prompt', async () => {
      let capturedPayload: any = null

      const mockClient = {
        models: {
          generateContent: vi.fn().mockImplementation((payload) => {
            capturedPayload = payload
            return Promise.resolve({
              text: 'Document summary.',
              candidates: [{ finishReason: 'STOP' }]
            })
          })
        }
      }

      const adapter = new GeminiAdapter(() => mockClient as any)

      const request: AiGenerationRequest = {
        provider: 'google-gemini',
        model: 'gemini-3.8-flash',
        messages: [{ role: 'user', content: 'Summarize this file.' }],
        documentContext: [
          {
            filename: 'audit.txt',
            text: 'System health is nominal.'
          }
        ]
      }

      await adapter.generateText(request, 'test-key')
      const userContent = capturedPayload.contents.find((c: any) => c.role === 'user')
      expect(userContent.parts[0].text).toContain('[DOCUMENT ATTACHMENT: audit.txt]')
      expect(userContent.parts[0].text).toContain('System health is nominal.')
      expect(userContent.parts[0].text).toContain('Summarize this file.')
    })
  })

  describe('OpenAiAdapter Visual QA & Document Context Preparation', () => {
    it('prepares image_url content parts for OpenAI chat completions', async () => {
      let capturedPayload: any = null

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation((payload) => {
              capturedPayload = payload
              return Promise.resolve({
                id: 'chatcmpl-test',
                choices: [{ message: { content: 'This is a diagram of the HELIOXEN dock.' }, finish_reason: 'stop' }]
              })
            })
          }
        }
      }

      const adapter = new OpenAiAdapter(() => mockClient as any)

      const request: AiGenerationRequest = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Explain this diagram.' }],
        imageAttachment: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        }
      }

      const response = await adapter.generateText(request, 'test-key')
      expect(response.text).toBe('This is a diagram of the HELIOXEN dock.')
      expect(capturedPayload).toBeDefined()

      const userMsg = capturedPayload.messages.find((m: any) => m.role === 'user')
      expect(Array.isArray(userMsg.content)).toBe(true)
      expect(userMsg.content[0]).toEqual({ type: 'text', text: 'Explain this diagram.' })
      expect(userMsg.content[1]).toEqual({
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        }
      })
    })
  })

  describe('Model Registry Vision Capability Verification', () => {
    it('verifies that vision models have imageInput supported at modelLevel', () => {
      const geminiFlash = CURATED_MODELS['gemini-3.8-flash']
      expect(geminiFlash.capabilities.modelLevel.imageInput).toBe('supported')

      const gpt4oMini = CURATED_MODELS['gpt-4o-mini']
      expect(gpt4oMini.capabilities.modelLevel.imageInput).toBe('supported')

      const gpt4o = CURATED_MODELS['gpt-4o']
      expect(gpt4o.capabilities.modelLevel.imageInput).toBe('supported')
    })
  })
})
