/**
 * HELIOXEN AI — Step 28: Telemetry Tools & Orchestration Integration Tests
 */

import { describe, it, expect } from 'vitest'
import { mainToolRegistry } from '../../src/main/tools'
import { mainToolDispatcher, mainExecutionEngine } from '../../src/main/orchestration'
import { authorizer } from '../../src/main/security'
import { CAPABILITIES } from '../../src/shared/security/capabilities'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('Step 28: Telemetry Tools & Orchestration Integration', () => {
  it('registers Step 28 tools in authoritative ToolRegistry and BUILTIN_TOOL_CATALOG', () => {
    expect(mainToolRegistry.get('telemetry:get_system_health')).toBeDefined()
    expect(mainToolRegistry.get('system:list_installed_apps')).toBeDefined()
    expect(mainToolRegistry.get('system:list_windows')).toBeDefined()

    const healthMeta = mainToolRegistry.getMetadata('telemetry:get_system_health')
    expect(healthMeta?.riskTier).toBe('low')
    expect(healthMeta?.requiredCapabilities).toContain('telemetry:readSystemHealth')

    const appsMeta = mainToolRegistry.getMetadata('system:list_installed_apps')
    expect(appsMeta?.riskTier).toBe('moderate')
    expect(appsMeta?.requiredCapabilities).toContain('telemetry:readInstalledApps')

    const winMeta = mainToolRegistry.getMetadata('system:list_windows')
    expect(winMeta?.riskTier).toBe('moderate')
    expect(winMeta?.requiredCapabilities).toContain('telemetry:readDesktopWindows')
  })

  it('declares corresponding security capabilities in CAPABILITIES registry', () => {
    expect(CAPABILITIES['telemetry:readSystemHealth']).toBeDefined()
    expect(CAPABILITIES['telemetry:readSystemHealth'].riskTier).toBe('low')

    expect(CAPABILITIES['telemetry:readInstalledApps']).toBeDefined()
    expect(CAPABILITIES['telemetry:readInstalledApps'].riskTier).toBe('moderate')

    expect(CAPABILITIES['telemetry:readDesktopWindows']).toBeDefined()
    expect(CAPABILITIES['telemetry:readDesktopWindows'].riskTier).toBe('moderate')
  })

  it('authorizes renderer access for all Step 28 telemetry capabilities', () => {
    expect(() =>
      authorizer.authorize('telemetry:readSystemHealth', { requester: 'renderer-main-window' })
    ).not.toThrow()

    expect(() =>
      authorizer.authorize('telemetry:readInstalledApps', { requester: 'renderer-main-window' })
    ).not.toThrow()

    expect(() =>
      authorizer.authorize('telemetry:readDesktopWindows', { requester: 'renderer-main-window' })
    ).not.toThrow()
  })

  it('validates tool inputs via mainToolRegistry.validateInput', () => {
    const validHealth = mainToolRegistry.validateInput('telemetry:get_system_health', { sampleDurationMs: 100 })
    expect(validHealth.valid).toBe(true)

    const invalidHealth = mainToolRegistry.validateInput('telemetry:get_system_health', { sampleDurationMs: 10000 })
    expect(invalidHealth.valid).toBe(false)

    const validApps = mainToolRegistry.validateInput('system:list_installed_apps', { query: 'Code', limit: 10 })
    expect(validApps.valid).toBe(true)

    const validWindows = mainToolRegistry.validateInput('system:list_windows', { redactSensitiveTitles: true })
    expect(validWindows.valid).toBe(true)
  })

  it('dispatches telemetry:get_system_health to genuine manager handler', async () => {
    const toolDef = mainToolRegistry.get('telemetry:get_system_health')!
    const context = { taskId: 'task_telemetry_test', stepId: 'step_1', conversationId: 'conv_1' }

    const result = await mainToolDispatcher.dispatch(toolDef, { sampleDurationMs: 50 }, context)
    expect(result).toBeDefined()
    expect(result.os).toBeDefined()
    expect(result.cpu).toBeDefined()
    expect(result.memory).toBeDefined()
  })

  it('executes a multi-step task plan calling telemetry:get_system_health', async () => {
    const plan: TaskPlan = {
      id: 'plan_telemetry_exec',
      taskId: 'task_exec_telemetry',
      conversationId: 'conv_telemetry',
      version: '1.0.0',
      intent: 'Collect system health metrics for diagnostic overview',
      requiresTools: true,
      steps: [
        {
          id: 'step_telemetry',
          toolId: 'telemetry:get_system_health',
          description: 'Query CPU, memory, and storage metrics',
          input: { sampleDurationMs: 50 },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const execResult = await mainExecutionEngine.executePlan(plan)
    expect(execResult.status).toBe('completed')
    expect(execResult.stepResults['step_telemetry'].status).toBe('completed')
    expect((execResult.stepResults['step_telemetry'].output as any)?.cpu).toBeDefined()
  })
})
