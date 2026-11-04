/**
 * HELIOXEN AI — Step 40: Agent Town & Dynamic Skills Contracts and Pure Utilities
 * Enforces strict runtime validation, DAG cycle detection, declarative data-flow resolution,
 * and capability derivation for agents, plugins, connectors, and skills.
 */

import { z } from 'zod'
import type { RiskTier } from '../security/capabilities'
import {
  AgentCategory,
  AgentDefinition,
  AGENT_TOWN_SCHEMA_VERSION,
  ConnectorDescriptor,
  DynamicSkillDefinition,
  PluginManifest,
  SkillDataBinding,
  SkillStepDefinition
} from './types'

// ============================================================================
// 1. ZOD RUNTIME SCHEMAS
// ============================================================================

export const AgentCategorySchema = z.enum([
  'general',
  'research',
  'coding',
  'productivity',
  'system',
  'specialized'
])

export const AgentRuntimeStatusSchema = z.enum([
  'idle',
  'assigned',
  'running',
  'awaiting_approval',
  'waiting_dependency',
  'paused',
  'cancelling',
  'completed',
  'failed',
  'unavailable',
  'disabled'
])

export const AgentModelEligibilitySchema = z.object({
  eligibleModelIds: z.array(z.string().min(1)).min(1),
  preferredModelId: z.string().optional(),
  requiresVision: z.boolean().optional(),
  requiresToolCalling: z.boolean().optional()
})

export const AgentDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,64}$/, 'Agent ID must be 3-64 alphanumeric characters with underscores/hyphens'),
  displayName: z.string().min(2).max(100),
  purpose: z.string().min(5).max(300),
  description: z.string().min(10).max(1000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver (e.g. 1.0.0)'),
  category: AgentCategorySchema,
  requiredCapabilities: z.array(z.string().min(1)),
  modelEligibility: AgentModelEligibilitySchema,
  defaultToolIds: z.array(z.string().min(1)),
  enabled: z.boolean().default(true),
  status: AgentRuntimeStatusSchema.default('idle'),
  iconName: z.string().max(64).optional(),
  tags: z.array(z.string().max(40)).optional(),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now())
})

export const ConnectorScopeSchema = z.object({
  scopeId: z.string().min(1).max(64),
  displayName: z.string().min(2).max(100),
  description: z.string().min(5).max(300),
  scopeType: z.enum(['read_only', 'read_write', 'administrative']),
  granted: z.boolean().default(false)
})

export const ConnectorDescriptorSchema = z.object({
  connectorId: z.string().regex(/^[a-z0-9_-]{3,64}$/),
  displayName: z.string().min(2).max(100),
  description: z.string().min(5).max(500),
  protocol: z.enum(['native_adapter', 'mcp_spec', 'webhook_receiver']),
  status: z.enum([
    'not_configured',
    'disconnected',
    'awaiting_authorization',
    'connected',
    'auth_expired',
    'insufficient_permission',
    'disabled',
    'error'
  ]),
  scopes: z.array(ConnectorScopeSchema),
  credentialIdReference: z.string().max(120).nullable().optional(),
  endpointUrl: z.string().url().max(500).nullable().optional(),
  allowsWriteOperations: z.boolean().default(false),
  lastConnectedAt: z.number().nullable().optional(),
  lastErrorMessage: z.string().nullable().optional()
})

export const PluginManifestSchema = z.object({
  pluginId: z.string().regex(/^[a-z0-9_-]{3,64}$/),
  displayName: z.string().min(2).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(10).max(1000),
  publisher: z.object({
    name: z.string().min(2).max(100),
    verified: z.boolean().default(false),
    homepageUrl: z.string().url().optional()
  }),
  license: z.string().min(1).max(100),
  manifestSchemaVersion: z.number().int().default(AGENT_TOWN_SCHEMA_VERSION),
  connectors: z.array(ConnectorDescriptorSchema),
  declaredToolIds: z.array(z.string().min(1)),
  requiredCapabilities: z.array(z.string().min(1)),
  enabled: z.boolean().default(true),
  installedAt: z.number().int().positive(),
  updatedAt: z.number().int().positive()
})

