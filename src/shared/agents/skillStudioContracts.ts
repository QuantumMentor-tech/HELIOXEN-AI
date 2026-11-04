/**
 * HELIOXEN AI — Step 42: Skill Studio Contracts & Deterministic Validation Pipeline
 * Provides Zod schemas, 7-stage validation pipeline, canonical SHA-256 integrity hashing,
 * version diff comparison, and sanitized import/export packaging.
 */

import { z } from 'zod'
import * as crypto from 'crypto'
import {
  DynamicSkillDefinition,
  SkillStepDefinition,
  SkillDataBinding
} from './types'
import {
  SkillExportPackage,
  SkillImportPreview,
  SkillTestScenario,
  SkillValidationReport,
  SkillVersionDiff,
  ValidationIssue,
  ValidationStageName
} from './skillStudioTypes'
import { RiskTier, CAPABILITIES } from '../security/capabilities'

// ============================================================================
// 1. ZOD SCHEMAS
// ============================================================================

export const SkillTestScenarioSchema = z.object({
  scenarioId: z.string().min(1).max(64),
  skillId: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(512).default(''),
  inputParameters: z.record(z.string(), z.unknown()).default({}),
  mockToolOutputs: z.record(z.string(), z.unknown()).default({}),
  expectedOutput: z.unknown().optional(),
  expectedStatus: z.enum(['completed', 'failed']).default('completed'),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive()
})

export const SkillExportPackageSchema = z.object({
  format: z.literal('helioxen-skill-package'),
  packageSchemaVersion: z.literal(1),
  exportedAt: z.number().int().positive(),
  skill: z.object({
    id: z.string().min(1).max(64),
    displayName: z.string().min(1).max(128),
    description: z.string().max(1024),
    version: z.string().min(1).max(32),
    category: z.enum(['general', 'research', 'coding', 'productivity', 'system', 'specialized']),
    author: z.string().max(64),
    steps: z.array(z.any()),
    constraints: z.object({
      maxTimeoutMs: z.number().int().positive(),
      maxStepRetries: z.number().int().nonnegative(),
      stopOnFirstFailure: z.boolean()
    }),
    derivedCapabilities: z.array(z.string()),
    derivedRiskTier: z.enum(['low', 'moderate', 'high', 'prohibited'])
  }),
  testScenarios: z.array(z.any()).optional(),
  definitionHash: z.string().min(16)
})

// ============================================================================
// 2. CANONICAL SHA-256 HASH COMPUTATION
// ============================================================================

/**
 * Computes a deterministic canonical SHA-256 hash across definition content.
 * Normalizes step ordering, binding keys, and fields to prevent cosmetic diff noise.
 */
export function computeSkillDefinitionHash(skill: DynamicSkillDefinition): string {
  const normalizedSteps = [...skill.steps].map((s) => ({
    stepId: s.stepId,
    displayName: s.displayName,
    toolId: s.toolId,
    dependsOnStepIds: [...s.dependsOnStepIds].sort(),
    inputBindings: Object.keys(s.inputBindings)
      .sort()
      .reduce((acc, k) => {
        acc[k] = s.inputBindings[k]
        return acc
      }, {} as Record<string, SkillDataBinding>),
    requiresHumanApproval: Boolean(s.requiresHumanApproval)
  }))

  const canonicalPayload = {
    id: skill.id,
    displayName: skill.displayName,
    description: skill.description,
    version: skill.version,
    category: skill.category,
    steps: normalizedSteps,
    constraints: skill.constraints
  }

  const json = JSON.stringify(canonicalPayload)
  return crypto.createHash('sha256').update(json, 'utf-8').digest('hex')
}

// ============================================================================
// 3. DETERMINISTIC 7-STAGE VALIDATION PIPELINE
// ============================================================================

export interface ValidationRegistryOptions {
  readonly toolRegistryIds: Set<string>
  readonly enabledAgentIds?: Set<string>
  readonly toolDetails?: Map<
    string,
    {
      readonly requiredCapabilities: readonly string[]
      readonly riskTier: RiskTier
      readonly confirmationPolicy: string
      readonly enabled: boolean
    }
  >
  readonly resourceLimits?: {
    readonly maxSteps?: number
    readonly maxTimeoutMs?: number
    readonly maxRetries?: number
  }
}

