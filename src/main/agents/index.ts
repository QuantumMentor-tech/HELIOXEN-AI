/**
 * HELIOXEN AI — Step 40: Main Agents Subsystem Barrel
 * Exports singletons and services for Agent Town, Plugin Connectors, and Dynamic Skills.
 */

import * as os from 'os'
import * as path from 'path'
import { AgentRegistry } from './AgentRegistry'
import { ConnectorRegistry } from './ConnectorRegistry'
import { DynamicSkillsManager } from './DynamicSkillsManager'
import { MultiAgentCoordinator } from './MultiAgentCoordinator'
import { AgentTownService } from './AgentTownService'
import { mainToolRegistry } from '../tools'
import { mainExecutionEngine } from '../orchestration'

export {
  AgentRegistry,
  ConnectorRegistry,
  DynamicSkillsManager,
  MultiAgentCoordinator,
  AgentTownService
}

function resolveDefaultStorageDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    // Fallback outside Electron
  }
  return path.join(os.tmpdir(), 'helioxen-agenttown-default')
}

let providerServiceGetter: (() => any) | undefined

export function setAgentTownProviderServiceGetter(getter: () => any): void {
  providerServiceGetter = getter
}

export const agentTownService = new AgentTownService({
  storageDir: resolveDefaultStorageDir(),
  toolRegistry: mainToolRegistry,
  executionEngine: mainExecutionEngine,
  providerServiceGetter: () => (providerServiceGetter ? providerServiceGetter() : null)
})

