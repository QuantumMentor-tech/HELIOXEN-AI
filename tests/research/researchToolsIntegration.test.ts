/**
 * HELIOXEN AI — Step 32: Research Tools and Orchestration Integration Tests
 */

import { describe, it, expect } from 'vitest'
import { mainToolRegistry } from '../../src/main/tools'
import { createMainToolDispatcher } from '../../src/main/orchestration'
import { TaskExecutionEngine } from '../../src/shared/orchestration/TaskExecutionEngine'
import { TaskPlan, ToolExecutionContext } from '../../src/shared/orchestration/types'

describe('Step 32: Research Tools Integration', () => {
  const researchToolIds = [
    'research:web_search',
    'research:extract_tab_content',
    'research:extract_url_content',
    'research:capture_tab_screenshot',
    'research:manage_collection',
    'research:validate_citations'
  ]

  it('registers all 6 research tools in mainToolRegistry with proper schemas', () => {
    for (const toolId of researchToolIds) {
      const tool = mainToolRegistry.get(toolId)
      expect(tool).toBeDefined()
      expect(tool?.id).toBe(toolId)
      expect(tool?.inputSchema).toBeDefined()
      expect(tool?.outputSchema).toBeDefined()
      expect(tool?.category).toBe('system')
      expect(tool?.requiredCapabilities.length).toBeGreaterThan(0)
    }
  })

  it('verifies capability requirements on research tools', () => {
    const searchTool = mainToolRegistry.get('research:web_search')
    expect(searchTool?.requiredCapabilities).toContain('research:webSearch')

    const extractTabTool = mainToolRegistry.get('research:extract_tab_content')
    expect(extractTabTool?.requiredCapabilities).toContain('research:extractContent')

    const screenshotTool = mainToolRegistry.get('research:capture_tab_screenshot')
    expect(screenshotTool?.requiredCapabilities).toContain('research:captureScreenshot')

    const citationsTool = mainToolRegistry.get('research:validate_citations')
    expect(citationsTool?.requiredCapabilities).toContain('research:manageResults')
  })

  it('dispatches research tools through the main dispatcher', async () => {
    const dispatcher = createMainToolDispatcher()
    const execContext: ToolExecutionContext = {
      taskId: 'task_research_dispatch_1',
      stepId: 'step_1',
      conversationId: 'conv_research_dispatch_1'
    }

    // 1. Web search
    const searchDef = mainToolRegistry.get('research:web_search')!
    const searchResult = (await dispatcher.dispatch(
      searchDef,
      { query: 'artificial intelligence ethics', maxResults: 2 },
      execContext
    )) as any

    expect(searchResult).toBeDefined()
    expect(searchResult.query).toBe('artificial intelligence ethics')
    expect(searchResult.results.length).toBeGreaterThan(0)

    // 2. Extract content from URL
    const extractDef = mainToolRegistry.get('research:extract_url_content')!
    const extractResult = (await dispatcher.dispatch(
      extractDef,
      { url: 'https://example.org/ethics-guidelines' },
      execContext
    )) as any

    expect(extractResult).toBeDefined()
    expect(extractResult.id).toMatch(/^src_/)
    expect(extractResult.sourceUrl).toBe('https://example.org/ethics-guidelines')

    // 3. Validate citations
    const citDef = mainToolRegistry.get('research:validate_citations')!
    const citResult = (await dispatcher.dispatch(
      citDef,
      {
        conversationId: 'conv_research_dispatch_1',
        citations: [{ sourceUrl: 'https://example.org/ethics-guidelines', claimText: 'Ethics are essential' }]
      },
      execContext
    )) as any

    expect(citResult).toBeInstanceOf(Array)
    expect(citResult.length).toBe(1)
    expect(citResult[0].isVerified).toBe(true)
  })

  it('executes a multi-step research plan via TaskExecutionEngine', async () => {
    const dispatcher = createMainToolDispatcher()
    const engine = new TaskExecutionEngine(mainToolRegistry, dispatcher)

    const plan: TaskPlan = {
      id: 'plan_research_test_' + Date.now(),
      taskId: 'task_research_test_' + Date.now(),
      conversationId: 'conv_research_plan_test',
      version: '1.0.0',
      intent: 'Search for quantum computing topics and validate source citations',
      requiresTools: true,
      createdAt: Date.now(),
      steps: [
        {
          id: 'step_search',
          toolId: 'research:web_search',
          input: {
            query: 'quantum superposition',
            maxResults: 2
          },
          dependencies: [],
          description: 'Search web for quantum physics articles'
        },
        {
          id: 'step_extract',
          toolId: 'research:extract_url_content',
          input: {
            url: 'https://example.org/research/article-1'
          },
          dependencies: ['step_search'],
          description: 'Extract content from search destination'
        },
        {
          id: 'step_validate_citations',
          toolId: 'research:validate_citations',
          input: {
            conversationId: 'conv_research_plan_test',
            citations: [
              {
                sourceUrl: 'https://example.org/research/article-1',
                claimText: 'Superposition enables parallel state evaluation'
              }
            ]
          },
          dependencies: ['step_extract'],
          description: 'Verify research citations against extracted evidence'
        }
      ]
    }

    const executionResult = await engine.executePlan(plan)
    expect(executionResult.status).toBe('completed')
    expect(executionResult.stepResults['step_search'].status).toBe('completed')
    expect(executionResult.stepResults['step_extract'].status).toBe('completed')
    expect(executionResult.stepResults['step_validate_citations'].status).toBe('completed')

    const citOutput = executionResult.stepResults['step_validate_citations'].output as any
    expect(citOutput[0].isVerified).toBe(true)
  })
})

