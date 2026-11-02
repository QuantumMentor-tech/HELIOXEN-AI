import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_TOOL_CATALOG, ProhibitedShellExecuteTool } from '../../src/shared/tools/catalog'
import { ToolDefinition, DEFAULT_TOOL_LIMITS } from '../../src/shared/tools/types'
import { ToolDispatcher } from '../../src/shared/orchestration/ToolDispatcher'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('Orchestration Security and Limits', () => {
  let registry: ToolRegistry
  let dispatcher: ToolDispatcher

  beforeEach(() => {
    registry = new ToolRegistry()
    for (const tool of BUILTIN_TOOL_CATALOG) {
      registry.register(tool)
    }
    dispatcher = new ToolDispatcher()
  })

  it('permanently blocks execution of prohibited shell tools', async () => {
    const engine = new TaskExecutionEngine(registry, dispatcher)

    const plan: TaskPlan = {
      id: 'plan_shell_attack',
      taskId: 'task_shell_attack',
      conversationId: 'conv_sec',
      version: '1.0.0',
      intent: 'Attacker requesting shell command',
      requiresTools: true,
      steps: [
        {
          id: 'step_exploit',
          toolId: 'shell:execute',
          description: 'Malicious shell payload',
          input: { command: 'rm -rf /' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('rejected')
    expect(result.error).toContain('prohibited tool')
    expect(Object.keys(result.stepResults)).toHaveLength(0)
  })

  it('halts execution when security authorizer denies capability', async () => {
    // Authorizer mock that denies workspace:readContext
    const mockAuthorizer = {
      authorize: (capId: string) => {
        if (capId === 'workspace:readContext') {
          return false // Denied
        }
        return true
      }
    }

    const engine = new TaskExecutionEngine(registry, dispatcher, mockAuthorizer as any)

    const plan: TaskPlan = {
      id: 'plan_auth_denied',
      taskId: 'task_auth_denied',
      conversationId: 'conv_sec',
      version: '1.0.0',
      intent: 'Access context without capability',
      requiresTools: true,
      steps: [
        {
          id: 'step_read_context',
          toolId: 'workspace:get_context_summary',
          description: 'Try reading context summary',
          input: { conversationId: 'conv_sec' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('failed')
    expect(result.stepResults['step_read_context'].status).toBe('failed')
    expect(result.stepResults['step_read_context'].error).toContain('Authorization denied')
  })

  it('enforces human confirmation before executing high-consequence tools', async () => {
    // Register tool requiring user confirmation
    const sensitiveTool: ToolDefinition<{ action: string }, { performed: boolean }> = {
      id: 'utility:sensitive_action',
      displayName: 'Sensitive Action',
      description: 'Requires explicit human confirmation before execution',
      category: 'utility',
      version: '1.0.0',
      inputSchema: z.object({ action: z.string() }).strict(),
      outputSchema: z.object({ performed: z.boolean() }),
      jsonSchema: { type: 'object', properties: { action: { type: 'string' } }, required: ['action'] },
      requiredCapabilities: [],
      riskTier: 'high',
      confirmationPolicy: 'user_confirmation',
      implementationStatus: 'available',
      registrationStatus: 'enabled',
      executionMode: 'synchronous',
      limits: DEFAULT_TOOL_LIMITS,
      source: 'extension'
    }

    registry.register(sensitiveTool)
    dispatcher.registerHandler('utility:sensitive_action', async () => {
      return { performed: true }
    })

    const engine = new TaskExecutionEngine(registry, dispatcher)

    const plan: TaskPlan = {
      id: 'plan_confirmation_test',
      taskId: 'task_confirmation_test',
      conversationId: 'conv_sec',
      version: '1.0.0',
      intent: 'Perform sensitive action',
      requiresTools: true,
      steps: [
        {
          id: 'step_sensitive',
          toolId: 'utility:sensitive_action',
          description: 'Sensitive operation requiring user approval',
          input: { action: 'format_cache' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    // 1. Without approval: execution is blocked
    const unapprovedResult = await engine.executePlan(plan)
    expect(unapprovedResult.status).toBe('failed')
    expect(unapprovedResult.stepResults['step_sensitive'].status).toBe('failed')
    expect(unapprovedResult.stepResults['step_sensitive'].error).toContain('requires explicit user confirmation')

    // 2. With explicit user approval: execution proceeds
    const approvedPlan: TaskPlan = {
      ...plan,
      taskId: 'task_confirmation_approved'
    }
    const approvedResult = await engine.executePlan(approvedPlan, {
      approvedConfirmations: new Set(['step_sensitive'])
    })
    expect(approvedResult.status).toBe('completed')
    expect(approvedResult.stepResults['step_sensitive'].status).toBe('completed')
    expect((approvedResult.stepResults['step_sensitive'].output as any).performed).toBe(true)
  })

  it('rejects input with unexpected properties (strict schema validation)', async () => {
    const engine = new TaskExecutionEngine(registry, dispatcher)

    const plan: TaskPlan = {
      id: 'plan_extra_props',
      taskId: 'task_extra_props',
      conversationId: 'conv_sec',
      version: '1.0.0',
      intent: 'Inject unexpected parameter',
      requiresTools: true,
      steps: [
        {
          id: 'step_injected',
          toolId: 'system:get_time',
          description: 'Inject unexpected root shell parameter',
          input: { timezone: 'UTC', maliciousPayload: '<script>alert(1)</script>' },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const result = await engine.executePlan(plan)
    expect(result.status).toBe('failed')
    expect(result.stepResults['step_injected'].status).toBe('failed')
    expect(result.stepResults['step_injected'].error).toContain('Input schema validation failed')
  })
})
