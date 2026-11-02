/**
 * HELIOXEN AI — Step 26: Orchestration Contracts, Validation Schemas and Graph Algorithms
 * Zod validation schemas for task plans, execution results, data-binding parser, and topological sorter.
 */

import { z } from 'zod'
import {
  DEFAULT_PLANNER_LIMITS,
  DataBindingRef,
  PlanStep,
  TaskPlan,
  TaskExecutionResult,
  StepExecutionResult
} from './types'

export const PlanStepSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Step ID must be alphanumeric with underscores or hyphens'),
  toolId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9_]+:[a-z0-9_]+$/, 'Tool ID must follow "namespace:action" format'),
  description: z.string().min(1).max(500),
  input: z.record(z.string(), z.unknown()),
  dependencies: z
    .array(z.string().min(1).max(64))
    .max(DEFAULT_PLANNER_LIMITS.maxDependenciesPerStep),
  requiresConfirmation: z.boolean().optional()
})

export const TaskPlanSchema = z.object({
  id: z.string().min(1).max(128),
  taskId: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semantic versioning (e.g. 1.0.0)'),
  intent: z.string().min(1).max(1000),
  requiresTools: z.boolean(),
  clarificationNeeded: z.string().max(1000).optional(),
  steps: z.array(PlanStepSchema).max(DEFAULT_PLANNER_LIMITS.maxSteps),
  createdAt: z.number().int().positive()
})

export const StepExecutionResultSchema = z.object({
  stepId: z.string().min(1).max(64),
  toolId: z.string().min(1).max(128),
  status: z.enum(['succeeded', 'completed', 'failed', 'cancelled', 'skipped', 'outcome_unknown']),
  input: z.unknown(),
  output: z.unknown().optional(),
  error: z.string().max(2000).optional(),
  durationMs: z.number().nonnegative(),
  startedAt: z.number().int().positive(),
  finishedAt: z.number().int().positive(),
  retryAttempts: z.number().int().nonnegative().default(0)
})

export const TaskExecutionResultSchema = z.object({
  taskId: z.string().min(1).max(128),
  planId: z.string().min(1).max(128),
  status: z.enum([
    'completed',
    'partially_completed',
    'partial',
    'failed',
    'rejected',
    'cancelled',
    'outcome_unknown'
  ]),
  stepResults: z.record(z.string(), StepExecutionResultSchema),
  finalOutput: z.unknown().optional(),
  error: z.string().max(2000).optional(),
  totalDurationMs: z.number().nonnegative(),
  startedAt: z.number().int().positive(),
  finishedAt: z.number().int().positive()
})

export const TaskCancellationRequestSchema = z.object({
  taskId: z.string().min(1).max(128),
  reason: z.string().max(500).optional(),
  requestedBy: z.string().max(64).optional()
})

export const TaskCancellationResultSchema = z.object({
  taskId: z.string().min(1).max(128),
  accepted: z.boolean(),
  currentState: z.string().min(1).max(64),
  message: z.string().min(1).max(500)
})

export const TaskProgressEventSchema = z.object({
  id: z.string().min(1).max(128),
  taskId: z.string().min(1).max(128),
  stepId: z.string().min(1).max(64).optional(),
  sequenceNumber: z.number().int().positive(),
  eventType: z.string().min(1).max(64),
  previousState: z.string().min(1).max(64).optional(),
  newState: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
  timestamp: z.number().int().positive(),
  retryAttempt: z.number().int().nonnegative().optional(),
  completedStepCount: z.number().int().nonnegative(),
  totalStepCount: z.number().int().nonnegative(),
  errorCategory: z.string().max(128).optional(),
  durationMs: z.number().nonnegative().optional()
})

export const AuditEventSchema = z.object({
  id: z.string().min(1).max(128),
  schemaVersion: z.literal('1.0.0'),
  taskId: z.string().min(1).max(128),
  stepId: z.string().min(1).max(64).optional(),
  sequenceNumber: z.number().int().positive(),
  timestamp: z.number().int().positive(),
  eventType: z.string().min(1).max(64),
  toolId: z.string().min(1).max(128).optional(),
  toolVersion: z.string().max(32).optional(),
  attemptNumber: z.number().int().nonnegative(),
  previousState: z.string().max(64).optional(),
  newState: z.string().min(1).max(64),
  resultCategory: z.string().max(128).optional(),
  authorizationOutcome: z.enum(['granted', 'denied']).optional(),
  confirmationOutcome: z.enum(['not_required', 'approved', 'rejected']).optional(),
  durationMs: z.number().nonnegative().optional(),
  sourceComponent: z.string().min(1).max(128),
  sanitizedMetadata: z.record(z.string(), z.unknown()).optional()
})

/**
 * Regular expression matching data binding references: "$step.<stepId>.output.<path>"
 */
export const DATA_BINDING_REGEX = /^\$step\.([a-zA-Z0-9_-]{1,64})\.output\.([a-zA-Z0-9_.-]+)$/

/**
 * Parses a candidate value into a DataBindingRef if it conforms to the binding contract.
 */
export function parseDataBinding(value: unknown): DataBindingRef | null {
  if (typeof value !== 'string') return null
  const match = value.match(DATA_BINDING_REGEX)
  if (!match) return null
  return {
    sourceStepId: match[1],
    outputPropertyPath: match[2]
  }
}

/**
 * Extracts all data binding references present recursively in an arbitrary input structure.
 */
