import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG } from '../../src/shared/tools/catalog'
import { PlanValidator } from '../../src/shared/orchestration/PlanValidator'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('PlanValidator', () => {
  let registry: ToolRegistry
  let validator: PlanValidator

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
    validator = new PlanValidator(registry)
  })

  it('validates a well-formed single-step plan successfully', () => {
    const plan: TaskPlan = {
      id: 'plan_1',
      taskId: 'task_1',
      conversationId: 'conv_1',
      version: '1.0.0',
      intent: 'Get time',
      requiresTools: true,
      steps: [
        {
          id: 'step_1',
          toolId: 'system:get_time',
          description: 'Get local system time',
          input: { timezone: 'UTC' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.topologicalOrder).toEqual(['step_1'])
  })

  it('validates a well-formed multi-step plan and produces topological execution order', () => {
    const plan: TaskPlan = {
      id: 'plan_2',
      taskId: 'task_2',
      conversationId: 'conv_2',
      version: '1.0.0',
      intent: 'Get time then workspace summary',
      requiresTools: true,
      steps: [
        {
          id: 'step_b',
          toolId: 'workspace:get_context_summary',
          description: 'Get workspace context summary',
          input: { conversationId: 'conv_2' },
          dependencies: ['step_a']
        },
        {
          id: 'step_a',
          toolId: 'system:get_time',
          description: 'Get time first',
          input: {},
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(true)
    expect(result.topologicalOrder).toEqual(['step_a', 'step_b'])
  })

  it('rejects plans with missing required schema fields', () => {
    const malformed = {
      id: 'plan_bad',
      // missing taskId
      conversationId: 'conv_bad',
      steps: []
    }

    const result = validator.validate(malformed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('taskId'))).toBe(true)
  })

  it('rejects plans with duplicate step identifiers', () => {
    const plan: TaskPlan = {
      id: 'plan_dup',
      taskId: 'task_dup',
      conversationId: 'conv_dup',
      version: '1.0.0',
      intent: 'Duplicate steps',
      requiresTools: true,
      steps: [
        {
          id: 'step_dup',
          toolId: 'system:get_time',
          description: 'First instance',
          input: {},
          dependencies: []
        },
        {
          id: 'step_dup',
          toolId: 'models:list_available',
          description: 'Second instance with same ID',
          input: {},
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Duplicate step identifier'))).toBe(true)
  })

  it('rejects plans referencing unknown tools', () => {
    const plan: TaskPlan = {
      id: 'plan_unknown',
      taskId: 'task_unknown',
      conversationId: 'conv_unknown',
      version: '1.0.0',
      intent: 'Unknown tool test',
      requiresTools: true,
      steps: [
        {
          id: 'step_unregistered',
          toolId: 'unregistered:arbitrary_action',
          description: 'Model invented tool',
          input: {},
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('unknown or unregistered tool'))).toBe(true)
  })

  it('rejects plans requesting prohibited tools (shell:execute)', () => {
    const plan: TaskPlan = {
      id: 'plan_prohibited',
      taskId: 'task_prohibited',
      conversationId: 'conv_prohibited',
      version: '1.0.0',
      intent: 'Execute shell command',
      requiresTools: true,
      steps: [
        {
          id: 'step_shell',
          toolId: 'shell:execute',
          description: 'Run arbitrary bash command',
          input: { command: 'cat /etc/passwd' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('prohibited tool'))).toBe(true)
  })

  it('rejects plans with self-dependencies', () => {
    const plan: TaskPlan = {
      id: 'plan_self_dep',
      taskId: 'task_self_dep',
      conversationId: 'conv_self_dep',
      version: '1.0.0',
      intent: 'Self dependency test',
      requiresTools: true,
      steps: [
        {
          id: 'step_self',
          toolId: 'system:get_time',
          description: 'Depends on itself',
          input: {},
          dependencies: ['step_self']
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('cannot depend on itself'))).toBe(true)
  })

  it('rejects plans containing dependency cycles', () => {
    const plan: TaskPlan = {
      id: 'plan_cycle',
      taskId: 'task_cycle',
      conversationId: 'conv_cycle',
      version: '1.0.0',
      intent: 'Cycle detection',
      requiresTools: true,
      steps: [
        {
          id: 'step_1',
          toolId: 'system:get_time',
          description: 'Step 1 depends on Step 2',
          input: {},
          dependencies: ['step_2']
        },
        {
          id: 'step_2',
          toolId: 'models:list_available',
          description: 'Step 2 depends on Step 1',
          input: {},
          dependencies: ['step_1']
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Cyclic dependency detected'))).toBe(true)
  })

  it('rejects data bindings that reference non-prerequisite steps', () => {
    const plan: TaskPlan = {
      id: 'plan_binding_err',
      taskId: 'task_binding_err',
      conversationId: 'conv_binding_err',
      version: '1.0.0',
      intent: 'Invalid binding reference',
      requiresTools: true,
      steps: [
        {
          id: 'step_time',
          toolId: 'system:get_time',
          description: 'Get time',
          input: {},
          dependencies: []
        },
        {
          id: 'step_models',
          toolId: 'models:list_available',
          description: 'List models',
          // references step_time output without declaring step_time as dependency!
          input: { provider: '$step.step_time.output.timezone' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = validator.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('does not declare it as a dependency'))).toBe(true)
  })
})
