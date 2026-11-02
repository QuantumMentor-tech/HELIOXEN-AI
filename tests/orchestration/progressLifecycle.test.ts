import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'
import { ToolDispatcher } from '../../src/shared/orchestration/ToolDispatcher'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan, TaskProgressEvent } from '../../src/shared/orchestration/types'

describe('Progress Lifecycle and Event Sequencing', () => {
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

  it('emits monotonically sequenced progress events throughout task execution', async () => {
    const receivedEvents: TaskProgressEvent[] = []
    const unsubscribe = engine.onProgress((event) => {
      receivedEvents.push(event)
    })

    const plan: TaskPlan = {
      id: 'plan_progress_seq',
      taskId: 'task_progress_seq',
      conversationId: 'conv_prog',
      version: '1.0.0',
      intent: 'Verify progress event sequencing',
      requiresTools: true,
      steps: [
        {
          id: 'step_time_1',
          toolId: 'system:get_time',
          description: 'Get local system time',
          input: { timezone: 'UTC' },
          dependencies: []
        },
        {
          id: 'step_time_2',
          toolId: 'system:get_time',
          description: 'Get second timestamp',
          input: { timezone: 'Asia/Tokyo' },
          dependencies: ['step_time_1']
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('completed')

    unsubscribe()

    expect(receivedEvents.length).toBeGreaterThanOrEqual(5)

    // Verify monotonic sequence numbering
    for (let i = 0; i < receivedEvents.length; i++) {
      expect(receivedEvents[i].sequenceNumber).toBe(i + 1)
      expect(receivedEvents[i].taskId).toBe('task_progress_seq')
      expect(receivedEvents[i].totalStepCount).toBe(2)
    }

    // Verify step counts progress accurately
    const finalEvent = receivedEvents[receivedEvents.length - 1]
    expect(finalEvent.eventType).toBe('task:completed')
    expect(finalEvent.completedStepCount).toBe(2)
    expect(finalEvent.newState).toBe('completed')
  })

  it('reports accurate completedStepCount when steps succeed or fail', async () => {
    const receivedEvents: TaskProgressEvent[] = []
    engine.onProgress((event) => {
      receivedEvents.push(event)
    })

    const plan: TaskPlan = {
      id: 'plan_progress_count',
      taskId: 'task_progress_count',
      conversationId: 'conv_prog',
      version: '1.0.0',
      intent: 'Check verified step counts',
      requiresTools: true,
      steps: [
        {
          id: 'step_time',
          toolId: 'system:get_time',
          description: 'Get system time',
          input: {},
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    await engine.executePlan(plan)

    const stepSuccessEvent = receivedEvents.find((e) => e.eventType === 'step:succeeded')
    expect(stepSuccessEvent).toBeDefined()
    expect(stepSuccessEvent?.completedStepCount).toBe(1)
    expect(stepSuccessEvent?.stepId).toBe('step_time')
  })

  it('allows unsubscribing from progress stream cleanly', async () => {
    let callCount = 0
    const unsubscribe = engine.onProgress(() => {
      callCount += 1
    })

    unsubscribe()

    const plan: TaskPlan = {
      id: 'plan_unsub',
      taskId: 'task_unsub',
      conversationId: 'conv_unsub',
      version: '1.0.0',
      intent: 'Test unsubscription',
      requiresTools: true,
      steps: [
        {
          id: 'step_1',
          toolId: 'system:get_time',
          description: 'Get time',
          input: {},
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    await engine.executePlan(plan)
    expect(callCount).toBe(0)
  })
})
