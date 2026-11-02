/**
 * HELIOXEN AI — Main Process Tool Registry Service
 * Initializes the authoritative ToolRegistry with the approved built-in catalog.
 */

import { ToolRegistry, BUILTIN_TOOL_CATALOG } from '../../shared/tools'

export function createMainToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry()
  for (const tool of BUILTIN_TOOL_CATALOG) {
    registry.register(tool)
  }
  return registry
}

export const mainToolRegistry = createMainToolRegistry()
