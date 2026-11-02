import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import {
  BUILTIN_TOOL_CATALOG,
  SystemGetTimeTool,
  DocumentsExtractTextTool,
  ProhibitedShellExecuteTool
} from '../../src/shared/tools/catalog'
import { ToolDefinition, DEFAULT_TOOL_LIMITS } from '../../src/shared/tools/types'
import { z } from 'zod'

describe('Step 25: Capabilities, Risk Tiers, and Eligibility Evaluation', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
  })

  describe('Capability Definition Verification', () => {
    it('rejects registration of a tool with an unknown security capability', () => {
      const invalidTool: ToolDefinition = {
        id: 'test:unauthorized_cap',
        displayName: 'Test Tool',
        description: 'Test description',
        category: 'utility',
        version: '1.0.0',
        inputSchema: z.object({}).strict(),
        outputSchema: z.object({}).strict(),
        jsonSchema: { type: 'object', properties: {} },
        requiredCapabilities: ['unknown:phantom_capability_xyz'],
        riskTier: 'low',
        confirmationPolicy: 'none',
        implementationStatus: 'available',
        registrationStatus: 'enabled',
        executionMode: 'synchronous',
        limits: DEFAULT_TOOL_LIMITS,
        source: 'builtin'
      }

      expect(() => registry.register(invalidTool)).toThrowError(
        /Unknown required capability 'unknown:phantom_capability_xyz'/i
      )
    })

    it('rejects declaring prohibited capability without prohibited risk tier', () => {
      const hostileTool: ToolDefinition = {
        id: 'test:bypass_prohibited',
        displayName: 'Bypass Tool',
        description: 'Claims low risk for shell',
        category: 'utility',
        version: '1.0.0',
        inputSchema: z.object({}).strict(),
        outputSchema: z.object({}).strict(),
        jsonSchema: { type: 'object', properties: {} },
        requiredCapabilities: ['shell:execute'],
        riskTier: 'low', // Illegal mismatch with prohibited capability
        confirmationPolicy: 'none',
        implementationStatus: 'available',
        registrationStatus: 'enabled',
        executionMode: 'synchronous',
        limits: DEFAULT_TOOL_LIMITS,
        source: 'builtin'
      }

      expect(() => registry.register(hostileTool)).toThrowError(
        /Cannot declare prohibited capability.*without 'prohibited' risk tier/i
      )
    })
  })

  describe('Eligibility Evaluation & Authorization', () => {
    it('evaluates a tool with no required capabilities as eligible', () => {
      const evalResult = registry.evaluateEligibility('system:get_time', [])
      expect(evalResult.eligible).toBe(true)
      expect(evalResult.requiresConfirmation).toBe(false)
    })

    it('marks a tool as ineligible when required capabilities are not granted', () => {
      const evalResult = registry.evaluateEligibility('documents:extract_text', [])
      expect(evalResult.eligible).toBe(false)
      expect(evalResult.reason).toContain("Missing required security capability: 'documents:extract'")
    })

    it('marks a tool as eligible when required capabilities are granted', () => {
      const evalResult = registry.evaluateEligibility('documents:extract_text', ['documents:extract'])
      expect(evalResult.eligible).toBe(true)
    })

    it('always evaluates prohibited tools as ineligible regardless of granted capabilities', () => {
      const evalResult = registry.evaluateEligibility('shell:execute', ['shell:execute'])
      expect(evalResult.eligible).toBe(false)
      expect(evalResult.reason).toContain('prohibited')
    })

    it('marks a disabled tool as ineligible', () => {
      registry.register({
        ...SystemGetTimeTool,
        id: 'system:disabled_time',
        registrationStatus: 'disabled'
      })
      const evalResult = registry.evaluateEligibility('system:disabled_time')
      expect(evalResult.eligible).toBe(false)
      expect(evalResult.reason).toContain('is disabled')
    })

    it('reports tool as ineligible if not present in registry', () => {
      const evalResult = registry.evaluateEligibility('nonexistent:tool')
      expect(evalResult.eligible).toBe(false)
      expect(evalResult.reason).toContain('does not exist in registry')
    })
  })
})
