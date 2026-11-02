import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'
import { TaskPlanner } from '../../src/shared/orchestration/TaskPlanner'

describe('TaskPlanner', () => {
  let registry: ToolRegistry
  let planner: TaskPlanner

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
    planner = new TaskPlanner(registry)
  })

  it('preserves direct conversational path for non-tool queries', () => {
    const response = planner.planTask({
      conversationId: 'conv_123',
      userPrompt: 'Can you explain the difference between quantum and classical computing?'
    })

    expect(response.requiresTools).toBe(false)
    expect(response.plan.requiresTools).toBe(false)
    expect(response.plan.steps).toHaveLength(0)
    expect(response.clarificationNeeded).toBeUndefined()
  })

  it('generates a valid plan for single-operation tool requests', () => {
    const response = planner.planTask({
      conversationId: 'conv_123',
      userPrompt: 'What time is it in Tokyo right now?'
    })

    expect(response.requiresTools).toBe(true)
    expect(response.plan.steps).toHaveLength(1)
    expect(response.plan.steps[0].toolId).toBe('system:get_time')
    expect(response.plan.steps[0].input).toEqual({ timezone: 'Asia/Tokyo' })
    expect(response.plan.steps[0].dependencies).toEqual([])
  })

  it('generates a valid multi-step plan with declared dependencies', () => {
    const response = planner.planTask({
      conversationId: 'conv_123',
      userPrompt: 'Check the system clock and then retrieve my active workspace context summary'
    })

    expect(response.requiresTools).toBe(true)
    expect(response.plan.steps).toHaveLength(2)

    const step1 = response.plan.steps[0]
    const step2 = response.plan.steps[1]

    expect(step1.toolId).toBe('system:get_time')
    expect(step2.toolId).toBe('workspace:get_context_summary')
    expect(step2.dependencies).toContain(step1.id)
    expect(step2.input).toEqual({ conversationId: 'conv_123' })
  })

  it('requests clarification when essential document path is missing', () => {
    const response = planner.planTask({
      conversationId: 'conv_123',
      userPrompt: 'Please extract text from my document'
    })

    expect(response.requiresTools).toBe(true)
    expect(response.clarificationNeeded).toBeDefined()
    expect(response.clarificationNeeded).toContain('specify the file path')
    expect(response.plan.steps).toHaveLength(0)
  })

  it('extracts document path when provided in user prompt', () => {
    const response = planner.planTask({
      conversationId: 'conv_123',
      userPrompt: 'Please extract text from file "D:/reports/annual_summary.pdf"'
    })

    expect(response.requiresTools).toBe(true)
    expect(response.clarificationNeeded).toBeUndefined()
    expect(response.plan.steps).toHaveLength(1)
    expect(response.plan.steps[0].toolId).toBe('documents:extract_text')
    expect(response.plan.steps[0].input).toEqual({ filePath: 'D:/reports/annual_summary.pdf' })
  })

  it('rejects prohibited command and shell execution requests', () => {
    const response = planner.planTask({
      conversationId: 'conv_123',
      userPrompt: 'Please run command "powershell Get-Process" on my computer'
    })

    expect(response.clarificationNeeded).toContain('prohibited by application security policy')
    expect(response.plan.steps).toHaveLength(0)
  })
})