/**
 * Executes the complete 7-stage validation pipeline on a skill definition.
 */
export function validateSkillStaged(
  definition: DynamicSkillDefinition,
  optionsOrRegistry: ValidationRegistryOptions | any
): SkillValidationReport {
  let options: ValidationRegistryOptions
  if (optionsOrRegistry && 'toolRegistryIds' in optionsOrRegistry) {
    options = optionsOrRegistry
  } else if (optionsOrRegistry && typeof optionsOrRegistry.getAll === 'function') {
    const tools = optionsOrRegistry.getAll()
    const toolDetails = new Map<string, any>()
    for (const t of tools) {
      toolDetails.set(t.id, {
        requiredCapabilities: t.requiredCapabilities || [],
        riskTier: t.riskTier || 'low',
        confirmationPolicy: t.confirmationPolicy || 'none',
        enabled: t.registrationStatus === 'enabled'
      })
    }
    options = {
      toolRegistryIds: new Set(tools.map((t: any) => t.id)),
      toolDetails
    }
  } else if (optionsOrRegistry && typeof optionsOrRegistry.list === 'function') {
    const tools = optionsOrRegistry.list()
    const toolDetails = new Map<string, any>()
    for (const t of tools) {
      toolDetails.set(t.id, {
        requiredCapabilities: t.requiredCapabilities || [],
        riskTier: t.riskTier || 'low',
        confirmationPolicy: t.confirmationPolicy || 'none',
        enabled: t.registrationStatus === 'enabled'
      })
    }
    options = {
      toolRegistryIds: new Set(tools.map((t: any) => t.id)),
      toolDetails
    }
  } else {
    options = { toolRegistryIds: new Set() }
  }

  const issues: ValidationIssue[] = []
  const stageResults: Record<ValidationStageName, { passed: boolean; issueCount: number }> = {
    structural: { passed: true, issueCount: 0 },
    registry_resolution: { passed: true, issueCount: 0 },
    data_flow: { passed: true, issueCount: 0 },
    dependency_graph: { passed: true, issueCount: 0 },
    authorization_risk: { passed: true, issueCount: 0 },
    resource_limits: { passed: true, issueCount: 0 }
  }

  const recordIssue = (issue: ValidationIssue) => {
    issues.push(issue)
    stageResults[issue.stage].issueCount++
    if (issue.severity === 'error') {
      stageResults[issue.stage].passed = false
    }
  }

  // -------------------------------------------------------------
  // Stage 1: Structural Validation
  // -------------------------------------------------------------
  if (!definition.id || definition.id.trim().length === 0) {
    recordIssue({
      stage: 'structural',
      severity: 'error',
      code: 'ERR_EMPTY_ID',
      message: 'Skill definition must specify a non-empty ID.'
    })
  }

  if (!definition.displayName || definition.displayName.trim().length === 0) {
    recordIssue({
      stage: 'structural',
      severity: 'error',
      code: 'ERR_EMPTY_NAME',
      message: 'Skill definition must specify a non-empty display name.'
    })
  }

  if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
    recordIssue({
      stage: 'structural',
      severity: 'error',
      code: 'ERR_NO_STEPS',
      message: 'Skill definition must define at least one workflow step.'
    })
  }

  const stepIds = new Set<string>()
  for (const step of definition.steps || []) {
    if (!step.stepId || step.stepId.trim().length === 0) {
      recordIssue({
        stage: 'structural',
        severity: 'error',
        code: 'ERR_INVALID_STEP_ID',
        message: 'Workflow step is missing a valid stepId.'
      })
    } else if (stepIds.has(step.stepId)) {
      recordIssue({
        stage: 'structural',
        severity: 'error',
        code: 'ERR_DUPLICATE_STEP_ID',
        stepId: step.stepId,
        message: `Duplicate stepId '${step.stepId}' detected.`
      })
    }
    stepIds.add(step.stepId)
  }

  // -------------------------------------------------------------
  // Stage 2: Registry Resolution
  // -------------------------------------------------------------
  for (const step of definition.steps || []) {
    if (!step.toolId) {
      recordIssue({
        stage: 'registry_resolution',
        severity: 'error',
        code: 'ERR_MISSING_TOOL_ID',
        stepId: step.stepId,
        message: `Step '${step.stepId}' does not declare a target toolId.`
      })
      continue
    }

    if (!options.toolRegistryIds.has(step.toolId)) {
      recordIssue({
        stage: 'registry_resolution',
        severity: 'error',
        code: 'ERR_UNRESOLVED_TOOL',
        stepId: step.stepId,
        message: `Step '${step.stepId}' references unregistered tool '${step.toolId}'.`,
        suggestedFix: 'Select an available registered tool from the tool catalog.'
      })
    } else if (options.toolDetails && options.toolDetails.has(step.toolId)) {
      const details = options.toolDetails.get(step.toolId)!
      if (!details.enabled) {
        recordIssue({
          stage: 'registry_resolution',
          severity: 'error',
          code: 'ERR_DISABLED_TOOL',
          stepId: step.stepId,
          message: `Referenced tool '${step.toolId}' is currently disabled in registry.`
        })
      }
    }
  }

  // -------------------------------------------------------------
  // Stage 3: Data-Flow & Secret Leak Validation
  // -------------------------------------------------------------
  const serialized = JSON.stringify(definition).toLowerCase()
  if (
    serialized.includes('bearer ') ||
    serialized.includes('api_key') ||
    serialized.includes('apikey') ||
    serialized.includes('password') ||
    serialized.includes('secret_key')
  ) {
    recordIssue({
      stage: 'data_flow',
      severity: 'error',
      code: 'ERR_CREDENTIAL_LEAK',
      message: 'Definition contains embedded raw credentials or authentication secrets in step bindings.'
    })
  }

  const stepIndexMap = new Map((definition.steps || []).map((s, idx) => [s.stepId, idx]))

  for (let idx = 0; idx < (definition.steps || []).length; idx++) {
    const step = definition.steps[idx]
    for (const [inputKey, binding] of Object.entries(step.inputBindings || {})) {
      if (binding.type === 'step_output') {
        if (!binding.sourceStepId) {
          recordIssue({
            stage: 'data_flow',
            severity: 'error',
            code: 'ERR_EMPTY_SOURCE_STEP',
            stepId: step.stepId,
            fieldPath: inputKey,
            message: `Binding for input '${inputKey}' in step '${step.stepId}' missing sourceStepId.`
          })
        } else if (!stepIds.has(binding.sourceStepId)) {
          recordIssue({
            stage: 'data_flow',
            severity: 'error',
            code: 'ERR_NONEXISTENT_SOURCE_STEP',
            stepId: step.stepId,
            fieldPath: inputKey,
            message: `Step '${step.stepId}' binds input '${inputKey}' to non-existent step '${binding.sourceStepId}'.`
          })
        } else {
          const sourceIdx = stepIndexMap.get(binding.sourceStepId)!
          if (sourceIdx >= idx) {
            recordIssue({
              stage: 'data_flow',
              severity: 'error',
              code: 'ERR_FORWARD_DATA_REFERENCE',
              stepId: step.stepId,
              fieldPath: inputKey,
              message: `Forward reference detected: Step '${step.stepId}' cannot bind to output of step '${binding.sourceStepId}', which executes later or concurrently.`
            })
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Stage 4: Dependency Graph & Kahn's Topological Ordering
  // -------------------------------------------------------------
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()
  for (const s of definition.steps || []) {
    inDegree.set(s.stepId, 0)
    adjList.set(s.stepId, [])
  }

  for (const s of definition.steps || []) {
    for (const depId of s.dependsOnStepIds || []) {
      if (!stepIds.has(depId)) {
        recordIssue({
          stage: 'dependency_graph',
          severity: 'error',
          code: 'ERR_UNRESOLVED_DEPENDENCY',
          stepId: s.stepId,
          message: `Step '${s.stepId}' depends on non-existent step '${depId}'.`
        })
        continue
      }
      if (depId === s.stepId) {
        recordIssue({
          stage: 'dependency_graph',
          severity: 'error',
          code: 'ERR_SELF_DEPENDENCY',
          stepId: s.stepId,
          message: `Step '${s.stepId}' cannot depend on itself.`
        })
        continue
      }
      adjList.get(depId)!.push(s.stepId)
      inDegree.set(s.stepId, (inDegree.get(s.stepId) || 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const stepOrder: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    stepOrder.push(curr)
    for (const neighbor of adjList.get(curr) || []) {
      const nextDeg = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, nextDeg)
      if (nextDeg === 0) queue.push(neighbor)
    }
  }

  if (stepOrder.length < stepIds.size) {
    recordIssue({
      stage: 'dependency_graph',
      severity: 'error',
      code: 'ERR_CYCLIC_DEPENDENCIES',
      message: 'Cyclic dependency loop detected across workflow steps.'
    })
  }

  // -------------------------------------------------------------
  // Stage 5: Authorization & Risk Analysis
  // -------------------------------------------------------------
  const derivedCaps = new Set<string>()
  const confirmationPoints: string[] = []
  let highestRiskTier: RiskTier = 'low'
  const riskRanks: Record<RiskTier, number> = { low: 1, moderate: 2, high: 3, prohibited: 4 }

  for (const step of definition.steps || []) {
    if (step.requiresHumanApproval) {
      confirmationPoints.push(step.stepId)
    }

    if (options.toolDetails && options.toolDetails.has(step.toolId)) {
      const details = options.toolDetails.get(step.toolId)!
      for (const cap of details.requiredCapabilities) {
        derivedCaps.add(cap)
        const capDef = (CAPABILITIES as any)[cap]
        if (capDef?.status === 'prohibited' || capDef?.riskTier === 'prohibited') {
          recordIssue({
            stage: 'authorization_risk',
            severity: 'error',
            code: 'ERR_PROHIBITED_CAPABILITY',
            stepId: step.stepId,
            message: `Step '${step.stepId}' requires permanently prohibited capability '${cap}'.`
          })
        }
      }
      if (riskRanks[details.riskTier] > riskRanks[highestRiskTier]) {
        highestRiskTier = details.riskTier
      }
    }
  }

  // -------------------------------------------------------------
  // Stage 6: Resource & Policy Limits
  // -------------------------------------------------------------
  const maxSteps = options.resourceLimits?.maxSteps ?? 20
  if (definition.steps && definition.steps.length > maxSteps) {
    recordIssue({
      stage: 'resource_limits',
      severity: 'error',
      code: 'ERR_MAX_STEPS_EXCEEDED',
      message: `Workflow step count (${definition.steps.length}) exceeds maximum limit (${maxSteps}).`
    })
  }

  const maxTimeout = options.resourceLimits?.maxTimeoutMs ?? 120000
  if (definition.constraints?.maxTimeoutMs && definition.constraints.maxTimeoutMs > maxTimeout) {
    recordIssue({
      stage: 'resource_limits',
      severity: 'warning',
      code: 'WARN_HIGH_TIMEOUT',
      message: `Execution timeout (${definition.constraints.maxTimeoutMs}ms) is higher than recommended (${maxTimeout}ms).`
    })
  }

  const hasErrors = issues.some((i) => i.severity === 'error')
  const hasWarnings = issues.some((i) => i.severity === 'warning')

  return {
    valid: !hasErrors,
    overallStatus: hasErrors ? 'failed' : hasWarnings ? 'passed_with_warnings' : 'passed',
    issues,
    stageResults,
    stepOrder: hasErrors ? [] : stepOrder,
    derivedCapabilities: Array.from(derivedCaps),
    derivedRiskTier: highestRiskTier,
    requiresHumanConsent: highestRiskTier === 'high' || confirmationPoints.length > 0,
    confirmationPoints,
    validatedAt: Date.now()
  }
}

// ============================================================================
// 4. VERSION COMPARISON UTILITY
// ============================================================================

export function compareSkillDefinitions(
  base: DynamicSkillDefinition,
  target: DynamicSkillDefinition
): SkillVersionDiff {
  const baseStepMap = new Map(base.steps.map((s) => [s.stepId, s]))
  const targetStepMap = new Map(target.steps.map((s) => [s.stepId, s]))

  const stepsAdded = target.steps.filter((s) => !baseStepMap.has(s.stepId)).map((s) => s.stepId)
  const stepsRemoved = base.steps.filter((s) => !targetStepMap.has(s.stepId)).map((s) => s.stepId)

  const stepsModified: Array<{
    readonly stepId: string
    readonly toolChanged?: { readonly from: string; readonly to: string }
    readonly bindingsChanged?: readonly string[]
    readonly dependenciesChanged?: readonly string[]
    readonly approvalRequirementChanged?: boolean
  }> = []

  for (const targetStep of target.steps) {
    const baseStep = baseStepMap.get(targetStep.stepId)
    if (!baseStep) continue

    const toolChanged =
      baseStep.toolId !== targetStep.toolId
        ? { from: baseStep.toolId, to: targetStep.toolId }
        : undefined

    const bindingsChanged: string[] = []
    const allInputKeys = Array.from(
      new Set([...Object.keys(baseStep.inputBindings), ...Object.keys(targetStep.inputBindings)])
    )
    for (const key of allInputKeys) {
      if (
        JSON.stringify(baseStep.inputBindings[key]) !==
        JSON.stringify(targetStep.inputBindings[key])
      ) {
        bindingsChanged.push(key)
      }
    }

    const dependenciesChanged =
      JSON.stringify([...baseStep.dependsOnStepIds].sort()) !==
      JSON.stringify([...targetStep.dependsOnStepIds].sort())
        ? targetStep.dependsOnStepIds
        : undefined

    const approvalRequirementChanged =
      Boolean(baseStep.requiresHumanApproval) !== Boolean(targetStep.requiresHumanApproval)

    if (
      toolChanged ||
      bindingsChanged.length > 0 ||
      dependenciesChanged ||
      approvalRequirementChanged
    ) {
      stepsModified.push({
        stepId: targetStep.stepId,
        toolChanged,
        bindingsChanged: bindingsChanged.length > 0 ? bindingsChanged : undefined,
        dependenciesChanged,
        approvalRequirementChanged
      })
    }
  }

  const baseCaps = new Set(base.derivedCapabilities)
  const targetCaps = new Set(target.derivedCapabilities)

  const capabilitiesAdded = Array.from(targetCaps).filter((c) => !baseCaps.has(c))
  const capabilitiesRemoved = Array.from(baseCaps).filter((c) => !targetCaps.has(c))

  const riskTierChanged =
    base.derivedRiskTier !== target.derivedRiskTier
      ? { from: base.derivedRiskTier, to: target.derivedRiskTier }
      : undefined

  const metadataChanges = {
    displayNameChanged: base.displayName !== target.displayName,
    descriptionChanged: base.description !== target.description,
    categoryChanged: base.category !== target.category
  }

  const isIdentical =
    !metadataChanges.displayNameChanged &&
    !metadataChanges.descriptionChanged &&
    !metadataChanges.categoryChanged &&
    stepsAdded.length === 0 &&
    stepsRemoved.length === 0 &&
    stepsModified.length === 0 &&
    capabilitiesAdded.length === 0 &&
    capabilitiesRemoved.length === 0 &&
    !riskTierChanged

  return {
    baseVersionId: base.version || 'base',
    targetVersionId: target.version || 'target',
    isIdentical,
    metadataChanges,
    stepsAdded,
    stepsRemoved,
    stepsModified,
    capabilitiesAdded,
    capabilitiesRemoved,
    riskTierChanged
  }
}

// ============================================================================
// 5. SAFE EXPORT / IMPORT PACKAGING
// ============================================================================

export function serializeSkillExportPackage(
  skill: DynamicSkillDefinition,
  scenarios?: readonly SkillTestScenario[]
): string {
  // Ensure no secrets or API keys are leaked into export
  const cleanedSteps = skill.steps.map((st) => {
    const cleanedBindings: Record<string, any> = {}
    for (const [k, b] of Object.entries(st.inputBindings)) {
      if (b.type === 'literal') {
        const valStr = typeof b.literalValue === 'string' ? b.literalValue : ''
        if (
          /api[-_]?key|secret|token|password|bearer|auth|credential/i.test(k) ||
          /AIza[0-9A-Za-z-_]{35}/.test(valStr) ||
          /sk-[0-9A-Za-z-_]{20,}/.test(valStr) ||
          valStr.toLowerCase().includes('secret')
        ) {
          cleanedBindings[k] = { ...b, literalValue: '[REDACTED_CREDENTIAL]' }
          continue
        }
      }
      cleanedBindings[k] = b
    }
    return { ...st, inputBindings: cleanedBindings }
  })

  const cleanedScenarios = (scenarios || []).map((s) => ({
    scenarioId: s.scenarioId,
    name: s.name,
    description: s.description,
    inputParameters: s.inputParameters,
    mockToolOutputs: s.mockToolOutputs,
    expectedOutput: s.expectedOutput,
    expectedStatus: s.expectedStatus,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  }))

  const definitionHash = computeSkillDefinitionHash(skill)

  const pkg: SkillExportPackage = {
    format: 'helioxen-skill-package',
    packageSchemaVersion: 1,
    exportedAt: Date.now(),
    skill: {
      id: skill.id,
      displayName: skill.displayName,
      description: skill.description,
      version: skill.version,
      category: skill.category,
      author: skill.author,
      steps: cleanedSteps,
      constraints: skill.constraints,
      derivedCapabilities: skill.derivedCapabilities,
      derivedRiskTier: skill.derivedRiskTier
    },
    testScenarios: cleanedScenarios,
    definitionHash
  }

  return JSON.stringify(pkg, null, 2)
}

export function parseAndValidateSkillImportPackage(
  rawJson: string,
  optionsOrRegistry: ValidationRegistryOptions | any
): SkillImportPreview {
  let options: ValidationRegistryOptions
  if (optionsOrRegistry && 'toolRegistryIds' in optionsOrRegistry) {
    options = optionsOrRegistry
  } else if (optionsOrRegistry && typeof optionsOrRegistry.getAll === 'function') {
    const tools = optionsOrRegistry.getAll()
    const toolDetails = new Map<string, any>()
    for (const t of tools) {
      toolDetails.set(t.id, {
        requiredCapabilities: t.requiredCapabilities || [],
        riskTier: t.riskTier || 'low',
        confirmationPolicy: t.confirmationPolicy || 'none',
        enabled: t.registrationStatus === 'enabled'
      })
    }
    options = {
      toolRegistryIds: new Set(tools.map((t: any) => t.id)),
      toolDetails
    }
  } else if (optionsOrRegistry && typeof optionsOrRegistry.list === 'function') {
    const tools = optionsOrRegistry.list()
    const toolDetails = new Map<string, any>()
    for (const t of tools) {
      toolDetails.set(t.id, {
        requiredCapabilities: t.requiredCapabilities || [],
        riskTier: t.riskTier || 'low',
        confirmationPolicy: t.confirmationPolicy || 'none',
        enabled: t.registrationStatus === 'enabled'
      })
    }
    options = {
      toolRegistryIds: new Set(tools.map((t: any) => t.id)),
      toolDetails
    }
  } else {
    options = { toolRegistryIds: new Set() }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('IMPORT_ERROR: Malformed JSON. Package could not be parsed.')
  }

  const parsedPkg = SkillExportPackageSchema.safeParse(parsed)
  if (!parsedPkg.success) {
    throw new Error(
      `IMPORT_ERROR: Invalid package structure: ${parsedPkg.error.issues.map((i) => i.message).join('; ')}`
    )
  }

  const data = parsedPkg.data
  const candidateSkill: DynamicSkillDefinition = {
    id: data.skill.id,
    displayName: data.skill.displayName,
    description: data.skill.description,
    version: data.skill.version,
    category: data.skill.category,
    author: data.skill.author || 'Imported',
    steps: data.skill.steps,
    constraints: data.skill.constraints,
    derivedCapabilities: data.skill.derivedCapabilities,
    derivedRiskTier: data.skill.derivedRiskTier,
    status: 'draft', // Untrusted: always quarantined as draft
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  // Identify missing dependencies
  const missingTools: string[] = []
  for (const step of candidateSkill.steps) {
    if (!options.toolRegistryIds.has(step.toolId)) {
      missingTools.push(step.toolId)
    }
  }

  const validation = validateSkillStaged(candidateSkill, options)

  return {
    valid: validation.valid,
    sourceFormat: data.format,
    candidateSkill,
    candidateScenariosCount: data.testScenarios?.length ?? 0,
    missingDependencies: missingTools,
    missingConnectors: [],
    requiredCapabilities: validation.derivedCapabilities,
    riskTier: validation.derivedRiskTier,
    validationReport: validation,
    requiresRemapping: missingTools.length > 0,
    potentialConflictWithExistingSkill: false
  }
}
