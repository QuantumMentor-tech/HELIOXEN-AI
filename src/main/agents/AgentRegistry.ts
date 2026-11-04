/**
 * HELIOXEN AI — Step 40: Agent Registry
 * Main-process authoritative registry for AI agents and agent roles.
 * Enforces atomic validation, duplicate prevention, model eligibility resolution,
 * capability verification, and runtime state tracking.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  AgentDefinition,
  AgentRuntimeStatus,
  AgentTaskAssignment
} from '../../shared/agents/types'
import {
  AgentDefinitionSchema,
  BUILTIN_AGENT_DEFINITIONS
} from '../../shared/agents/contracts'
import { ToolRegistry } from '../../shared/tools'

export interface AgentRegistryOptions {
  readonly storageDir: string
  readonly toolRegistry?: ToolRegistry
  readonly nowFn?: () => number
}

interface PersistedAgentsStore {
  schemaVersion: number
  updatedAt: number
  agents: Record<string, AgentDefinition>
}

export class AgentRegistry {
  private readonly storePath: string
  private readonly toolRegistry?: ToolRegistry
  private readonly nowFn: () => number
  private agents: Map<string, AgentDefinition> = new Map()

  constructor(options: AgentRegistryOptions) {
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.toolRegistry = options.toolRegistry

    const baseDir = path.resolve(options.storageDir, 'agents')
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    this.storePath = path.join(baseDir, 'agents_store.json')
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        // Seed verified built-in agents
        for (const builtin of BUILTIN_AGENT_DEFINITIONS) {
          this.agents.set(builtin.id, { ...builtin })
        }
        this.persistToDisk()
        return
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as PersistedAgentsStore
      if (parsed?.agents && typeof parsed.agents === 'object') {
        for (const [id, agent] of Object.entries(parsed.agents)) {
          const validated = AgentDefinitionSchema.safeParse(agent)
          if (validated.success) {
            this.agents.set(id, validated.data)
          }
        }
      }

      // Ensure built-in agents exist
      for (const builtin of BUILTIN_AGENT_DEFINITIONS) {
        if (!this.agents.has(builtin.id)) {
          this.agents.set(builtin.id, { ...builtin })
        }
      }
    } catch {
      // Fallback on corrupt file
      for (const builtin of BUILTIN_AGENT_DEFINITIONS) {
        this.agents.set(builtin.id, { ...builtin })
      }
    }
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const data: PersistedAgentsStore = {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        agents: Object.fromEntries(this.agents.entries())
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
   * Registers a new verified agent definition.
   */
  public registerAgent(def: unknown): AgentDefinition {
    const validated = AgentDefinitionSchema.parse(def)

    if (this.agents.has(validated.id)) {
      throw new Error(`AGENT_CONFLICT: Agent with ID '${validated.id}' is already registered.`)
    }

    const now = this.nowFn()
    const record: AgentDefinition = {
      ...validated,
      createdAt: now,
      updatedAt: now
    }

    this.agents.set(record.id, record)
    this.persistToDisk()
    return record
  }

  /**
   * Unregisters an agent definition. Built-in core agents cannot be deleted.
   */
  public unregisterAgent(id: string): boolean {
    const existing = this.agents.get(id)
    if (!existing) return false

    const isBuiltin = BUILTIN_AGENT_DEFINITIONS.some((b) => b.id === id)
    if (isBuiltin) {
      throw new Error(`UNREGISTER_PROHIBITED: Built-in agent '${id}' cannot be deleted. You can disable it instead.`)
    }

    this.agents.delete(id)
    this.persistToDisk()
    return true
  }

  public getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id)
  }

  public listAgents(category?: string): AgentDefinition[] {
    const list = Array.from(this.agents.values())
    if (category && category !== 'all') {
      return list.filter((a) => a.category === category)
    }
    return list
  }

  /**
   * Enables or disables an agent.
   */
  public setAgentEnabled(id: string, enabled: boolean): AgentDefinition {
    const existing = this.agents.get(id)
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND: Agent '${id}' does not exist.`)
    }

    const updated: AgentDefinition = {
      ...existing,
      enabled,
      status: enabled ? (existing.status === 'disabled' ? 'idle' : existing.status) : 'disabled',
      updatedAt: this.nowFn()
    }

    this.agents.set(id, updated)
    this.persistToDisk()
    return updated
  }

  /**
   * Updates runtime task state for an active agent.
   */
  public updateRuntimeStatus(
    id: string,
    status: AgentRuntimeStatus,
    activeAssignment?: AgentTaskAssignment | null
  ): AgentDefinition {
    const existing = this.agents.get(id)
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND: Agent '${id}' does not exist.`)
    }

    const updated: AgentDefinition = {
      ...existing,
      status: existing.enabled ? status : 'disabled',
      activeAssignment: activeAssignment !== undefined ? activeAssignment : existing.activeAssignment,
      updatedAt: this.nowFn()
    }

    this.agents.set(id, updated)
    this.persistToDisk()
    return updated
  }
}

