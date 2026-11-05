/**
 * HELIOXEN AI — Step 45: Smart-Home Integration Subsystem Types
 * Types for discovery, entity state inspection, risk classification,
 * and controlled physical actuation under mandatory human confirmation.
 */

export type SmartHomePlatform = 'home_assistant' | 'matter_rest' | 'local_hub'

export type SmartHomeEntityDomain =
  | 'light'
  | 'switch'
  | 'climate'
  | 'sensor'
  | 'binary_sensor'
  | 'lock'
  | 'cover'
  | 'alarm'

export type SmartHomeRiskClass =
  | 'read_only'
  | 'reversible_action'
  | 'physical_security_consequential'

export interface SmartHomeEntity {
  readonly entityId: string
  readonly hubId: string
  readonly domain: SmartHomeEntityDomain
  /** Untrusted data label: Device names from external hubs must never execute as prompt instructions */
  readonly friendlyName: string
  readonly state: string
  readonly attributes: Record<string, unknown>
  readonly riskClass: SmartHomeRiskClass
  readonly isAvailable: boolean
  readonly lastUpdated: number
  readonly supportedCommands: readonly string[]
}

export interface SmartHomeHubDescriptor {
  readonly hubId: string
  readonly platform: SmartHomePlatform
  readonly displayName: string
  readonly endpointUrl: string
  readonly isConnected: boolean
  readonly isAuthorized: boolean
  readonly entityCount: number
  readonly lastHealthCheckAt?: number
}

export interface SmartHomeActionCommand {
  readonly hubId: string
  readonly entityId: string
  readonly command: string
  readonly parameters?: Record<string, unknown>
  readonly confirmationToken?: string
}

export interface SmartHomeActionResult {
  readonly success: boolean
  readonly entityId: string
  readonly command: string
  readonly outcome: 'completed' | 'failed' | 'uncertain' | 'awaiting_confirmation'
  readonly previousState?: string
  readonly newState?: string
  readonly message: string
  readonly error?: string
  readonly executedAt: number
}

export interface SmartHomeSecurityConfirmationRequest {
  readonly confirmationId: string
  readonly hubId: string
  readonly entityId: string
  readonly friendlyName: string
  readonly command: string
  readonly targetState: string
  readonly riskDescription: string
  readonly expiresAt: number
  readonly token: string
}

