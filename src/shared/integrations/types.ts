/**
 * HELIOXEN AI — Step 44: Integration Layer Common Types
 * Common contracts for connecting, managing, and authenticating external integrations.
 */

export type IntegrationCategory = 'communication' | 'media' | 'device' | 'smart_home'

export type IntegrationConnectionStatus =
  | 'not_configured'
  | 'disconnected'
  | 'awaiting_authorization'
  | 'connected'
  | 'limited_permissions'
  | 'auth_expired'
  | 'rate_limited'
  | 'connection_failed'

export interface IntegrationScopeDefinition {
  readonly scopeId: string
  readonly displayName: string
  readonly description: string
  readonly isWrite: boolean
  readonly riskTier: 'low' | 'moderate' | 'high'
}

export interface IntegrationDescriptor {
  readonly id: string
  readonly connectorId: string
  readonly displayName: string
  readonly category: IntegrationCategory
  readonly description: string
  readonly iconName: string
  readonly providerDocUrl: string
  readonly status: IntegrationConnectionStatus
  readonly availableScopes: readonly IntegrationScopeDefinition[]
  readonly grantedScopes: readonly string[]
  readonly connectedAccountLabel?: string
  readonly connectedAt?: number
  readonly lastHealthCheckAt?: number
  readonly isHealthy: boolean
  readonly healthMessage?: string
  readonly limitations: readonly string[]
  readonly supportedProtocols: readonly ('oauth2_pkce' | 'api_key' | 'webhook' | 'local_system')[]
}

export interface ConnectIntegrationRequest {
  readonly integrationId: string
  readonly accountLabel?: string
  readonly scopes?: readonly string[]
  readonly credentials?: Record<string, string> // In-memory during auth handshake, immediately saved to secure vault
}

export interface DisconnectIntegrationRequest {
  readonly integrationId: string
  readonly revokeRemote?: boolean
}

export interface IntegrationOperationResult {
  readonly success: boolean
  readonly integrationId: string
  readonly message: string
  readonly descriptor?: IntegrationDescriptor
  readonly error?: string
}

