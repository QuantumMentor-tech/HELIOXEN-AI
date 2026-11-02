/**
 * HELIOXEN AI — Step 26: Trusted Plan Validator
 * Enforces structural, schema, registry, capability, dependency DAG, and data-binding validation.
 * No model-generated plan may reach the execution engine without passing this validation.
 */

import { ToolRegistry } from '../tools'
import {
  DEFAULT_PLANNER_LIMITS,
  PlannerLimits,
  PlanValidationResult,
  TaskPlan
} from './types'
import {
  TaskPlanSchema,
  topologicalSortPlan,
  calculateMaxDependencyDepth,
  extractAllDataBindings
} from './contracts'

export class PlanValidator {
  private readonly toolRegistry: ToolRegistry
  private readonly limits: PlannerLimits

  constructor(toolRegistry: ToolRegistry, limits: PlannerLimits = DEFAULT_PLANNER_LIMITS) {
    this.toolRegistry = toolRegistry
    this.limits = limits
  }

  /**
   * Deterministically validates an untrusted candidate plan against authoritative contracts.
   * If any check fails, the plan is rejected atomically.
   */
  public validate(plan: unknown): PlanValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Structural Schema Validation
    const schemaResult = TaskPlanSchema.safeParse(plan)
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        errors.push(`Structural validation failed at "${issue.path.join('.')}": ${issue.message}`)
      }
      return { valid: false, errors, warnings }
    }

    const validPlan = schemaResult.data as TaskPlan

    // 2. Payload Size Limit Validation
    const serialized = JSON.stringify(validPlan)
    const payloadBytes = Buffer.byteLength(serialized, 'utf8')
    if (payloadBytes > this.limits.maxPlanPayloadBytes) {
      errors.push(
        `Plan payload size (${payloadBytes} bytes) exceeds maximum limit (${this.limits.maxPlanPayloadBytes} bytes)`
      )
    }

    // 3. Step Count Bounds
    if (validPlan.steps.length > this.limits.maxSteps) {
      errors.push(
        `Plan step count (${validPlan.steps.length}) exceeds maximum allowable steps (${this.limits.maxSteps})`
      )
    }

    // Pure conversational responses with no steps are structurally valid
    if (validPlan.steps.length === 0) {
      if (validPlan.requiresTools) {
        errors.push('Plan declares requiresTools: true but contains no operational steps')
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        topologicalOrder: []
      }
    }

    // 4. Unique Step Identifier Validation
    const seenStepIds = new Set<string>()
    for (const step of validPlan.steps) {
      if (seenStepIds.has(step.id)) {
        errors.push(`Duplicate step identifier detected: "${step.id}"`)
      }
      seenStepIds.add(step.id)
    }

    // 5. Dependency Graph & DAG Topological Order Validation
    const sortResult = topologicalSortPlan(validPlan.steps)
    if (sortResult.missingDependencies.length > 0) {
      errors.push(...sortResult.missingDependencies)
    }
    if (sortResult.hasCycle) {
      errors.push(sortResult.cycleDetails || 'Plan dependency graph contains a cycle')
    }

    // 6. Maximum Dependency Depth Validation
    const maxDepth = calculateMaxDependencyDepth(validPlan.steps)
    if (maxDepth > this.limits.maxDependencyDepth) {
      errors.push(
        `Dependency chain depth (${maxDepth}) exceeds allowable maximum (${this.limits.maxDependencyDepth})`
      )
    }

    // 7. Tool Registry & Capability Validation for Each Step
    for (const step of validPlan.steps) {
      const toolDef = this.toolRegistry.get(step.toolId)
      if (!toolDef) {
        errors.push(
          `Step "${step.id}" references unknown or unregistered tool: "${step.toolId}"`
        )
        continue
      }

      // Check tool implementation availability
      if (toolDef.implementationStatus !== 'available') {
        errors.push(
          `Step "${step.id}" references tool "${step.toolId}" with unavailable implementation (${toolDef.implementationStatus})`
        )
      }

      // Check tool registration status
      if (toolDef.registrationStatus !== 'enabled') {
        errors.push(
          `Step "${step.id}" references disabled tool: "${step.toolId}"`
        )
      }

      // Check risk tier — prohibited tools (e.g. shell:execute) are strictly barred
      if (toolDef.riskTier === 'prohibited') {
        errors.push(
          `Step "${step.id}" requests prohibited tool "${step.toolId}" under strict security policy`
        )
      }

      // 8. Data Binding & Prerequisite Validation
      const bindings = extractAllDataBindings(step.input)
      for (const binding of bindings) {
        // Source step must exist
        if (!seenStepIds.has(binding.sourceStepId)) {
          errors.push(
            `Step "${step.id}" references data from nonexistent step "${binding.sourceStepId}"`
          )
          continue
        }

        // Source step must be an explicit prerequisite dependency
        if (!step.dependencies.includes(binding.sourceStepId)) {
          errors.push(
            `Step "${step.id}" binds data from step "${binding.sourceStepId}", but does not declare it as a dependency`
          )
        }

        // In topological sort, source step must precede current step
        if (sortResult.sortedStepIds.length > 0) {
          const sourceIdx = sortResult.sortedStepIds.indexOf(binding.sourceStepId)
          const currentIdx = sortResult.sortedStepIds.indexOf(step.id)
          if (sourceIdx >= currentIdx) {
            errors.push(
              `Step "${step.id}" binds data from downstream or concurrent step "${binding.sourceStepId}"`
            )
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      topologicalOrder: errors.length === 0 ? sortResult.sortedStepIds : undefined
    }
  }
}
