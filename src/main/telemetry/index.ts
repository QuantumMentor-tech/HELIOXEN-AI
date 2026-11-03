/**
 * HELIOXEN AI — Step 28: Main Process Telemetry Services
 * Exports authoritative singleton instances for system telemetry, application discovery, and window discovery.
 */

import { SystemTelemetryManager } from './SystemTelemetryManager'
import { InstalledAppDiscoveryManager } from './InstalledAppDiscoveryManager'
import { WindowDiscoveryManager } from './WindowDiscoveryManager'

export * from './SystemTelemetryManager'
export * from './InstalledAppDiscoveryManager'
export * from './WindowDiscoveryManager'

export const systemTelemetryManager = new SystemTelemetryManager()
export const installedAppDiscoveryManager = new InstalledAppDiscoveryManager()
export const windowDiscoveryManager = new WindowDiscoveryManager()