export function extractAllDataBindings(input: unknown): DataBindingRef[] {
  const bindings: DataBindingRef[] = []

  function traverse(current: unknown): void {
    if (!current) return
    if (typeof current === 'string') {
      const parsed = parseDataBinding(current)
      if (parsed) bindings.push(parsed)
    } else if (Array.isArray(current)) {
      for (const item of current) {
        traverse(item)
      }
    } else if (typeof current === 'object') {
      for (const val of Object.values(current)) {
        traverse(val)
      }
    }
  }

  traverse(input)
  return bindings
}

/**
 * Safely extracts a property from a nested object using dot-separated notation.
 */
export function getNestedProperty(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  const parts = path.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[part]
  }
  return current
}

/**
 * Replaces data binding references with actual resolved prerequisite step outputs.
 */
export function substituteDataBindings<T = unknown>(
  input: T,
  stepOutputs: Record<string, unknown>
): { resolved: T; missingBindings: string[] } {
  const missingBindings: string[] = []

  function resolveValue(val: unknown): unknown {
    if (typeof val === 'string') {
      const binding = parseDataBinding(val)
      if (!binding) return val

      const sourceOutput = stepOutputs[binding.sourceStepId]
      if (sourceOutput === undefined) {
        missingBindings.push(`Prerequisite step "${binding.sourceStepId}" has no available output`)
        return undefined
      }

      const extracted = getNestedProperty(sourceOutput, binding.outputPropertyPath)
      if (extracted === undefined) {
        missingBindings.push(
          `Property "${binding.outputPropertyPath}" was not found in output of step "${binding.sourceStepId}"`
        )
        return undefined
      }
      return extracted
    }

    if (Array.isArray(val)) {
      return val.map((item) => resolveValue(item))
    }

    if (val !== null && typeof val === 'object') {
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val)) {
        result[k] = resolveValue(v)
      }
      return result
    }

    return val
  }

  const resolved = resolveValue(input) as T
  return { resolved, missingBindings }
}

/**
 * Topological Sort via Kahn's Algorithm.
 * Returns sorted step IDs in deterministic dependency order, or detects cycles / missing nodes.
 */
export function topologicalSortPlan(steps: readonly PlanStep[]): {
  sortedStepIds: string[]
  hasCycle: boolean
  cycleDetails?: string
  missingDependencies: string[]
} {
  const stepMap = new Map<string, PlanStep>()
  for (const step of steps) {
    stepMap.set(step.id, step)
  }

  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()
  const missingDependencies: string[] = []

  for (const step of steps) {
    inDegree.set(step.id, 0)
    adjList.set(step.id, [])
  }

  // Populate graph and in-degrees
  for (const step of steps) {
    for (const depId of step.dependencies) {
      if (!stepMap.has(depId)) {
        missingDependencies.push(
          `Step "${step.id}" depends on nonexistent step "${depId}"`
        )
        continue
      }
      if (depId === step.id) {
        return {
          sortedStepIds: [],
          hasCycle: true,
          cycleDetails: `Step "${step.id}" cannot depend on itself (self-dependency detected)`,
          missingDependencies
        }
      }
      adjList.get(depId)!.push(step.id)
      inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1)
    }
  }

  if (missingDependencies.length > 0) {
    return {
      sortedStepIds: [],
      hasCycle: false,
      missingDependencies
    }
  }

  // Queue of nodes with 0 in-degree (ready to execute)
  const queue: string[] = []
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id)
    }
  }

  // Deterministic order: sort initial independent steps by original plan position
  const stepIndices = new Map<string, number>()
  steps.forEach((s, idx) => stepIndices.set(s.id, idx))
  queue.sort((a, b) => (stepIndices.get(a) || 0) - (stepIndices.get(b) || 0))

  const sortedStepIds: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    sortedStepIds.push(current)

    const neighbors = adjList.get(current) || []
    for (const neighbor of neighbors) {
      const newDegree = inDegree.get(neighbor)! - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
        queue.sort((a, b) => (stepIndices.get(a) || 0) - (stepIndices.get(b) || 0))
      }
    }
  }

  if (sortedStepIds.length !== steps.length) {
    const unvisited = steps.filter((s) => !sortedStepIds.includes(s.id)).map((s) => s.id)
    return {
      sortedStepIds: [],
      hasCycle: true,
      cycleDetails: `Cyclic dependency detected involving steps: [${unvisited.join(', ')}]`,
      missingDependencies
    }
  }

  return {
    sortedStepIds,
    hasCycle: false,
    missingDependencies: []
  }
}

/**
 * Calculates the maximum dependency chain depth across the plan DAG.
 */
export function calculateMaxDependencyDepth(steps: readonly PlanStep[]): number {
  if (steps.length === 0) return 0

  const stepMap = new Map<string, PlanStep>()
  for (const step of steps) {
    stepMap.set(step.id, step)
  }

  const memo = new Map<string, number>()

  function getDepth(stepId: string, visited: Set<string>): number {
    if (visited.has(stepId)) return 0 // cycle guard
    if (memo.has(stepId)) return memo.get(stepId)!

    const step = stepMap.get(stepId)
    if (!step || step.dependencies.length === 0) {
      memo.set(stepId, 1)
      return 1
    }

    visited.add(stepId)
    let maxChildDepth = 0
    for (const depId of step.dependencies) {
      const childDepth = getDepth(depId, visited)
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth
      }
    }
    visited.delete(stepId)

    const depth = 1 + maxChildDepth
    memo.set(stepId, depth)
    return depth
  }

  let overallMax = 0
  for (const step of steps) {
    const depth = getDepth(step.id, new Set())
    if (depth > overallMax) overallMax = depth
  }

  return overallMax
}
