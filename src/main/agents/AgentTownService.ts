/**
 * HELIOXEN AI — Step 40: Agent Town Service
 * Unified main-process orchestrator for Agent Town, Plugin Connectors, and Dynamic Skills.
 */

import {
  AgentCategory,
  AgentDefinition,
  AgentTownOverviewSnapshot,
  ConnectorDescriptor,
  DynamicSkillDefinition,
  PluginManifest,
  SkillDryRunResult,
  SkillExecutionResult
} from '../../shared/agents/types'
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
  CollaborationPlanInput,
  CoordinatedParentTask
} from '../../shared/agents/collaborationTypes'
import { ToolRegistry } from '../../shared/tools'
import { TaskExecutionEngine } from '../../shared/orchestration'
import { AgentRegistry } from './AgentRegistry'
import { ConnectorRegistry } from './ConnectorRegistry'
import { DynamicSkillsManager } from './DynamicSkillsManager'
import { MultiAgentCoordinator } from './MultiAgentCoordinator'

export interface AgentTownServiceOptions {
  readonly storageDir: string
  readonly toolRegistry: ToolRegistry
  readonly executionEngine?: TaskExecutionEngine
  readonly providerServiceGetter?: () => any
  readonly nowFn?: () => number
}

export class AgentTownService {
  public readonly agentRegistry: AgentRegistry
  public readonly connectorRegistry: ConnectorRegistry
  public readonly skillsManager: DynamicSkillsManager
  public readonly coordinator: MultiAgentCoordinator
  private readonly nowFn: () => number

  constructor(options: AgentTownServiceOptions) {
    this.nowFn = options.nowFn ?? (() => Date.now())

    this.agentRegistry = new AgentRegistry({
      storageDir: options.storageDir,
      toolRegistry: options.toolRegistry,
      nowFn: this.nowFn
    })

    this.connectorRegistry = new ConnectorRegistry({
      storageDir: options.storageDir,
      toolRegistry: options.toolRegistry,
      nowFn: this.nowFn
    })

    this.skillsManager = new DynamicSkillsManager({
      storageDir: options.storageDir,
      toolRegistry: options.toolRegistry,
      executionEngine: options.executionEngine,
      providerServiceGetter: options.providerServiceGetter,
      nowFn: this.nowFn
    })

    this.coordinator = new MultiAgentCoordinator({
      storageDir: options.storageDir,
      agentRegistry: this.agentRegistry,
      toolRegistry: options.toolRegistry,
      executionEngine: options.executionEngine,
      nowFn: this.nowFn
    })
  }

  public dispose(): void {
    // Clean up active listeners or pending registrations
  }

  /**
   * Retrieves full Agent Town workspace overview snapshot.
   */
  public getOverviewSnapshot(): AgentTownOverviewSnapshot {
    const agents = this.agentRegistry.listAgents()
    const plugins = this.connectorRegistry.listPlugins()
    const skills = this.skillsManager.listSkills()

    const activeAgentsCount = agents.filter((a) => a.enabled && a.status !== 'unavailable').length
    const connectedPluginsCount = plugins.filter(
      (p) => p.enabled && p.connectors.some((c) => c.status === 'connected')
    ).length
    const enabledSkillsCount = skills.filter((s) => s.status === 'enabled').length

    return {
      agents,
      plugins,
      skills,
      totalAgents: agents.length,
      activeAgentsCount,
      totalPlugins: plugins.length,
      connectedPluginsCount,
      totalSkills: skills.length,
      enabledSkillsCount,
      acquiredAt: this.nowFn()
    }
  }

  // --- Agent Delegation ---
  public listAgents(category?: string): AgentDefinition[] {
    return this.agentRegistry.listAgents(category)
  }

  public setAgentEnabled(id: string, enabled: boolean): AgentDefinition {
    return this.agentRegistry.setAgentEnabled(id, enabled)
  }

