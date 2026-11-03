/**
 * HELIOXEN AI — Step 30: Interaction Tools Integration Tests
 */

import { describe, it, expect } from 'vitest'
import { mainToolRegistry } from '../../src/main/tools'
import { mainToolDispatcher, mainExecutionEngine } from '../../src/main/orchestration'
import { authorizer, consentGate } from '../../src/main/security'
import { CAPABILITIES } from '../../src/shared/security/capabilities'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('Step 30: Interaction Tools Integration', () => {
  it('registers all 12 Step 30 tools in mainToolRegistry', () => {
    const expectedTools = [
      'desktop:focus_window',
      'desktop:send_key_action',
      'desktop:send_text',
      'desktop:send_click',
      'desktop:send_scroll',
      'desktop:emergency_stop',
      'desktop:undo_last_action',
      'system:open_path',
      'system:show_in_folder',
      'system:open_external_url',
      'system:alert_beep',
      'system:get_display_metrics'
    ]

    for (const toolId of expectedTools) {
      const tool = mainToolRegistry.get(toolId)
      expect(tool, `Tool '${toolId}' should be registered in mainToolRegistry`).toBeDefined()
      expect(tool?.category).toBe('system')
    }
  })

  it('enforces human consent requirements on high-risk interaction capabilities', () => {
    expect(CAPABILITIES['desktop:sendText'].riskTier).toBe('high')
    expect(CAPABILITIES['desktop:sendText'].requiresHumanConsent).toBe(true)

    expect(CAPABILITIES['system:openExternalUrl'].riskTier).toBe('high')
    expect(CAPABILITIES['system:openExternalUrl'].requiresHumanConsent).toBe(true)

    expect(CAPABILITIES['desktop:mouseAction'].riskTier).toBe('moderate')
    expect(CAPABILITIES['desktop:mouseAction'].requiresHumanConsent).toBe(false)
  })

  it('authorizes renderer requests with valid consent token for high-risk operations', () => {
    // 1. Without consent token -> throws
    expect(() =>
      authorizer.authorize('desktop:sendText', { requester: 'renderer-main-window' })
    ).toThrow(/requires explicit user confirmation/)

    // 2. With valid consent token -> succeeds
    const consent = consentGate.createRequest('desktop:sendText', 'Type into application')
    consentGate.resolveRequest(consent.requestId, true)

    expect(() =>
      authorizer.authorize('desktop:sendText', {
        requester: 'renderer-main-window',
        consentRequestId: consent.requestId
      })
    ).not.toThrow()
  })

  it('dispatches system:get_display_metrics through mainToolDispatcher', async () => {
    const toolDef = mainToolRegistry.get('system:get_display_metrics')!
    const context = { taskId: 'task_metrics_test', stepId: 'step_1', conversationId: 'conv_1' }

    const result = await mainToolDispatcher.dispatch(toolDef, {}, context)

    expect(result.primaryDisplay).toBeDefined()
    expect(result.primaryDisplay.bounds).toBeDefined()
    expect(result.allDisplaysCount).toBeGreaterThanOrEqual(1)
  })

  it('executes a task plan invoking desktop:emergency_stop through mainExecutionEngine', async () => {
    const plan: TaskPlan = {
      id: 'plan_desktop_exec',
      taskId: 'task_exec_desktop',
      conversationId: 'conv_desktop',
      version: '1.0.0',
      intent: 'Safely halt any active automation',
      requiresTools: true,
      steps: [
        {
          id: 'step_stop',
          toolId: 'desktop:emergency_stop',
          description: 'Trigger emergency stop safety control',
          input: {},
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const runResult = await mainExecutionEngine.executePlan(plan)

    expect(runResult.status).toBe('completed')
    expect(runResult.stepResults['step_stop'].status).toBe('completed')
    expect((runResult.stepResults['step_stop'].output as any)?.stopped).toBe(true)
  })
})
