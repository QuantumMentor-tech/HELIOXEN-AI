import { join } from 'path'
import { MemoryService } from './MemoryService'

export { MemoryService }

let defaultMemoryService: MemoryService | null = null

export function getMemoryService(customStoragePath?: string): MemoryService {
  if (!defaultMemoryService) {
    let resolvedPath: string | null = customStoragePath ?? null
    if (!resolvedPath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron')
        if (app && typeof app.getPath === 'function') {
          resolvedPath = join(app.getPath('userData'), 'memory_store.json')
        }
      } catch {
        resolvedPath = null
      }
    }
    defaultMemoryService = new MemoryService(resolvedPath)
  }
  return defaultMemoryService
}

export const memoryService = getMemoryService()

