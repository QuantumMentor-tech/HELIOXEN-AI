/**
 * HELIOXEN AI — Step 33: Automation Tools and Orchestration Integration Tests
 * Verifies tool registration, capabilities, dispatcher routing, and TaskExecutionEngine confirmation gating.
 */

import { describe, it, expect, vi } from 'vitest'
import { mainToolRegistry } from '../../src/main/tools'
import { createMainToolDispatcher } from '../../src/main/orchestration'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { authorizer } from '../../src/main/security'
import { TaskPlan, ToolExecutionContext } from '../../src/shared/orchestration/types'

describe('Step 33: Automation Tools and Orchestration Integration', () => {
  const automationToolIds = [
    'browser:inspect_page',
    'browser:click_element',
    'browser:scroll_page',
    'browser:fill_field',
    'browser:select_option',
    'browser:review_form',
    'browser:submit_form',
    'browser:manage_downloads'
  ]

  it('registers all 8 Step 33 automation tools in mainToolRegistry with proper schemas', () => {
    for (const toolId of automationToolIds) {
      const tool = mainToolRegistry.get(toolId)
      expect(tool).toBeDefined()
      expect(tool?.id).toBe(toolId)
      expect(tool?.inputSchema).toBeDefined()
      expect(tool?.outputSchema).toBeDefined()
      expect(tool?.category).toBe('system')
      expect(tool?.requiredCapabilities.length).toBeGreaterThan(0)
    }
  })

  it('verifies capability and confirmation policies for browser automation tools', () => {
    const inspectTool = mainToolRegistry.get('browser:inspect_page')
    expect(inspectTool?.requiredCapabilities).toContain('browser:inspectPage')
    expect(inspectTool?.riskTier).toBe('low')
    expect(inspectTool?.confirmationPolicy).toBe('none')

    const clickTool = mainToolRegistry.get('browser:click_element')
    expect(clickTool?.requiredCapabilities).toContain('browser:interact')
    expect(clickTool?.riskTier).toBe('moderate')

    const fillTool = mainToolRegistry.get('browser:fill_field')
    expect(fillTool?.requiredCapabilities).toContain('browser:fillForm')
    expect(fillTool?.riskTier).toBe('moderate')

    const submitTool = mainToolRegistry.get('browser:submit_form')
    expect(submitTool?.requiredCapabilities).toContain('browser:submitForm')
    expect(submitTool?.riskTier).toBe('high')
    expect(submitTool?.confirmationPolicy).toBe('user_confirmation')

    const downloadTool = mainToolRegistry.get('browser:manage_downloads')
    expect(downloadTool?.requiredCapabilities).toContain('browser:download')
  })

  it('dispatches browser:manage_downloads list action through main tool dispatcher', async () => {
    const dispatcher = createMainToolDispatcher()
    const execContext: ToolExecutionContext = {
      taskId: 'task_automation_test_1',
      stepId: 'step_1',
      conversationId: 'conv_automation_test_1'
    }

    const downloadToolDef = mainToolRegistry.get('browser:manage_downloads')!
    const result = (await dispatcher.dispatch(
      downloadToolDef,
      { action: 'list' },
      execContext
    )) as any

    expect(result).toBeDefined()
    expect(Array.isArray(result.downloads)).toBe(true)
  })

  it('halts execution of browser:submit_form when unconfirmed', async () => {
    const dispatcher = createMainToolDispatcher()
    const engine = new TaskExecutionEngine(mainToolRegistry, dispatcher, authorizer)

    const plan: TaskPlan = {
      id: 'plan_submit_gate_1',
      taskId: 'task_submit_gate_1',
      conversationId: 'conv_submit_gate_1',
      version: '1.0.0',
      intent: 'Automated Form Submission with Gating',
      requiresTools: true,
      steps: [
        {
          id: 'step_inspect_1',
          toolId: 'browser:manage_downloads',
          description: 'Check active downloads',
          input: { action: 'list' },
          dependencies: []
        },
        {
          id: 'step_submit_1',
          toolId: 'browser:submit_form',
          description: 'Submit consequential checkout form',
          input: {
            tabId: 'tab_test_gate_1',
            confirmationToken: 'valid_token_sample_1234'
          },
          dependencies: ['step_inspect_1']
        }
      ],
      createdAt: Date.now()
    }

    // Run without pre-approved confirmation
    const result = await engine.executePlan(plan, {
      taskId: 'task_submit_gate_1',
      conversationId: 'conv_submit_gate_1'
    })

    // Plan should fail or halt at submit step because user confirmation is required
    expect(result.stepResults['step_inspect_1'].status).toBe('completed')
    expect(result.stepResults['step_submit_1'].status).toBe('failed')
    expect(result.stepResults['step_submit_1'].error).toContain('requires explicit user confirmation')
  })

  it('proceeds with browser:submit_form execution when step confirmation is explicitly approved', async () => {
    const dispatcher = createMainToolDispatcher()
    // Mock the dispatcher handler for browser:submit_form so it returns simulated result
    dispatcher.registerHandler('browser:submit_form', async (input: any) => {
      return {
        success: true,
        action: 'submitForm',
        tabId: input.tabId,
        resultingUrl: 'https://example.org/thank-you',
        targetFound: true,
        message: 'Form successfully submitted with user token.'
      }
    })

    const engine = new TaskExecutionEngine(mainToolRegistry, dispatcher, authorizer)

    const plan: TaskPlan = {
      id: 'plan_submit_approved_1',
      taskId: 'task_submit_approved_1',
      conversationId: 'conv_submit_approved_1',
      version: '1.0.0',
      intent: 'Approved Form Submission Plan',
      requiresTools: true,
      steps: [
        {
          id: 'step_submit_approved',
          toolId: 'browser:submit_form',
          description: 'Submit order form',
          input: {
            tabId: 'tab_test_approved_1',
            confirmationToken: 'valid_token_sample_5678'
          },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    // Run WITH approvedConfirmations set containing the stepId
    const approvedConfirmations = new Set<string>(['step_submit_approved'])
    const result = await engine.executePlan(plan, {
      taskId: 'task_submit_approved_1',
      conversationId: 'conv_submit_approved_1',
      approvedConfirmations
    })

    expect(result.status).toBe('completed')
    expect(result.stepResults['step_submit_approved'].status).toBe('completed')
    expect((result.stepResults['step_submit_approved'].output as any).success).toBe(true)
  })
})
