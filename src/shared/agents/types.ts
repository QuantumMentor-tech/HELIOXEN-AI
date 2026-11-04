/**
 * HELIOXEN AI — Step 40: Agent Town, Plugin Connectors, and Dynamic Skills Framework
 * Shared Domain Types and Data Contracts.
 * Strictly separates agents, plugins, connectors, and declarative skills.
 */

import type { RiskTier } from '../security/capabilities'
import type { ToolMetadata, ToolDefinition } from '../tools/types'

export const AGENT_TOWN_SCHEMA_VERSION = 1

// ============================================================================
// 1. AGENT TOWN & AGENT REGISTRY TYPES
// ============================================================================

export type AgentCategory =
  | 'general'
  | 'research'
  | 'coding'
  | 'productivity'
  | 'system'
  | 'specialized'

export type AgentRuntimeStatus =
  | 'idle'
  | 'assigned'
  | 'running'
  | 'awaiting_approval'
  | 'waiting_dependency'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'unavailable'
  | 'disabled'

export interface AgentModelEligibility {
  readonly eligibleModelIds: readonly string[]
  readonly preferredModelId?: string
  readonly requiresVision?: boolean
  readonly requiresToolCalling?: boolean
}

export interface AgentTaskAssignment {
  readonly taskId: string
  readonly taskDescription: string
  readonly startedAt: number
  readonly status: AgentRuntimeStatus
  readonly currentStepIndex?: number
  readonly totalSteps?: number
}

export interface AgentDefinition {
  readonly id: string
  readonly displayName: string
  readonly purpose: string
  readonly description: string
  readonly version: string
  readonly category: AgentCategory
  readonly requiredCapabilities: readonly string[]
  readonly modelEligibility: AgentModelEligibility
  readonly defaultToolIds: readonly string[]
  readonly enabled: boolean
  readonly status: AgentRuntimeStatus
  readonly activeAssignment?: AgentTaskAssignment | null
  readonly iconName?: string
  readonly tags?: readonly string[]
  readonly createdAt: number
  readonly updatedAt: number
}

// ============================================================================
// 2. PLUGIN & CONNECTOR FRAMEWORK TYPES
// ============================================================================

export type ConnectorConnectionStatus =
  | 'not_configured'
  | 'disconnected'
  | 'awaiting_authorization'
  | 'connected'
  | 'auth_expired'
  | 'insufficient_permission'
  | 'disabled'
  | 'error'

export type ConnectorScopeType = 'read_only' | 'read_write' | 'administrative'

export interface ConnectorScopeDeclaration {
  readonly scopeId: string
  readonly displayName: string
  readonly description: string
  readonly scopeType: ConnectorScopeType
  readonly granted: boolean
}

export interface ConnectorDescriptor {
  readonly connectorId: string
  readonly displayName: string
  readonly description: string
  readonly protocol: 'native_adapter' | 'mcp_spec' | 'webhook_receiver'
  readonly status: ConnectorConnectionStatus
  readonly scopes: readonly ConnectorScopeDeclaration[]
  readonly credentialIdReference?: string | null
  readonly endpointUrl?: string | null
  readonly allowsWriteOperations: boolean
  readonly lastConnectedAt?: number | null
  readonly lastErrorMessage?: string | null
}

export interface PluginManifest {
  readonly pluginId: string
  readonly displayName: string
  readonly version: string
  readonly description: string
  readonly publisher: {
    readonly name: string
    readonly verified: boolean
    readonly homepageUrl?: string
  }
  readonly license: string
  readonly manifestSchemaVersion: number
  readonly connectors: readonly ConnectorDescriptor[]
  readonly declaredToolIds: readonly string[]
  readonly requiredCapabilities: readonly string[]
  readonly enabled: boolean
  readonly installedAt: number
  readonly updatedAt: number
}

// ============================================================================
// 3. DYNAMIC SKILLS FRAMEWORK TYPES
// ============================================================================

export type SkillLifecycleStatus =
  | 'draft'
  | 'validation_failed'
  | 'validated'
  | 'awaiting_approval'
  | 'enabled'
  | 'disabled'
  | 'deprecated'

export interface SkillDataBinding {
  /** Reference type: literal value or output reference from a prior step */
  readonly type: 'literal' | 'step_output'
  readonly literalValue?: unknown
  /** Step ID of producing step (e.g. 'step_1') */
  readonly sourceStepId?: string
  /** Field path inside step output (e.g. 'result.summary' or 'items') */
  readonly fieldPath?: string
}

export interface SkillStepDefinition {
  readonly stepId: string
  readonly displayName: string
  readonly toolId: string
  readonly inputBindings: Record<string, SkillDataBinding>
  readonly dependsOnStepIds: readonly string[]
  /** Optional declarative condition for branching (strictly non-executable equality/truthiness) */
  readonly condition?: {
    readonly sourceStepId: string
    readonly fieldPath: string
    readonly operator: 'equals' | 'not_equals' | 'truthy' | 'falsy'
    readonly expectedValue?: unknown
  }
  readonly requiresHumanApproval?: boolean
}

export interface SkillExecutionConstraint {
  readonly maxTimeoutMs: number
  readonly maxStepRetries: number
  readonly stopOnFirstFailure: boolean
}

export interface DynamicSkillDefinition {
  readonly id: string
  readonly displayName: string
  readonly description: string
  readonly version: string
  readonly author: string
  readonly category: AgentCategory
  readonly steps: readonly SkillStepDefinition[]
  readonly derivedCapabilities: readonly string[]
  readonly derivedRiskTier: RiskTier
  readonly status: SkillLifecycleStatus
  readonly constraints: SkillExecutionConstraint
  readonly validationErrors?: readonly string[]
  readonly lastTestedAt?: number | null
  readonly lastDryRunSuccess?: boolean | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface SkillValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly stepOrder: readonly string[]
  readonly derivedRiskTier?: RiskTier
}

export interface DynamicSkillCreateInput {
  readonly id?: string
  readonly name?: string
  readonly displayName?: string
  readonly description?: string
  readonly category?: AgentCategory | string
  readonly version?: string
  readonly steps?: readonly any[]
  readonly author?: string
  readonly constraints?: Partial<SkillExecutionConstraint>
  readonly inputs?: Record<string, unknown>
  readonly outputBinding?: Record<string, unknown>
}

export interface SkillDryRunResult {
  readonly skillId: string
  readonly valid: boolean
  readonly simulatedSteps: readonly {
    readonly stepId: string
    readonly toolId: string
    readonly resolvedInputs: Record<string, unknown>
    readonly mockOutput: unknown
    readonly simulatedDurationMs: number
  }[]
  readonly derivedCapabilities: readonly string[]
  readonly validationErrors: readonly string[]
  readonly dryRunTimestamp: number
}

export interface SkillExecutionResult {
  readonly executionId: string
  readonly skillId: string
  readonly status: 'completed' | 'failed' | 'cancelled'
  readonly completedStepCount: number
  readonly totalStepCount: number
  readonly output: unknown
  readonly error?: string
  readonly startedAt: number
  readonly finishedAt: number
}

// ============================================================================
// 4. AGENT TOWN OVERVIEW SNAPSHOT
// ============================================================================

export interface AgentTownOverviewSnapshot {
  readonly agents: readonly AgentDefinition[]
  readonly plugins: readonly PluginManifest[]
  readonly skills: readonly DynamicSkillDefinition[]
  readonly totalAgents: number
  readonly activeAgentsCount: number
  readonly totalPlugins: number
  readonly connectedPluginsCount: number
  readonly totalSkills: number
  readonly enabledSkillsCount: number
  readonly acquiredAt: number
}
