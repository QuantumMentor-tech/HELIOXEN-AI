/**
 * HELIOXEN AI — Step 25: Authoritative Tool Registry
 * Centralized, type-safe, validated, and permission-aware tool registry.
 * Strictly separates definition from execution and prevents capability self-granting.
 */

import {
  ToolDefinition,
  ToolMetadata,
  ToolQueryFilter,
  ToolEligibilityEvaluation,
  ToolValidationResult,
  OpenAiToolSchema,
  GeminiToolDeclaration
} from './types'
import {
  validateToolIdentifier,
  normalizeZodError,
  sanitizeToolMetadata,
  toOpenAiTool,
  toGeminiTool
} from './contracts'
import { CAPABILITIES } from '../security/capabilities'

export class ToolRegistry {
  private definitions: Map<string, ToolDefinition> = new Map()

  /**
   * Registers an approved tool definition into the authoritative registry.
   * Enforces atomic validation, identifier format, schema integrity, and duplicate prevention.
   */
  public register(def: ToolDefinition): void {
    if (!def) {
      throw new Error('Tool definition cannot be null or undefined')
    }

    // 1. Validate identifier syntax
    const idCheck = validateToolIdentifier(def.id)
    if (!idCheck.valid) {
      throw new Error(`Tool registration failed: ${idCheck.error}`)
    }

    // 2. Reject duplicate identifiers (no silent overwriting)
    if (this.definitions.has(def.id)) {
      throw new Error(`Tool registration conflict: Tool with identifier '${def.id}' is already registered`)
    }

    // 3. Validate required fields
    if (!def.displayName || !def.description || !def.category || !def.version) {
      throw new Error(`Tool registration failed for '${def.id}': Missing required metadata fields`)
    }

    // 4. Validate schemas exist
    if (!def.inputSchema || !def.outputSchema || !def.jsonSchema) {
      throw new Error(`Tool registration failed for '${def.id}': Tool must declare inputSchema, outputSchema, and jsonSchema`)
    }

    // 5. Verify required capabilities against authoritative capability definitions
    for (const capId of def.requiredCapabilities) {
      const capDef = CAPABILITIES[capId]
      if (!capDef) {
        throw new Error(
          `Tool registration failed for '${def.id}': Unknown required capability '${capId}'`
        )
      }
      // Prohibited capabilities can only be associated with prohibited tools
      if (capDef.riskTier === 'prohibited' && def.riskTier !== 'prohibited') {
        throw new Error(
          `Tool registration failed for '${def.id}': Cannot declare prohibited capability '${capId}' without 'prohibited' risk tier`
        )
      }
    }

    // 6. Freeze definition to ensure immutability
    const frozenDef: ToolDefinition = Object.freeze({
      ...def,
      requiredCapabilities: Object.freeze([...def.requiredCapabilities]),
      tags: def.tags ? Object.freeze([...def.tags]) : undefined,
      limits: Object.freeze({ ...def.limits })
    })

    this.definitions.set(def.id, frozenDef)
  }

  /**
   * Unregisters a tool definition.
   */
  public unregister(id: string): boolean {
    return this.definitions.delete(id)
  }

  /**
   * Resolves a tool definition by its exact identifier.
   */
  public get(id: string): ToolDefinition | undefined {
    return this.definitions.get(id)
  }

  /**
   * Retrieves sanitized, read-only metadata for a registered tool.
   */
  public getMetadata(id: string): ToolMetadata | undefined {
    const def = this.definitions.get(id)
    if (!def) return undefined
    return sanitizeToolMetadata(def)
  }

  /**
   * Lists registered tool metadata with deterministic ordering, optionally filtered.
   */
  public list(filter?: ToolQueryFilter): ToolMetadata[] {
    const list = Array.from(this.definitions.values())
      .filter((def) => {
        if (filter?.category && def.category !== filter.category) return false
        if (filter?.riskTier && def.riskTier !== filter.riskTier) return false
        if (filter?.implementationStatus && def.implementationStatus !== filter.implementationStatus) return false
        if (filter?.registrationStatus && def.registrationStatus !== filter.registrationStatus) return false
        if (filter?.search) {
          const s = filter.search.toLowerCase()
          const matches =
            def.id.toLowerCase().includes(s) ||
            def.displayName.toLowerCase().includes(s) ||
            def.description.toLowerCase().includes(s)
          if (!matches) return false
        }
        return true
      })
      .sort((a, b) => a.id.localeCompare(b.id)) // Deterministic alphabetical sort

    return list.map(sanitizeToolMetadata)
  }

