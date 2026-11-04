/**
 * HELIOXEN AI — Step 41: Multi-Agent Collaboration Contracts & Graph Validation
 * Runtime validation schemas, DAG dependency resolution, privilege boundary enforcement,
 * and conflict detection for multi-agent coordinated execution.
 */

import { z } from 'zod'
import type { RiskTier } from '../security/capabilities'
import {
  CollaborationPlanInput,
  CollaborationPlanValidationResult,
  CollaborationResourceBudget,
  ConflictingClaim,
  DEFAULT_COLLABORATION_BUDGET,
  DelegatedChildTaskDefinition
} from './collaborationTypes'

export const CollaborationResourceBudgetSchema = z.object({
  maxChildTasks: z.number().int().min(1).max(25).default(DEFAULT_COLLABORATION_BUDGET.maxChildTasks),
  maxDelegationDepth: z.number().int().min(1).max(5).default(DEFAULT_COLLABORATION_BUDGET.maxDelegationDepth),
  maxConcurrency: z.number().int().min(1).max(8).default(DEFAULT_COLLABORATION_BUDGET.maxConcurrency),
  maxExecutionTimeMs: z.number().int().min(1000).max(300000).default(DEFAULT_COLLABORATION_BUDGET.maxExecutionTimeMs),
  maxRetriesPerChild: z.number().int().min(0).max(3).default(DEFAULT_COLLABORATION_BUDGET.maxRetriesPerChild)
})

export const SourceProvenanceRefSchema = z.object({
  sourceId: z.string().min(1).max(128),
  title: z.string().max(256).optional(),
  url: z.string().max(1024).optional(),
  citationText: z.string().max(1024).optional()
})

export const DelegatedContextEnvelopeSchema = z.object({
  objective: z.string().min(3).max(500),
  inputData: z.record(z.string(), z.unknown()).default({}),
  predecessorOutputs: z.record(z.string(), z.unknown()).default({}),
  sourceProvenance: z.array(SourceProvenanceRefSchema).optional(),
  capabilityConstraints: z.array(z.string()).default([]),
  isReadOnly: z.boolean().default(true)
})

export const DelegatedChildTaskDefinitionSchema = z.object({
  childTaskId: z.string().regex(/^[a-z0-9_-]{3,64}$/, 'Child task ID must be 3-64 alphanumeric characters'),
  assignedAgentId: z.string().min(1).max(64),
  objective: z.string().min(5).max(500),
  requiredCapabilities: z.array(z.string()).default([]),
  toolId: z.string().optional(),
  toolInput: z.record(z.string(), z.unknown()).optional(),
  inputEnvelope: DelegatedContextEnvelopeSchema,
  dependencies: z.array(z.string()).default([]),
  delegationDepth: z.number().int().min(1).max(5).default(1),
  isReadOnly: z.boolean().default(true),
  expectedOutputSchema: z.record(z.string(), z.unknown()).optional()
})

export const CollaborationPlanInputSchema = z.object({
  parentTaskId: z.string().regex(/^[a-z0-9_-]{3,64}$/).optional(),
  conversationId: z.string().min(1).max(128),
  userIntent: z.string().min(5).max(1000),
  authorizedScope: z.array(z.string()),
  childTasks: z.array(DelegatedChildTaskDefinitionSchema).min(1).max(25),
  budget: CollaborationResourceBudgetSchema.partial().optional()
})

/**
 * Validates a proposed multi-agent collaboration plan against structural, dependency,
 * agent eligibility, and security privilege rules.
 */
