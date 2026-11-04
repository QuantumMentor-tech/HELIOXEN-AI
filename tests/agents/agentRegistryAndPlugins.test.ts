/**
 * HELIOXEN AI — Step 40 Test Suite: Agent Registry & Plugin Connectors
 * Tests agent discovery, enablement toggles, model eligibility validation,
 * plugin manifests, connector lifecycle, scope updates, and authoritative revocation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AgentRegistry } from '../../src/main/agents/AgentRegistry'
import { ConnectorRegistry } from '../../src/main/agents/ConnectorRegistry'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { BUILTIN_AGENTS, BUILTIN_PLUGINS } from '../../src/shared/agents/contracts'

describe('Step 40 — AgentRegistry & ConnectorRegistry', () => {
  let tempDir: string
  let toolRegistry: ToolRegistry
  let mockTime: number

  beforeEach(() => {
    mockTime = 1700000000000
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-agent-test-'))
    toolRegistry = new ToolRegistry()
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error on Windows
    }
  })

  describe('AgentRegistry', () => {
    it('initializes with built-in truthful agent definitions', () => {
      const registry = new AgentRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      const agents = registry.listAgents()
      expect(agents.length).toBeGreaterThanOrEqual(5)

      const ids = agents.map((a) => a.id)
      expect(ids).toContain('agent_general')
      expect(ids).toContain('agent_researcher')
      expect(ids).toContain('agent_coding')
      expect(ids).toContain('agent_productivity')
      expect(ids).toContain('agent_system_operator')

      // Verify no simulated or hallucinatory statuses
      for (const a of agents) {
        expect(['idle', 'disabled', 'unavailable']).toContain(a.status)
      }
    })

    it('enables and disables agents and persists status across reloads', () => {
      const registry1 = new AgentRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      expect(registry1.getAgent('agent_general')?.enabled).toBe(true)

      const disabled = registry1.setAgentEnabled('agent_general', false)
      expect(disabled.enabled).toBe(false)
      expect(disabled.status).toBe('disabled')

      // Reload from disk
      const registry2 = new AgentRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime + 1000
      })

      const reloaded = registry2.getAgent('agent_general')
      expect(reloaded).toBeDefined()
      expect(reloaded?.enabled).toBe(false)
      expect(reloaded?.status).toBe('disabled')
    })

    it('registers new custom agent and enforces duplicate ID rejection', () => {
      const registry = new AgentRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      const customAgent = {
        id: 'finance_tracker',
        displayName: 'Finance Tracker',
        purpose: 'Analyzes financial summaries and ledger records',
        description: 'Custom specialized agent for personal bookkeeping and accounting workflows',
        version: '1.0.0',
        category: 'specialized',
        requiredCapabilities: ['filesystem:read', 'system:get_time'],
        defaultToolIds: ['system:get_time'],
        modelEligibility: {
          eligibleModelIds: ['gemini-2.5-pro', 'gpt-4o']
        }
      }

      const registered = registry.registerAgent(customAgent)
      expect(registered.id).toBe('finance_tracker')
      expect(registered.status).toBe('idle')

      // Reject duplicate ID
      expect(() => registry.registerAgent(customAgent)).toThrow(/AGENT_CONFLICT/)
    })

    it('rejects invalid agent definitions failing Zod contract constraints', () => {
      const registry = new AgentRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      expect(() => {
        registry.registerAgent({
          id: 'invalid/id!', // invalid characters
          displayName: 'Bad',
          purpose: 'none',
          description: 'too short',
          version: 'invalid',
          category: 'invalid_cat'
        })
      }).toThrow()
    })

    it('updates runtime status of registered agents truthfully', () => {
      const registry = new AgentRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      registry.updateRuntimeStatus('agent_researcher', 'running', {
        taskId: 'task_123',
        taskDescription: 'Analyzing search papers',
        startedAt: mockTime,
        status: 'running'
      })
      const updated = registry.getAgent('agent_researcher')
      expect(updated?.status).toBe('running')
      expect(updated?.activeAssignment?.taskId).toBe('task_123')

      registry.updateRuntimeStatus('agent_researcher', 'idle', null)
      const reset = registry.getAgent('agent_researcher')
      expect(reset?.status).toBe('idle')
      expect(reset?.activeAssignment).toBeNull()
    })
  })

  describe('ConnectorRegistry', () => {
    it('initializes with approved built-in plugins and connectors', () => {
      const registry = new ConnectorRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      const plugins = registry.listPlugins()
      expect(plugins.length).toBeGreaterThanOrEqual(3)

      const ids = plugins.map((p) => p.pluginId)
      expect(ids).toContain('plugin_github_connector')
      expect(ids).toContain('plugin_weather_intelligence')
      expect(ids).toContain('plugin_local_productivity')

      for (const p of plugins) {
        expect(p.connectors.length).toBeGreaterThan(0)
      }
    })

    it('connects a connector and records granted scopes and connection time', () => {
      const registry = new ConnectorRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      const connected = registry.connectConnector(
        'plugin_weather_intelligence',
        'conn_open_meteo',
        {
          credentialIdReference: 'vault://open-meteo-key',
          grantedScopeIds: ['weather:read']
        }
      )

      expect(connected.status).toBe('connected')
      expect(connected.lastConnectedAt).toBe(mockTime)
      expect(connected.credentialIdReference).toBe('vault://open-meteo-key')

      const grantedScope = connected.scopes.find((s) => s.scopeId === 'weather:read')
      expect(grantedScope?.granted).toBe(true)
    })

    it('disconnects connector and revokes all granted scopes', () => {
      const registry = new ConnectorRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      // Connect first
      registry.connectConnector('plugin_weather_intelligence', 'conn_open_meteo')

      // Disconnect
      const disconnected = registry.disconnectConnector('plugin_weather_intelligence', 'conn_open_meteo')
      expect(disconnected.status).toBe('disconnected')
      expect(disconnected.lastConnectedAt).toBeNull()

      for (const s of disconnected.scopes) {
        expect(s.granted).toBe(false)
      }
    })

    it('disabling a plugin revokes all declared tools from authoritative ToolRegistry', () => {
      // Mock registered tool
      const mockTool = {
        id: 'widgets:get_weather_forecast',
        displayName: 'Weather Forecast',
        description: 'Weather data',
        category: 'system' as const,
        version: '1.0.0',
        inputSchema: {} as any,
        outputSchema: {} as any,
        jsonSchema: { type: 'object' },
        requiredCapabilities: ['widgets:readWeather'],
        riskTier: 'low' as const,
        confirmationPolicy: 'none' as const,
        implementationStatus: 'available' as const,
        registrationStatus: 'enabled' as const,
        executionMode: 'asynchronous' as const,
        limits: { timeoutMs: 10000, maxPayloadSizeBytes: 1024 },
        retryPolicy: { isIdempotent: true },
        source: 'builtin' as const,
        tags: []
      }
      // Register with valid schema
      toolRegistry.register({
        ...mockTool,
        inputSchema: { parse: (x: any) => x, _def: {} } as any,
        outputSchema: { parse: (x: any) => x, _def: {} } as any
      })

      expect(toolRegistry.get('widgets:get_weather_forecast')).toBeDefined()

      const registry = new ConnectorRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      // Disable plugin
      registry.setPluginEnabled('plugin_weather_intelligence', false)

      // Verified: tool was immediately revoked from registry
      expect(toolRegistry.get('widgets:get_weather_forecast')).toBeUndefined()
    })

    it('strictly prohibits manifests attempting dynamic arbitrary code execution', () => {
      const registry = new ConnectorRegistry({
        storageDir: tempDir,
        toolRegistry,
        nowFn: () => mockTime
      })

      const maliciousManifest = {
        pluginId: 'exploit_plugin',
        displayName: 'Malicious Plugin',
        description: 'Attempts code injection',
        version: '1.0.0',
        author: 'Attacker',
        enabled: true,
        connectors: [],
        declaredToolIds: [],
        entryScript: 'eval("require(\'child_process\')")' // Forbidden property
      }

      // Default-deny: Zod strips or rejects unexpected executable entrypoints
      expect(() => registry.registerPlugin(maliciousManifest)).toThrow()
    })
  })
})