  /**
   * Validates an untrusted input payload against a registered tool's input schema.
   */
  public validateInput<T = any>(toolId: string, input: unknown): ToolValidationResult<T> {
    const def = this.definitions.get(toolId)
    if (!def) {
      return {
        valid: false,
        errors: [{ message: `Unrecognized tool identifier: '${toolId}'`, code: 'TOOL_NOT_FOUND' }]
      }
    }

    if (def.registrationStatus === 'disabled') {
      return {
        valid: false,
        errors: [{ message: `Tool '${toolId}' is currently disabled`, code: 'TOOL_DISABLED' }]
      }
    }

    const parseResult = def.inputSchema.safeParse(input)
    if (parseResult.success) {
      return { valid: true, data: parseResult.data as T }
    }

    return {
      valid: false,
      errors: normalizeZodError(parseResult.error)
    }
  }

  /**
   * Validates a candidate execution result against a registered tool's output schema.
   */
  public validateOutput<T = any>(toolId: string, output: unknown): ToolValidationResult<T> {
    const def = this.definitions.get(toolId)
    if (!def) {
      return {
        valid: false,
        errors: [{ message: `Unrecognized tool identifier: '${toolId}'`, code: 'TOOL_NOT_FOUND' }]
      }
    }

    const parseResult = def.outputSchema.safeParse(output)
    if (parseResult.success) {
      return { valid: true, data: parseResult.data as T }
    }

    return {
      valid: false,
      errors: normalizeZodError(parseResult.error)
    }
  }

  /**
   * Evaluates whether a tool is eligible for invocation in an authorized context.
   * Evaluates definition requirement, implementation availability, and granted capability permissions.
   */
  public evaluateEligibility(
    toolId: string,
    grantedCapabilities: readonly string[] = []
  ): ToolEligibilityEvaluation {
    const def = this.definitions.get(toolId)
    if (!def) {
      return {
        eligible: false,
        toolId,
        reason: `Tool '${toolId}' does not exist in registry.`,
        requiresConfirmation: false,
        requiredCapabilities: []
      }
    }

    // 1. Prohibited risk tier check (takes precedence over registration state)
    if (def.riskTier === 'prohibited' || def.confirmationPolicy === 'prohibited') {
      return {
        eligible: false,
        toolId,
        reason: `Tool '${toolId}' is classified as prohibited and cannot be invoked.`,
        requiresConfirmation: false,
        requiredCapabilities: def.requiredCapabilities
      }
    }

    // 2. Check registration status
    if (def.registrationStatus !== 'enabled') {
      return {
        eligible: false,
        toolId,
        reason: `Tool '${toolId}' is disabled.`,
        requiresConfirmation: false,
        requiredCapabilities: def.requiredCapabilities
      }
    }

    // 3. Check implementation availability
    if (def.implementationStatus !== 'available') {
      return {
        eligible: false,
        toolId,
        reason: `Tool '${toolId}' implementation is currently unavailable (${def.implementationStatus}).`,
        requiresConfirmation: false,
        requiredCapabilities: def.requiredCapabilities
      }
    }

    // Required capabilities verification
    const grantedSet = new Set(grantedCapabilities)
    for (const capId of def.requiredCapabilities) {
      if (!grantedSet.has(capId)) {
        return {
          eligible: false,
          toolId,
          reason: `Missing required security capability: '${capId}'.`,
          requiresConfirmation: false,
          requiredCapabilities: def.requiredCapabilities
        }
      }
    }

    return {
      eligible: true,
      toolId,
      requiresConfirmation: def.confirmationPolicy === 'user_confirmation',
      requiredCapabilities: def.requiredCapabilities
    }
  }

  /**
   * Generates model-facing OpenAI function declarations for registered tools.
   */
  public formatOpenAiTools(toolIds?: readonly string[]): OpenAiToolSchema[] {
    const targetDefs = toolIds
      ? toolIds.map((id) => this.definitions.get(id)).filter((d): d is ToolDefinition => !!d)
      : Array.from(this.definitions.values())

    return targetDefs
      .filter((d) => d.registrationStatus === 'enabled' && d.riskTier !== 'prohibited')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toOpenAiTool)
  }

  /**
   * Generates model-facing Google Gemini function declarations for registered tools.
   */
  public formatGeminiTools(toolIds?: readonly string[]): GeminiToolDeclaration[] {
    const targetDefs = toolIds
      ? toolIds.map((id) => this.definitions.get(id)).filter((d): d is ToolDefinition => !!d)
      : Array.from(this.definitions.values())

    return targetDefs
      .filter((d) => d.registrationStatus === 'enabled' && d.riskTier !== 'prohibited')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toGeminiTool)
  }

  /**
   * Returns current count of registered tools.
   */
  public get count(): number {
    return this.definitions.size
  }
}
