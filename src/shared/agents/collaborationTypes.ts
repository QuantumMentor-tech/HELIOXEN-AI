/**
 * HELIOXEN AI — Step 41: Multi-Agent Collaboration and Delegation Types
 * Canonical contracts for parent-child tasks, delegation envelopes, bounded resource budgets,
 * dependency tracking, conflict resolution, and aggregated outcomes.
 */

import type { RiskTier } from '../security/capabilities'
import type { AgentRuntimeStatus } from './types'

export const COLLABORATION_SCHEMA_VERSION = 1

export type CoordinationPhase =
  | 'created'
  | 'validating'
  | 'scheduled'
  | 'executing'
  | 'aggregating'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled'

export type ChildTaskExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked'

export interface CollaborationResourceBudget {
  readonly maxChildTasks: number
  readonly maxDelegationDepth: number
  readonly maxConcurrency: number
  readonly maxExecutionTimeMs: number
  readonly maxRetriesPerChild: number
}

export const DEFAULT_COLLABORATION_BUDGET: CollaborationResourceBudget = {
  maxChildTasks: 10,
  maxDelegationDepth: 3,
  maxConcurrency: 4,
  maxExecutionTimeMs: 60000,
  maxRetriesPerChild: 1
} as const

export interface SourceProvenanceRef {
  readonly sourceId: string
  readonly title?: string
  readonly url?: string
  readonly citationText?: string
}

export interface DelegatedContextEnvelope {
  readonly objective: string
  readonly inputData: Record<string, unknown>
  readonly predecessorOutputs: Record<string, unknown>
  readonly sourceProvenance?: readonly SourceProvenanceRef[]
  readonly capabilityConstraints: readonly string[]
  readonly isReadOnly: boolean
}

export interface DelegatedChildTaskDefinition {
  readonly childTaskId: string
  readonly assignedAgentId: string
  readonly objective: string
  readonly requiredCapabilities: readonly string[]
  readonly toolId?: string
  readonly toolInput?: Record<string, unknown>
  readonly inputEnvelope: DelegatedContextEnvelope
  readonly dependencies: readonly string[]
  readonly delegationDepth: number
  readonly isReadOnly: boolean
  readonly expectedOutputSchema?: Record<string, unknown>
}

export interface ChildTaskRecord {
  readonly childTaskId: string
  readonly parentTaskId: string
  readonly assignedAgentId: string
  readonly objective: string
  readonly status: ChildTaskExecutionStatus
  readonly delegationDepth: number
  readonly dependencies: readonly string[]
  readonly inputEnvelope: DelegatedContextEnvelope
  readonly output?: unknown
  readonly error?: string
  readonly toolReferences?: readonly string[]
  readonly retryCount: number
  readonly startedAt?: number | null
  readonly finishedAt?: number | null
  readonly durationMs?: number
}

export interface ConflictingClaim {
  readonly fieldOrTopic: string
  readonly agentA: {
    readonly agentId: string
    readonly claim: unknown
    readonly source?: string
  }
  readonly agentB: {
    readonly agentId: string
    readonly claim: unknown
    readonly source?: string
  }
  readonly resolutionStrategy: 'preserved_both' | 'user_escalation_required' | 'latest_evidence'
}

export interface CoordinatedParentResult {
  readonly summary: string
  readonly aggregatedOutput: Record<string, unknown>
  readonly completedOperations: readonly string[]
  readonly failedOperations: readonly string[]
  readonly blockedOperations: readonly string[]
  readonly conflicts: readonly ConflictingClaim[]
  readonly limitations: readonly string[]
}

export interface CoordinatedParentTask {
  readonly parentTaskId: string
  readonly conversationId: string
  readonly userIntent: string
  readonly authorizedScope: readonly string[]
  readonly phase: CoordinationPhase
  readonly status: 'created' | 'running' | 'completed' | 'partially_completed' | 'failed' | 'cancelled'
  readonly childTaskIds: readonly string[]
  readonly childTasks: Record<string, ChildTaskRecord>
  readonly budget: CollaborationResourceBudget
  readonly aggregateProgress: {
    readonly total: number
    readonly completed: number
    readonly failed: number
    readonly blocked: number
    readonly running: number
  }
  readonly finalResult?: CoordinatedParentResult | null
  readonly error?: string
  readonly cancellationRequested: boolean
  readonly cancellationReason?: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface CollaborationPlanInput {
  readonly parentTaskId?: string
  readonly conversationId: string
  readonly userIntent: string
  readonly authorizedScope: readonly string[]
  readonly childTasks: readonly DelegatedChildTaskDefinition[]
  readonly budget?: Partial<CollaborationResourceBudget>
}

export interface CollaborationPlanValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly topologicalOrder: readonly string[]
  readonly derivedRiskTier: RiskTier
}

