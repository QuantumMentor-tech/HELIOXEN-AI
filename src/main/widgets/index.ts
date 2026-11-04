/**
 * HELIOXEN AI — Step 39: Main Widgets Subsystem Barrel
 * Exports singletons and services for System Health, Network Monitor, and Weather.
 */

import * as os from 'os'
import * as path from 'path'
import { SystemHealthService } from './SystemHealthService'
import { NetworkMonitorService } from './NetworkMonitorService'
import { WeatherService } from './WeatherService'
import { OpenMeteoWeatherAdapter } from './OpenMeteoWeatherAdapter'
import { WidgetPreferencesManager } from './WidgetPreferencesManager'

export {
  SystemHealthService,
  NetworkMonitorService,
  WeatherService,
  OpenMeteoWeatherAdapter,
  WidgetPreferencesManager
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
  return path.join(os.tmpdir(), 'helioxen-widgets-default')
}

export const systemHealthService = new SystemHealthService()
export const networkMonitorService = new NetworkMonitorService()
export const weatherService = new WeatherService()
export const widgetPreferencesManager = new WidgetPreferencesManager({
  storageDir: resolveDefaultStorageDir()
})

