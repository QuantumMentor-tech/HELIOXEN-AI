/**
 * HELIOXEN AI — Step 42 Test Suite: Dynamic Skill Studio Validation & Testing
 * Tests the deterministic 7-stage validation pipeline, immutable version records,
 * canonical SHA-256 hashing, safe rollback with capability re-validation,
 * and test workbench scenario/regression suite execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { DynamicSkillsManager } from '../../src/main/agents/DynamicSkillsManager'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { TaskExecutionEngine, ToolDispatcher } from '../../src/shared/orchestration'
import { authorizer } from '../../src/main/security'
import {
  computeSkillDefinitionHash,
  validateSkillStaged,
  compareSkillDefinitions
} from '../../src/shared/agents/skillStudioContracts'
import { DynamicSkillDefinition } from '../../src/shared/agents/types'

describe('Step 42 — Dynamic Skill Studio: 7-Stage Validation & Testing', () => {
  let tempDir: string
  let toolRegistry: ToolRegistry
  let toolDispatcher: ToolDispatcher
  let executionEngine: TaskExecutionEngine
  let skillsManager: DynamicSkillsManager

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-skill-studio-test-'))
    toolRegistry = new ToolRegistry()
    toolDispatcher = new ToolDispatcher()
    executionEngine = new TaskExecutionEngine(toolRegistry, toolDispatcher, authorizer)

    // Register approved baseline tools
    toolRegistry.register({
      id: 'system:get_time',
      displayName: 'Get Time',
      description: 'Gets current epoch time',
      category: 'system' as const,
      version: '1.0.0',
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({ epochMs: z.number() }),
      jsonSchema: { type: 'object' },
      requiredCapabilities: [],
      riskTier: 'low' as const,
      confirmationPolicy: 'none' as const,
      implementationStatus: 'available' as const,
      registrationStatus: 'enabled' as const,
      executionMode: 'asynchronous' as const,
      limits: { timeoutMs: 5000, maxPayloadSizeBytes: 1024 },
      retryPolicy: { isIdempotent: true },
      source: 'builtin' as const,
      tags: []
    })

    toolRegistry.register({
      id: 'widgets:get_system_health',
      displayName: 'Get System Health',
      description: 'Reads telemetry metrics',
      category: 'system' as const,
      version: '1.0.0',
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({ cpuUsage: z.number() }),
      jsonSchema: { type: 'object' },
      requiredCapabilities: [],
      riskTier: 'low' as const,
      confirmationPolicy: 'none' as const,
      implementationStatus: 'available' as const,
      registrationStatus: 'enabled' as const,
      executionMode: 'asynchronous' as const,
      limits: { timeoutMs: 5000, maxPayloadSizeBytes: 1024 },
      retryPolicy: { isIdempotent: true },
      source: 'builtin' as const,
      tags: []
    })

    toolRegistry.register({
      id: 'filesystem:write_file',
      displayName: 'Write File',
      description: 'Writes to local disk',
      category: 'system' as const,
      version: '1.0.0',
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      outputSchema: z.object({ success: z.boolean() }),
      jsonSchema: { type: 'object' },
      requiredCapabilities: ['filesystem:write'],
      riskTier: 'high' as const,
      confirmationPolicy: 'always' as const,
      implementationStatus: 'available' as const,
      registrationStatus: 'enabled' as const,
      executionMode: 'asynchronous' as const,
      limits: { timeoutMs: 10000, maxPayloadSizeBytes: 1024 * 1024 },
      retryPolicy: { isIdempotent: false },
      source: 'builtin' as const,
      tags: []
    })

    toolDispatcher.registerHandler('system:get_time', async () => ({
      epochMs: 1700000000000
    }))
    toolDispatcher.registerHandler('widgets:get_system_health', async () => ({
      cpuUsage: 18.5
    }))
    toolDispatcher.registerHandler('filesystem:write_file', async (args: any) => ({
      success: true,
      writtenPath: args.path
    }))

    skillsManager = new DynamicSkillsManager({
      storageDir: tempDir,
      toolRegistry,
      executionEngine
    })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // --------------------------------------------------------------------------
  // 1. DETERMINISTIC 7-STAGE VALIDATION PIPELINE
  // --------------------------------------------------------------------------
  describe('7-Stage Validation Pipeline', () => {
    it('passes completely for valid DAG with approved tools and safe bindings', () => {
      const validSkill: DynamicSkillDefinition = {
        id: 'skill_daily_briefing',
        displayName: 'Daily Briefing',
        description: 'Collects time and system health',
        category: 'productivity',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Query Time',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          },
          {
            stepId: 'step_2',
            displayName: 'Query System Health',
            toolId: 'widgets:get_system_health',
            inputBindings: {
              timestamp: { type: 'step_output', sourceStepId: 'step_1', fieldPath: 'epochMs' }
            },
            dependsOnStepIds: ['step_1']
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 1, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      const report = validateSkillStaged(validSkill, toolRegistry)
      expect(report.valid).toBe(true)
      expect(report.overallStatus).toBe('passed')
      expect(report.stageResults.structural.passed).toBe(true)
      expect(report.stageResults.registry_resolution.passed).toBe(true)
      expect(report.stageResults.data_flow.passed).toBe(true)
      expect(report.stageResults.dependency_graph.passed).toBe(true)
      expect(report.stageResults.authorization_risk.passed).toBe(true)
      expect(report.stageResults.resource_limits.passed).toBe(true)
      expect(report.derivedRiskTier).toBe('low')
      expect(report.stepOrder).toEqual(['step_1', 'step_2'])
    })

    it('rejects unresolvable tool in Stage 2 (registry_resolution)', () => {
      const invalidSkill: DynamicSkillDefinition = {
        id: 'skill_bad_tool',
        displayName: 'Bad Tool Skill',
        description: 'Refers to unknown tool',
        category: 'general',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Call Fake Tool',
            toolId: 'unregistered:fake_tool',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      const report = validateSkillStaged(invalidSkill, toolRegistry)
      expect(report.valid).toBe(false)
      expect(report.overallStatus).toBe('failed')
      expect(report.stageResults.registry_resolution.passed).toBe(false)
      const err = report.issues.find((i) => i.stage === 'registry_resolution')
      expect(err).toBeDefined()
      expect(err?.message).toContain('unregistered:fake_tool')
    })

    it('rejects forward references in Stage 3 (data_flow)', () => {
      const forwardRefSkill: DynamicSkillDefinition = {
        id: 'skill_forward_ref',
        displayName: 'Forward Ref Skill',
        description: 'Binds to future step output',
        category: 'general',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'First Step',
            toolId: 'system:get_time',
            inputBindings: {
              data: { type: 'step_output', sourceStepId: 'step_2', fieldPath: 'cpuUsage' }
            },
            dependsOnStepIds: []
          },
          {
            stepId: 'step_2',
            displayName: 'Second Step',
            toolId: 'widgets:get_system_health',
            inputBindings: {},
            dependsOnStepIds: ['step_1']
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      const report = validateSkillStaged(forwardRefSkill, toolRegistry)
      expect(report.valid).toBe(false)
      expect(report.stageResults.data_flow.passed).toBe(false)
      const dataFlowIssue = report.issues.find((i) => i.stage === 'data_flow')
      expect(dataFlowIssue).toBeDefined()
      expect(dataFlowIssue?.message).toContain('Forward reference')
    })

    it('detects cyclic dependencies in Stage 4 (dependency_graph)', () => {
      const cyclicSkill: DynamicSkillDefinition = {
        id: 'skill_cyclic',
        displayName: 'Cyclic Skill',
        description: 'Steps depend on each other cyclically',
        category: 'general',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_a',
            displayName: 'Step A',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: ['step_b']
          },
          {
            stepId: 'step_b',
            displayName: 'Step B',
            toolId: 'widgets:get_system_health',
            inputBindings: {},
            dependsOnStepIds: ['step_a']
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      const report = validateSkillStaged(cyclicSkill, toolRegistry)
      expect(report.valid).toBe(false)
      expect(report.stageResults.dependency_graph.passed).toBe(false)
      const cycleIssue = report.issues.find((i) => i.stage === 'dependency_graph')
      expect(cycleIssue).toBeDefined()
      expect(cycleIssue?.message).toContain('Cyclic')
    })

    it('correctly maps authorization and risk tier in Stage 5 (authorization_risk)', () => {
      const highRiskSkill: DynamicSkillDefinition = {
        id: 'skill_write',
        displayName: 'File Write Skill',
        description: 'Uses high risk filesystem write',
        category: 'system',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Write Config',
            toolId: 'filesystem:write_file',
            inputBindings: {
              path: { type: 'literal', literalValue: '/tmp/test.txt' },
              content: { type: 'literal', literalValue: 'hello' }
            },
            dependsOnStepIds: []
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      const report = validateSkillStaged(highRiskSkill, toolRegistry)
      expect(report.valid).toBe(true)
      expect(report.derivedRiskTier).toBe('high')
      expect(report.derivedCapabilities).toContain('filesystem:write')
      expect(report.requiresHumanConsent).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // 2. IMMUTABLE VERSIONING, HASHING, AND SAFE ROLLBACK
  // --------------------------------------------------------------------------
  describe('Immutable Versioning & Safe Rollback', () => {
    it('computes deterministic canonical SHA-256 definition hash', () => {
      const def1: DynamicSkillDefinition = {
        id: 'skill_hash_test',
        displayName: 'Hash Test',
        description: 'Testing canonical hash',
        category: 'productivity',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Step 1',
            toolId: 'system:get_time',
            inputBindings: { b: { type: 'literal', literalValue: 2 }, a: { type: 'literal', literalValue: 1 } },
            dependsOnStepIds: []
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      // Exact same contents but inverted input bindings key order
      const def2: DynamicSkillDefinition = {
        ...def1,
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Step 1',
            toolId: 'system:get_time',
            inputBindings: { a: { type: 'literal', literalValue: 1 }, b: { type: 'literal', literalValue: 2 } },
            dependsOnStepIds: []
          }
        ]
      }

      const hash1 = computeSkillDefinitionHash(def1)
      const hash2 = computeSkillDefinitionHash(def2)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // valid sha-256 hex
    })

    it('creates version records and compares diffs accurately', async () => {
      const v1Def: DynamicSkillDefinition = {
        id: 'skill_evolution',
        displayName: 'Skill Evolution v1',
        description: 'Baseline version',
        category: 'productivity',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Step 1',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      skillsManager.createSkillDraft(v1Def)
      const v1Record = await skillsManager.createSkillVersion(v1Def.id, 'Initial revision')
      expect(v1Record.versionNumber).toBe('1.0.0')

      // Create v2 definition with an added step
      const v2Def: DynamicSkillDefinition = {
        ...v1Def,
        version: '1.1.0',
        steps: [
          ...v1Def.steps,
          {
            stepId: 'step_2',
            displayName: 'Step 2 Health',
            toolId: 'widgets:get_system_health',
            inputBindings: {},
            dependsOnStepIds: ['step_1']
          }
        ]
      }
      await skillsManager.updateSkill(v2Def.id, v2Def)
      const v2Record = await skillsManager.createSkillVersion(v2Def.id, 'Added health check step')
      expect(v2Record.versionNumber).toBe('1.1.0')

      // Compare versions
      const diff = compareSkillDefinitions(v1Def, v2Def)
      expect(diff.isIdentical).toBe(false)
      expect(diff.stepsAdded).toContain('step_2')
      expect(diff.stepsRemoved).toHaveLength(0)

      // Test safe rollback
      const rolledBack = await skillsManager.rollbackSkillVersion(v1Def.id, v1Record.versionId)
      expect(rolledBack.steps).toHaveLength(1)
      expect(rolledBack.steps[0].stepId).toBe('step_1')
    })
  })

  // --------------------------------------------------------------------------
  // 3. TEST WORKBENCH & REGRESSION SUITE
  // --------------------------------------------------------------------------
  describe('Test Workbench & Regression Engine', () => {
    it('creates test scenario, executes it with mock outputs, and evaluates assertions', async () => {
      const skillDef: DynamicSkillDefinition = {
        id: 'skill_tested',
        displayName: 'Tested Skill',
        description: 'Skill under synthetic test',
        category: 'productivity',
        version: '1.0.0',
        author: 'User',
        status: 'draft',
        steps: [
          {
            stepId: 'step_time',
            displayName: 'Get Epoch',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      skillsManager.createSkillDraft(skillDef)

      const scenario = await skillsManager.createTestScenario(skillDef.id, {
        scenarioId: 'scen_baseline',
        skillId: skillDef.id,
        name: 'Baseline Scenario',
        description: 'Tests time execution',
        inputParameters: {},
        mockToolOutputs: {
          'system:get_time': { epochMs: 1700000099999 }
        },
        expectedStatus: 'completed'
      })

      expect(scenario.scenarioId).toBe('scen_baseline')

      // Run scenario
      const result = await skillsManager.runTestScenario(skillDef.id, 'scen_baseline')
      expect(result.passed).toBe(true)
      expect(result.actualStatus).toBe('completed')
      expect(result.stepRuns).toHaveLength(1)
      expect(result.stepRuns[0].mockOutput).toEqual({ epochMs: 1700000099999 })

      // Run regression suite
      const regressionReport = await skillsManager.runRegressionTests(skillDef.id)
      expect(regressionReport.totalScenarios).toBe(1)
      expect(regressionReport.passedCount).toBe(1)
      expect(regressionReport.failedCount).toBe(0)
      expect(regressionReport.hasRegressions).toBe(false)
    })
  })
})