  // --- Plugin Delegation ---
  public listPlugins(): PluginManifest[] {
    return this.connectorRegistry.listPlugins()
  }

  public setPluginEnabled(pluginId: string, enabled: boolean): PluginManifest {
    return this.connectorRegistry.setPluginEnabled(pluginId, enabled)
  }

  public findPluginByConnectorId(connectorId: string): string | undefined {
    for (const plugin of this.connectorRegistry.listPlugins()) {
      if (plugin.connectors.some((c) => c.connectorId === connectorId)) {
        return plugin.pluginId
      }
    }
    return undefined
  }

  public connectConnector(
    connectorId: string,
    credentialRef?: string
  ): ConnectorDescriptor {
    const pluginId = this.findPluginByConnectorId(connectorId)
    if (!pluginId) {
      throw new Error(`CONNECTOR_NOT_FOUND: No plugin found containing connector '${connectorId}'.`)
    }
    return this.connectorRegistry.connectConnector(pluginId, connectorId, {
      credentialIdReference: credentialRef
    })
  }

  public disconnectConnector(connectorId: string): ConnectorDescriptor {
    const pluginId = this.findPluginByConnectorId(connectorId)
    if (!pluginId) {
      throw new Error(`CONNECTOR_NOT_FOUND: No plugin found containing connector '${connectorId}'.`)
    }
    return this.connectorRegistry.disconnectConnector(pluginId, connectorId)
  }

  public updateConnectorScopes(connectorId: string, grantedScopes: string[]): ConnectorDescriptor {
    const pluginId = this.findPluginByConnectorId(connectorId)
    if (!pluginId) {
      throw new Error(`CONNECTOR_NOT_FOUND: No plugin found containing connector '${connectorId}'.`)
    }
    return this.connectorRegistry.updateScopes(pluginId, connectorId, grantedScopes)
  }

  // --- Dynamic Skills Delegation ---
  public listSkills(category?: string): DynamicSkillDefinition[] {
    return this.skillsManager.listSkills(category)
  }

  public getSkill(skillId: string): DynamicSkillDefinition | null {
    return this.skillsManager.getSkill(skillId) ?? null
  }

  public validateSkill(definition: unknown) {
    return this.skillsManager.validateSkillDefinition(definition)
  }

  public saveSkill(definition: unknown): DynamicSkillDefinition {
    const raw = definition as any
    if (raw?.id && this.skillsManager.getSkill(raw.id)) {
      return this.skillsManager.updateSkill(raw.id, definition)
    }
    return this.skillsManager.createSkillDraft(definition)
  }

  public setSkillStatus(skillId: string, status: any): DynamicSkillDefinition {
    return this.skillsManager.setSkillStatus(skillId, status)
  }

  public createSkillDraft(def: unknown): DynamicSkillDefinition {
    return this.skillsManager.createSkillDraft(def)
  }

  public updateSkill(skillId: string, patch: unknown): DynamicSkillDefinition {
    return this.skillsManager.updateSkill(skillId, patch)
  }

  public deleteSkill(skillId: string): boolean {
    return this.skillsManager.deleteSkill(skillId)
  }

  public enableSkill(skillId: string): DynamicSkillDefinition {
    return this.skillsManager.enableSkill(skillId)
  }

  public disableSkill(skillId: string): DynamicSkillDefinition {
    return this.skillsManager.disableSkill(skillId)
  }

  public async dryRunSkill(
    definitionOrId: unknown,
    _testInputs?: Record<string, unknown>
  ): Promise<SkillDryRunResult> {
    if (typeof definitionOrId === 'string') {
      return this.skillsManager.dryRunSkill(definitionOrId)
    }
    const raw = definitionOrId as any
    let skillId = raw?.id
    if (!skillId) {
      skillId = `temp_dryrun_${Date.now()}`
    }
    let existing = this.skillsManager.getSkill(skillId)
    if (!existing) {
      existing = this.skillsManager.createSkillDraft({ ...raw, id: skillId })
    }
    return this.skillsManager.dryRunSkill(skillId)
  }

