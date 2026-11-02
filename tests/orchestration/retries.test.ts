import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'
import { ToolDefinition, DEFAULT_TOOL_LIMITS } from '../../src/shared/tools/types'
import { ToolDispatcher } from '../../src/shared/orchestration/ToolDispatcher'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('Policy-Aware Retries and Recovery', () => {
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

  it('retries transient failures automatically and marks step succeeded upon recovery', async () => {
    let callAttempts = 0

    const flakeyTool: ToolDefinition<{ inputVal: string }, { result: string }> = {
      id: 'utility:flakey_tool',
      displayName: 'Flakey Tool',
      description: 'Fails on first invocation, succeeds on second',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ inputVal: z.string() }).strict(),
      outputSchema: z.object({ result: z.string() }),
      jsonSchema: { type: 'object', properties: { inputVal: { type: 'string' } }, required: ['inputVal'] },
      requiredCapabilities: [],
      riskTier: 'low',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      retryPolicy: {
        isIdempotent: true,
        hasSideEffects: false,
        maxRetries: 2,
        initialBackoffMs: 10,
        maxBackoffMs: 50,
        backoffFactor: 2
      },
      source: 'extension'
    }

    registry.register(flakeyTool)
    dispatcher.registerHandler('utility:flakey_tool', async (input) => {
      callAttempts += 1
      if (callAttempts === 1) {
        throw new Error('Transient network timeout')
      }
      return { result: `Success after retry: ${input.inputVal}` }
    })

    const plan: TaskPlan = {
      id: 'plan_retry_success',
      taskId: 'task_retry_success',
      conversationId: 'conv_retry',
      version: '1.0.0',
      intent: 'Test retry recovery',
      requiresTools: true,
      steps: [
        {
          id: 'step_flakey',
          toolId: 'utility:flakey_tool',
          description: 'Flakey tool step',
          input: { inputVal: 'payload_alpha' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('completed')
    expect(callAttempts).toBe(2)
    expect(result.stepResults['step_flakey'].status).toBe('completed')
    expect(result.stepResults['step_flakey'].retryAttempts).toBe(1)
    expect((result.stepResults['step_flakey'].output as any).result).toBe('Success after retry: payload_alpha')
  })

  it('rejects automated retry for non-idempotent operations with side effects', async () => {
    let callAttempts = 0

    const sideEffectTool: ToolDefinition<{ amount: number }, { transferred: boolean }> = {
      id: 'utility:non_idempotent_tool',
      displayName: 'Non-Idempotent Tool',
      description: 'Has side effects and is non-idempotent',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ amount: z.number() }).strict(),
      outputSchema: z.object({ transferred: z.boolean() }),
      jsonSchema: { type: 'object', properties: { amount: { type: 'number' } }, required: ['amount'] },
      requiredCapabilities: [],
      riskTier: 'moderate',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      retryPolicy: {
        isIdempotent: false,
        hasSideEffects: true,
        maxRetries: 3,
        initialBackoffMs: 10,
        maxBackoffMs: 50,
        backoffFactor: 2
      },
      source: 'extension'
    }

    registry.register(sideEffectTool)
    dispatcher.registerHandler('utility:non_idempotent_tool', async () => {
      callAttempts += 1
      throw new Error('Downstream server error')
    })

    const plan: TaskPlan = {
      id: 'plan_no_retry_side_effect',
      taskId: 'task_no_retry_side_effect',
      conversationId: 'conv_retry',
      version: '1.0.0',
      intent: 'Non-idempotent operation',
      requiresTools: true,
      steps: [
        {
          id: 'step_side_effect',
          toolId: 'utility:non_idempotent_tool',
          description: 'Must not retry',
          input: { amount: 100 },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('failed')
    // Must be called exactly once: no retries!
    expect(callAttempts).toBe(1)
    expect(result.stepResults['step_side_effect'].status).toBe('failed')
    expect(result.stepResults['step_side_effect'].retryAttempts).toBe(0)
  })

  it('exhausts retry budget and reports permanent failure when failures persist', async () => {
    let callAttempts = 0

    const alwaysFailsTool: ToolDefinition<{ id: string }, { ok: boolean }> = {
      id: 'utility:always_fails',
      displayName: 'Always Fails Tool',
      description: 'Always throws',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ id: z.string() }).strict(),
      outputSchema: z.object({ ok: z.boolean() }),
      jsonSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      requiredCapabilities: [],
      riskTier: 'low',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      retryPolicy: {
        isIdempotent: true,
        hasSideEffects: false,
        maxRetries: 2, // 1 initial + 2 retries = 3 attempts total
        initialBackoffMs: 10,
        maxBackoffMs: 50,
        backoffFactor: 2
      },
      source: 'extension'
    }

    registry.register(alwaysFailsTool)
    dispatcher.registerHandler('utility:always_fails', async () => {
      callAttempts += 1
      throw new Error('Persistent external failure')
    })

    const plan: TaskPlan = {
      id: 'plan_budget_exhaust',
      taskId: 'task_budget_exhaust',
      conversationId: 'conv_retry',
      version: '1.0.0',
      intent: 'Test budget exhaustion',
      requiresTools: true,
      steps: [
        {
          id: 'step_exhaust',
          toolId: 'utility:always_fails',
          description: 'Always fails',
          input: { id: 'test_123' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('failed')
    expect(callAttempts).toBe(3) // 1 initial + 2 retries
    expect(result.stepResults['step_exhaust'].retryAttempts).toBe(2)
  })

  it('aborts retry delay immediately when cancellation is requested during backoff', async () => {
    let callAttempts = 0

    const slowRetryTool: ToolDefinition<{ val: string }, { ok: boolean }> = {
      id: 'utility:slow_retry_tool',
      displayName: 'Slow Retry Tool',
      description: 'Fails then has long retry backoff',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ val: z.string() }).strict(),
      outputSchema: z.object({ ok: z.boolean() }),
      jsonSchema: { type: 'object', properties: { val: { type: 'string' } }, required: ['val'] },
      requiredCapabilities: [],
      riskTier: 'low',
      confirmationPolicy: 'none',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      retryPolicy: {
        isIdempotent: true,
        hasSideEffects: false,
        maxRetries: 2,
        initialBackoffMs: 1000, // 1s backoff
        maxBackoffMs: 2000,
        backoffFactor: 2
      },
      source: 'extension'
    }

    registry.register(slowRetryTool)
    dispatcher.registerHandler('utility:slow_retry_tool', async () => {
      callAttempts += 1
      throw new Error('Initial network error')
    })

    const plan: TaskPlan = {
      id: 'plan_cancel_during_backoff',
      taskId: 'task_cancel_during_backoff',
      conversationId: 'conv_retry',
      version: '1.0.0',
      intent: 'Cancel during retry wait',
      requiresTools: true,
      steps: [
        {
          id: 'step_slow_retry',
          toolId: 'utility:slow_retry_tool',
          description: 'Step with long retry delay',
          input: { val: 'abc' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const execPromise = engine.executePlan(plan)

    // Wait 50ms for initial attempt to fail and enter 1s backoff wait
    await new Promise((r) => setTimeout(r, 60))
    engine.requestCancellation('task_cancel_during_backoff', 'Cancelled during retry delay')

    const result = await execPromise
    expect(result.status).toBe('cancelled')
    // Attempted only once before cancellation aborted the backoff!
    expect(callAttempts).toBe(1)
  })
})