export const SkillDataBindingSchema = z.object({
  type: z.enum(['literal', 'step_output']),
  literalValue: z.unknown().optional(),
  sourceStepId: z.string().regex(/^[a-z0-9_-]{1,64}$/).optional(),
  fieldPath: z.string().regex(/^[a-zA-Z0-9_.[\]]+$/).max(120).optional()
})

export const SkillStepDefinitionSchema = z.object({
  stepId: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  displayName: z.string().min(2).max(100),
  toolId: z.string().min(1).max(100),
  inputBindings: z.record(z.string(), SkillDataBindingSchema),
  dependsOnStepIds: z.array(z.string().regex(/^[a-z0-9_-]{1,64}$/)),
  condition: z
    .object({
      sourceStepId: z.string().min(1),
      fieldPath: z.string().min(1),
      operator: z.enum(['equals', 'not_equals', 'truthy', 'falsy']),
      expectedValue: z.unknown().optional()
    })
    .optional(),
  requiresHumanApproval: z.boolean().optional()
})

export const DynamicSkillDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,64}$/),
  displayName: z.string().min(2).max(100),
  description: z.string().min(5).max(1000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author: z.string().min(2).max(100),
  category: AgentCategorySchema,
  steps: z.array(SkillStepDefinitionSchema).min(1).max(20),
  derivedCapabilities: z.array(z.string().min(1)),
  derivedRiskTier: z.enum(['low', 'moderate', 'high', 'prohibited']),
  status: z.enum([
    'draft',
    'validation_failed',
    'validated',
    'awaiting_approval',
    'enabled',
    'disabled',
    'deprecated'
  ]),
  constraints: z.object({
    maxTimeoutMs: z.number().int().min(1000).max(120000),
    maxStepRetries: z.number().int().min(0).max(3),
    stopOnFirstFailure: z.boolean()
  }),
  validationErrors: z.array(z.string()).optional(),
  lastTestedAt: z.number().nullable().optional(),
  lastDryRunSuccess: z.boolean().nullable().optional(),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now())
})

// ============================================================================
// 2. BUILT-IN VERIFIED AGENT DEFINITIONS
// ============================================================================

