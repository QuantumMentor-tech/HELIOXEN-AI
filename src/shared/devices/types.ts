/**
 * HELIOXEN AI — Step 45: Android Device Integration Types
 * Contracts for device pairing, status inspection, capability enumeration,
 * and controlled allowlisted device actions.
 */

export type AndroidDeviceStatus =
  | 'connected'
  | 'unauthorized'
  | 'disconnected'
  | 'pairing_required'
  | 'offline'

export type AndroidConnectionType = 'usb' | 'wifi_pairing'

export type AndroidActionType =
  | 'ping'
  | 'get_device_properties'
  | 'get_battery_status'
  | 'get_screen_state'
  | 'send_test_intent'

export interface AndroidDevice {
  readonly id: string
  readonly serialNumber: string
  readonly model: string
  readonly manufacturer: string
  readonly androidVersion: string
  readonly sdkLevel: number
  readonly batteryPercent: number
  readonly isCharging: boolean
  readonly connectionType: AndroidConnectionType
  readonly status: AndroidDeviceStatus
  readonly isAuthorized: boolean
  readonly authorizedAt?: number
  readonly lastSeenAt: number
  readonly supportedCapabilities: readonly AndroidActionType[]
}

export interface AndroidPairingRequest {
  readonly deviceId: string
  readonly pairingMethod: 'adb_usb' | 'wireless_pair_code'
  readonly pairingCode?: string
}

export interface AndroidPairingResult {
  readonly success: boolean
  readonly deviceId: string
  readonly status: AndroidDeviceStatus
  readonly message: string
  readonly error?: string
}

export interface AndroidActionCommand {
  readonly deviceId: string
  readonly action: AndroidActionType
  readonly parameters?: Record<string, unknown>
}

export interface AndroidActionResult {
  readonly success: boolean
  readonly deviceId: string
  readonly action: AndroidActionType
  readonly data?: Record<string, unknown>
  readonly message: string
  readonly error?: string
  readonly executedAt: number
}

