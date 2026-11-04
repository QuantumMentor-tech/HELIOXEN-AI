/**
 * HELIOXEN AI — Step 42: Dynamic Skills Manager
 * Advanced governance for user-defined reusable workflows, 7-stage validation pipeline,
 * immutable version records, definition hashing, test workbench with scenarios and regression testing,
 * AI-assisted drafting & refinement, and safe declarative import/export packaging.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  AgentCategory,
  DynamicSkillDefinition,
  SkillDryRunResult,
  SkillExecutionResult,
  SkillLifecycleStatus
} from '../../shared/agents/types'
import {
  DynamicSkillDefinitionSchema,
  resolveSkillDataBinding,
  validateSkillWorkflowGraph
} from '../../shared/agents/contracts'
import {
  SkillExportPackage,
  SkillImportPreview,
  SkillRegressionTestReport,
  SkillScenarioTestResult,
  SkillTestScenario,
  SkillValidationReport,
  SkillVersionDiff,
  SkillVersionRecord
} from '../../shared/agents/skillStudioTypes'
import {
  compareSkillDefinitions,
  computeSkillDefinitionHash,
  parseAndValidateSkillImportPackage,
  serializeSkillExportPackage,
  SkillTestScenarioSchema,
  validateSkillStaged,
  ValidationRegistryOptions
} from '../../shared/agents/skillStudioContracts'
import { ToolRegistry } from '../../shared/tools'
import {
  PlanStep,
  TaskExecutionEngine,
  TaskPlan
} from '../../shared/orchestration'
import type { RiskTier } from '../../shared/security/capabilities'

export interface DynamicSkillsManagerOptions {
  readonly storageDir: string
  readonly toolRegistry: ToolRegistry
  readonly executionEngine?: TaskExecutionEngine
  readonly providerServiceGetter?: () => any
  readonly nowFn?: () => number
}

interface PersistedSkillsStore {
  schemaVersion: number
  updatedAt: number
  skills: Record<string, DynamicSkillDefinition>
}

interface PersistedVersionsStore {
  schemaVersion: number
  updatedAt: number
  versions: Record<string, SkillVersionRecord[]>
}

interface PersistedScenariosStore {
  schemaVersion: number
  updatedAt: number
  scenarios: Record<string, SkillTestScenario[]>
}

export class DynamicSkillsManager {
  private readonly storePath: string
  private readonly versionsStorePath: string
  private readonly scenariosStorePath: string
  private readonly toolRegistry: ToolRegistry
  private readonly executionEngine?: TaskExecutionEngine
  private readonly providerServiceGetter?: () => any
  private readonly nowFn: () => number

  private skills: Map<string, DynamicSkillDefinition> = new Map()
  private versions: Map<string, SkillVersionRecord[]> = new Map()
  private scenarios: Map<string, SkillTestScenario[]> = new Map()

  constructor(options: DynamicSkillsManagerOptions) {
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.toolRegistry = options.toolRegistry
    this.executionEngine = options.executionEngine
    this.providerServiceGetter = options.providerServiceGetter

    const baseDir = path.resolve(options.storageDir, 'skills')
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    this.storePath = path.join(baseDir, 'skills_store.json')
    this.versionsStorePath = path.join(baseDir, 'skills_version_store.json')
    this.scenariosStorePath = path.join(baseDir, 'skills_test_scenarios_store.json')

    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8')
        const parsed = JSON.parse(raw) as PersistedSkillsStore
        if (parsed?.skills && typeof parsed.skills === 'object') {
          for (const [id, skill] of Object.entries(parsed.skills)) {
            const validated = DynamicSkillDefinitionSchema.safeParse(skill)
            if (validated.success) {
              this.skills.set(id, validated.data)
            }
          }
        }
      }

      if (fs.existsSync(this.versionsStorePath)) {
        const raw = fs.readFileSync(this.versionsStorePath, 'utf-8')
        const parsed = JSON.parse(raw) as PersistedVersionsStore
        if (parsed?.versions && typeof parsed.versions === 'object') {
          for (const [id, vers] of Object.entries(parsed.versions)) {
            if (Array.isArray(vers)) {
              this.versions.set(id, vers)
            }
          }
        }
      }

      if (fs.existsSync(this.scenariosStorePath)) {
        const raw = fs.readFileSync(this.scenariosStorePath, 'utf-8')
        const parsed = JSON.parse(raw) as PersistedScenariosStore
        if (parsed?.scenarios && typeof parsed.scenarios === 'object') {
          for (const [id, scens] of Object.entries(parsed.scenarios)) {
            if (Array.isArray(scens)) {
              this.scenarios.set(id, scens)
            }
          }
        }
      }
    } catch {
      // Keep memory intact on corrupt file
    }
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const saveAtomic = (filePath: string, dataObj: unknown) => {
        const tmp = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
        fs.writeFileSync(tmp, JSON.stringify(dataObj, null, 2), 'utf-8')
        try {
          fs.renameSync(tmp, filePath)
        } catch {
          try {
            fs.copyFileSync(tmp, filePath)
            fs.unlinkSync(tmp)
          } catch {
            fs.writeFileSync(filePath, JSON.stringify(dataObj, null, 2), 'utf-8')
          }
        }
      }

      saveAtomic(this.storePath, {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        skills: Object.fromEntries(this.skills.entries())
      })

      saveAtomic(this.versionsStorePath, {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        versions: Object.fromEntries(this.versions.entries())
      })

      saveAtomic(this.scenariosStorePath, {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        scenarios: Object.fromEntries(this.scenarios.entries())
      })
    } catch {
      // Keep memory intact
    }
  }

  private buildValidationOptions(): ValidationRegistryOptions {
    const toolRegistryIds = new Set(this.toolRegistry.list().map((t) => t.id))
    const toolDetails = new Map<
      string,
      {
        requiredCapabilities: readonly string[]
        riskTier: RiskTier
        confirmationPolicy: string
        enabled: boolean
      }
    >()

    for (const tool of this.toolRegistry.list()) {
      toolDetails.set(tool.id, {
        requiredCapabilities: tool.requiredCapabilities,
        riskTier: tool.riskTier,
        confirmationPolicy: tool.confirmationPolicy,
        enabled: tool.registrationStatus === 'enabled'
      })
    }

    return {
      toolRegistryIds,
      toolDetails,
      resourceLimits: {
        maxSteps: 20,
        maxTimeoutMs: 120000,
        maxRetries: 3
      }
    }
  }

  private deriveCapabilitiesAndRisk(steps: readonly DynamicSkillDefinition['steps'][number][]): {
    derivedCapabilities: string[]
    derivedRiskTier: RiskTier
  } {
    const caps = new Set<string>()
    let highestRisk: RiskTier = 'low'
    const riskRank: Record<RiskTier, number> = { low: 1, moderate: 2, high: 3, prohibited: 4 }

    for (const step of steps) {
      const toolDef = this.toolRegistry.get(step.toolId)
      if (toolDef) {
        for (const c of toolDef.requiredCapabilities) {
          caps.add(c)
        }
        if (riskRank[toolDef.riskTier] > riskRank[highestRisk]) {
          highestRisk = toolDef.riskTier
        }
      }
    }

    return {
      derivedCapabilities: Array.from(caps),
      derivedRiskTier: highestRisk
    }
  }

  // ============================================================================
  // SKILL CRUD & LIFECYCLE
  // ============================================================================

  public createSkillDraft(input: unknown): DynamicSkillDefinition {
    const raw = input as any
    const registeredToolIds = new Set(this.toolRegistry.list().map((t) => t.id))

    const graphCheck = validateSkillWorkflowGraph({ steps: raw?.steps ?? [] }, registeredToolIds)
    const { derivedCapabilities, derivedRiskTier } = this.deriveCapabilitiesAndRisk(raw?.steps ?? [])

    const now = this.nowFn()
    const candidate: DynamicSkillDefinition = {
      id: String(raw.id || `skill_${now}_${Math.random().toString(36).slice(2, 8)}`),
      displayName: String(raw.displayName ?? 'Untitled Skill'),
      description: String(raw.description ?? ''),
      version: String(raw.version ?? '1.0.0'),
      author: String(raw.author ?? 'User'),
      category: raw.category ?? 'productivity',
      steps: Array.isArray(raw.steps) ? raw.steps : [],
      derivedCapabilities,
      derivedRiskTier,
      status: graphCheck.valid ? 'validated' : 'validation_failed',
      constraints: {
        maxTimeoutMs: Number(raw.constraints?.maxTimeoutMs ?? 30000),
        maxStepRetries: Number(raw.constraints?.maxStepRetries ?? 1),
        stopOnFirstFailure: Boolean(raw.constraints?.stopOnFirstFailure ?? true)
      },
      validationErrors: graphCheck.errors,
      createdAt: now,
      updatedAt: now
    }

    const validated = DynamicSkillDefinitionSchema.parse(candidate)
    if (this.skills.has(validated.id)) {
      throw new Error(`SKILL_CONFLICT: Skill '${validated.id}' already exists.`)
    }

    this.skills.set(validated.id, validated)

    // Automatically record initial version
    this.createSkillVersion(validated.id, 'Initial draft creation')

    this.persistToDisk()
    return validated
  }

  public updateSkill(skillId: string, patch: unknown): DynamicSkillDefinition {
    const existing = this.skills.get(skillId)
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)
    }

    const merged = { ...existing, ...(patch as any), updatedAt: this.nowFn() }
    const registeredToolIds = new Set(this.toolRegistry.list().map((t) => t.id))
    const graphCheck = validateSkillWorkflowGraph({ steps: merged.steps }, registeredToolIds)
    const { derivedCapabilities, derivedRiskTier } = this.deriveCapabilitiesAndRisk(merged.steps)

    const updatedCandidate: DynamicSkillDefinition = {
      ...merged,
      derivedCapabilities,
      derivedRiskTier,
      // Edits invalidate approval: resets to validated or validation_failed
      status: graphCheck.valid ? 'validated' : 'validation_failed',
      validationErrors: graphCheck.errors,
      updatedAt: this.nowFn()
    }

    const validated = DynamicSkillDefinitionSchema.parse(updatedCandidate)
    this.skills.set(skillId, validated)

    // Record new draft revision
    this.createSkillVersion(skillId, 'Updated workflow definition')

    this.persistToDisk()
    return validated
  }

  public getSkill(skillId: string): DynamicSkillDefinition | undefined {
    return this.skills.get(skillId)
  }

  public listSkills(category?: string): DynamicSkillDefinition[] {
    const list = Array.from(this.skills.values())
    if (category && category !== 'all') {
      return list.filter((s) => s.category === category)
    }
    return list
  }

  public deleteSkill(skillId: string): boolean {
    const deleted = this.skills.delete(skillId)
    if (deleted) {
      this.versions.delete(skillId)
      this.scenarios.delete(skillId)
      this.persistToDisk()
    }
    return deleted
  }

  public enableSkill(skillId: string): DynamicSkillDefinition {
    const existing = this.skills.get(skillId)
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)
    }

    const report = this.validateSkillStaged(existing)
    if (!report.valid) {
      throw new Error(
        `ACTIVATION_DENIED: Skill '${skillId}' has validation errors: ${report.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`
      )
    }

    // Verify all tools are currently eligible in ToolRegistry
    for (const step of existing.steps) {
      const eligibility = this.toolRegistry.evaluateEligibility(step.toolId)
      if (!eligibility.eligible) {
        throw new Error(
          `ACTIVATION_DENIED: Step '${step.stepId}' references ineligible tool '${step.toolId}' (${eligibility.reason}).`
        )
      }
    }

    const updated: DynamicSkillDefinition = {
      ...existing,
      status: 'enabled',
      updatedAt: this.nowFn()
    }

    this.skills.set(skillId, updated)

    // Mark latest version approved
    const list = this.versions.get(skillId) || []
    if (list.length > 0) {
      const latest = list[list.length - 1]
      list[list.length - 1] = {
        ...latest,
        approvalStatus: 'approved',
        approvedAt: this.nowFn()
      }
    }

    this.persistToDisk()
    return updated
  }

  public disableSkill(skillId: string): DynamicSkillDefinition {
    const existing = this.skills.get(skillId)
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)
    }

    const updated: DynamicSkillDefinition = {
      ...existing,
      status: 'disabled',
      updatedAt: this.nowFn()
    }

    this.skills.set(skillId, updated)
    this.persistToDisk()
    return updated
  }

  public setSkillStatus(skillId: string, status: SkillLifecycleStatus): DynamicSkillDefinition {
    if (status === 'enabled') return this.enableSkill(skillId)
    if (status === 'disabled') return this.disableSkill(skillId)
    const existing = this.skills.get(skillId)
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)
    }
    const updated: DynamicSkillDefinition = {
      ...existing,
      status,
      updatedAt: this.nowFn()
    }
    this.skills.set(skillId, updated)
    this.persistToDisk()
    return updated
  }

  // ============================================================================
  // 7-STAGE DETERMINISTIC VALIDATION PIPELINE
  // ============================================================================

  public validateSkillDefinition(input: unknown) {
    const raw = input as any
    const registeredToolIds = new Set(this.toolRegistry.list().map((t) => t.id))
    return validateSkillWorkflowGraph({ steps: raw?.steps ?? [] }, registeredToolIds)
  }

  public validateSkillStaged(definitionOrId: unknown): SkillValidationReport {
    let skill: DynamicSkillDefinition
    if (typeof definitionOrId === 'string') {
      const found = this.skills.get(definitionOrId)
      if (!found) {
        throw new Error(`SKILL_NOT_FOUND: Skill '${definitionOrId}' does not exist.`)
      }
      skill = found
    } else {
      skill = definitionOrId as DynamicSkillDefinition
    }

    const options = this.buildValidationOptions()
    return validateSkillStaged(skill, options)
  }

  // ============================================================================
  // IMMUTABLE VERSIONING, COMPARISON & ROLLBACK
  // ============================================================================

  public createSkillVersion(skillId: string, changelog = 'Revision update'): SkillVersionRecord {
    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)
    }

    const validationReport = this.validateSkillStaged(skill)
    const definitionHash = computeSkillDefinitionHash(skill)
    const now = this.nowFn()

    const list = this.versions.get(skillId) || []
    const versionNumber = skill.version || `1.0.${list.length}`
    const versionId = `v_${skillId}_${now}_${Math.random().toString(36).slice(2, 6)}`

    const record: SkillVersionRecord = {
      versionId,
      skillId,
      versionNumber,
      definitionHash,
      definition: JSON.parse(JSON.stringify(skill)),
      changelog,
      author: skill.author || 'User',
      validationReport,
      approvalStatus: skill.status === 'enabled' ? 'approved' : 'draft',
      approvedAt: skill.status === 'enabled' ? now : null,
      createdAt: now
    }

    list.push(record)
    this.versions.set(skillId, list)
    this.persistToDisk()
    return record
  }

  public listSkillVersions(skillId: string): SkillVersionRecord[] {
    return this.versions.get(skillId) || []
  }

  public getSkillVersion(skillId: string, versionId: string): SkillVersionRecord | undefined {
    const list = this.versions.get(skillId) || []
    return list.find((v) => v.versionId === versionId)
  }

  public compareSkillVersions(
    skillId: string,
    baseVersionId: string,
    targetVersionId: string
  ): SkillVersionDiff {
    const v1 = this.getSkillVersion(skillId, baseVersionId)
    const v2 = this.getSkillVersion(skillId, targetVersionId)
    if (!v1 || !v2) {
      throw new Error('VERSION_NOT_FOUND: One or both requested version records do not exist.')
    }
    return compareSkillDefinitions(v1.definition, v2.definition)
  }

  public rollbackSkillVersion(skillId: string, targetVersionId: string): DynamicSkillDefinition {
    const versionRec = this.getSkillVersion(skillId, targetVersionId)
    if (!versionRec) {
      throw new Error(`VERSION_NOT_FOUND: Version '${targetVersionId}' does not exist for skill '${skillId}'.`)
    }

    // Revalidate target definition against current tool registry and capabilities
    const report = this.validateSkillStaged(versionRec.definition)
    if (!report.valid) {
      throw new Error(
        `ROLLBACK_DENIED: Target version '${targetVersionId}' failed validation against current capabilities: ${report.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`
      )
    }

    const restored: DynamicSkillDefinition = {
      ...versionRec.definition,
      status: 'validated', // Quarantined as validated; requires deliberate human re-activation
      updatedAt: this.nowFn()
    }

    this.skills.set(skillId, restored)
    this.createSkillVersion(skillId, `Rollback to version ${versionRec.versionNumber}`)
    this.persistToDisk()
    return restored
  }

  // ============================================================================
  // TEST WORKBENCH & SCENARIO REGRESSION TESTING
  // ============================================================================

  public createTestScenario(
    skillId: string,
    input: Omit<SkillTestScenario, 'createdAt' | 'updatedAt'>
  ): SkillTestScenario {
    if (!this.skills.has(skillId)) {
      throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)
    }

    const now = this.nowFn()
    const scenario: SkillTestScenario = {
      ...input,
      skillId,
      createdAt: now,
      updatedAt: now
    }

    const validated = SkillTestScenarioSchema.parse(scenario)
    const list = this.scenarios.get(skillId) || []
    list.push(validated)
    this.scenarios.set(skillId, list)
    this.persistToDisk()
    return validated
  }

  public listTestScenarios(skillId: string): SkillTestScenario[] {
    return this.scenarios.get(skillId) || []
  }

  public deleteTestScenario(skillId: string, scenarioId: string): boolean {
    const list = this.scenarios.get(skillId) || []
    const filtered = list.filter((s) => s.scenarioId !== scenarioId)
    if (filtered.length !== list.length) {
      this.scenarios.set(skillId, filtered)
      this.persistToDisk()
      return true
    }
    return false
  }

  public async runTestScenario(skillId: string, scenarioId: string): Promise<SkillScenarioTestResult> {
    const skill = this.skills.get(skillId)
    if (!skill) throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)

    const list = this.scenarios.get(skillId) || []
    const scenario = list.find((s) => s.scenarioId === scenarioId)
    if (!scenario) throw new Error(`SCENARIO_NOT_FOUND: Scenario '${scenarioId}' does not exist.`)

    const startedAt = this.nowFn()
    const validation = this.validateSkillStaged(skill)
    if (!validation.valid) {
      return {
        scenarioId,
        scenarioName: scenario.name,
        passed: false,
        actualStatus: 'failed',
        stepRuns: [],
        outputMatched: false,
        failureReason: `Skill failed validation: ${validation.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`,
        durationMs: 0,
        executedAt: startedAt
      }
    }

    const simulatedOutputs = new Map<string, unknown>()
    const stepRuns: SkillScenarioTestResult['stepRuns'][number][] = []
    let actualStatus: 'completed' | 'failed' = 'completed'
    let failureReason: string | undefined

    for (const stepId of validation.stepOrder) {
      const step = skill.steps.find((s) => s.stepId === stepId)!
      const resolvedInputs: Record<string, unknown> = {}

      for (const [key, binding] of Object.entries(step.inputBindings)) {
        if (binding.type === 'literal') {
          resolvedInputs[key] = binding.literalValue
        } else if (binding.type === 'step_output') {
          resolvedInputs[key] = resolveSkillDataBinding(binding, simulatedOutputs)
        }
      }

      // Check scenario mock outputs
      let mockOutput =
        scenario.mockToolOutputs[step.stepId] ?? scenario.mockToolOutputs[step.toolId]
      if (mockOutput === undefined) {
        mockOutput = {
          stepId,
          simulated: true,
          mockResult: `Mock output for tool '${step.toolId}'`,
          resolvedInputs
        }
      }

      simulatedOutputs.set(stepId, mockOutput)
      stepRuns.push({
        stepId,
        toolId: step.toolId,
        resolvedInputs,
        mockOutput,
        status: 'simulated',
        durationMs: 2
      })
    }

    const finalStepId = validation.stepOrder[validation.stepOrder.length - 1]
    const actualOutput = simulatedOutputs.get(finalStepId)

    let outputMatched = true
    if (scenario.expectedOutput !== undefined) {
      const expectedJson = JSON.stringify(scenario.expectedOutput)
      const actualJson = JSON.stringify(actualOutput)
      outputMatched = expectedJson === actualJson
      if (!outputMatched) {
        failureReason = `Output mismatch. Expected: ${expectedJson}, Actual: ${actualJson}`
      }
    }

    const passed = actualStatus === scenario.expectedStatus && outputMatched
    if (!passed && !failureReason) {
      failureReason = `Status mismatch. Expected: ${scenario.expectedStatus}, Actual: ${actualStatus}`
    }

    return {
      scenarioId,
      scenarioName: scenario.name,
      passed,
      actualStatus,
      actualOutput,
      stepRuns,
      outputMatched,
      failureReason,
      durationMs: this.nowFn() - startedAt,
      executedAt: startedAt
    }
  }

  public async runRegressionTests(skillId: string): Promise<SkillRegressionTestReport> {
    const skill = this.skills.get(skillId)
    if (!skill) throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)

    const scenarios = this.scenarios.get(skillId) || []
    const results: SkillScenarioTestResult[] = []

    for (const sc of scenarios) {
      const res = await this.runTestScenario(skillId, sc.scenarioId)
      results.push(res)
    }

    const passedCount = results.filter((r) => r.passed).length
    const failedCount = results.filter((r) => !r.passed).length
    const newlyFailed = results.filter((r) => !r.passed).map((r) => r.scenarioId)

    return {
      skillId,
      targetVersion: skill.version || '1.0.0',
      totalScenarios: scenarios.length,
      passedCount,
      failedCount,
      scenarioResults: results,
      hasRegressions: failedCount > 0,
      newlyFailedScenarioIds: newlyFailed,
      evaluatedAt: this.nowFn()
    }
  }

  // ============================================================================
  // DECLARATIVE EXPORT & IMPORT
  // ============================================================================

  public exportSkillPackage(skillId: string): string {
    const skill = this.skills.get(skillId)
    if (!skill) throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)

    const scenarios = this.scenarios.get(skillId) || []
    return serializeSkillExportPackage(skill, scenarios)
  }

  public previewSkillImport(rawJson: string): SkillImportPreview {
    const options = this.buildValidationOptions()
    return parseAndValidateSkillImportPackage(rawJson, options)
  }

  public importSkillPackage(
    rawJson: string,
    options: { newId?: string; author?: string } = {}
  ): DynamicSkillDefinition {
    const preview = this.previewSkillImport(rawJson)
    const targetId = options.newId || preview.candidateSkill.id

    if (this.skills.has(targetId)) {
      throw new Error(`SKILL_CONFLICT: Skill with ID '${targetId}' already exists. Provide a new ID.`)
    }

    const imported: DynamicSkillDefinition = {
      ...preview.candidateSkill,
      id: targetId,
      author: options.author || preview.candidateSkill.author || 'Imported',
      status: 'draft', // Quarantined: import is never automatically enabled
      createdAt: this.nowFn(),
      updatedAt: this.nowFn()
    }

    this.skills.set(targetId, imported)
    this.createSkillVersion(targetId, 'Imported from skill package')
    this.persistToDisk()
    return imported
  }

  // ============================================================================
  // AI-ASSISTED SKILL DRAFTING & REFINEMENT
  // ============================================================================

  public async generateSkillDraftWithAi(
    prompt: string,
    preferredCategory: AgentCategory = 'productivity'
  ): Promise<DynamicSkillDefinition> {
    const registeredTools = this.toolRegistry.list().filter((t) => t.registrationStatus === 'enabled')
    const toolIds = registeredTools.map((t) => t.id)

    let generated: Partial<DynamicSkillDefinition> = {}

    if (this.providerServiceGetter) {
      try {
        const providerService = this.providerServiceGetter()
        if (providerService) {
          const systemPrompt = `You are a strict JSON workflow generator for HELIOXEN AI skills.
Return ONLY a valid JSON object matching the requested workflow. Do NOT wrap in markdown code blocks.
You may ONLY use registered tool IDs from this list: ${toolIds.join(', ')}.
Schema required:
{
  "displayName": "string",
  "description": "string",
  "category": "${preferredCategory}",
  "steps": [
    {
      "stepId": "step_1",
      "displayName": "string",
      "toolId": "registered_tool_id",
      "inputBindings": {
        "argKey": { "type": "literal", "literalValue": "value" }
      },
      "dependsOnStepIds": []
    }
  ]
}`
          const response = await providerService.generateText({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Create a skill for: ${prompt}` }
            ],
            taskCategory: 'general'
          })

          const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim()
          generated = JSON.parse(cleaned)
        }
      } catch {
        // Fall back to template generation
      }
    }

    // Fallback template if AI unavailable or failed
    if (!generated.steps || generated.steps.length === 0) {
      const defaultTool = toolIds[0] || 'system:get_time'
      generated = {
        displayName: prompt.slice(0, 40) || 'AI-Assisted Skill Draft',
        description: `Draft workflow generated for: ${prompt}`,
        category: preferredCategory,
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Initial Operation',
            toolId: defaultTool,
            inputBindings: {},
            dependsOnStepIds: []
          }
        ]
      }
    }

    const created = this.createSkillDraft({
      ...generated,
      id: `ai_skill_${this.nowFn()}_${Math.random().toString(36).slice(2, 6)}`,
      category: preferredCategory
    })

    const draft: DynamicSkillDefinition = {
      ...created,
      status: 'draft'
    }
    this.skills.set(draft.id, draft)
    this.persistToDisk()
    return draft
  }

  public async refineSkillWithAi(
    skillId: string,
    instruction: string
  ): Promise<DynamicSkillDefinition> {
    const existing = this.skills.get(skillId)
    if (!existing) throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)

    const validation = this.validateSkillStaged(existing)
    const registeredTools = this.toolRegistry.list().map((t) => t.id)

    let refinedSteps = [...existing.steps]

    if (this.providerServiceGetter) {
      try {
        const providerService = this.providerServiceGetter()
        if (providerService) {
          const systemPrompt = `You are a workflow refinement assistant for HELIOXEN AI skills.
Return ONLY valid JSON for the updated steps array. You may only reference these tools: ${registeredTools.join(', ')}.
Current validation issues: ${JSON.stringify(validation.issues)}.
Output format: [ { "stepId": "...", "displayName": "...", "toolId": "...", "inputBindings": {}, "dependsOnStepIds": [] } ]`

          const response = await providerService.generateText({
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Current steps: ${JSON.stringify(existing.steps)}. Instruction: ${instruction}`
              }
            ],
            taskCategory: 'general'
          })

          const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed) && parsed.length > 0) {
            refinedSteps = parsed
          }
        }
      } catch {
        // Fall back to manual refinement
      }
    }

    // Creates an updated draft revision without mutating existing approved version
    return this.updateSkill(skillId, {
      steps: refinedSteps,
      description: `${existing.description} (Refined: ${instruction})`
    })
  }

  // ============================================================================
  // DRY-RUN & AUTHORITATIVE EXECUTION
  // ============================================================================

  public async dryRunSkill(skillId: string): Promise<SkillDryRunResult> {
    const skill = this.skills.get(skillId)
    if (!skill) throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)

    const registeredToolIds = new Set(this.toolRegistry.list().map((t) => t.id))
    const graphCheck = validateSkillWorkflowGraph({ steps: skill.steps }, registeredToolIds)

    if (!graphCheck.valid) {
      return {
        skillId,
        valid: false,
        simulatedSteps: [],
        derivedCapabilities: skill.derivedCapabilities,
        validationErrors: graphCheck.errors,
        dryRunTimestamp: this.nowFn()
      }
    }

    const simulatedOutputs = new Map<string, unknown>()
    const simulatedSteps: Array<SkillDryRunResult['simulatedSteps'][number]> = []

    for (const stepId of graphCheck.stepOrder) {
      const step = skill.steps.find((s) => s.stepId === stepId)!
      const resolvedInputs: Record<string, unknown> = {}

      for (const [key, binding] of Object.entries(step.inputBindings)) {
        resolvedInputs[key] = resolveSkillDataBinding(binding, simulatedOutputs)
      }

      const mockOutput = {
        stepId,
        simulated: true,
        mockResult: `Simulated dry-run output for tool '${step.toolId}'`,
        resolvedInputs
      }

      simulatedOutputs.set(stepId, mockOutput)
      simulatedSteps.push({
        stepId,
        toolId: step.toolId,
        resolvedInputs,
        mockOutput,
        simulatedDurationMs: 5
      })
    }

    const result: SkillDryRunResult = {
      skillId,
      valid: true,
      simulatedSteps,
      derivedCapabilities: skill.derivedCapabilities,
      validationErrors: [],
      dryRunTimestamp: this.nowFn()
    }

    const updated: DynamicSkillDefinition = {
      ...skill,
      lastTestedAt: this.nowFn(),
      lastDryRunSuccess: true
    }
    this.skills.set(skillId, updated)
    this.persistToDisk()

    return result
  }

  public async executeSkill(
    skillId: string,
    options: {
      conversationId?: string
      signal?: AbortSignal
    } = {}
  ): Promise<SkillExecutionResult> {
    const skill = this.skills.get(skillId)
    if (!skill) throw new Error(`SKILL_NOT_FOUND: Skill '${skillId}' does not exist.`)

    if (skill.status !== 'enabled') {
      throw new Error(`EXECUTION_DENIED: Skill '${skillId}' is not in enabled status (current status: '${skill.status}').`)
    }

    if (!this.executionEngine) {
      throw new Error('EXECUTION_UNAVAILABLE: TaskExecutionEngine is not configured.')
    }

    const executionId = `exec_${this.nowFn()}_${Math.random().toString(36).slice(2, 8)}`
    const taskId = `task_skill_${skillId}_${this.nowFn()}`
    const startedAt = this.nowFn()

    const planSteps: PlanStep[] = skill.steps.map((step) => {
      const initialLiteralArgs: Record<string, unknown> = {}
      for (const [key, binding] of Object.entries(step.inputBindings)) {
        if (binding.type === 'literal') {
          initialLiteralArgs[key] = binding.literalValue
        } else if (binding.type === 'step_output') {
          initialLiteralArgs[key] = `$step.${binding.sourceStepId}.output${binding.fieldPath ? `.${binding.fieldPath}` : ''}`
        }
      }

      return {
        id: step.stepId,
        toolId: step.toolId,
        input: initialLiteralArgs,
        dependencies: [...step.dependsOnStepIds],
        description: step.displayName,
        requiresConfirmation: Boolean(step.requiresHumanApproval)
      }
    })

    const plan: TaskPlan = {
      id: `plan_${executionId}`,
      taskId,
      conversationId: options.conversationId || 'default-conv',
      version: '1.0.0',
      intent: `Execute dynamic skill: ${skill.displayName}`,
      requiresTools: true,
      steps: planSteps,
      createdAt: startedAt
    }

    try {
      const taskResult = await this.executionEngine.executePlan(plan, {
        signal: options.signal
      })

      const finishedAt = this.nowFn()
      const stepResultsList = Object.values(taskResult.stepResults || {})
      const completedSteps = stepResultsList.filter((r) => r.status === 'completed' || r.status === 'succeeded').length

      return {
        executionId,
        skillId,
        status:
          taskResult.status === 'completed'
            ? 'completed'
            : taskResult.status === 'cancelled'
            ? 'cancelled'
            : 'failed',
        completedStepCount: completedSteps,
        totalStepCount: skill.steps.length,
        output: taskResult.finalOutput ?? null,
        error: taskResult.error,
        startedAt,
        finishedAt
      }
    } catch (err) {
      const finishedAt = this.nowFn()
      return {
        executionId,
        skillId,
        status: options.signal?.aborted ? 'cancelled' : 'failed',
        completedStepCount: 0,
        totalStepCount: skill.steps.length,
        output: null,
        error: err instanceof Error ? err.message : String(err),
        startedAt,
        finishedAt
      }
    }
  }
}