export const BUILTIN_AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  {
    id: 'agent_general',
    displayName: 'Core Assistant Agent',
    purpose: 'General-purpose dialogue, planning, and task synthesis.',
    description:
      'The foundational conversational assistant for user queries, direct reasoning, and step orchestration.',
    version: '1.0.0',
    category: 'general',
    requiredCapabilities: ['context:read', 'telemetry:readSystemHealth'],
    modelEligibility: {
      eligibleModelIds: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gpt-4o', 'gpt-4o-mini'],
      preferredModelId: 'gemini-3.8-flash',
      requiresToolCalling: true
    },
    defaultToolIds: ['system:get_time', 'workspace:get_context_summary'],
    enabled: true,
    status: 'idle',
    iconName: 'bot',
    tags: ['general', 'conversational', 'orchestration'],
    createdAt: 1762260000000,
    updatedAt: 1762260000000
  },
  {
    id: 'agent_researcher',
    displayName: 'Research Specialist Agent',
    purpose: 'Web exploration, document extraction, citations, and global situational intelligence.',
    description:
      'Gathers verified facts across authorized web search, document parsing, and World Monitor news intelligence.',
    version: '1.0.0',
    category: 'research',
    requiredCapabilities: ['research:webSearch', 'documents:extract', 'world:read'],
    modelEligibility: {
      eligibleModelIds: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gpt-4o'],
      preferredModelId: 'gemini-3.8-flash',
      requiresToolCalling: true
    },
    defaultToolIds: [
      'research:web_search',
      'research:extract_tab_content',
      'world:query_news_feed',
      'world:search_locations'
    ],
    enabled: true,
    status: 'idle',
    iconName: 'globe',
    tags: ['research', 'web', 'documents', 'news'],
    createdAt: 1762260000000,
    updatedAt: 1762260000000
  },
  {
    id: 'agent_coding',
    displayName: 'Code & Diagram Engineer',
    purpose: 'Mermaid visualization studio, diagram generation, and structured code analysis.',
    description:
      'Specializes in structured technical workflows, architecture diagrams via VisualHub, and validated schemas.',
    version: '1.0.0',
    category: 'coding',
    requiredCapabilities: ['visual:renderMermaid', 'visual:saveDiagram'],
    modelEligibility: {
      eligibleModelIds: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gpt-4o'],
      preferredModelId: 'gemini-3.8-flash',
      requiresToolCalling: true
    },
    defaultToolIds: ['visual:render_mermaid', 'visual:export_diagram'],
    enabled: true,
    status: 'idle',
    iconName: 'code',
    tags: ['coding', 'diagrams', 'mermaid', 'architecture'],
    createdAt: 1762260000000,
    updatedAt: 1762260000000
  },
  {
    id: 'agent_productivity',
    displayName: 'Productivity Coordinator',
    purpose: 'Notes, task management, deadlines, reminders, and daily briefings.',
    description:
      'Maintains local productivity items, scheduling, calendar checks, and synthesizes morning briefings.',
    version: '1.0.0',
    category: 'productivity',
    requiredCapabilities: ['productivity:notes', 'productivity:tasks', 'productivity:briefing'],
    modelEligibility: {
      eligibleModelIds: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gpt-4o-mini'],
      preferredModelId: 'gemini-3.8-flash',
      requiresToolCalling: true
    },
    defaultToolIds: ['notes:create', 'notes:search', 'tasks:create', 'tasks:list', 'briefing:generate'],
    enabled: true,
    status: 'idle',
    iconName: 'check-square',
    tags: ['productivity', 'notes', 'tasks', 'calendar'],
    createdAt: 1762260000000,
    updatedAt: 1762260000000
  },
  {
    id: 'agent_system_operator',
    displayName: 'Desktop & Telemetry Operator',
    purpose: 'Local system health inspection, bounded network diagnostics, and window discovery.',
    description:
      'Supervises host machine resources, application health, approved endpoint connectivity, and desktop awareness.',
    version: '1.0.0',
    category: 'system',
    requiredCapabilities: [
      'telemetry:readSystemHealth',
      'telemetry:readDesktopWindows',
      'widgets:readSystemHealth',
      'widgets:runNetworkDiagnostic'
    ],
    modelEligibility: {
      eligibleModelIds: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gpt-4o-mini'],
      preferredModelId: 'gemini-3.8-flash',
      requiresToolCalling: true
    },
    defaultToolIds: [
      'widgets:get_system_health',
      'widgets:run_network_diagnostic',
      'system:list_windows'
    ],
    enabled: true,
    status: 'idle',
    iconName: 'cpu',
    tags: ['system', 'health', 'network', 'telemetry'],
    createdAt: 1762260000000,
    updatedAt: 1762260000000
  }
] as const

// ============================================================================
// 3. BUILT-IN APPROVED PLUGIN MANIFESTS & CONNECTORS
// ============================================================================