  public async executeSkill(
    skillId: string,
    options?: { conversationId?: string; signal?: AbortSignal }
  ): Promise<SkillExecutionResult> {
    return this.skillsManager.executeSkill(skillId, options)
  }

  // --- Step 42: Advanced Dynamic Skill Studio Delegation ---
  public validateSkillStaged(definitionOrId: unknown): SkillValidationReport {
    return this.skillsManager.validateSkillStaged(definitionOrId)
  }

  public createSkillVersion(skillId: string, changelog?: string): SkillVersionRecord {
    return this.skillsManager.createSkillVersion(skillId, changelog)
  }

  public listSkillVersions(skillId: string): SkillVersionRecord[] {
    return this.skillsManager.listSkillVersions(skillId)
  }

  public getSkillVersion(skillId: string, versionId: string): SkillVersionRecord | undefined {
    return this.skillsManager.getSkillVersion(skillId, versionId)
  }

  public compareSkillVersions(
    skillId: string,
    baseVersionId: string,
    targetVersionId: string
  ): SkillVersionDiff {
    return this.skillsManager.compareSkillVersions(skillId, baseVersionId, targetVersionId)
  }

  public rollbackSkillVersion(skillId: string, targetVersionId: string): DynamicSkillDefinition {
    return this.skillsManager.rollbackSkillVersion(skillId, targetVersionId)
  }

  public createTestScenario(skillId: string, input: any): SkillTestScenario {
    return this.skillsManager.createTestScenario(skillId, input)
  }

  public listTestScenarios(skillId: string): SkillTestScenario[] {
    return this.skillsManager.listTestScenarios(skillId)
  }

  public deleteTestScenario(skillId: string, scenarioId: string): boolean {
    return this.skillsManager.deleteTestScenario(skillId, scenarioId)
  }

  public async runTestScenario(skillId: string, scenarioId: string): Promise<SkillScenarioTestResult> {
    return this.skillsManager.runTestScenario(skillId, scenarioId)
  }

  public async runRegressionTests(skillId: string): Promise<SkillRegressionTestReport> {
    return this.skillsManager.runRegressionTests(skillId)
  }

  public exportSkillPackage(skillId: string): string {
    return this.skillsManager.exportSkillPackage(skillId)
  }

  public previewSkillImport(rawJson: string): SkillImportPreview {
    return this.skillsManager.previewSkillImport(rawJson)
  }

  public importSkillPackage(
    rawJson: string,
    options?: { newId?: string; author?: string }
  ): DynamicSkillDefinition {
    return this.skillsManager.importSkillPackage(rawJson, options)
  }

  public async generateSkillDraftWithAi(
    prompt: string,
    category?: AgentCategory
  ): Promise<DynamicSkillDefinition> {
    return this.skillsManager.generateSkillDraftWithAi(prompt, category)
  }

  public async refineSkillWithAi(
    skillId: string,
    instruction: string
  ): Promise<DynamicSkillDefinition> {
    return this.skillsManager.refineSkillWithAi(skillId, instruction)
  }

  // --- Multi-Agent Collaboration Delegation ---
  public async coordinateTask(
    input: CollaborationPlanInput,
    options?: { signal?: AbortSignal }
  ): Promise<CoordinatedParentTask> {
    return this.coordinator.coordinateTask(input, options)
  }

  public getCoordinatedTask(parentTaskId: string): CoordinatedParentTask | undefined {
    return this.coordinator.getCoordinatedTask(parentTaskId)
  }

  public listCoordinatedTasks(): CoordinatedParentTask[] {
    return this.coordinator.listCoordinatedTasks()
  }

  public cancelCoordinatedTask(parentTaskId: string, reason?: string): boolean {
    return this.coordinator.cancelTask(parentTaskId, reason)
  }
}