export function validateCollaborationPlan(
  plan: CollaborationPlanInput,
  options: {
    enabledAgentIds: ReadonlySet<string>
    toolRegistryIds?: ReadonlySet<string>
  }
): CollaborationPlanValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Structural schema parse
  const parseResult = CollaborationPlanInputSchema.safeParse(plan)
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      warnings: [],
      topologicalOrder: [],
      derivedRiskTier: 'low'
    }
  }

  const validPlan = parseResult.data
  const budget: CollaborationResourceBudget = {
    ...DEFAULT_COLLABORATION_BUDGET,
    ...(validPlan.budget || {})
  }

  // 2. Child task count and depth enforcement
  if (validPlan.childTasks.length > budget.maxChildTasks) {
    errors.push(
      `Child task count (${validPlan.childTasks.length}) exceeds resource budget limit (${budget.maxChildTasks}).`
    )
  }

  const childTaskIds = new Set<string>()
  const parentScopeSet = new Set(validPlan.authorizedScope)
  let highestRiskTier: RiskTier = 'low'

  for (const child of validPlan.childTasks) {
    // Unique child ID
    if (childTaskIds.has(child.childTaskId)) {
      errors.push(`Duplicate childTaskId detected: '${child.childTaskId}'.`)
    }
    childTaskIds.add(child.childTaskId)

    // Agent exists and is enabled
    if (!options.enabledAgentIds.has(child.assignedAgentId)) {
      errors.push(
        `Child task '${child.childTaskId}' assigned to unknown or disabled agent '${child.assignedAgentId}'.`
      )
    }

    // Delegation depth limit
    if (child.delegationDepth > budget.maxDelegationDepth) {
      errors.push(
        `Child task '${child.childTaskId}' delegation depth (${child.delegationDepth}) exceeds maximum depth (${budget.maxDelegationDepth}).`
      )
    }

    // Permission inheritance: child task capabilities cannot exceed authorized parent scope
    for (const cap of child.requiredCapabilities) {
      if (!parentScopeSet.has(cap) && !parentScopeSet.has('*')) {
        errors.push(
          `Privilege escalation rejected: Child task '${child.childTaskId}' requires capability '${cap}' which is not in parent authorized scope.`
        )
      }
    }

    // If child task invokes a tool directly, verify tool registration
    if (child.toolId && options.toolRegistryIds && !options.toolRegistryIds.has(child.toolId)) {
      errors.push(
        `Child task '${child.childTaskId}' references unregistered or unavailable tool '${child.toolId}'.`
      )
    }

    // Sensitive credential leak scan in context envelope
    const serializedInput = JSON.stringify(child.inputEnvelope.inputData).toLowerCase()
    if (
      serializedInput.includes('bearer ') ||
      serializedInput.includes('api_key') ||
      serializedInput.includes('apikey') ||
      serializedInput.includes('password') ||
      serializedInput.includes('secret') ||
      serializedInput.includes('client_secret')
    ) {
      errors.push(
        `Security boundary violation: Child task '${child.childTaskId}' context envelope contains raw credential tokens or leaked secrets.`
      )
    }
  }

  // 3. Dependency validation and cycle detection via Kahn's algorithm
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const child of validPlan.childTasks) {
    inDegree.set(child.childTaskId, 0)
    adjList.set(child.childTaskId, [])
  }

  for (const child of validPlan.childTasks) {
    for (const depId of child.dependencies) {
      if (!childTaskIds.has(depId)) {
        errors.push(
          `Child task '${child.childTaskId}' declares non-existent prerequisite dependency '${depId}'.`
        )
        continue
      }
      if (depId === child.childTaskId) {
        errors.push(`Self-dependency loop detected in child task '${child.childTaskId}'.`)
        continue
      }
      adjList.get(depId)!.push(child.childTaskId)
      inDegree.set(child.childTaskId, (inDegree.get(child.childTaskId) || 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const topologicalOrder: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    topologicalOrder.push(curr)

    for (const neighbor of adjList.get(curr) || []) {
      const nextDeg = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, nextDeg)
      if (nextDeg === 0) queue.push(neighbor)
    }
  }

  if (topologicalOrder.length !== validPlan.childTasks.length) {
    errors.push('Dependency cycle detected in multi-agent collaboration plan.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    topologicalOrder,
    derivedRiskTier: highestRiskTier
  }
}

/**
 * Compares structured outputs across child tasks to detect factual or field contradictions
 * without fabricating consensus.
 */
export function detectOutputConflicts(
  childResults: Array<{
    childTaskId: string
    assignedAgentId: string
    output: unknown
    sourceProvenance?: readonly { sourceId: string; url?: string }[]
  }>
): ConflictingClaim[] {
  const conflicts: ConflictingClaim[] = []
  const seenOutputs = new Map<string, { agentId: string; value: unknown; source?: string }>()

  for (const res of childResults) {
    if (!res.output || typeof res.output !== 'object') continue
    const record = res.output as Record<string, unknown>

    for (const [key, value] of Object.entries(record)) {
      if (value === undefined || value === null) continue
      const existing = seenOutputs.get(key)
      if (existing) {
        // Compare values
        const serializedExisting = JSON.stringify(existing.value)
        const serializedCurrent = JSON.stringify(value)

        if (serializedExisting !== serializedCurrent) {
          conflicts.push({
            fieldOrTopic: key,
            agentA: {
              agentId: existing.agentId,
              claim: existing.value,
              source: existing.source
            },
            agentB: {
              agentId: res.assignedAgentId,
              claim: value,
              source: res.sourceProvenance?.[0]?.url || res.sourceProvenance?.[0]?.sourceId
            },
            resolutionStrategy: 'preserved_both'
          })
        }
      } else {
        seenOutputs.set(key, {
          agentId: res.assignedAgentId,
          value,
          source: res.sourceProvenance?.[0]?.url || res.sourceProvenance?.[0]?.sourceId
        })
      }
    }
  }

  return conflicts
}

