/**
 * HELIOXEN AI — Step 40: Agent Town Workspace Panel
 * Comprehensive UI for Agent Town, Plugin Connectors, and Dynamic Skills Studio.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plug,
  Zap,
  PlusCircle,
  Play,
  CheckCircle,
  RefreshCw,
  Sliders,
  Power,
  Trash2,
  Check,
  X,
  GitMerge,
  AlertTriangle,
  StopCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ShieldCheck,
  History,
  Sparkles,
  Download,
  Upload,
  GitCompare,
  TestTube,
  FileCheck,
  AlertCircle
} from 'lucide-react'
import {
  AgentDefinition,
  AgentTownOverviewSnapshot,
  DynamicSkillDefinition,
  PluginManifest,
  SkillDryRunResult,
  SkillValidationResult,
  SkillStepDefinition
} from '../../../../shared/agents/types'
import {
  CoordinatedParentTask,
  ChildTaskRecord,
  CollaborationPlanInput
} from '../../../../shared/agents/collaborationTypes'
import {
  SkillImportPreview,
  SkillRegressionTestReport,
  SkillScenarioTestResult,
  SkillTestScenario,
  SkillValidationReport,
  SkillVersionDiff,
  SkillVersionRecord
} from '../../../../shared/agents/skillStudioTypes'
import { Card } from '../ui/Card'
import { Badge, BadgeVariant } from '../ui/Badge'
import { Button } from '../ui/Button'

type ActiveTab = 'agents' | 'plugins' | 'skills' | 'builder' | 'collaboration'
type StudioSubTab = 'editor' | 'validation' | 'testing' | 'versions' | 'import_export'

function getCoordinationBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'nominal'
    case 'partially_completed':
    case 'blocked':
      return 'warning'
    case 'failed':
      return 'danger'
    case 'running':
      return 'info'
    default:
      return 'neutral'
  }
}

export const AgentTownPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('agents')
  const [overview, setOverview] = useState<AgentTownOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Builder state
  const [builderId, setBuilderId] = useState<string>('')
  const [builderName, setBuilderName] = useState<string>('')
  const [builderDescription, setBuilderDescription] = useState<string>('')
  const [builderCategory, setBuilderCategory] = useState<string>('productivity')
  const [builderSteps, setBuilderSteps] = useState<SkillStepDefinition[]>([
    {
      stepId: 'step_1',
      toolId: 'system:get_time',
      displayName: 'Get Current Time',
      inputBindings: {},
      dependsOnStepIds: []
    }
  ])
  const [validationResult, setValidationResult] = useState<SkillValidationResult | null>(null)
  const [dryRunResult, setDryRunResult] = useState<SkillDryRunResult | null>(null)
  const [isExecuting, setIsExecuting] = useState<string | null>(null)
  const [executionOutput, setExecutionOutput] = useState<string | null>(null)

  // Step 41: Multi-Agent Collaboration state
  const [coordinatedTasks, setCoordinatedTasks] = useState<CoordinatedParentTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCoordinating, setIsCoordinating] = useState<boolean>(false)

  // Step 42: Advanced Skill Studio State
  const [studioSubTab, setStudioSubTab] = useState<StudioSubTab>('editor')
  const [stagedReport, setStagedReport] = useState<SkillValidationReport | null>(null)
  const [aiPrompt, setAiPrompt] = useState<string>('')
  const [aiRefineInstruction, setAiRefineInstruction] = useState<string>('')
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false)
  const [skillVersions, setSkillVersions] = useState<SkillVersionRecord[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [diffResult, setDiffResult] = useState<SkillVersionDiff | null>(null)
  const [testScenarios, setTestScenarios] = useState<SkillTestScenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [scenarioResult, setScenarioResult] = useState<SkillScenarioTestResult | null>(null)
  const [regressionReport, setRegressionReport] = useState<SkillRegressionTestReport | null>(null)
  const [importJson, setImportJson] = useState<string>('')
  const [importPreview, setImportPreview] = useState<SkillImportPreview | null>(null)
  const [exportPackageJson, setExportPackageJson] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      if (window.helioxen?.agents) {
        const snap = await window.helioxen.agents.getOverview()
        setOverview(snap)

        if (window.helioxen.agents.listCoordinatedTasks) {
          const tasks = await window.helioxen.agents.listCoordinatedTasks()
          setCoordinatedTasks(tasks || [])
          if (!selectedTaskId && tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].parentTaskId)
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load Agent Town overview:', err)
      setActionMessage(`Error loading agents: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [selectedTaskId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleAgent = async (agent: AgentDefinition) => {
    if (!window.helioxen?.agents) return
    try {
      await window.helioxen.agents.setAgentEnabled(agent.id, !agent.enabled)
      await loadData()
      setActionMessage(`Agent "${agent.displayName}" ${!agent.enabled ? 'enabled' : 'disabled'}.`)
    } catch (err: any) {
      setActionMessage(`Failed to update agent: ${err.message || String(err)}`)
    }
  }

  const handleTogglePlugin = async (plugin: PluginManifest) => {
    if (!window.helioxen?.agents) return
    try {
      await window.helioxen.agents.setPluginEnabled(plugin.pluginId, !plugin.enabled)
      await loadData()
      setActionMessage(`Plugin "${plugin.displayName}" ${!plugin.enabled ? 'enabled' : 'disabled'}.`)
    } catch (err: any) {
      setActionMessage(`Failed to toggle plugin: ${err.message || String(err)}`)
    }
  }

  const handleConnect = async (connectorId: string) => {
    if (!window.helioxen?.agents) return
    try {
      await window.helioxen.agents.connectConnector(connectorId)
      await loadData()
      setActionMessage(`Connector "${connectorId}" connected.`)
    } catch (err: any) {
      setActionMessage(`Failed to connect: ${err.message || String(err)}`)
    }
  }

  const handleDisconnect = async (connectorId: string) => {
    if (!window.helioxen?.agents) return
    try {
      await window.helioxen.agents.disconnectConnector(connectorId)
      await loadData()
      setActionMessage(`Connector "${connectorId}" disconnected and tools revoked.`)
    } catch (err: any) {
      setActionMessage(`Failed to disconnect: ${err.message || String(err)}`)
    }
  }

  const handleValidateBuilder = async () => {
    if (!window.helioxen?.agents) return
    try {
      const def = {
        id: builderId.trim() || `skill_${Date.now()}`,
        displayName: builderName.trim() || 'Untitled Skill',
        description: builderDescription.trim() || 'Declarative dynamic skill',
        category: builderCategory,
        version: '1.0.0',
        steps: builderSteps,
        author: 'User',
        inputs: {},
        outputBinding: {}
      }
      const res = await window.helioxen.agents.validateSkill(def)
      setValidationResult(res)
      if (res.valid) {
        setActionMessage('Skill DAG passed validation successfully.')
      } else {
        setActionMessage(`Validation issues: ${res.errors.join('; ')}`)
      }
    } catch (err: any) {
      setActionMessage(`Validation error: ${err.message || String(err)}`)
    }
  }

  const handleDryRunBuilder = async () => {
    if (!window.helioxen?.agents) return
    try {
      const def = {
        id: builderId.trim() || `skill_${Date.now()}`,
        displayName: builderName.trim() || 'Untitled Skill',
        description: builderDescription.trim() || 'Declarative dynamic skill',
        category: builderCategory,
        version: '1.0.0',
        steps: builderSteps,
        author: 'User',
        inputs: {},
        outputBinding: {}
      }
      const res = await window.helioxen.agents.dryRunSkill(def, {})
      setDryRunResult(res)
      if (res.valid) {
        setActionMessage(`Dry-run succeeded: simulated ${res.simulatedSteps.length} steps without side effects.`)
      } else {
        setActionMessage(`Dry-run rejected: ${res.validationErrors.join('; ')}`)
      }
    } catch (err: any) {
      setActionMessage(`Dry run error: ${err.message || String(err)}`)
    }
  }

  const handleSaveSkill = async () => {
    if (!window.helioxen?.agents) return
    try {
      const id = builderId.trim() || `user_skill_${Date.now()}`
      const def = {
        id,
        displayName: builderName.trim() || 'Custom Dynamic Skill',
        description: builderDescription.trim() || 'User-authored dynamic workflow',
        category: builderCategory,
        version: '1.0.0',
        steps: builderSteps,
        author: 'User',
        inputs: {},
        outputBinding: {}
      }
      const saved = await window.helioxen.agents.saveSkill(def)
      await window.helioxen.agents.setSkillStatus(saved.id, 'enabled')
      await loadData()
      setActionMessage(`Skill "${saved.displayName}" validated and enabled in library.`)
      setActiveTab('skills')
    } catch (err: any) {
      setActionMessage(`Failed to save skill: ${err.message || String(err)}`)
    }
  }

  const handleToggleSkillStatus = async (skill: DynamicSkillDefinition) => {
    if (!window.helioxen?.agents) return
    try {
      const newStatus = skill.status === 'enabled' ? 'disabled' : 'enabled'
      await window.helioxen.agents.setSkillStatus(skill.id, newStatus)
      await loadData()
      setActionMessage(`Skill "${skill.displayName}" is now ${newStatus}.`)
    } catch (err: any) {
      setActionMessage(`Failed to update skill: ${err.message || String(err)}`)
    }
  }

  const handleDeleteSkill = async (skillId: string) => {
    if (!window.helioxen?.agents) return
    try {
      await window.helioxen.agents.deleteSkill(skillId)
      await loadData()
      setActionMessage(`Skill "${skillId}" deleted from library.`)
    } catch (err: any) {
      setActionMessage(`Failed to delete skill: ${err.message || String(err)}`)
    }
  }

  const handleExecuteSkill = async (skill: DynamicSkillDefinition) => {
    if (!window.helioxen?.agents) return
    try {
      setIsExecuting(skill.id)
      setExecutionOutput('Executing skill through authoritative TaskExecutionEngine...')
      const res = await window.helioxen.agents.executeSkill(skill.id, {})
      const duration = res.finishedAt - res.startedAt
      if (res.status === 'completed') {
        setExecutionOutput(`Execution completed in ${duration}ms. Execution ID: ${res.executionId}`)
        setActionMessage(`Skill "${skill.displayName}" executed successfully.`)
      } else {
        setExecutionOutput(`Execution failed: ${res.error || 'Unknown error'}`)
        setActionMessage(`Skill "${skill.displayName}" execution failed.`)
      }
      await loadData()
    } catch (err: any) {
      setExecutionOutput(`Execution exception: ${err.message || String(err)}`)
      setActionMessage(`Execution failed: ${err.message || String(err)}`)
    } finally {
      setIsExecuting(null)
    }
  }

  // Multi-Agent Collaboration Actions
  const handleDispatchSampleCollaboration = async () => {
    if (!window.helioxen?.agents?.coordinateTask) return
    try {
      setIsCoordinating(true)
      setActionMessage('Dispatching multi-agent collaboration DAG...')
      const input: CollaborationPlanInput = {
        conversationId: `conv_collab_${Date.now()}`,
        userIntent: 'Analyze current system state and summarize productivity impact',
        authorizedScope: ['read:system_info', 'read:files', 'write:notes'],
        budget: {
          maxDelegationDepth: 2,
          maxChildTasks: 3,
          maxConcurrency: 2,
          maxExecutionTimeMs: 15000,
          maxRetriesPerChild: 1
        },
        childTasks: [
          {
            childTaskId: 'task_research_phase',
            assignedAgentId: 'agent_researcher',
            objective: 'Gather core facts and verify background evidence',
            delegationDepth: 1,
            dependencies: [],
            isReadOnly: true,
            requiredCapabilities: ['read:system_info'],
            inputEnvelope: {
              objective: 'Gather core facts and verify background evidence',
              inputData: { topic: 'Productivity and multi-agent coordination metrics' },
              predecessorOutputs: {},
              capabilityConstraints: ['read:system_info'],
              isReadOnly: true,
              sourceProvenance: [
                { sourceId: 'src_knowledge_base', url: 'helioxen://knowledge/step41' }
              ]
            }
          },
          {
            childTaskId: 'task_productivity_phase',
            assignedAgentId: 'agent_productivity',
            objective: 'Format research findings into actionable daily tasks',
            delegationDepth: 1,
            dependencies: ['task_research_phase'],
            isReadOnly: false,
            requiredCapabilities: ['write:notes'],
            inputEnvelope: {
              objective: 'Format research findings into actionable daily tasks',
              inputData: { format: 'bullet_list' },
              predecessorOutputs: {},
              capabilityConstraints: ['write:notes'],
              isReadOnly: false
            }
          },
          {
            childTaskId: 'task_general_summary',
            assignedAgentId: 'agent_general',
            objective: 'Synthesize findings and generate executive summary',
            delegationDepth: 2,
            dependencies: ['task_productivity_phase'],
            isReadOnly: true,
            requiredCapabilities: ['read:system_info'],
            inputEnvelope: {
              objective: 'Synthesize findings and generate executive summary',
              inputData: { style: 'executive' },
              predecessorOutputs: {},
              capabilityConstraints: ['read:system_info'],
              isReadOnly: true
            }
          }
        ]
      }

      const coordinated = await window.helioxen.agents.coordinateTask(input)
      setSelectedTaskId(coordinated.parentTaskId)
      await loadData()
      setActionMessage(`Coordinated collaboration completed with status: ${coordinated.status}.`)
    } catch (err: any) {
      setActionMessage(`Collaboration failed: ${err.message || String(err)}`)
    } finally {
      setIsCoordinating(false)
    }
  }

  const handleCancelCoordinatedTask = async (parentTaskId: string) => {
    if (!window.helioxen?.agents?.cancelCoordinatedTask) return
    try {
      const ok = await window.helioxen.agents.cancelCoordinatedTask(
        parentTaskId,
        'User requested cancellation from UI'
      )
      if (ok) {
        setActionMessage(`Cancellation requested for task '${parentTaskId}'.`)
        await loadData()
      } else {
        setActionMessage(`Could not cancel task '${parentTaskId}' (already finished or not found).`)
      }
    } catch (err: any) {
      setActionMessage(`Cancel error: ${err.message || String(err)}`)
    }
  }

  // Step 42: Staged 7-Phase Validation
  const handleRunStagedValidation = async () => {
    if (!window.helioxen?.agents?.validateSkillStaged) return
    try {
      const def = {
        id: builderId.trim() || `skill_${Date.now()}`,
        displayName: builderName.trim() || 'Untitled Skill',
        description: builderDescription.trim() || 'Declarative dynamic skill',
        category: builderCategory,
        version: '1.0.0',
        steps: builderSteps,
        author: 'User',
        constraints: { maxTimeoutMs: 30000, maxStepRetries: 1, stopOnFirstFailure: true }
      }
      const report = await window.helioxen.agents.validateSkillStaged(def)
      setStagedReport(report)
      if (report.valid) {
        setActionMessage(`Deterministic 7-stage validation: PASSED (${report.derivedRiskTier.toUpperCase()} risk)`)
      } else {
        const errorCount = report.issues.filter((i) => i.severity === 'error').length
        setActionMessage(`Validation blocked by ${errorCount} error(s). Review validation tab.`)
      }
    } catch (err: any) {
      setActionMessage(`Validation error: ${err.message || String(err)}`)
    }
  }

  // Step 42: AI-Assisted Drafting & Refinement
  const handleGenerateAiDraft = async () => {
    if (!window.helioxen?.agents?.generateSkillDraftWithAi || !aiPrompt.trim()) return
    try {
      setIsGeneratingAi(true)
      setActionMessage('Generating structured skill draft via provider model...')
      const draft = await window.helioxen.agents.generateSkillDraftWithAi(aiPrompt.trim(), builderCategory)
      setBuilderId(draft.id)
      setBuilderName(draft.displayName)
      setBuilderDescription(draft.description)
      setBuilderCategory(draft.category)
      setBuilderSteps([...draft.steps])
      await loadData()
      setActionMessage(`AI Draft generated: "${draft.displayName}". Quarantined as unapproved draft.`)
    } catch (err: any) {
      setActionMessage(`AI Drafting failed: ${err.message || String(err)}`)
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const handleRefineAiDraft = async () => {
    if (!window.helioxen?.agents?.refineSkillWithAi || !builderId || !aiRefineInstruction.trim()) return
    try {
      setIsGeneratingAi(true)
      setActionMessage('Refining workflow draft based on instructions...')
      const refined = await window.helioxen.agents.refineSkillWithAi(builderId, aiRefineInstruction.trim())
      setBuilderSteps([...refined.steps])
      setBuilderDescription(refined.description)
      await loadData()
      setActionMessage(`Workflow draft refined. Created new draft revision.`)
    } catch (err: any) {
      setActionMessage(`Refinement failed: ${err.message || String(err)}`)
    } finally {
      setIsGeneratingAi(false)
    }
  }

  // Step 42: Versions & Rollback
  const handleLoadVersions = async (skillId: string) => {
    if (!window.helioxen?.agents?.listSkillVersions || !skillId) return
    try {
      const vers = await window.helioxen.agents.listSkillVersions(skillId)
      setSkillVersions(vers || [])
      if (vers && vers.length > 0 && !selectedVersionId) {
        setSelectedVersionId(vers[vers.length - 1].versionId)
      }
    } catch (err: any) {
      console.error('Failed to load skill versions:', err)
    }
  }

  const handleRollbackVersion = async (targetVersionId: string) => {
    if (!window.helioxen?.agents?.rollbackSkillVersion || !builderId) return
    try {
      const restored = await window.helioxen.agents.rollbackSkillVersion(builderId, targetVersionId)
      setBuilderSteps([...restored.steps])
      setBuilderDescription(restored.description)
      await loadData()
      await handleLoadVersions(builderId)
      setActionMessage(`Skill rolled back to revision ${restored.version}. Revalidated against current capabilities.`)
    } catch (err: any) {
      setActionMessage(`Rollback failed: ${err.message || String(err)}`)
    }
  }

  // Step 42: Test Scenarios & Regression
  const handleLoadScenarios = async (skillId: string) => {
    if (!window.helioxen?.agents?.listTestScenarios || !skillId) return
    try {
      const scens = await window.helioxen.agents.listTestScenarios(skillId)
      setTestScenarios(scens || [])
    } catch (err: any) {
      console.error('Failed to load test scenarios:', err)
    }
  }

  const handleCreateSampleScenario = async () => {
    if (!window.helioxen?.agents?.createTestScenario || !builderId) return
    try {
      const sc = await window.helioxen.agents.createTestScenario(builderId, {
        scenarioId: `scen_${Date.now()}`,
        skillId: builderId,
        name: 'Standard Baseline Run',
        description: 'Synthetic fixture testing standard workflow inputs',
        inputParameters: { testMode: true },
        mockToolOutputs: {
          'system:get_time': { epochMs: 1700000000000, iso: '2023-11-14T22:13:20.000Z' }
        },
        expectedStatus: 'completed'
      })
      await handleLoadScenarios(builderId)
      setActionMessage(`Test scenario "${sc.name}" created.`)
    } catch (err: any) {
      setActionMessage(`Failed to create scenario: ${err.message || String(err)}`)
    }
  }

  const handleRunScenario = async (scenarioId: string) => {
    if (!window.helioxen?.agents?.runTestScenario || !builderId) return
    try {
      const res = await window.helioxen.agents.runTestScenario(builderId, scenarioId)
      setScenarioResult(res)
      setActionMessage(`Scenario "${res.scenarioName}": ${res.passed ? 'PASSED' : 'FAILED'}`)
    } catch (err: any) {
      setActionMessage(`Scenario run failed: ${err.message || String(err)}`)
    }
  }

  const handleRunRegression = async () => {
    if (!window.helioxen?.agents?.runRegressionTests || !builderId) return
    try {
      const rep = await window.helioxen.agents.runRegressionTests(builderId)
      setRegressionReport(rep)
      setActionMessage(`Regression suite: ${rep.passedCount}/${rep.totalScenarios} scenarios passed.`)
    } catch (err: any) {
      setActionMessage(`Regression test failed: ${err.message || String(err)}`)
    }
  }

  // Step 42: Export & Import
  const handleExportPackage = async () => {
    if (!window.helioxen?.agents?.exportSkillPackage || !builderId) return
    try {
      const pkgJson = await window.helioxen.agents.exportSkillPackage(builderId)
      setExportPackageJson(pkgJson)
      setActionMessage(`Skill exported to JSON package (${pkgJson.length} bytes).`)
    } catch (err: any) {
      setActionMessage(`Export failed: ${err.message || String(err)}`)
    }
  }

  const handlePreviewImport = async () => {
    if (!window.helioxen?.agents?.previewSkillImport || !importJson.trim()) return
    try {
      const prev = await window.helioxen.agents.previewSkillImport(importJson.trim())
      setImportPreview(prev)
      if (prev.valid) {
        setActionMessage(`Package valid: "${prev.candidateSkill.displayName}". Ready to import.`)
      } else {
        setActionMessage(`Package has issues: missing ${prev.missingDependencies.length} tools.`)
      }
    } catch (err: any) {
      setActionMessage(`Import preview failed: ${err.message || String(err)}`)
    }
  }

  const handleExecuteImport = async () => {
    if (!window.helioxen?.agents?.importSkillPackage || !importJson.trim()) return
    try {
      const imported = await window.helioxen.agents.importSkillPackage(importJson.trim())
      await loadData()
      setBuilderId(imported.id)
      setBuilderName(imported.displayName)
      setBuilderDescription(imported.description)
      setBuilderCategory(imported.category)
      setBuilderSteps([...imported.steps])
      setImportJson('')
      setImportPreview(null)
      setActionMessage(`Skill "${imported.displayName}" imported into library as quarantined draft.`)
    } catch (err: any) {
      setActionMessage(`Import failed: ${err.message || String(err)}`)
    }
  }

  useEffect(() => {
    if (activeTab === 'builder' && builderId) {
      handleLoadVersions(builderId)
      handleLoadScenarios(builderId)
    }
  }, [activeTab, builderId])

  const selectedTask = coordinatedTasks.find((t) => t.parentTaskId === selectedTaskId)

  return (
    <div className="flex flex-col space-y-6 max-w-7xl mx-auto pb-12 animate-hx-fade-in">
      {/* Top Banner / Stats Overview */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-hx-md bg-hx-panel/40 border border-hx-border-panel">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-hx-cyan" />
            <h2 className="text-base font-display font-semibold text-hx-text-primary">
              Agent Town &amp; Dynamic Skills Hub
            </h2>
            <Badge variant="nominal" size="sm">
              Phase 14 • Steps 40-42
            </Badge>
          </div>
          <p className="text-xs text-hx-text-secondary mt-1">
            Registered Agents, Plugin Connectors, and Declarative Dynamic Workflows with Strict Risk Sandboxing.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-center px-3 py-1.5 rounded-hx-sm bg-hx-space/60 border border-hx-border-panel">
            <span className="block text-xs font-mono font-bold text-hx-cyan">
              {overview?.activeAgentsCount ?? 0} / {overview?.totalAgents ?? 0}
            </span>
            <span className="text-[10px] text-hx-text-secondary uppercase">Active Agents</span>
          </div>
          <div className="text-center px-3 py-1.5 rounded-hx-sm bg-hx-space/60 border border-hx-border-panel">
            <span className="block text-xs font-mono font-bold text-hx-emerald">
              {overview?.connectedPluginsCount ?? 0} / {overview?.totalPlugins ?? 0}
            </span>
            <span className="text-[10px] text-hx-text-secondary uppercase">Connectors</span>
          </div>
          <div className="text-center px-3 py-1.5 rounded-hx-sm bg-hx-space/60 border border-hx-border-panel">
            <span className="block text-xs font-mono font-bold text-hx-amber">
              {overview?.enabledSkillsCount ?? 0} / {overview?.totalSkills ?? 0}
            </span>
            <span className="text-[10px] text-hx-text-secondary uppercase">Skills</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="px-4 py-2.5 rounded-hx-sm bg-hx-cyan/10 border border-hx-cyan/30 text-xs text-hx-cyan flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-hx-text-secondary hover:text-hx-text-primary ml-3"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center border-b border-hx-border-panel space-x-2">
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-display font-medium border-b-2 transition-colors ${
            activeTab === 'agents'
              ? 'border-hx-cyan text-hx-cyan font-semibold'
              : 'border-transparent text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Agents ({overview?.agents.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('plugins')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-display font-medium border-b-2 transition-colors ${
            activeTab === 'plugins'
              ? 'border-hx-cyan text-hx-cyan font-semibold'
              : 'border-transparent text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          <span>Plugin Connectors ({overview?.plugins.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-display font-medium border-b-2 transition-colors ${
            activeTab === 'skills'
              ? 'border-hx-cyan text-hx-cyan font-semibold'
              : 'border-transparent text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Dynamic Skills ({overview?.skills.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-display font-medium border-b-2 transition-colors ${
            activeTab === 'builder'
              ? 'border-hx-cyan text-hx-cyan font-semibold'
              : 'border-transparent text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Skill Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('collaboration')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-display font-medium border-b-2 transition-colors ${
            activeTab === 'collaboration'
              ? 'border-hx-cyan text-hx-cyan font-semibold'
              : 'border-transparent text-hx-text-secondary hover:text-hx-text-primary'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Collaboration Hub ({coordinatedTasks.length})</span>
        </button>
      </div>

      {/* Tab: Agents Grid */}
      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {overview?.agents.map((agent) => (
            <Card
              key={agent.id}
              variant="panel"
              border="subtle"
              padding="sm"
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🤖</span>
                    <div>
                      <h4 className="text-xs font-bold text-hx-text-primary">{agent.displayName}</h4>
                      <span className="text-[10px] text-hx-text-secondary">{agent.purpose}</span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      !agent.enabled
                        ? 'neutral'
                        : agent.status === 'idle'
                          ? 'nominal'
                          : agent.status === 'running'
                            ? 'info'
                            : 'warning'
                    }
                    size="sm"
                  >
                    {!agent.enabled ? 'DISABLED' : agent.status.toUpperCase()}
                  </Badge>
                </div>

                <p className="text-[11px] text-hx-text-secondary leading-relaxed mb-3">
                  {agent.description}
                </p>

                <div className="space-y-1.5 mb-3 text-[10px] font-mono">
                  <div className="flex items-center justify-between text-hx-text-secondary">
                    <span>Category:</span>
                    <span className="text-hx-text-primary capitalize">{agent.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-hx-text-secondary">
                    <span>Preferred Model:</span>
                    <span className="text-hx-cyan truncate max-w-[140px]">
                      {agent.modelEligibility.preferredModelId || 'Default'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-hx-text-secondary">
                    <span>Required Capabilities:</span>
                    <span className="text-hx-text-primary">{agent.requiredCapabilities.length}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-hx-border-panel flex items-center justify-between">
                <span className="text-[10px] text-hx-text-secondary">
                  {agent.activeAssignment ? `Task: ${agent.activeAssignment.taskId}` : 'No active tasks'}
                </span>
                <Button
                  variant={agent.enabled ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => handleToggleAgent(agent)}
                  leftIcon={<Power className="w-3 h-3" />}
                >
                  {agent.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Plugin Connectors */}
      {activeTab === 'plugins' && (
        <div className="space-y-4">
          {overview?.plugins.map((plugin) => (
            <Card key={plugin.pluginId} variant="panel" border="subtle" padding="md">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-hx-md bg-hx-cyan/10 border border-hx-cyan/30 flex items-center justify-center text-hx-cyan">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-hx-text-primary">{plugin.displayName}</h4>
                      <span className="text-[10px] font-mono text-hx-text-secondary">v{plugin.version}</span>
                      <Badge variant={plugin.enabled ? 'nominal' : 'neutral'} size="sm">
                        {plugin.enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-hx-text-secondary mt-0.5">{plugin.description}</p>
                  </div>
                </div>

                <Button
                  variant={plugin.enabled ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => handleTogglePlugin(plugin)}
                >
                  {plugin.enabled ? 'Disable Plugin' : 'Enable Plugin'}
                </Button>
              </div>

              {/* Connectors inside this plugin */}
              <div className="mt-4 pt-3 border-t border-hx-border-panel space-y-3">
                <h5 className="text-[11px] font-semibold text-hx-text-secondary uppercase tracking-wider">
                  Declared Connectors &amp; Scopes
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {plugin.connectors.map((connector) => (
                    <div
                      key={connector.connectorId}
                      className="p-3 rounded-hx-sm bg-hx-space/60 border border-hx-border-panel flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-hx-text-primary">
                            {connector.displayName}
                          </span>
                          <Badge
                            variant={
                              connector.status === 'connected'
                                ? 'nominal'
                                : connector.status === 'auth_expired'
                                  ? 'warning'
                                  : 'neutral'
                            }
                            size="sm"
                          >
                            {connector.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-hx-text-secondary mb-2">
                          Endpoint: <span className="font-mono text-hx-cyan">{connector.endpointUrl}</span>
                        </p>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {connector.scopes.map((s) => (
                            <span
                              key={s.scopeId}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                s.granted
                                  ? 'bg-hx-emerald/15 text-hx-emerald border border-hx-emerald/30'
                                  : 'bg-hx-panel text-hx-text-secondary'
                              }`}
                            >
                              {s.displayName} ({s.scopeId})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-hx-border-panel text-[10px]">
                        <span className="text-hx-text-secondary font-mono">
                          Plugin Tools: {plugin.declaredToolIds.length}
                        </span>
                        {connector.status === 'connected' ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDisconnect(connector.connectorId)}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleConnect(connector.connectorId)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Dynamic Skills Library */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          {executionOutput && (
            <Card variant="panel" border="panel" padding="sm" className="font-mono text-xs">
              <div className="flex items-center justify-between mb-1 text-hx-cyan">
                <span className="font-bold">Execution Output:</span>
                <button
                  onClick={() => setExecutionOutput(null)}
                  className="text-hx-text-secondary hover:text-hx-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <pre className="text-hx-text-primary bg-hx-space p-2 rounded text-[11px] overflow-x-auto whitespace-pre-wrap">
                {executionOutput}
              </pre>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overview?.skills.map((skill) => (
              <Card
                key={skill.id}
                variant="panel"
                border="subtle"
                padding="sm"
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-hx-amber" />
                      <div>
                        <h4 className="text-xs font-bold text-hx-text-primary">{skill.displayName}</h4>
                        <span className="text-[10px] text-hx-text-secondary">v{skill.version} • by {skill.author}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Badge
                        variant={
                          skill.derivedRiskTier === 'high'
                            ? 'warning'
                            : skill.derivedRiskTier === 'moderate'
                              ? 'info'
                              : 'nominal'
                        }
                        size="sm"
                      >
                        {skill.derivedRiskTier.toUpperCase()}
                      </Badge>
                      <Badge
                        variant={skill.status === 'enabled' ? 'nominal' : 'neutral'}
                        size="sm"
                      >
                        {skill.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-hx-text-secondary leading-relaxed mb-3">
                    {skill.description}
                  </p>

                  <div className="space-y-1.5 mb-3 text-[10px]">
                    <div className="flex items-center justify-between text-hx-text-secondary font-mono">
                      <span>Steps:</span>
                      <span className="text-hx-text-primary">{skill.steps.length} sequential steps</span>
                    </div>
                    <div className="flex items-center justify-between text-hx-text-secondary font-mono">
                      <span>Derived Capabilities:</span>
                      <span className="text-hx-cyan">{skill.derivedCapabilities.length}</span>
                    </div>
                  </div>

                  {/* Steps preview */}
                  <div className="p-2 rounded bg-hx-space/60 border border-hx-border-panel mb-3 space-y-1">
                    {skill.steps.map((st, i) => (
                      <div key={st.stepId} className="text-[10px] font-mono text-hx-text-secondary flex items-center space-x-1.5">
                        <span className="text-hx-cyan">{i + 1}.</span>
                        <span className="text-hx-text-primary truncate">{st.displayName}</span>
                        <span className="text-hx-text-secondary">({st.toolId})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-hx-border-panel flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={skill.status !== 'enabled' || isExecuting === skill.id}
                      onClick={() => handleExecuteSkill(skill)}
                      leftIcon={<Play className="w-3 h-3" />}
                    >
                      {isExecuting === skill.id ? 'Running...' : 'Run'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleSkillStatus(skill)}
                    >
                      {skill.status === 'enabled' ? 'Disable' : 'Enable'}
                    </Button>
                  </div>

                  {skill.author.toLowerCase() === 'user' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteSkill(skill.id)}
                      leftIcon={<Trash2 className="w-3 h-3" />}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Skill Studio / Safe Declarative Builder (Step 42 Elevated) */}
      {activeTab === 'builder' && (
        <div className="flex flex-col space-y-5">
          {/* Studio Sub-Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-hx-md bg-hx-panel/60 border border-hx-border-panel">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => setStudioSubTab('editor')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-sm text-xs font-medium transition-colors ${
                  studioSubTab === 'editor'
                    ? 'bg-hx-cyan/15 text-hx-cyan border border-hx-cyan/40 font-semibold'
                    : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-panel'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Workflow Editor</span>
              </button>

              <button
                onClick={() => {
                  setStudioSubTab('validation')
                  if (!stagedReport) handleRunStagedValidation()
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-sm text-xs font-medium transition-colors ${
                  studioSubTab === 'validation'
                    ? 'bg-hx-cyan/15 text-hx-cyan border border-hx-cyan/40 font-semibold'
                    : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-panel'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>7-Stage Validation</span>
                {stagedReport && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      stagedReport.valid
                        ? 'bg-hx-emerald/20 text-hx-emerald'
                        : 'bg-hx-warning/20 text-hx-warning'
                    }`}
                  >
                    {stagedReport.valid ? 'PASS' : 'WARN'}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setStudioSubTab('testing')
                  if (builderId) handleLoadScenarios(builderId)
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-sm text-xs font-medium transition-colors ${
                  studioSubTab === 'testing'
                    ? 'bg-hx-cyan/15 text-hx-cyan border border-hx-cyan/40 font-semibold'
                    : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-panel'
                }`}
              >
                <TestTube className="w-3.5 h-3.5" />
                <span>Test Workbench</span>
                {testScenarios.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-hx-space text-hx-text-secondary font-mono">
                    {testScenarios.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setStudioSubTab('versions')
                  if (builderId) handleLoadVersions(builderId)
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-sm text-xs font-medium transition-colors ${
                  studioSubTab === 'versions'
                    ? 'bg-hx-cyan/15 text-hx-cyan border border-hx-cyan/40 font-semibold'
                    : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-panel'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Version History</span>
                {skillVersions.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-hx-space text-hx-text-secondary font-mono">
                    {skillVersions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setStudioSubTab('import_export')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-sm text-xs font-medium transition-colors ${
                  studioSubTab === 'import_export'
                    ? 'bg-hx-cyan/15 text-hx-cyan border border-hx-cyan/40 font-semibold'
                    : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-panel'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Import / Export</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs text-hx-text-secondary">
              <span className="font-mono text-hx-cyan">{builderId || 'untitled'}</span>
              <span>•</span>
              <span className="font-mono">{builderSteps.length} step(s)</span>
            </div>
          </div>

          {/* SUB-TAB 1: Workflow Editor */}
          {studioSubTab === 'editor' && (
            <Card variant="panel" border="subtle" padding="lg">
              <div className="space-y-6">
                {/* AI-Assisted Drafting Header */}
                <div className="p-4 rounded-hx-md bg-gradient-to-r from-hx-cyan/10 via-hx-panel to-hx-panel border border-hx-cyan/30 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-hx-cyan" />
                    <h4 className="text-xs font-display font-semibold text-hx-text-primary">
                      AI Workflow Drafting Assistant
                    </h4>
                    <Badge variant="nominal" size="sm">
                      Untrusted Draft Mode
                    </Badge>
                  </div>
                  <p className="text-[11px] text-hx-text-secondary">
                    Describe your desired agent workflow in plain language. HELIOXEN generates a structured, declarative draft quarantined for human inspection and DAG validation.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Gather system telemetry, check weather forecast, and synthesize a daily briefing note"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                    />
                    <select
                      value={builderCategory}
                      onChange={(e) => setBuilderCategory(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                    >
                      <option value="productivity">productivity</option>
                      <option value="data_analysis">data_analysis</option>
                      <option value="system_automation">system_automation</option>
                      <option value="creative">creative</option>
                      <option value="general">general</option>
                    </select>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateAiDraft}
                      disabled={isGeneratingAi || !aiPrompt.trim()}
                      leftIcon={<Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />}
                    >
                      {isGeneratingAi ? 'Drafting...' : 'Generate AI Draft'}
                    </Button>
                  </div>

                  {builderId && (
                    <div className="pt-2 border-t border-hx-border-panel/40 flex flex-col sm:flex-row gap-2 items-center">
                      <span className="text-[11px] text-hx-text-secondary whitespace-nowrap">Refine active draft:</span>
                      <input
                        type="text"
                        placeholder="e.g. Add validation check after step 1, enforce timeout of 10s"
                        value={aiRefineInstruction}
                        onChange={(e) => setAiRefineInstruction(e.target.value)}
                        className="flex-1 px-3 py-1 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRefineAiDraft}
                        disabled={isGeneratingAi || !aiRefineInstruction.trim()}
                      >
                        Refine Draft
                      </Button>
                    </div>
                  )}
                </div>

                {/* Skill Metadata Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-hx-text-secondary mb-1">
                      Skill ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. user_daily_summary"
                      value={builderId}
                      onChange={(e) => setBuilderId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary font-mono focus:outline-none focus:border-hx-cyan"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-hx-text-secondary mb-1">
                      Skill Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Daily Briefing & Research Archive"
                      value={builderName}
                      onChange={(e) => setBuilderName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-hx-text-secondary mb-1">
                      Category
                    </label>
                    <select
                      value={builderCategory}
                      onChange={(e) => setBuilderCategory(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                    >
                      <option value="productivity">productivity</option>
                      <option value="data_analysis">data_analysis</option>
                      <option value="system_automation">system_automation</option>
                      <option value="creative">creative</option>
                      <option value="general">general</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-hx-text-secondary mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Describe what this skill accomplishes..."
                    value={builderDescription}
                    onChange={(e) => setBuilderDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan resize-none"
                  />
                </div>

                {/* Workflow Steps Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-medium text-hx-text-secondary">
                      Workflow Steps DAG ({builderSteps.length})
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const nextIndex = builderSteps.length + 1
                        setBuilderSteps([
                          ...builderSteps,
                          {
                            stepId: `step_${nextIndex}`,
                            toolId: 'widgets:get_system_health',
                            displayName: `System Diagnostics Sample ${nextIndex}`,
                            inputBindings: {},
                            dependsOnStepIds: []
                          }
                        ])
                      }}
                      leftIcon={<PlusCircle className="w-3 h-3" />}
                    >
                      Add Step
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {builderSteps.map((st, i) => (
                      <div
                        key={st.stepId}
                        className="p-3.5 rounded-hx-sm bg-hx-space/80 border border-hx-border-panel space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-hx-cyan flex items-center space-x-1.5">
                            <span>Step #{i + 1}</span>
                            <span className="text-hx-text-secondary">({st.stepId})</span>
                          </span>
                          {builderSteps.length > 1 && (
                            <button
                              onClick={() => {
                                setBuilderSteps(builderSteps.filter((_, idx) => idx !== i))
                              }}
                              className="text-hx-text-secondary hover:text-hx-warning text-[11px] flex items-center space-x-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-hx-text-secondary">Step Title</label>
                            <input
                              type="text"
                              value={st.displayName}
                              onChange={(e) => {
                                const updated = [...builderSteps]
                                updated[i] = { ...st, displayName: e.target.value }
                                setBuilderSteps(updated)
                              }}
                              className="w-full px-2 py-1 rounded bg-hx-panel border border-hx-border-panel text-[11px] text-hx-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-hx-text-secondary">Target Tool</label>
                            <select
                              value={st.toolId}
                              onChange={(e) => {
                                const updated = [...builderSteps]
                                updated[i] = { ...st, toolId: e.target.value }
                                setBuilderSteps(updated)
                              }}
                              className="w-full px-2 py-1 rounded bg-hx-panel border border-hx-border-panel text-[11px] text-hx-text-primary font-mono"
                            >
                              <option value="system:get_time">system:get_time</option>
                              <option value="widgets:get_system_health">widgets:get_system_health</option>
                              <option value="widgets:get_weather_forecast">widgets:get_weather_forecast</option>
                              <option value="agents:list_available">agents:list_available</option>
                              <option value="research:web_search">research:web_search</option>
                              <option value="notes:search">notes:search</option>
                              <option value="tasks:list">tasks:list</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-hx-text-secondary">Depends On Step ID(s)</label>
                            <input
                              type="text"
                              placeholder="e.g. step_1, step_2"
                              value={(st.dependsOnStepIds || []).join(', ')}
                              onChange={(e) => {
                                const val = e.target.value
                                const deps = val.split(',').map((s) => s.trim()).filter(Boolean)
                                const updated = [...builderSteps]
                                updated[i] = { ...st, dependsOnStepIds: deps }
                                setBuilderSteps(updated)
                              }}
                              className="w-full px-2 py-1 rounded bg-hx-panel border border-hx-border-panel text-[11px] text-hx-text-primary font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation and Dry-Run Previews */}
                {stagedReport && (
                  <div
                    className={`p-3.5 rounded-hx-sm text-xs font-mono border ${
                      stagedReport.valid
                        ? 'bg-hx-emerald/10 border-hx-emerald/30 text-hx-emerald'
                        : 'bg-hx-warning/10 border-hx-warning/30 text-hx-warning'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 font-bold">
                      <span className="flex items-center space-x-1.5">
                        {stagedReport.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        <span>7-Stage Deterministic Validation: {stagedReport.valid ? 'PASSED' : 'BLOCKED'}</span>
                      </span>
                      <span>Risk Tier: {stagedReport.derivedRiskTier.toUpperCase()}</span>
                    </div>
                    {stagedReport.issues.length > 0 && (
                      <div className="space-y-1 text-[11px] opacity-90">
                        {stagedReport.issues.slice(0, 3).map((iss, idx) => (
                          <div key={idx} className="flex items-start space-x-1.5">
                            <span className="font-semibold uppercase">[{iss.severity}]</span>
                            <span>{iss.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {dryRunResult && (
                  <div
                    className={`p-3 rounded-hx-sm text-xs font-mono ${
                      dryRunResult.valid
                        ? 'bg-hx-cyan/10 border border-hx-cyan/30 text-hx-cyan'
                        : 'bg-hx-warning/10 border border-hx-warning/30 text-hx-warning'
                    }`}
                  >
                    <div className="font-bold mb-1">
                      Dry-Run Simulation: {dryRunResult.valid ? 'SUCCESS' : 'FAILED'}
                    </div>
                    <div>Simulated Steps: {dryRunResult.simulatedSteps.length}</div>
                    <div>Derived Capabilities: {dryRunResult.derivedCapabilities.join(', ') || 'none'}</div>
                  </div>
                )}

                {/* Bottom Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-hx-border-panel">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRunStagedValidation}
                      leftIcon={<ShieldCheck className="w-4 h-4" />}
                    >
                      7-Stage Validate
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDryRunBuilder}
                      leftIcon={<Play className="w-4 h-4" />}
                    >
                      Dry Run
                    </Button>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveSkill}
                    leftIcon={<PlusCircle className="w-4 h-4" />}
                  >
                    Save &amp; Register Active Version
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* SUB-TAB 2: 7-Stage Validation Pipeline Inspector */}
          {studioSubTab === 'validation' && (
            <Card variant="panel" border="subtle" padding="lg">
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-hx-cyan" />
                      <span>Deterministic 7-Stage Validation Pipeline</span>
                    </h3>
                    <p className="text-xs text-hx-text-secondary mt-0.5">
                      Validates declarative skill definitions against schemas, tool registries, data lineages, cyclic graphs, permissions, quotas, and readiness.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRunStagedValidation}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Re-Run Validation
                  </Button>
                </div>

                {stagedReport ? (
                  <div className="space-y-4">
                    {/* Summary Header */}
                    <div
                      className={`p-4 rounded-hx-md border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                        stagedReport.valid
                          ? 'bg-hx-emerald/10 border-hx-emerald/30 text-hx-emerald'
                          : 'bg-hx-warning/10 border-hx-warning/30 text-hx-warning'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2 font-bold text-sm">
                          {stagedReport.valid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          <span>Readiness Status: {stagedReport.valid ? 'PASSED — READY FOR ACTIVATION' : 'BLOCKED — ERRORS PRESENT'}</span>
                        </div>
                        <div className="text-xs opacity-90 mt-1">
                          Evaluated at {new Date(stagedReport.validatedAt).toLocaleTimeString()} • {stagedReport.stepOrder.length} steps topologically ordered
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            stagedReport.derivedRiskTier === 'low'
                              ? 'nominal'
                              : stagedReport.derivedRiskTier === 'moderate'
                              ? 'info'
                              : stagedReport.derivedRiskTier === 'high'
                              ? 'warning'
                              : 'danger'
                          }
                          size="md"
                        >
                          Risk: {stagedReport.derivedRiskTier.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* 7 Stages Visualization Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'structural',
                          title: '1. Structural Schema',
                          desc: 'Validates strict Zod schema, step IDs, and parameter bindings'
                        },
                        {
                          id: 'registry_resolution',
                          title: '2. Registry Resolution',
                          desc: 'Checks if every referenced tool exists in approved registry'
                        },
                        {
                          id: 'data_flow',
                          title: '3. Data Flow Lineage',
                          desc: 'Verifies step inputs bind only to prior steps without forward references'
                        },
                        {
                          id: 'dependency_graph',
                          title: '4. DAG Cycle Detection',
                          desc: 'Topological sort to guarantee acyclic Directed Graph execution'
                        },
                        {
                          id: 'authorization_risk',
                          title: '5. Authorization & Risk',
                          desc: 'Maps required capabilities, checks sandboxing and risk tier'
                        },
                        {
                          id: 'resource_limits',
                          title: '6. Resource Limits',
                          desc: 'Enforces max steps, concurrency limits, and execution timeouts'
                        },
                        {
                          id: 'readiness_summary',
                          title: '7. Readiness Summary',
                          desc: 'Synthesizes blocking issues vs informational suggestions'
                        }
                      ].map((stage) => {
                        const issuesForStage = stagedReport.issues.filter((i) => i.stage === stage.id)
                        const hasErrors = issuesForStage.some((i) => i.severity === 'error')
                        const hasWarnings = issuesForStage.some((i) => i.severity === 'warning')

                        return (
                          <div
                            key={stage.id}
                            className={`p-3.5 rounded-hx-md border ${
                              hasErrors
                                ? 'bg-hx-warning/10 border-hx-warning/40'
                                : hasWarnings
                                ? 'bg-hx-panel/60 border-hx-warning/30'
                                : 'bg-hx-panel/40 border-hx-border-panel'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-hx-text-primary">
                                {stage.title}
                              </span>
                              {hasErrors ? (
                                <XCircle className="w-3.5 h-3.5 text-hx-warning" />
                              ) : hasWarnings ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-hx-warning" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5 text-hx-emerald" />
                              )}
                            </div>
                            <p className="text-[11px] text-hx-text-secondary leading-snug">
                              {stage.desc}
                            </p>
                            {issuesForStage.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-hx-border-panel/40 text-[10px] space-y-1">
                                {issuesForStage.map((iss, i) => (
                                  <div key={i} className="text-hx-warning">
                                    • {iss.message}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Issues List Detailed Breakdown */}
                    {stagedReport.issues.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-semibold text-hx-text-secondary uppercase tracking-wider">
                          Validation Findings ({stagedReport.issues.length})
                        </h4>
                        <div className="space-y-2">
                          {stagedReport.issues.map((iss, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-hx-sm border text-xs ${
                                iss.severity === 'error'
                                  ? 'bg-hx-warning/10 border-hx-warning/30 text-hx-warning'
                                  : 'bg-hx-panel/50 border-hx-border-panel text-hx-text-secondary'
                              }`}
                            >
                              <div className="flex items-center space-x-2 font-mono text-[11px] mb-0.5">
                                <span className="uppercase font-bold">[{iss.severity}]</span>
                                <span>Stage: {iss.stage}</span>
                                {iss.stepId && <span>• Step: {iss.stepId}</span>}
                              </div>
                              <div className="text-hx-text-primary font-medium">{iss.message}</div>
                              {iss.suggestedFix && (
                                <div className="text-[11px] text-hx-text-secondary mt-1">
                                  Suggestion: {iss.suggestedFix}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-hx-border-panel rounded-hx-md">
                    <ShieldCheck className="w-8 h-8 text-hx-cyan mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-hx-text-secondary">
                      No validation report yet. Click below to run the deterministic 7-stage check on the current workflow.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 mx-auto"
                      onClick={handleRunStagedValidation}
                    >
                      Run 7-Stage Validation
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* SUB-TAB 3: Test Workbench & Regression Testing */}
          {studioSubTab === 'testing' && (
            <Card variant="panel" border="subtle" padding="lg">
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center space-x-2">
                      <TestTube className="w-4 h-4 text-hx-cyan" />
                      <span>Skill Test Workbench &amp; Regression Engine</span>
                    </h3>
                    <p className="text-xs text-hx-text-secondary mt-0.5">
                      Define isolated synthetic fixtures with mock tool outputs to test workflow steps and detect regressions across revisions.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateSampleScenario}
                      leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                    >
                      Add Test Scenario
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRunRegression}
                      disabled={testScenarios.length === 0}
                      leftIcon={<Play className="w-3.5 h-3.5" />}
                    >
                      Run Regression Suite
                    </Button>
                  </div>
                </div>

                {/* Scenarios Grid */}
                <div>
                  <h4 className="text-xs font-semibold text-hx-text-secondary uppercase tracking-wider mb-2">
                    Defined Scenarios ({testScenarios.length})
                  </h4>

                  {testScenarios.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-hx-border-panel rounded-hx-md">
                      <p className="text-xs text-hx-text-secondary">
                        No test scenarios created for skill &ldquo;{builderId}&rdquo;.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3 mx-auto"
                        onClick={handleCreateSampleScenario}
                      >
                        Create Baseline Fixture
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {testScenarios.map((sc) => (
                        <div
                          key={sc.scenarioId}
                          className="p-3.5 rounded-hx-md bg-hx-space/60 border border-hx-border-panel space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-semibold text-hx-text-primary">{sc.name}</div>
                              <div className="text-[11px] text-hx-text-secondary">{sc.description}</div>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRunScenario(sc.scenarioId)}
                              leftIcon={<Play className="w-3 h-3" />}
                            >
                              Run
                            </Button>
                          </div>

                          <div className="text-[10px] font-mono text-hx-text-secondary bg-hx-panel/50 p-2 rounded">
                            Expected: {sc.expectedStatus || 'completed'} • Mocks: {Object.keys(sc.mockToolOutputs || {}).length} tools
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scenario Execution Result */}
                {scenarioResult && (
                  <div
                    className={`p-4 rounded-hx-md border ${
                      scenarioResult.passed
                        ? 'bg-hx-emerald/10 border-hx-emerald/30 text-hx-emerald'
                        : 'bg-hx-warning/10 border-hx-warning/30 text-hx-warning'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs flex items-center space-x-1.5">
                        {scenarioResult.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span>Scenario &ldquo;{scenarioResult.scenarioName}&rdquo;: {scenarioResult.passed ? 'PASSED' : 'FAILED'}</span>
                      </span>
                      <span className="text-[11px] font-mono">{scenarioResult.durationMs}ms</span>
                    </div>

                    {scenarioResult.failureReason && (
                      <div className="text-xs mb-2 text-hx-warning">
                        Failure reason: {scenarioResult.failureReason}
                      </div>
                    )}

                    <div className="space-y-1 pt-2 border-t border-hx-border-panel/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-hx-text-secondary">
                        Simulated Step Trace ({scenarioResult.stepRuns.length})
                      </span>
                      {scenarioResult.stepRuns.map((sr, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-mono opacity-90">
                          <span>{sr.stepId} ({sr.toolId})</span>
                          <span>{sr.status} ({sr.durationMs}ms)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regression Suite Report */}
                {regressionReport && (
                  <div className="p-4 rounded-hx-md bg-hx-panel/50 border border-hx-border-panel space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-hx-text-primary">
                        Regression Suite Summary: {regressionReport.failedCount === 0 ? 'ALL PASSED' : 'FAILURES DETECTED'}
                      </span>
                      <span className="text-xs font-mono text-hx-cyan">
                        {regressionReport.passedCount} / {regressionReport.totalScenarios} passed
                      </span>
                    </div>
                    {regressionReport.newlyFailedScenarioIds.length > 0 && (
                      <div className="text-xs text-hx-warning">
                        Regressed scenarios: {regressionReport.newlyFailedScenarioIds.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* SUB-TAB 4: Immutable Version History & Safe Rollback */}
          {studioSubTab === 'versions' && (
            <Card variant="panel" border="subtle" padding="lg">
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center space-x-2">
                      <History className="w-4 h-4 text-hx-cyan" />
                      <span>Immutable Version History &amp; Safe Rollback</span>
                    </h3>
                    <p className="text-xs text-hx-text-secondary mt-0.5">
                      Every skill alteration generates an immutable version record sealed with a canonical SHA-256 hash. Rollbacks re-verify permissions before activation.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => builderId && handleLoadVersions(builderId)}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Refresh Versions
                  </Button>
                </div>

                {skillVersions.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-hx-border-panel rounded-hx-md">
                    <p className="text-xs text-hx-text-secondary">
                      No version history found for skill &ldquo;{builderId}&rdquo;. Save the skill in the editor to record version 1.0.0.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {skillVersions.map((v) => {
                      const isActive = v.approvalStatus === 'approved' || v.versionNumber === '1.0.0'
                      return (
                        <div
                          key={v.versionId}
                          className="p-3.5 rounded-hx-md bg-hx-space/60 border border-hx-border-panel flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-hx-text-primary font-mono">
                                v{v.versionNumber}
                              </span>
                              <span className="text-[11px] text-hx-text-secondary font-mono">
                                ({v.versionId})
                              </span>
                              <Badge variant={isActive ? 'nominal' : 'neutral'} size="sm">
                                {isActive ? 'Active' : v.approvalStatus}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-hx-text-secondary">
                              Author: {v.author} • {new Date(v.createdAt).toLocaleString()} • Hash: <span className="font-mono text-hx-cyan">{v.definitionHash.slice(0, 12)}...</span>
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRollbackVersion(v.versionId)}
                            leftIcon={<History className="w-3.5 h-3.5" />}
                          >
                            Rollback to this Version
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* SUB-TAB 5: Declarative Import & Export */}
          {studioSubTab === 'import_export' && (
            <Card variant="panel" border="subtle" padding="lg">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center space-x-2">
                    <Download className="w-4 h-4 text-hx-cyan" />
                    <span>Safe Declarative Import &amp; Export</span>
                  </h3>
                  <p className="text-xs text-hx-text-secondary mt-0.5">
                    Export scrubbed declarative skill packages with zero secret leakage, or import external workflows into quarantine draft mode.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Export Column */}
                  <div className="space-y-3 p-4 rounded-hx-md bg-hx-space/40 border border-hx-border-panel">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-hx-text-primary flex items-center space-x-1.5">
                        <Download className="w-3.5 h-3.5 text-hx-cyan" />
                        <span>Export Current Skill</span>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportPackage}
                        disabled={!builderId}
                      >
                        Generate Export Package
                      </Button>
                    </div>

                    <p className="text-[11px] text-hx-text-secondary">
                      Serializes declarative DAG, parameters, and metadata. Strictly scrubs any tokens, credentials, or private state.
                    </p>

                    <textarea
                      readOnly
                      placeholder="Exported JSON package will appear here..."
                      value={exportPackageJson || ''}
                      rows={10}
                      className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-panel text-[11px] text-hx-text-primary font-mono focus:outline-none resize-none"
                    />
                  </div>

                  {/* Import Column */}
                  <div className="space-y-3 p-4 rounded-hx-md bg-hx-space/40 border border-hx-border-panel">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-hx-text-primary flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5 text-hx-cyan" />
                        <span>Import Declarative Package</span>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handlePreviewImport}
                        disabled={!importJson.trim()}
                      >
                        Preview &amp; Inspect
                      </Button>
                    </div>

                    <p className="text-[11px] text-hx-text-secondary">
                      Paste untrusted skill JSON. The package is pre-flighted for missing dependencies and imported strictly as a quarantined draft.
                    </p>

                    <textarea
                      placeholder="Paste exported skill JSON package here..."
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-panel text-[11px] text-hx-text-primary font-mono focus:outline-none focus:border-hx-cyan resize-none"
                    />

                    {importPreview && (
                      <div className="p-3 rounded-hx-sm bg-hx-panel/60 border border-hx-border-panel space-y-2 text-xs">
                        <div className="font-semibold text-hx-text-primary">
                          Preview: {importPreview.candidateSkill?.displayName} ({importPreview.candidateSkill?.id})
                        </div>
                        {importPreview.missingDependencies.length > 0 && (
                          <div className="text-hx-warning text-[11px]">
                            Missing tool dependencies: {importPreview.missingDependencies.join(', ')}
                          </div>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleExecuteImport}
                          className="w-full"
                        >
                          Import as Quarantined Draft
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Multi-Agent Collaboration Hub (Step 41) */}
      {activeTab === 'collaboration' && (
        <div className="flex flex-col space-y-6">
          {/* Header & Controls */}
          <Card className="p-5 border-hx-border-panel bg-hx-panel/50">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-5 h-5 text-hx-cyan" />
                  <h3 className="text-sm font-display font-semibold text-hx-text-primary">
                    Multi-Agent Delegation &amp; Coordinated Execution Hub
                  </h3>
                </div>
                <p className="text-xs text-hx-text-secondary mt-1">
                  Bounded parent-child task delegation across specialized agents with DAG dependency resolution,
                  privilege inheritance, concurrency budgeting, and honest disagreement preservation.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
                >
                  Refresh
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDispatchSampleCollaboration}
                  disabled={isCoordinating}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  {isCoordinating ? 'Coordinating...' : 'Dispatch Sample Collaboration'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Main 2-Column Coordination View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Coordinated Parent Tasks List */}
            <div className="lg:col-span-4 flex flex-col space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-hx-text-secondary uppercase tracking-wider">
                  Coordinated Tasks ({coordinatedTasks.length})
                </span>
              </div>

              {coordinatedTasks.length === 0 ? (
                <Card className="p-6 text-center border-hx-border-panel bg-hx-panel/30">
                  <Layers className="w-8 h-8 text-hx-text-secondary mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-hx-text-secondary">
                    No multi-agent coordination workflows dispatched yet.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 mx-auto"
                    onClick={handleDispatchSampleCollaboration}
                    disabled={isCoordinating}
                  >
                    Dispatch First Workflow
                  </Button>
                </Card>
              ) : (
                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {coordinatedTasks.map((task) => {
                    const isSelected = selectedTaskId === task.parentTaskId
                    const completed = task.aggregateProgress.completed
                    const total = task.aggregateProgress.total
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                    return (
                      <div
                        key={task.parentTaskId}
                        onClick={() => setSelectedTaskId(task.parentTaskId)}
                        className={`p-3.5 rounded-hx-md border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-hx-cyan bg-hx-cyan/10'
                            : 'border-hx-border-panel bg-hx-panel/40 hover:bg-hx-panel/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-hx-text-primary line-clamp-1 font-mono">
                            {task.parentTaskId}
                          </span>
                          <Badge
                            variant={getCoordinationBadgeVariant(task.status)}
                            size="sm"
                          >
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <p className="text-xs text-hx-text-secondary line-clamp-2 mb-2">
                          {task.userIntent}
                        </p>

                        {/* Progress Bar */}
                        <div className="w-full bg-hx-bg-subtle rounded-full h-1.5 mb-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              task.status === 'completed'
                                ? 'bg-hx-cyan'
                                : task.status === 'partially_completed'
                                ? 'bg-hx-warning'
                                : task.status === 'failed'
                                ? 'bg-hx-error'
                                : 'bg-hx-info'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-hx-text-secondary">
                          <span>
                            {completed}/{total} subtasks done
                          </span>
                          <span>{new Date(task.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Coordinated Task Inspector */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              {selectedTask ? (
                <Card className="p-5 border-hx-border-panel bg-hx-panel/50 space-y-5">
                  {/* Task Header */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-4 border-b border-hx-border-panel">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-hx-cyan font-bold">
                          {selectedTask.parentTaskId}
                        </span>
                        <Badge
                          variant={getCoordinationBadgeVariant(selectedTask.status)}
                          size="sm"
                        >
                          {selectedTask.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-semibold text-hx-text-primary mt-1">
                        {selectedTask.userIntent}
                      </h4>
                    </div>

                    {['running', 'scheduled'].includes(selectedTask.status) && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancelCoordinatedTask(selectedTask.parentTaskId)}
                        leftIcon={<StopCircle className="w-4 h-4" />}
                      >
                        Cancel Workflow
                      </Button>
                    )}
                  </div>

                  {/* Resource Budget & Authorized Scope Badges */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-hx-xs bg-hx-bg-subtle text-hx-text-secondary border border-hx-border-panel">
                      Concurrency: {selectedTask.budget.maxConcurrency}
                    </span>
                    <span className="px-2 py-0.5 rounded-hx-xs bg-hx-bg-subtle text-hx-text-secondary border border-hx-border-panel">
                      Max Depth: {selectedTask.budget.maxDelegationDepth}
                    </span>
                    <span className="px-2 py-0.5 rounded-hx-xs bg-hx-bg-subtle text-hx-text-secondary border border-hx-border-panel">
                      Timeout: {selectedTask.budget.maxExecutionTimeMs}ms
                    </span>
                    <span className="px-2 py-0.5 rounded-hx-xs bg-hx-bg-subtle text-hx-text-secondary border border-hx-border-panel">
                      Scope: {selectedTask.authorizedScope.join(', ') || 'none'}
                    </span>
                  </div>

                  {/* Conflict Detection Banner */}
                  {selectedTask.finalResult?.conflicts &&
                    selectedTask.finalResult.conflicts.length > 0 && (
                      <div className="p-3.5 rounded-hx-md bg-hx-warning/10 border border-hx-warning/30 text-hx-warning text-xs space-y-1.5">
                        <div className="flex items-center space-x-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Conflicting Output Claims Detected</span>
                        </div>
                        <p className="text-[11px] opacity-90">
                          Disagreements across delegated agents were preserved truthfully without fabricating consensus.
                        </p>
                        <div className="space-y-1 mt-2">
                          {selectedTask.finalResult.conflicts.map((conf, idx) => (
                            <div key={idx} className="p-2 rounded bg-hx-warning/10 font-mono text-[10px]">
                              <div>Topic: {conf.fieldOrTopic}</div>
                              <div>
                                {conf.agentA.agentId}: {String(conf.agentA.claim)} vs {conf.agentB.agentId}: {String(conf.agentB.claim)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Limitations Banner */}
                  {selectedTask.finalResult?.limitations &&
                    selectedTask.finalResult.limitations.length > 0 && (
                      <div className="p-3 rounded-hx-sm bg-hx-bg-subtle border border-hx-border-panel text-hx-text-secondary text-xs space-y-1">
                        <span className="font-semibold text-hx-text-primary">Execution Limitations:</span>
                        <ul className="list-disc list-inside text-[11px] space-y-0.5">
                          {selectedTask.finalResult.limitations.map((lim, i) => (
                            <li key={i}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Child Task Hierarchy & DAG Execution */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-hx-text-secondary uppercase tracking-wider">
                        Child Delegation Graph ({selectedTask.childTaskIds.length} tasks)
                      </span>
                      <span className="text-xs text-hx-text-secondary">
                        Topological DAG Order
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedTask.childTaskIds.map((cid, idx) => {
                        const child: ChildTaskRecord | undefined = selectedTask.childTasks[cid]
                        if (!child) return null

                        return (
                          <div
                            key={cid}
                            className="p-3 rounded-hx-md border border-hx-border-panel bg-hx-panel/30 text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-hx-bg-subtle border border-hx-border-panel flex items-center justify-center font-mono text-[10px] text-hx-text-secondary">
                                  {idx + 1}
                                </span>
                                <span className="font-mono font-semibold text-hx-text-primary">
                                  {child.childTaskId}
                                </span>
                                <Badge variant="info" size="sm">
                                  {child.assignedAgentId}
                                </Badge>
                                <span className="text-[10px] text-hx-text-secondary">
                                  Depth {child.delegationDepth}
                                </span>
                              </div>

                              <Badge
                                variant={getCoordinationBadgeVariant(child.status)}
                                size="sm"
                              >
                                {child.status}
                              </Badge>
                            </div>

                            <p className="text-xs text-hx-text-primary">{child.objective}</p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-hx-text-secondary">
                              <span>
                                Dependencies:{' '}
                                {child.dependencies.length > 0
                                  ? child.dependencies.join(', ')
                                  : 'None (Root)'}
                              </span>
                              {child.durationMs !== undefined && (
                                <span>Duration: {child.durationMs}ms</span>
                              )}
                              {child.retryCount > 0 && (
                                <span>Retries: {child.retryCount}</span>
                              )}
                            </div>

                            {child.error && (
                              <div className="p-2 rounded bg-hx-error/10 border border-hx-error/30 text-hx-error text-[11px] font-mono">
                                Error: {child.error}
                              </div>
                            )}

                            {child.output !== undefined && child.output !== null && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-[11px] text-hx-cyan hover:underline">
                                  View Output Envelope
                                </summary>
                                <pre className="p-2 mt-1 rounded bg-hx-bg-subtle text-[10px] font-mono text-hx-text-secondary overflow-x-auto max-h-36">
                                  {JSON.stringify(child.output, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Aggregated Final Outcome */}
                  {selectedTask.finalResult && (
                    <div className="p-4 rounded-hx-md bg-hx-cyan/5 border border-hx-cyan/20 text-xs space-y-2">
                      <div className="flex items-center space-x-1.5 font-semibold text-hx-cyan">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aggregated Coordinated Result</span>
                      </div>
                      <p className="text-hx-text-primary text-xs">
                        {selectedTask.finalResult.summary}
                      </p>
                      {Object.keys(selectedTask.finalResult.aggregatedOutput).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-hx-cyan hover:underline">
                            Aggregated Outputs Payload
                          </summary>
                          <pre className="p-2 mt-1 rounded bg-hx-bg-subtle text-[10px] font-mono text-hx-text-secondary overflow-x-auto max-h-48">
                            {JSON.stringify(selectedTask.finalResult.aggregatedOutput, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-10 text-center border-hx-border-panel bg-hx-panel/30">
                  <GitMerge className="w-10 h-10 text-hx-text-secondary mx-auto mb-3 opacity-30" />
                  <h4 className="text-sm font-semibold text-hx-text-primary">
                    No Task Selected
                  </h4>
                  <p className="text-xs text-hx-text-secondary mt-1 max-w-sm mx-auto">
                    Select a coordinated workflow from the list on the left to inspect its DAG execution,
                    agent assignments, and aggregated outputs.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
