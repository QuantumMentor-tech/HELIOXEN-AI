import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'

describe('Step 25: Model-Facing Schema Translation', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
  })

  describe('OpenAI Function Calling Format', () => {
    it('generates compliant OpenAI tool definitions', () => {
      const openAiTools = registry.formatOpenAiTools(['system:get_time', 'documents:extract_text'])
      expect(openAiTools.length).toBe(2)

      const timeTool = openAiTools.find((t) => t.function.name === 'system__get_time')
      expect(timeTool).toBeDefined()
      expect(timeTool?.type).toBe('function')
      expect(timeTool?.function.parameters.type).toBe('object')
      expect(timeTool?.function.description).toContain('current operating system time')
    })

    it('excludes prohibited tools from model-facing OpenAI lists by default', () => {
      const openAiTools = registry.formatOpenAiTools()
      expect(openAiTools.some((t) => t.function.name.includes('shell'))).toBe(false)
    })
  })

  describe('Google Gemini Function Declaration Format', () => {
    it('generates compliant Google Gemini function declarations', () => {
      const geminiTools = registry.formatGeminiTools(['system:get_time'])
      expect(geminiTools.length).toBe(1)

      const timeTool = geminiTools[0]
      expect(timeTool.name).toBe('system__get_time')
      expect(timeTool.parameters.type).toBe('object')
      expect(timeTool.description).toBeDefined()
    })

    it('excludes prohibited and disabled tools from Gemini tool declarations', () => {
      const geminiTools = registry.formatGeminiTools()
      expect(geminiTools.some((t) => t.name.includes('shell'))).toBe(false)
    })
  })
})
