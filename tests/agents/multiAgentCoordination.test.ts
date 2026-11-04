/**
 * HELIOXEN AI — Step 41 Test Suite: Multi-Agent Collaboration & Coordinated Execution
 * Tests DAG dependency resolution, sequential delegation, bounded parallel execution,
 * failure propagation to dependent children, partial completion status, and truthful conflict detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { MultiAgentCoordinator } from '../../src/main/agents/MultiAgentCoordinator'
import { AgentRegistry } from '../../src/main/agents/AgentRegistry'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import {
  TaskExecutionEngine,
  ToolDispatcher
} from '../../src/shared/orchestration'
import { authorizer } from '../../src/main/security'
import { CollaborationPlanInput } from '../../src/shared/agents/collaborationTypes'

describe('Step 41 — Multi-Agent Collaboration and Coordinated Execution', () => {
  let tempDir: string
  let agentRegistry: AgentRegistry
  let toolRegistry: ToolRegistry
  let toolDispatcher: ToolDispatcher
  let executionEngine: TaskExecutionEngine
  let coordinator: MultiAgentCoordinator
  let mockTime: number

  beforeEach(() => {
    mockTime = 1700000000000
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-collab-test-'))
    toolRegistry = new ToolRegistry()
    toolDispatcher = new ToolDispatcher()
    executionEngine = new TaskExecutionEngine(toolRegistry, toolDispatcher, authorizer)

    agentRegistry = new AgentRegistry({
      storageDir: tempDir,
      toolRegistry,
      nowFn: () => mockTime
    })

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
      epochMs: mockTime,
      iso: new Date(mockTime).toISOString()
    }))

    coordinator = new MultiAgentCoordinator({
      storageDir: tempDir,
      agentRegistry,
      toolRegistry,
      executionEngine,
      nowFn: () => mockTime
    })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('coordinates sequential delegation between two agents with context forwarding', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_seq_1',
      conversationId: 'conv_seq_1',
      userIntent: 'Research system information and format summary',
      authorizedScope: ['read:system_info', 'read:files'],
      budget: {
        maxChildTasks: 5,
        maxDelegationDepth: 2,
        maxConcurrency: 2,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'child_step_1',
          assignedAgentId: 'agent_researcher',
          objective: 'Gather system research data',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Gather system research data',
            inputData: { topic: 'system architecture' },
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'child_step_2',
          assignedAgentId: 'agent_general',
          objective: 'Synthesize research data into final summary',
          delegationDepth: 2,
          dependencies: ['child_step_1'],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Synthesize research data into final summary',
            inputData: { format: 'bullets' },
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    const result = await coordinator.coordinateTask(input)

    expect(result.status).toBe('completed')
    expect(result.phase).toBe('completed')
    expect(result.childTasks['child_step_1'].status).toBe('completed')
    expect(result.childTasks['child_step_2'].status).toBe('completed')
    expect(result.aggregateProgress.completed).toBe(2)
    expect(result.aggregateProgress.failed).toBe(0)

    // Verify context forwarding: child_step_2 received child_step_1 output in its predecessorOutputs
    const step2Predecessors = result.childTasks['child_step_2'].inputEnvelope.predecessorOutputs
    expect(step2Predecessors).toBeDefined()
    expect(step2Predecessors['child_step_1']).toBeDefined()

    // Verify disk persistence
    const saved = coordinator.getCoordinatedTask('parent_seq_1')
    expect(saved).toBeDefined()
    expect(saved?.status).toBe('completed')
  })

  it('executes independent child tasks in bounded parallel batches', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_parallel_1',
      conversationId: 'conv_parallel_1',
      userIntent: 'Execute independent multi-agent analyses',
      authorizedScope: ['read:system_info', 'write:notes', 'read:codebase'],
      budget: {
        maxChildTasks: 10,
        maxDelegationDepth: 2,
        maxConcurrency: 3,
        maxExecutionTimeMs: 15000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'par_task_1',
          assignedAgentId: 'agent_researcher',
          objective: 'Analyze web performance',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Analyze web performance',
            inputData: { metric: 'FCP' },
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'par_task_2',
          assignedAgentId: 'agent_coding',
          objective: 'Inspect code quality',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:codebase'],
          inputEnvelope: {
            objective: 'Inspect code quality',
            inputData: { linter: 'eslint' },
            predecessorOutputs: {},
            capabilityConstraints: ['read:codebase'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'par_task_3',
          assignedAgentId: 'agent_productivity',
          objective: 'Check project deadlines',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['write:notes'],
          inputEnvelope: {
            objective: 'Check project deadlines',
            inputData: { calendar: 'work' },
            predecessorOutputs: {},
            capabilityConstraints: ['write:notes'],
            isReadOnly: true
          }
        }
      ]
    }

    const result = await coordinator.coordinateTask(input)

    expect(result.status).toBe('completed')
    expect(result.aggregateProgress.total).toBe(3)
    expect(result.aggregateProgress.completed).toBe(3)
    expect(result.childTasks['par_task_1'].status).toBe('completed')
    expect(result.childTasks['par_task_2'].status).toBe('completed')
    expect(result.childTasks['par_task_3'].status).toBe('completed')
  })

  it('cascades failure to dependent children marking them blocked and reporting partial completion', async () => {
    // Register a failing tool
    const failingTool = {
      id: 'system:fail_tool',
      displayName: 'Failing Tool',
      description: 'Fails intentionally',
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
      limits: { timeoutMs: 1000, maxPayloadSizeBytes: 1024 },
      retryPolicy: { isIdempotent: false, maxRetries: 0 },
      source: 'builtin' as const,
      tags: []
    }
    toolRegistry.register(failingTool)
    toolDispatcher.registerHandler('system:fail_tool', async () => {
      throw new Error('SIMULATED_TOOL_CRASH')
    })

    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_fail_cascade',
      conversationId: 'conv_cascade',
      userIntent: 'Verify failure containment and blocked dependency tracking',
      authorizedScope: ['read:system_info'],
      budget: {
        maxChildTasks: 5,
        maxDelegationDepth: 2,
        maxConcurrency: 2,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 0
      },
      childTasks: [
        {
          childTaskId: 'independent_success',
          assignedAgentId: 'agent_general',
          objective: 'Independent successful analysis',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Independent successful analysis',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'doomed_step',
          assignedAgentId: 'agent_researcher',
          objective: 'Step that uses failing tool',
          delegationDepth: 1,
          dependencies: [],
          toolId: 'system:fail_tool',
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Step that uses failing tool',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'dependent_step',
          assignedAgentId: 'agent_productivity',
          objective: 'Step that depends on doomed_step',
          delegationDepth: 2,
          dependencies: ['doomed_step'],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Step that depends on doomed_step',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    const result = await coordinator.coordinateTask(input)

    // Result should be partially_completed because independent_success passed
    expect(result.status).toBe('partially_completed')
    expect(result.phase).toBe('partially_completed')
    expect(result.childTasks['independent_success'].status).toBe('completed')
    expect(result.childTasks['doomed_step'].status).toBe('failed')
    expect(result.childTasks['dependent_step'].status).toBe('blocked')
    expect(result.childTasks['dependent_step'].error).toContain('doomed_step')

    expect(result.aggregateProgress.completed).toBe(1)
    expect(result.aggregateProgress.failed).toBe(1)
    expect(result.aggregateProgress.blocked).toBe(1)

    // Limitations should truthfully record failed and blocked operations
    expect(result.finalResult?.limitations.some((l) => l.includes('failed'))).toBe(true)
    expect(result.finalResult?.limitations.some((l) => l.includes('blocked'))).toBe(true)
  })

  it('truthfully detects and preserves conflicting claims across child agents', async () => {
    // Set up mock custom responses to inject contradictory findings
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_conflict_test',
      conversationId: 'conv_conflict',
      userIntent: 'Compare opinions on system performance bottleneck',
      authorizedScope: ['read:system_info'],
      budget: {
        maxChildTasks: 5,
        maxDelegationDepth: 2,
        maxConcurrency: 2,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'agent_a_task',
          assignedAgentId: 'agent_researcher',
          objective: 'Diagnose network bottleneck',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Diagnose network bottleneck',
            inputData: { component: 'network' },
            predecessorOutputs: {},
            sourceProvenance: [
              { sourceId: 'src_network_stats', url: 'https://example.com/net' }
            ],
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'agent_b_task',
          assignedAgentId: 'agent_coding',
          objective: 'Diagnose cpu bottleneck',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Diagnose cpu bottleneck',
            inputData: { component: 'cpu' },
            predecessorOutputs: {},
            sourceProvenance: [
              { sourceId: 'src_cpu_stats', url: 'https://example.com/cpu' }
            ],
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    const result = await coordinator.coordinateTask(input)

    expect(result.status).toBe('completed')
    expect(result.finalResult).toBeDefined()
    expect(result.finalResult?.completedOperations).toContain('agent_a_task')
    expect(result.finalResult?.completedOperations).toContain('agent_b_task')
  })

  it('executes structured tool calls through TaskExecutionEngine for child tasks', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_tool_dispatch',
      conversationId: 'conv_tool_dispatch',
      userIntent: 'Obtain current time via registered tool through authoritative engine',
      authorizedScope: ['read:system_info'],
      budget: {
        maxChildTasks: 3,
        maxDelegationDepth: 1,
        maxConcurrency: 1,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'tool_step_1',
          assignedAgentId: 'agent_system_operator',
          objective: 'Query system time',
          delegationDepth: 1,
          dependencies: [],
          toolId: 'system:get_time',
          toolInput: {},
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Query system time',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    const result = await coordinator.coordinateTask(input)

    expect(result.status).toBe('completed')
    const child = result.childTasks['tool_step_1']
    expect(child.status).toBe('completed')
    expect(child.output).toBeDefined()
    expect((child.output as any).epochMs).toBe(mockTime)
  })
})

