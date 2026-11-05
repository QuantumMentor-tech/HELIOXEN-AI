/**
 * HELIOXEN AI — Step 45: Android Device Validation & Contracts
 * Strict bounds checking, device identifier validation, and command parameter schemas.
 */

import { z } from 'zod'
import { AndroidActionType } from './types'

// Strict regex preventing command injection in device serial/identifier
export const SAFE_DEVICE_ID_REGEX = /^[a-zA-Z0-9.:_-]{1,128}$/

export function isValidDeviceId(deviceId: string): boolean {
  if (!deviceId || typeof deviceId !== 'string') return false
  return SAFE_DEVICE_ID_REGEX.test(deviceId.trim())
}

export const AndroidActionTypeSchema = z.enum([
  'ping',
  'get_device_properties',
  'get_battery_status',
  'get_screen_state',
  'send_test_intent'
])

export const AndroidPairingRequestSchema = z.object({
  deviceId: z.string().min(1).max(128).regex(SAFE_DEVICE_ID_REGEX, {
    message: 'Device ID contains invalid characters. Must be alphanumeric, dot, colon, underscore, or dash.'
  }),
  pairingMethod: z.enum(['adb_usb', 'wireless_pair_code']),
  pairingCode: z.string().max(32).optional()
})

export const AndroidActionCommandSchema = z.object({
  deviceId: z.string().min(1).max(128).regex(SAFE_DEVICE_ID_REGEX, {
    message: 'Device ID contains invalid characters.'
  }),
  action: AndroidActionTypeSchema,
  parameters: z.record(z.string(), z.unknown()).optional()
})