export const BUILTIN_PLUGIN_MANIFESTS: readonly PluginManifest[] = [
  {
    pluginId: 'plugin_github_connector',
    displayName: 'GitHub Developer Connector',
    version: '1.0.0',
    description:
      'Inspect public GitHub repositories, open issues, and pull request metadata without executing remote scripts.',
    publisher: {
      name: 'HELIOXEN Core Integrations',
      verified: true,
      homepageUrl: 'https://github.com'
    },
    license: 'MIT',
    manifestSchemaVersion: AGENT_TOWN_SCHEMA_VERSION,
    connectors: [
      {
        connectorId: 'conn_github_api',
        displayName: 'GitHub REST & GraphQL API Connector',
        description:
          'Connects to GitHub using Personal Access Tokens for issue reading and repository inspection.',
        protocol: 'native_adapter',
        status: 'disconnected',
        scopes: [
          {
            scopeId: 'repo:read',
            displayName: 'Read Repository & Issues',
            description: 'Inspect public and assigned repository contents, commit logs, and issues.',
            scopeType: 'read_only',
            granted: true
          },
          {
            scopeId: 'repo:write',
            displayName: 'Create Issue / PR Comments',
            description: 'Post comments and file draft issues upon explicit user confirmation.',
            scopeType: 'read_write',
            granted: false
          }
        ],
        allowsWriteOperations: false,
        endpointUrl: 'https://api.github.com'
      }
    ],
    declaredToolIds: [],
    requiredCapabilities: ['research:webSearch'],
    enabled: true,
    installedAt: 1762260000000,
    updatedAt: 1762260000000
  },
  {
    pluginId: 'plugin_weather_intelligence',
    displayName: 'Open-Meteo Weather Connector',
    version: '1.0.0',
    description:
      'Provides global atmospheric condition retrieval, 24h hourly strip, and 7-day weather outlooks under CC BY 4.0.',
    publisher: {
      name: 'Open-Meteo & HELIOXEN Team',
      verified: true,
      homepageUrl: 'https://open-meteo.com'
    },
    license: 'CC BY 4.0',
    manifestSchemaVersion: AGENT_TOWN_SCHEMA_VERSION,
    connectors: [
      {
        connectorId: 'conn_open_meteo',
        displayName: 'Open-Meteo Forecast & Geocoding Connector',
        description: 'Queries public Open-Meteo forecast endpoints with optional commercial key support.',
        protocol: 'native_adapter',
        status: 'connected',
        scopes: [
          {
            scopeId: 'weather:read',
            displayName: 'Read Global Weather Conditions',
            description: 'Fetches non-commercial weather data and geocoding candidates.',
            scopeType: 'read_only',
            granted: true
          }
        ],
        allowsWriteOperations: false,
        endpointUrl: 'https://api.open-meteo.com/v1/forecast'
      }
    ],
    declaredToolIds: ['widgets:get_weather_forecast'],
    requiredCapabilities: ['widgets:readWeather'],
    enabled: true,
    installedAt: 1762260000000,
    updatedAt: 1762260000000
  },
  {
    pluginId: 'plugin_local_productivity',
    displayName: 'Integrated Productivity Subsystem',
    version: '1.0.0',
    description:
      'First-class connector to local SQLite/JSON Notes, Tasks, Reminders, and Daily Briefing repositories.',
    publisher: {
      name: 'HELIOXEN Core Architecture',
      verified: true
    },
    license: 'MIT',
    manifestSchemaVersion: AGENT_TOWN_SCHEMA_VERSION,
    connectors: [
      {
        connectorId: 'conn_local_productivity',
        displayName: 'Local Productivity Storage Connector',
        description: 'Read and write access to user-owned personal productivity records.',
        protocol: 'native_adapter',
        status: 'connected',
        scopes: [
          {
            scopeId: 'notes:read_write',
            displayName: 'Manage Notes',
            description: 'Read, search, and author personal notes.',
            scopeType: 'read_write',
            granted: true
          },
          {
            scopeId: 'tasks:read_write',
            displayName: 'Manage Task Lists',
            description: 'Track and complete personal tasks.',
            scopeType: 'read_write',
            granted: true
          }
        ],
        allowsWriteOperations: true
      }
    ],
    declaredToolIds: ['notes:create', 'notes:search', 'tasks:create', 'tasks:list', 'tasks:complete'],
    requiredCapabilities: ['productivity:notes', 'productivity:tasks'],
    enabled: true,
    installedAt: 1762260000000,
    updatedAt: 1762260000000
  }
] as const

// ============================================================================
// 4. PURE SKILL WORKFLOW GRAPH VALIDATION UTILITIES
// ============================================================================

export interface SkillGraphValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stepOrder: string[]
}

/**
 * Validates a declarative skill workflow DAG:
 * 1. Checks that all step IDs are unique.
 * 2. Checks that every step references an existing, registered tool.
 * 3. Verifies that all dependency references (`dependsOnStepIds`) exist and appear prior in the DAG.
 * 4. Detects cyclic dependencies using topological sort.
 * 5. Validates data-flow bindings (`steps.<sourceStepId>...`) refer only to prior steps.
 * 6. Strictly blocks embedded executable scripts (e.g. `eval`, `process.`, `<script>`, `require(`).
 */
