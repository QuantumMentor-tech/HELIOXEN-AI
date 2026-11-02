import { describe, it, expect } from 'vitest'
import {
  ToolMetadataSchema,
  ToolQueryFilterSchema,
  ToolEligibilityEvaluationSchema,
  validateToolIdentifier,
  sanitizeToolMetadata
} from '../../src/shared/tools/contracts'
import {
  SystemGetTimeTool,
  DocumentsExtractTextTool
} from '../../src/shared/tools/catalog'

describe('Step 25: Tool Contracts & Schema Validation', () => {
  describe('Tool Identifier Validation', () => {
    it('accepts valid namespace:action identifiers', () => {
      expect(validateToolIdentifier('system:get_time').valid).toBe(true)
      expect(validateToolIdentifier('documents:extract_text').valid).toBe(true)
      expect(validateToolIdentifier('media:get_capture_sources').valid).toBe(true)
      expect(validateToolIdentifier('workspace_1:tool_action_2').valid).toBe(true)
    })

    it('rejects malformed, empty, or non-namespaced identifiers', () => {
      expect(validateToolIdentifier('').valid).toBe(false)
      expect(validateToolIdentifier('get_time').valid).toBe(false)
      expect(validateToolIdentifier('system:').valid).toBe(false)
      expect(validateToolIdentifier(':action').valid).toBe(false)
      expect(validateToolIdentifier('System:GetTime').valid).toBe(false)
      expect(validateToolIdentifier('system:get time').valid).toBe(false)
    })
  })

  describe('Runtime Schema Validation', () => {
    it('validates a well-formed ToolMetadata object', () => {
      const metadata = sanitizeToolMetadata(SystemGetTimeTool)
      const parseResult = ToolMetadataSchema.safeParse(metadata)
      expect(parseResult.success).toBe(true)
    })

    it('validates ToolQueryFilter schema', () => {
      const validFilter = {
        category: 'documents' as const,
        riskTier: 'low' as const,
        search: 'pdf'
      }
      expect(ToolQueryFilterSchema.safeParse(validFilter).success).toBe(true)
    })

    it('validates ToolEligibilityEvaluation schema', () => {
      const evalResult = {
        eligible: true,
        toolId: 'system:get_time',
        requiresConfirmation: false,
        requiredCapabilities: []
      }
      expect(ToolEligibilityEvaluationSchema.safeParse(evalResult).success).toBe(true)
    })
  })

  describe('Strict Input Validation & Bounded Constraints', () => {
    it('rejects unknown input properties by default (.strict())', () => {
      const validInput = { timezone: 'UTC' }
      expect(SystemGetTimeTool.inputSchema.safeParse(validInput).success).toBe(true)

      const hostileInput = { timezone: 'UTC', extraMaliciousField: true }
      const result = SystemGetTimeTool.inputSchema.safeParse(hostileInput)
      expect(result.success).toBe(false)
    })

    it('enforces string length constraints on input', () => {
      const oversizedInput = { timezone: 'A'.repeat(100) } // Max is 64
      expect(SystemGetTimeTool.inputSchema.safeParse(oversizedInput).success).toBe(false)
    })

    it('enforces numeric bounds on input parameters', () => {
      const validDocInput = { filePath: '/docs/test.pdf', maxChars: 5000 }
      expect(DocumentsExtractTextTool.inputSchema.safeParse(validDocInput).success).toBe(true)

      const negativeChars = { filePath: '/docs/test.pdf', maxChars: -10 }
      expect(DocumentsExtractTextTool.inputSchema.safeParse(negativeChars).success).toBe(false)

      const excessiveChars = { filePath: '/docs/test.pdf', maxChars: 200000 } // Max is 100000
      expect(DocumentsExtractTextTool.inputSchema.safeParse(excessiveChars).success).toBe(false)
    })
  })

  describe('Sanitized Metadata Exposure', () => {
    it('creates an isolated, read-only metadata representation', () => {
      const metadata = sanitizeToolMetadata(DocumentsExtractTextTool)
      expect(metadata.id).toBe('documents:extract_text')
      expect(metadata.requiredCapabilities).toEqual(['documents:extract'])
      expect(metadata.riskTier).toBe('low')
      expect(metadata.limits.timeoutMs).toBe(45000)
    })
  })
})
