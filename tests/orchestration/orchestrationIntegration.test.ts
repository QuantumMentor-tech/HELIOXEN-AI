import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'
import { TaskPlanner } from '../../src/shared/orchestration/TaskPlanner'
import { ToolDispatcher } from '../../src/shared/orchestration/ToolDispatcher'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'

describe('Orchestration End-to-End Integration', () => {
  let registry: ToolRegistry
  let planner: TaskPlanner
  let dispatcher: ToolDispatcher
  let engine: TaskExecutionEngine

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
    planner = new TaskPlanner(registry)
    dispatcher = new ToolDispatcher()
    engine = new TaskExecutionEngine(registry, dispatcher)
  })

  it('runs full end-to-end planning and execution for multi-step tool request', async () => {
    // 1. User submits request that needs multiple operations
    const userPrompt = 'What time is it in London and also retrieve the active workspace context summary'
    const planResponse = planner.planTask({
      conversationId: 'conv_e2e_101',
      userPrompt
    })

    expect(planResponse.requiresTools).toBe(true)
    expect(planResponse.plan.steps.length).toBeGreaterThanOrEqual(2)

    // 2. Validate plan steps
    const stepIds = planResponse.plan.steps.map((s) => s.id)
    expect(stepIds).toContain('step_system_time')
    expect(stepIds).toContain('step_workspace_summary')

    // 3. Execute plan through engine
    const executionResult = await engine.executePlan(planResponse.plan)

    expect(executionResult.status).toBe('completed')
    expect(executionResult.stepResults['step_system_time'].status).toBe('completed')
    expect(executionResult.stepResults['step_workspace_summary'].status).toBe('completed')

    // Verify system time output
    const timeOutput = executionResult.stepResults['step_system_time'].output as any
    expect(timeOutput.timezone).toBe('Europe/London')
    expect(timeOutput.localTime).toBeDefined()
    expect(timeOutput.isoUtc).toBeDefined()

    // Verify workspace summary output
    const workspaceOutput = executionResult.stepResults['step_workspace_summary'].output as any
    expect(workspaceOutput.conversationId).toBe('conv_e2e_101')
    expect(workspaceOutput.totalItems).toBe(0)

    // Verify task record tracking
    const taskRecord = engine.getTask(planResponse.taskId)
    expect(taskRecord).toBeDefined()
    expect(taskRecord?.state).toBe('completed')
    expect(taskRecord?.plan?.id).toBe(planResponse.plan.id)
  })

  it('preserves direct conversational path without executing any tools', async () => {
    const conversationalPrompt = 'Write a haiku about a robot watching the sunrise.'
    const planResponse = planner.planTask({
      conversationId: 'conv_e2e_102',
      userPrompt: conversationalPrompt
    })

    expect(planResponse.requiresTools).toBe(false)
    expect(planResponse.plan.steps).toHaveLength(0)

    // When passing non-tool plan to engine, completes immediately with zero tool dispatches
    const executionResult = await engine.executePlan(planResponse.plan)
    expect(executionResult.status).toBe('completed')
    expect(Object.keys(executionResult.stepResults)).toHaveLength(0)
  })
})
