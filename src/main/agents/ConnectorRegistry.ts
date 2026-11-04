/**
 * HELIOXEN AI — Step 40: Connector & Plugin Registry
 * Main-process governance for plugins, connector lifecycles, and tool activation.
 * Enforces default-deny registration, explicit scope separation, and clean tool unregistration on disablement.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  ConnectorConnectionStatus,
  ConnectorDescriptor,
  PluginManifest
} from '../../shared/agents/types'
import {
  BUILTIN_PLUGIN_MANIFESTS,
  PluginManifestSchema
} from '../../shared/agents/contracts'
import { ToolRegistry } from '../../shared/tools'

export interface ConnectorRegistryOptions {
  readonly storageDir: string
  readonly toolRegistry?: ToolRegistry
  readonly nowFn?: () => number
}

interface PersistedPluginsStore {
  schemaVersion: number
  updatedAt: number
  plugins: Record<string, PluginManifest>
}

export class ConnectorRegistry {
  private readonly storePath: string
  private readonly toolRegistry?: ToolRegistry
  private readonly nowFn: () => number
  private plugins: Map<string, PluginManifest> = new Map()

  constructor(options: ConnectorRegistryOptions) {
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.toolRegistry = options.toolRegistry

    const baseDir = path.resolve(options.storageDir, 'plugins')
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    this.storePath = path.join(baseDir, 'plugins_store.json')
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        for (const builtin of BUILTIN_PLUGIN_MANIFESTS) {
          this.plugins.set(builtin.pluginId, { ...builtin })
        }
        this.persistToDisk()
        return
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as PersistedPluginsStore
      if (parsed?.plugins && typeof parsed.plugins === 'object') {
        for (const [id, plugin] of Object.entries(parsed.plugins)) {
          const validated = PluginManifestSchema.safeParse(plugin)
          if (validated.success) {
            this.plugins.set(id, validated.data)
          }
        }
      }

      // Ensure built-in manifests exist
      for (const builtin of BUILTIN_PLUGIN_MANIFESTS) {
        if (!this.plugins.has(builtin.pluginId)) {
          this.plugins.set(builtin.pluginId, { ...builtin })
        }
      }
    } catch {
      for (const builtin of BUILTIN_PLUGIN_MANIFESTS) {
        this.plugins.set(builtin.pluginId, { ...builtin })
      }
    }
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const data: PersistedPluginsStore = {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        plugins: Object.fromEntries(this.plugins.entries())
      }

      const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
      try {
        fs.renameSync(tmpPath, this.storePath)
      } catch {
        try {
          fs.copyFileSync(tmpPath, this.storePath)
          fs.unlinkSync(tmpPath)
        } catch {
          fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8')
        }
      }
    } catch {
      // Keep memory copy intact
    }
  }

  /**
   * Registers a new verified plugin manifest.
   */
  public registerPlugin(manifest: unknown): PluginManifest {
    const validated = PluginManifestSchema.parse(manifest)

    if (this.plugins.has(validated.pluginId)) {
      throw new Error(`PLUGIN_CONFLICT: Plugin '${validated.pluginId}' is already registered.`)
    }

    const now = this.nowFn()
    const record: PluginManifest = {
      ...validated,
      installedAt: now,
      updatedAt: now
    }

    this.plugins.set(record.pluginId, record)
    this.persistToDisk()
    return record
  }

  public getPlugin(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId)
  }

  public listPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Enables or disables a plugin. When disabled, unregisters or disables its declared tools.
   */
  public setPluginEnabled(pluginId: string, enabled: boolean): PluginManifest {
    const existing = this.plugins.get(pluginId)
    if (!existing) {
      throw new Error(`PLUGIN_NOT_FOUND: Plugin '${pluginId}' does not exist.`)
    }

    const now = this.nowFn()
    const updated: PluginManifest = {
      ...existing,
      enabled,
      updatedAt: now
    }

    // Synchronize tools in authoritative ToolRegistry
    if (this.toolRegistry && existing.declaredToolIds.length > 0) {
      for (const toolId of existing.declaredToolIds) {
        if (!enabled) {
          try {
            this.toolRegistry.unregister(toolId)
          } catch {
            // Ignore if tool not found
          }
        }
      }
    }

    this.plugins.set(pluginId, updated)
    this.persistToDisk()
    return updated
  }

  /**
   * Updates granted scopes for a connector.
   */
  public updateScopes(pluginId: string, connectorId: string, grantedScopeIds: string[]): ConnectorDescriptor {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`PLUGIN_NOT_FOUND: Plugin '${pluginId}' does not exist.`)
    }

    const connIdx = plugin.connectors.findIndex((c) => c.connectorId === connectorId)
    if (connIdx === -1) {
      throw new Error(`CONNECTOR_NOT_FOUND: Connector '${connectorId}' not found in plugin '${pluginId}'.`)
    }

    const targetConnector = plugin.connectors[connIdx]
    const updatedScopes = targetConnector.scopes.map((s) => ({
      ...s,
      granted: grantedScopeIds.includes(s.scopeId)
    }))

    const updatedConnector: ConnectorDescriptor = {
      ...targetConnector,
      scopes: updatedScopes
    }

    const updatedConnectors = [...plugin.connectors]
    updatedConnectors[connIdx] = updatedConnector

    const updatedPlugin: PluginManifest = {
      ...plugin,
      connectors: updatedConnectors,
      updatedAt: this.nowFn()
    }

    this.plugins.set(pluginId, updatedPlugin)
    this.persistToDisk()
    return updatedConnector
  }

  /**
   * Connects a connector with validated authorization scopes.
   */
  public connectConnector(
    pluginId: string,
    connectorId: string,
    options: {
      credentialIdReference?: string | null
      grantedScopeIds?: string[]
    } = {}
  ): ConnectorDescriptor {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`PLUGIN_NOT_FOUND: Plugin '${pluginId}' does not exist.`)
    }

    const connIdx = plugin.connectors.findIndex((c) => c.connectorId === connectorId)
    if (connIdx === -1) {
      throw new Error(`CONNECTOR_NOT_FOUND: Connector '${connectorId}' not found in plugin '${pluginId}'.`)
    }

    const targetConnector = plugin.connectors[connIdx]
    const updatedScopes = targetConnector.scopes.map((s) => ({
      ...s,
      granted: options.grantedScopeIds ? options.grantedScopeIds.includes(s.scopeId) : s.granted
    }))

    const updatedConnector: ConnectorDescriptor = {
      ...targetConnector,
      status: 'connected',
      scopes: updatedScopes,
      credentialIdReference: options.credentialIdReference ?? targetConnector.credentialIdReference,
      lastConnectedAt: this.nowFn(),
      lastErrorMessage: null
    }

    const updatedConnectors = [...plugin.connectors]
    updatedConnectors[connIdx] = updatedConnector

    const updatedPlugin: PluginManifest = {
      ...plugin,
      connectors: updatedConnectors,
      updatedAt: this.nowFn()
    }

    this.plugins.set(pluginId, updatedPlugin)
    this.persistToDisk()
    return updatedConnector
  }

  /**
   * Disconnects a connector and revokes granted permissions.
   */
  public disconnectConnector(pluginId: string, connectorId: string): ConnectorDescriptor {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`PLUGIN_NOT_FOUND: Plugin '${pluginId}' does not exist.`)
    }

    const connIdx = plugin.connectors.findIndex((c) => c.connectorId === connectorId)
    if (connIdx === -1) {
      throw new Error(`CONNECTOR_NOT_FOUND: Connector '${connectorId}' not found in plugin '${pluginId}'.`)
    }

    const targetConnector = plugin.connectors[connIdx]
    const revokedScopes = targetConnector.scopes.map((s) => ({
      ...s,
      granted: false
    }))

    const updatedConnector: ConnectorDescriptor = {
      ...targetConnector,
      status: 'disconnected',
      scopes: revokedScopes,
      lastConnectedAt: null
    }

    const updatedConnectors = [...plugin.connectors]
    updatedConnectors[connIdx] = updatedConnector

    const updatedPlugin: PluginManifest = {
      ...plugin,
      connectors: updatedConnectors,
      updatedAt: this.nowFn()
    }

    this.plugins.set(pluginId, updatedPlugin)
    this.persistToDisk()
    return updatedConnector
  }
}
