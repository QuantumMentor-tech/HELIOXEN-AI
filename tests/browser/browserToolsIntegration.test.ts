/**
 * HELIOXEN AI — Step 31: Browser Tools and Orchestration Integration Tests
 */

import { describe, it, expect } from 'vitest'
import { mainToolRegistry } from '../../src/main/tools'
import { createMainToolDispatcher } from '../../src/main/orchestration'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan, ToolExecutionContext } from '../../src/shared/orchestration/types'

describe('Step 31: Browser Tools Integration', () => {
  const browserToolIds = [
    'browser:create_session',
    'browser:create_tab',
    'browser:navigate',
    'browser:switch_tab',
    'browser:close_tab',
    'browser:get_tab_state',
    'browser:list_tabs',
    'browser:reload',
    'browser:stop',
    'browser:go_back',
    'browser:go_forward',
    'browser:clear_session'
  ]

  it('registers all 12 browser tools in the mainToolRegistry with proper schemas', () => {
    for (const toolId of browserToolIds) {
      const tool = mainToolRegistry.get(toolId)
      expect(tool).toBeDefined()
      expect(tool?.id).toBe(toolId)
      expect(tool?.inputSchema).toBeDefined()
      expect(tool?.outputSchema).toBeDefined()
      expect(tool?.category).toBe('system')
      expect(tool?.requiredCapabilities.length).toBeGreaterThan(0)
    }
  })

  it('verifies capability requirements on browser tools', () => {
    const tabTool = mainToolRegistry.get('browser:create_tab')
    expect(tabTool?.requiredCapabilities).toContain('browser:manageTabs')

    const navTool = mainToolRegistry.get('browser:navigate')
    expect(navTool?.requiredCapabilities).toContain('browser:navigate')

    const sessionTool = mainToolRegistry.get('browser:create_session')
    expect(sessionTool?.requiredCapabilities).toContain('browser:createSession')

    const clearTool = mainToolRegistry.get('browser:clear_session')
    expect(clearTool?.requiredCapabilities).toContain('browser:clearSession')
  })

  it('dispatches browser tools through the main dispatcher', async () => {
    const dispatcher = createMainToolDispatcher()
    const execContext: ToolExecutionContext = {
      taskId: 'task_test_browser_1',
      stepId: 'step_1',
      conversationId: 'conv_test_browser_1'
    }

    // 1. Create tab
    const createTabDef = mainToolRegistry.get('browser:create_tab')!
    const createResult = (await dispatcher.dispatch(
      createTabDef,
      { url: 'https://example.org' },
      execContext
    )) as any

    expect(createResult).toBeDefined()
    expect(createResult.tabId).toBeDefined()
    expect(createResult.url).toBe('https://example.org/')

    const tabId = createResult.tabId

    // 2. Query tab state
    const getStateDef = mainToolRegistry.get('browser:get_tab_state')!
    const stateResult = (await dispatcher.dispatch(
      getStateDef,
      { tabId },
      execContext
    )) as any
    expect(stateResult.tabId).toBe(tabId)
    expect(stateResult.url).toBe('https://example.org/')

    // 3. List tabs
    const listTabsDef = mainToolRegistry.get('browser:list_tabs')!
    const listResult = (await dispatcher.dispatch(
      listTabsDef,
      {},
      execContext
    )) as any
    expect(listResult.tabs).toBeInstanceOf(Array)
    expect(listResult.tabs.some((t: any) => t.tabId === tabId)).toBe(true)

    // 4. Switch tab
    const switchTabDef = mainToolRegistry.get('browser:switch_tab')!
    const switchResult = (await dispatcher.dispatch(
      switchTabDef,
      { tabId },
      execContext
    )) as any
    expect(switchResult.tabId).toBe(tabId)

    // 5. Close tab
    const closeTabDef = mainToolRegistry.get('browser:close_tab')!
    const closeResult = (await dispatcher.dispatch(
      closeTabDef,
      { tabId },
      execContext
    )) as any
    expect(closeResult.success).toBe(true)
  })

  it('executes a multi-step task plan involving browser tools via TaskExecutionEngine', async () => {
    const dispatcher = createMainToolDispatcher()
    const engine = new TaskExecutionEngine(mainToolRegistry, dispatcher)

    const plan: TaskPlan = {
      id: 'plan_browser_test_' + Date.now(),
      taskId: 'task_browser_test_' + Date.now(),
      conversationId: 'conv_browser_test',
      version: '1.0.0',
      intent: 'Open a tab to search documentation and check its state',
      requiresTools: true,
      createdAt: Date.now(),
      steps: [
        {
          id: 'step_open_tab',
          toolId: 'browser:create_tab',
          input: {
            url: 'https://developer.mozilla.org'
          },
          dependencies: [],
          description: 'Open developer documentation tab'
        },
        {
          id: 'step_list_tabs',
          toolId: 'browser:list_tabs',
          input: {},
          dependencies: ['step_open_tab'],
          description: 'List active tabs'
        }
      ]
    }

    const executionResult = await engine.executePlan(plan)
    expect(executionResult.status).toBe('completed')
    expect(executionResult.stepResults['step_open_tab'].status).toBe('completed')
    expect(executionResult.stepResults['step_list_tabs'].status).toBe('completed')

    const tabOutput = executionResult.stepResults['step_open_tab'].output as any
    expect(tabOutput.url).toBe('https://developer.mozilla.org/')

    const listOutput = executionResult.stepResults['step_list_tabs'].output as any
    expect(listOutput.tabs.length).toBeGreaterThan(0)

    // Clean up created tab
    if (tabOutput.tabId) {
      const closeDef = mainToolRegistry.get('browser:close_tab')!
      await dispatcher.dispatch(closeDef, { tabId: tabOutput.tabId }, {
        taskId: plan.taskId,
        stepId: 'cleanup',
        conversationId: plan.conversationId
      })
    }
  })
})