export function validateSkillWorkflowGraph(
  skill: { steps: readonly SkillStepDefinition[] },
  registeredToolIds: ReadonlySet<string>
): SkillGraphValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const stepIds = new Set<string>()

  if (!skill.steps || skill.steps.length === 0) {
    return { valid: false, errors: ['Skill must declare at least one step.'], warnings: [], stepOrder: [] }
  }

  if (skill.steps.length > 20) {
    errors.push(`Skill exceeds maximum permitted step limit of 20 (received ${skill.steps.length}).`)
  }

  // 1. Uniqueness of step IDs and tool existence
  for (const step of skill.steps) {
    if (stepIds.has(step.stepId)) {
      errors.push(`Duplicate stepId '${step.stepId}' found in skill definition.`)
    }
    stepIds.add(step.stepId)

    if (!registeredToolIds.has(step.toolId)) {
      errors.push(`Step '${step.stepId}' references unregistered or disabled tool '${step.toolId}'.`)
    }

    // Check for malicious / executable payload strings in literal bindings
    for (const [inputKey, binding] of Object.entries(step.inputBindings)) {
      if (binding.type === 'literal' && typeof binding.literalValue === 'string') {
        const str = binding.literalValue.toLowerCase()
        if (
          str.includes('eval(') ||
          str.includes('function(') ||
          str.includes('<script') ||
          str.includes('process.') ||
          str.includes('require(') ||
          str.includes('child_process')
        ) {
          errors.push(
            `Security violation: Step '${step.stepId}' input '${inputKey}' contains prohibited script primitives.`
          )
        }
      }
    }
  }

  // 2. Dependency resolution and cycle detection via Kahn's algorithm
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const step of skill.steps) {
    inDegree.set(step.stepId, 0)
    adjList.set(step.stepId, [])
  }

  for (const step of skill.steps) {
    for (const depId of step.dependsOnStepIds) {
      if (!stepIds.has(depId)) {
        errors.push(`Step '${step.stepId}' depends on non-existent step '${depId}'.`)
        continue
      }
      if (depId === step.stepId) {
        errors.push(`Step '${step.stepId}' cannot depend on itself (self-dependency loop).`)
        continue
      }
      adjList.get(depId)!.push(step.stepId)
      inDegree.set(step.stepId, (inDegree.get(step.stepId) || 0) + 1)
    }

    // Also check step_output data-flow bindings
    for (const [paramName, binding] of Object.entries(step.inputBindings)) {
      if (binding.type === 'step_output') {
        if (!binding.sourceStepId) {
          errors.push(`Step '${step.stepId}' input '${paramName}' declares step_output but omits sourceStepId.`)
        } else if (!stepIds.has(binding.sourceStepId)) {
          errors.push(
            `Step '${step.stepId}' input '${paramName}' references non-existent step '${binding.sourceStepId}'.`
          )
        } else if (binding.sourceStepId === step.stepId) {
          errors.push(`Step '${step.stepId}' cannot bind its own output as an input.`)
        } else if (!step.dependsOnStepIds.includes(binding.sourceStepId)) {
          errors.push(
            `Step '${step.stepId}' input '${paramName}' binds output of '${binding.sourceStepId}', but does not declare it in dependsOnStepIds.`
          )
        }
      }
    }
  }

  // Topological sort
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const stepOrder: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    stepOrder.push(curr)

    for (const neighbor of adjList.get(curr) || []) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  if (stepOrder.length !== skill.steps.length) {
    errors.push('Cyclic dependency detected in skill step workflow graph.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stepOrder
  }
}

/**
 * Resolves a declarative SkillDataBinding against earlier step outputs safely without `eval`.
 */
export function resolveSkillDataBinding(
  binding: SkillDataBinding,
  priorStepOutputs: ReadonlyMap<string, unknown>
): unknown {
  if (binding.type === 'literal') {
    return binding.literalValue
  }

  if (binding.type === 'step_output') {
    if (!binding.sourceStepId) return undefined
    const stepOutput = priorStepOutputs.get(binding.sourceStepId)
    if (stepOutput === undefined || stepOutput === null) return undefined

    if (!binding.fieldPath || binding.fieldPath === 'output' || binding.fieldPath === 'result') {
      return stepOutput
    }

    // Safe path traversal without eval (e.g. 'result.summary' or 'items[0].id')
    const segments = binding.fieldPath.replace(/\[(\w+)\]/g, '.$1').split('.')
    let current: any = stepOutput
    for (const seg of segments) {
      if (current === null || current === undefined) return undefined
      current = current[seg]
    }
    return current
  }

  return undefined
}
