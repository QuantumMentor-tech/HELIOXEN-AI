/**
 * HELIOXEN AI — Step 41 Test Suite: Delegation Boundaries & Security Invariants
 * Tests privilege escalation prevention, credential leak detection, DAG cycle detection,
 * resource budget limits (depth and count), and cooperative cancellation propagation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { MultiAgentCoordinator } from '../../src/main/agents/MultiAgentCoordinator'
import { AgentRegistry } from '../../src/main/agents/AgentRegistry'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { TaskExecutionEngine, ToolDispatcher } from '../../src/shared/orchestration'
import { authorizer } from '../../src/main/security'
import { CollaborationPlanInput } from '../../src/shared/agents/collaborationTypes'

describe('Step 41 — Delegation Boundaries and Security Invariants', () => {
  let tempDir: string
  let agentRegistry: AgentRegistry
  let toolRegistry: ToolRegistry
  let toolDispatcher: ToolDispatcher
  let executionEngine: TaskExecutionEngine
  let coordinator: MultiAgentCoordinator
  let mockTime: number

  beforeEach(() => {
    mockTime = 1700000000000
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-sec-collab-'))
    toolRegistry = new ToolRegistry()
    toolDispatcher = new ToolDispatcher()
    executionEngine = new TaskExecutionEngine(toolRegistry, toolDispatcher, authorizer)

    agentRegistry = new AgentRegistry({
      storageDir: tempDir,
      toolRegistry,
      nowFn: () => mockTime
    })

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
      // Ignore
    }
  })

  it('rejects child task attempting privilege escalation beyond parent authorized scope', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_esc_1',
      conversationId: 'conv_esc_1',
      userIntent: 'Attempt privilege escalation through child delegation',
      authorizedScope: ['read:system_info'], // parent only authorized for read:system_info
      budget: {
        maxChildTasks: 5,
        maxDelegationDepth: 2,
        maxConcurrency: 2,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'child_escalation',
          assignedAgentId: 'agent_general',
          objective: 'Attempt unauthorized write operation',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: false,
          requiredCapabilities: ['write:files'], // NOT in parent scope!
          inputEnvelope: {
            objective: 'Attempt unauthorized write operation',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['write:files'],
            isReadOnly: false
          }
        }
      ]
    }

    await expect(coordinator.coordinateTask(input)).rejects.toThrow(/Privilege escalation rejected/)
  })

  it('rejects context envelopes containing raw credentials or leaked secrets', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_leak_1',
      conversationId: 'conv_leak_1',
      userIntent: 'Attempt passing raw credentials in context envelope',
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
          childTaskId: 'child_leaker',
          assignedAgentId: 'agent_researcher',
          objective: 'Process external feed',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Process external feed',
            inputData: {
              apiKey: 'sk-secret-12345-very-sensitive-key',
              tokenEndpoint: 'https://api.example.com'
            },
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    await expect(coordinator.coordinateTask(input)).rejects.toThrow(/Security boundary violation/)
  })

  it('rejects plans with circular dependency DAG cycles', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_cycle_1',
      conversationId: 'conv_cycle_1',
      userIntent: 'Circular dependency delegation plan',
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
          childTaskId: 'task_cycle_a',
          assignedAgentId: 'agent_researcher',
          objective: 'Task A depends on Task B',
          delegationDepth: 1,
          dependencies: ['task_cycle_b'],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Task A depends on Task B',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'task_cycle_b',
          assignedAgentId: 'agent_coding',
          objective: 'Task B depends on Task A',
          delegationDepth: 1,
          dependencies: ['task_cycle_a'],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Task B depends on Task A',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    await expect(coordinator.coordinateTask(input)).rejects.toThrow(/Dependency cycle detected/)
  })

  it('rejects plans that exceed delegation depth or child count budget', async () => {
    // 1. Test depth exceeding budget
    const depthExceededInput: CollaborationPlanInput = {
      parentTaskId: 'parent_depth_exceeded',
      conversationId: 'conv_depth_exceeded',
      userIntent: 'Deep delegation tree',
      authorizedScope: ['read:system_info'],
      budget: {
        maxChildTasks: 5,
        maxDelegationDepth: 2, // Maximum allowed is 2
        maxConcurrency: 2,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'task_deep',
          assignedAgentId: 'agent_researcher',
          objective: 'Depth 3 exceeds maxDelegationDepth of 2',
          delegationDepth: 3, // EXCEEDED!
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Depth 3 exceeds maxDelegationDepth of 2',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    await expect(coordinator.coordinateTask(depthExceededInput)).rejects.toThrow(/delegation depth .* exceeds maximum depth/)

    // 2. Test child count exceeding budget
    const countExceededInput: CollaborationPlanInput = {
      parentTaskId: 'parent_count_exceeded',
      conversationId: 'conv_count_exceeded',
      userIntent: 'Too many child tasks',
      authorizedScope: ['read:system_info'],
      budget: {
        maxChildTasks: 2, // Maximum allowed is 2
        maxDelegationDepth: 2,
        maxConcurrency: 2,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'task_c1',
          assignedAgentId: 'agent_researcher',
          objective: 'Child 1',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Child 1',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'task_c2',
          assignedAgentId: 'agent_coding',
          objective: 'Child 2',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Child 2',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'task_c3',
          assignedAgentId: 'agent_productivity',
          objective: 'Child 3 exceeds maxChildTasks limit of 2',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Child 3',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    await expect(coordinator.coordinateTask(countExceededInput)).rejects.toThrow(/Child task count .* exceeds resource budget limit/)
  })

  it('rejects tasks referencing unregistered or disabled agents', async () => {
    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_unknown_agent',
      conversationId: 'conv_unknown_agent',
      userIntent: 'Assigning to phantom agent',
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
          childTaskId: 'task_phantom',
          assignedAgentId: 'agent_phantom_unregistered', // Non-existent!
          objective: 'Phantom task',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Phantom task',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    await expect(coordinator.coordinateTask(input)).rejects.toThrow(/assigned to unknown or disabled agent/)
  })

  it('propagates cooperative cancellation to all active and pending child tasks', async () => {
    const abortCtrl = new AbortController()

    const input: CollaborationPlanInput = {
      parentTaskId: 'parent_cancel_test',
      conversationId: 'conv_cancel_test',
      userIntent: 'Test cooperative cancellation propagation',
      authorizedScope: ['read:system_info'],
      budget: {
        maxChildTasks: 5,
        maxDelegationDepth: 2,
        maxConcurrency: 1,
        maxExecutionTimeMs: 10000,
        maxRetriesPerChild: 1
      },
      childTasks: [
        {
          childTaskId: 'task_to_cancel_1',
          assignedAgentId: 'agent_researcher',
          objective: 'First step to be cancelled',
          delegationDepth: 1,
          dependencies: [],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'First step to be cancelled',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        },
        {
          childTaskId: 'task_to_cancel_2',
          assignedAgentId: 'agent_coding',
          objective: 'Second step dependent on first',
          delegationDepth: 2,
          dependencies: ['task_to_cancel_1'],
          isReadOnly: true,
          requiredCapabilities: ['read:system_info'],
          inputEnvelope: {
            objective: 'Second step dependent on first',
            inputData: {},
            predecessorOutputs: {},
            capabilityConstraints: ['read:system_info'],
            isReadOnly: true
          }
        }
      ]
    }

    // Abort immediately before or during start
    abortCtrl.abort()

    const result = await coordinator.coordinateTask(input, { signal: abortCtrl.signal })

    expect(result.status).toBe('cancelled')
    expect(result.phase).toBe('cancelled')
    expect(result.cancellationRequested).toBe(true)

    // Children must be marked cancelled
    for (const child of Object.values(result.childTasks)) {
      expect(['cancelled', 'blocked', 'failed']).toContain(child.status)
    }

    // Agents must have runtime status reset to idle
    const researcher = agentRegistry.getAgent('agent_researcher')
    expect(researcher?.status).toBe('idle')
  })
})

