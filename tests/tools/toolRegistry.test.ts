import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import {
  BUILTIN_TOOL_CATALOG,
  SystemGetTimeTool,
  DocumentsExtractTextTool
} from '../../src/shared/tools/catalog'
import { ToolDefinition, DEFAULT_TOOL_LIMITS } from '../../src/shared/tools/types'
import { z } from 'zod'

describe('Step 25: Authoritative Tool Registry Operations', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('Registration & Duplicate Prevention', () => {
    it('registers valid built-in tools', () => {
      registry.register(SystemGetTimeTool)
      expect(registry.count).toBe(1)
      expect(registry.get('system:get_time')).toBeDefined()
    })

    it('rejects duplicate tool registration with an atomic failure', () => {
      registry.register(SystemGetTimeTool)
      expect(() => registry.register(SystemGetTimeTool)).toThrowError(
        /already registered/i
      )
      expect(registry.count).toBe(1)
    })

    it('rejects registration with invalid identifier syntax', () => {
      const invalidTool: ToolDefinition = {
        ...SystemGetTimeTool,
        id: 'InvalidIdentifierWithoutColon'
      }
      expect(() => registry.register(invalidTool)).toThrowError(/must follow 'namespace:action_name'/i)
      expect(registry.count).toBe(0)
    })

    it('rejects registration with missing metadata', () => {
      const incompleteTool: any = {
        id: 'test:incomplete',
        displayName: '',
        description: 'Missing fields'
      }
      expect(() => registry.register(incompleteTool)).toThrowError(/missing required metadata/i)
      expect(registry.count).toBe(0)
    })
  })

  describe('Lookup & Listing', () => {
    beforeEach(() => {
      for (const tool of BUILTIN_TOOL_CATALOG) {
        registry.register(tool)
      }
    })

    it('resolves an exact registered tool by stable ID', () => {
      const tool = registry.get('documents:extract_text')
      expect(tool).toBeDefined()
      expect(tool?.category).toBe('documents')
    })

    it('returns undefined for an unknown tool ID', () => {
      expect(registry.get('unknown:tool')).toBeUndefined()
      expect(registry.getMetadata('unknown:tool')).toBeUndefined()
    })

    it('lists all registered tools with deterministic ordering', () => {
      const list = registry.list()
      expect(list.length).toBe(BUILTIN_TOOL_CATALOG.length)
      // Check alphabetical ordering
      const ids = list.map((t) => t.id)
      const sortedIds = [...ids].sort()
      expect(ids).toEqual(sortedIds)
    })

    it('filters tool list by category', () => {
      const systemTools = registry.list({ category: 'system' })
      expect(systemTools.every((t) => t.category === 'system')).toBe(true)
      expect(systemTools.some((t) => t.id === 'system:get_time')).toBe(true)
    })

    it('filters tool list by search keyword', () => {
      const matches = registry.list({ search: 'document' })
      expect(matches.some((t) => t.id === 'documents:extract_text')).toBe(true)
    })

    it('unregisters a registered tool', () => {
      expect(registry.unregister('system:get_time')).toBe(true)
      expect(registry.get('system:get_time')).toBeUndefined()
    })
  })

  describe('Input and Output Payload Validation', () => {
    beforeEach(() => {
      registry.register(SystemGetTimeTool)
      registry.register(DocumentsExtractTextTool)
    })

    it('validates a correct input payload', () => {
      const result = registry.validateInput('system:get_time', { timezone: 'UTC' })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.data).toEqual({ timezone: 'UTC' })
      }
    })

    it('returns normalized validation errors on invalid input', () => {
      const result = registry.validateInput('documents:extract_text', {
        filePath: '', // Minimum length is 1
        maxChars: -5
      })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    it('validates a correct tool output result', () => {
      const validOutput = {
        localTime: '2026-11-02 18:00:00',
        isoUtc: '2026-11-02T13:00:00.000Z',
        timestampMs: 1793540400000,
        timezone: 'UTC'
      }
      const result = registry.validateOutput('system:get_time', validOutput)
      expect(result.valid).toBe(true)
    })

    it('rejects an invalid tool output result', () => {
      const invalidOutput = {
        localTime: 'time',
        timestampMs: 'not-a-number'
      }
      const result = registry.validateOutput('system:get_time', invalidOutput)
      expect(result.valid).toBe(false)
    })
  })
})
