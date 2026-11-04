/**
 * HELIOXEN AI — Step 40 Test Suite: Dynamic Skills Framework & Security Validation
 * Tests DAG cycle detection, binding validation, permission derivation,
 * dry-run simulation, approval invalidation on edit, and authoritative execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { DynamicSkillsManager } from '../../src/main/agents/DynamicSkillsManager'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import {
  TaskExecutionEngine,
  ToolDispatcher
} from '../../src/shared/orchestration'
import { authorizer } from '../../src/main/security'
import {
  validateSkillWorkflowGraph,
  resolveSkillDataBinding
} from '../../src/shared/agents/contracts'

describe('Step 40 — Dynamic Skills Framework & Security', () => {
  let tempDir: string
  let toolRegistry: ToolRegistry
  let toolDispatcher: ToolDispatcher
  let executionEngine: TaskExecutionEngine
  let mockTime: number

  beforeEach(() => {
    mockTime = 1700000000000
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-skill-test-'))
    toolRegistry = new ToolRegistry()
    toolDispatcher = new ToolDispatcher()
    executionEngine = new TaskExecutionEngine(toolRegistry, toolDispatcher, authorizer)

    // Register a mock tool in toolRegistry & dispatcher
    const timeTool = {
      id: 'system:get_time',
      displayName: 'Get Time',
      description: 'Gets current epoch time',
      category: 'system' as const,
      version: '1.0.0',
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({}).passthrough(),
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
    }
    toolRegistry.register(timeTool)
    toolDispatcher.registerHandler('system:get_time', async () => ({
      epochMs: 1700000005000,
      iso: '2023-11-14T22:13:25.000Z'
    }))

    // Register high-risk tool
    const writeTool = {
      id: 'filesystem:create_file',
      displayName: 'Create File',
      description: 'Creates a file',
      category: 'system' as const,
      version: '1.0.0',
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({}).passthrough(),
      jsonSchema: { type: 'object' },
      requiredCapabilities: ['filesystem:write'],
      riskTier: 'high' as const,
      confirmationPolicy: 'none' as const,
      implementationStatus: 'available' as const,
      registrationStatus: 'enabled' as const,
      executionMode: 'asynchronous' as const,
      limits: { timeoutMs: 5000, maxPayloadSizeBytes: 1024 },
      retryPolicy: { isIdempotent: false },
      source: 'builtin' as const,
      tags: []
    }
    toolRegistry.register(writeTool)
    toolDispatcher.registerHandler('filesystem:create_file', async (args: any) => ({
      success: true,
      path: args.path
    }))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  })

  describe('DAG Validation & Cycle Detection', () => {
    it('detects and rejects dependency cycles in workflow graphs', () => {
      const registeredToolIds = new Set(['system:get_time', 'filesystem:create_file'])

      // Cyclic graph: step_a -> step_b -> step_a
      const cyclicSkill = {
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
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: ['step_a']
          }
        ]
      }

      const check = validateSkillWorkflowGraph(cyclicSkill, registeredToolIds)
      expect(check.valid).toBe(false)
      expect(check.errors.some((e) => e.includes('Cyclic dependency detected'))).toBe(true)
    })

    it('rejects references to unregistered tools', () => {
      const registeredToolIds = new Set(['system:get_time'])

      const invalidSkill = {
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Call Unknown Tool',
            toolId: 'unknown:magic_tool',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ]
      }

      const check = validateSkillWorkflowGraph(invalidSkill, registeredToolIds)
      expect(check.valid).toBe(false)
      expect(check.errors.some((e) => e.includes('unregistered or disabled tool'))).toBe(true)
    })

    it('rejects data bindings that reference forward steps not yet executed', () => {
      const registeredToolIds = new Set(['system:get_time'])

      const forwardRefSkill = {
        steps: [
          {
            stepId: 'step_1',
            displayName: 'First Step',
            toolId: 'system:get_time',
            inputBindings: {
              // Illegal: references step_2 which executes after step_1
              futureValue: {
                type: 'step_output' as const,
                sourceStepId: 'step_2',
                fieldPath: 'data'
              }
            },
            dependsOnStepIds: []
          },
          {
            stepId: 'step_2',
            displayName: 'Second Step',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: ['step_1']
          }
        ]
      }

      const check = validateSkillWorkflowGraph(forwardRefSkill, registeredToolIds)
      expect(check.valid).toBe(false)
      expect(check.errors.some((e) => e.includes('does not declare it in dependsOnStepIds'))).toBe(true)
    })
  })

  describe('Security & Arbitrary Code Prohibition', () => {
    it('strictly prohibits arbitrary code or script tokens in data bindings', () => {
      const registeredToolIds = new Set(['system:get_time'])

      const maliciousSkill = {
        steps: [
          {
            stepId: 'step_inject',
            displayName: 'Script Injection Attempt',
            toolId: 'system:get_time',
            inputBindings: {
              param: {
                type: 'literal' as const,
                literalValue: 'eval("require(\'fs\').unlinkSync(\'/\')")'
              }
            },
            dependsOnStepIds: []
          }
        ]
      }

      const check = validateSkillWorkflowGraph(maliciousSkill, registeredToolIds)
      expect(check.valid).toBe(false)
      expect(check.errors.some((e) => e.includes('prohibited script primitives'))).toBe(true)
    })

    it('derives capabilities and highest risk tier from referenced tools instead of self-declaration', () => {
      const manager = new DynamicSkillsManager({
        storageDir: tempDir,
        toolRegistry,
        executionEngine,
        nowFn: () => mockTime
      })

      // Skill references both low risk (system:get_time) and high risk (filesystem:create_file)
      const skillDraft = manager.createSkillDraft({
        id: 'multi_tier_skill',
        displayName: 'Multi Tier Skill',
        description: 'Demonstrates risk tier derivation from tools',
        category: 'productivity',
        steps: [
          {
            stepId: 's1',
            displayName: 'Get Time',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          },
          {
            stepId: 's2',
            displayName: 'Create File',
            toolId: 'filesystem:create_file',
            inputBindings: {
              path: { type: 'literal', literalValue: '/tmp/test.txt' }
            },
            dependsOnStepIds: ['s1']
          }
        ]
      })

      // Verified: Risk tier escalated to high because filesystem:create_file is high
      expect(skillDraft.derivedRiskTier).toBe('high')
      expect(skillDraft.derivedCapabilities).toContain('filesystem:write')
    })

    it('invalidates approval status back to validated or draft whenever a skill is edited', () => {
      const manager = new DynamicSkillsManager({
        storageDir: tempDir,
        toolRegistry,
        executionEngine,
        nowFn: () => mockTime
      })

      const skill = manager.createSkillDraft({
        id: 'editable_skill',
        displayName: 'Editable Skill',
        description: 'Test approval invalidation on modification',
        category: 'productivity',
        steps: [
          {
            stepId: 's1',
            displayName: 'Step 1',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ]
      })

      // Enable the skill
      const enabled = manager.enableSkill('editable_skill')
      expect(enabled.status).toBe('enabled')

      // Now edit the skill
      const updated = manager.updateSkill('editable_skill', {
        displayName: 'Modified Editable Skill'
      })

      // Verified: Status was revoked from enabled to validated, requiring review
      expect(updated.status).toBe('validated')
    })
  })

  describe('Dry-Run Simulation Mode', () => {
    it('simulates workflow execution without invoking live tool handlers', async () => {
      const manager = new DynamicSkillsManager({
        storageDir: tempDir,
        toolRegistry,
        executionEngine,
        nowFn: () => mockTime
      })

      manager.createSkillDraft({
        id: 'dryrun_candidate',
        displayName: 'Dry Run Candidate',
        description: 'Dry run testing',
        category: 'productivity',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Step One',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          },
          {
            stepId: 'step_2',
            displayName: 'Step Two',
            toolId: 'system:get_time',
            inputBindings: {
              previousTime: {
                type: 'step_output',
                sourceStepId: 'step_1',
                fieldPath: 'mockResult'
              }
            },
            dependsOnStepIds: ['step_1']
          }
        ]
      })

      const dryRun = await manager.dryRunSkill('dryrun_candidate')
      expect(dryRun.valid).toBe(true)
      expect(dryRun.simulatedSteps.length).toBe(2)
      expect(dryRun.simulatedSteps[0].mockOutput).toBeDefined()
      expect(dryRun.simulatedSteps[1].resolvedInputs.previousTime).toBe(
        "Simulated dry-run output for tool 'system:get_time'"
      )
    })
  })

  describe('Execution via TaskExecutionEngine', () => {
    it('executes enabled skill through authoritative engine and produces results', async () => {
      const manager = new DynamicSkillsManager({
        storageDir: tempDir,
        toolRegistry,
        executionEngine,
        nowFn: () => mockTime
      })

      manager.createSkillDraft({
        id: 'live_exec_skill',
        displayName: 'Live Executable Skill',
        description: 'Executes through engine',
        category: 'productivity',
        steps: [
          {
            stepId: 'time_step',
            displayName: 'Read Time',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ]
      })

      // Must be enabled to execute
      manager.enableSkill('live_exec_skill')

      const result = await manager.executeSkill('live_exec_skill')
      expect(result.status).toBe('completed')
      expect(result.completedStepCount).toBe(1)
      expect(result.output).toBeDefined()
    })

    it('rejects execution when skill is disabled or in draft status', async () => {
      const manager = new DynamicSkillsManager({
        storageDir: tempDir,
        toolRegistry,
        executionEngine,
        nowFn: () => mockTime
      })

      manager.createSkillDraft({
        id: 'disabled_skill',
        displayName: 'Disabled Skill',
        description: 'Draft skill',
        category: 'productivity',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Time',
            toolId: 'system:get_time',
            inputBindings: {},
            dependsOnStepIds: []
          }
        ]
      })

      await expect(manager.executeSkill('disabled_skill')).rejects.toThrow(/EXECUTION_DENIED/)
    })
  })
})
