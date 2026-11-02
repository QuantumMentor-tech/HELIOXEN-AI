import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'
import { ToolDefinition, DEFAULT_TOOL_LIMITS } from '../../src/shared/tools/types'
import { ToolDispatcher } from '../../src/shared/orchestration/ToolDispatcher'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('TaskExecutionEngine', () => {
  let registry: ToolRegistry
  let dispatcher: ToolDispatcher
  let engine: TaskExecutionEngine

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
    dispatcher = new ToolDispatcher()
    engine = new TaskExecutionEngine(registry, dispatcher)
  })

  it('executes a valid single-step plan through genuine tool handler', async () => {
    const plan: TaskPlan = {
      id: 'plan_exec_1',
      taskId: 'task_exec_1',
      conversationId: 'conv_1',
      version: '1.0.0',
      intent: 'Get time in UTC',
      requiresTools: true,
      steps: [
        {
          id: 'step_1',
          toolId: 'system:get_time',
          description: 'Get UTC time',
          input: { timezone: 'UTC' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('completed')
    expect(result.stepResults['step_1']).toBeDefined()
    expect(result.stepResults['step_1'].status).toBe('completed')

    const output = result.stepResults['step_1'].output as any
    expect(output.timezone).toBe('UTC')
    expect(output.isoUtc).toBeDefined()
    expect(output.timestampMs).toBeGreaterThan(0)
  })

  it('executes a multi-step plan with data-binding resolution', async () => {
    // Register a test tool that accepts a timezone string from Step 1
    const echoTool: ToolDefinition<{ receivedTz: string }, { verified: boolean; tz: string }> = {
      id: 'utility:echo_timezone',
      displayName: 'Echo Timezone',
      description: 'Verifies data binding from prerequisite tool',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ receivedTz: z.string().min(1) }).strict(),
      outputSchema: z.object({ verified: z.boolean(), tz: z.string() }),
      jsonSchema: {
        type: 'object',
        properties: { receivedTz: { type: 'string' } },
        required: ['receivedTz']
      },
      requiredCapabilities: [],
      riskTier: 'low',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      source: 'extension'
    }

    registry.register(echoTool)
    dispatcher.registerHandler('utility:echo_timezone', async (input: { receivedTz: string }) => {
      return { verified: true, tz: input.receivedTz }
    })

    const plan: TaskPlan = {
      id: 'plan_binding_workflow',
      taskId: 'task_binding_workflow',
      conversationId: 'conv_multi',
      version: '1.0.0',
      intent: 'Extract timezone and pass to downstream echo tool',
      requiresTools: true,
      steps: [
        {
          id: 'step_time',
          toolId: 'system:get_time',
          description: 'Get Tokyo time',
          input: { timezone: 'Asia/Tokyo' },
          dependencies: []
        },
        {
          id: 'step_echo',
          toolId: 'utility:echo_timezone',
          description: 'Receive timezone from step_time',
          input: { receivedTz: '$step.step_time.output.timezone' },
          dependencies: ['step_time']
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('completed')
    expect(result.stepResults['step_time'].status).toBe('completed')
    expect(result.stepResults['step_echo'].status).toBe('completed')

    const echoOutput = result.stepResults['step_echo'].output as any
    expect(echoOutput.verified).toBe(true)
    expect(echoOutput.tz).toBe('Asia/Tokyo')
  })

  it('fails fast on prerequisite failure and skips dependent steps', async () => {
    // Register a failing tool
    const failingTool: ToolDefinition<{ shouldFail: boolean }, { ok: boolean }> = {
      id: 'utility:failing_tool',
      displayName: 'Failing Tool',
      description: 'Always fails to test error propagation',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ shouldFail: z.boolean() }).strict(),
      outputSchema: z.object({ ok: z.boolean() }),
      jsonSchema: { type: 'object', properties: { shouldFail: { type: 'boolean' } }, required: ['shouldFail'] },
      requiredCapabilities: [],
      riskTier: 'low',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      source: 'extension'
    }

    registry.register(failingTool)
    dispatcher.registerHandler('utility:failing_tool', async () => {
      throw new Error('Simulated tool execution failure')
    })

    const plan: TaskPlan = {
      id: 'plan_fail_test',
      taskId: 'task_fail_test',
      conversationId: 'conv_fail',
      version: '1.0.0',
      intent: 'Prerequisite failure handling',
      requiresTools: true,
      steps: [
        {
          id: 'step_fail',
          toolId: 'utility:failing_tool',
          description: 'This step fails',
          input: { shouldFail: true },
          dependencies: []
        },
        {
          id: 'step_dependent',
          toolId: 'system:get_time',
          description: 'Should be skipped because prerequisite failed',
          input: {},
          dependencies: ['step_fail']
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('failed')
    expect(result.stepResults['step_fail'].status).toBe('failed')
    expect(result.stepResults['step_fail'].error).toContain('Simulated tool execution failure')
    expect(result.stepResults['step_dependent'].status).toBe('skipped')
    expect(result.stepResults['step_dependent'].error).toContain('prerequisite step failure')
  })

  it('rejects duplicate dispatch of an actively executing task', async () => {
    // Slow tool to simulate active execution
    const slowTool: ToolDefinition<{ delayMs: number }, { done: boolean }> = {
      id: 'utility:slow_tool',
      displayName: 'Slow Tool',
      description: 'Delays for a given duration',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ delayMs: z.number() }).strict(),
      outputSchema: z.object({ done: z.boolean() }),
      jsonSchema: { type: 'object', properties: { delayMs: { type: 'number' } }, required: ['delayMs'] },
      requiredCapabilities: [],
      riskTier: 'low',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'asynchronous',
      limits: DEFAULT_TOOL_LIMITS,
      source: 'extension'
    }

    registry.register(slowTool)
    dispatcher.registerHandler('utility:slow_tool', async (input: { delayMs: number }) => {
      await new Promise((resolve) => setTimeout(resolve, input.delayMs))
      return { done: true }
    })

    const plan: TaskPlan = {
      id: 'plan_concurrent',
      taskId: 'task_concurrent_id',
      conversationId: 'conv_concurrent',
      version: '1.0.0',
      intent: 'Test concurrent dispatch guard',
      requiresTools: true,
      steps: [
        {
          id: 'step_slow',
          toolId: 'utility:slow_tool',
          description: 'Runs slowly',
          input: { delayMs: 100 },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    // Launch first execution
    const p1 = engine.executePlan(plan)

    // Attempt second execution immediately with identical taskId
    await expect(engine.executePlan(plan)).rejects.toThrow('Duplicate dispatch rejected')

    // First execution should complete normally
    const result1 = await p1
    expect(result1.status).toBe('completed')
  })
})
