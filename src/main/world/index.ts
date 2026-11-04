/**
 * HELIOXEN AI — Step 38: World Monitor, Interactive Globe, Geographic Maps, and News Intelligence
 * Barrel export and singleton factory for main-process World Monitor service.
 */

import * as os from 'os'
import * as path from 'path'
import {
  WorldMonitorService,
  GdeltDocPublicApiAdapter,
  NasaEarthObservatoryFeedAdapter,
  parseSafeRssItems
} from './WorldMonitorService'
import type {
  WorldMonitorServiceOptions,
  WorldNewsSourceAdapter,
  RawAdapterNewsItem
} from './WorldMonitorService'
import { systemOperationManager } from '../interaction'

export {
  WorldMonitorService,
  GdeltDocPublicApiAdapter,
  NasaEarthObservatoryFeedAdapter,
  parseSafeRssItems
}

export type {
  WorldMonitorServiceOptions,
  WorldNewsSourceAdapter,
  RawAdapterNewsItem
}

let defaultWorldMonitorService: WorldMonitorService | null = null

function resolveDefaultStorageDir(customStorageDir?: string): string {
  if (customStorageDir) return customStorageDir
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    // Fallback outside Electron runtime
  }
  return path.join(os.tmpdir(), 'helioxen-worldmonitor-default')
}

export function getWorldMonitorService(customStorageDir?: string): WorldMonitorService {
  if (!defaultWorldMonitorService) {
    const resolvedDir = resolveDefaultStorageDir(customStorageDir)
    defaultWorldMonitorService = new WorldMonitorService({
      storageDir: resolvedDir,
      openExternalUrlFn: async (url: string) => {
        await systemOperationManager.openExternalUrl({ url })
      }
    })
  }
  return defaultWorldMonitorService
}

export const worldMonitorService = getWorldMonitorService()
