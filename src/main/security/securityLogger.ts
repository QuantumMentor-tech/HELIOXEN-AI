/**
 * Auditable security event logging for HELIOXEN AI.
 * Enforces strict redaction to prevent secret leakage into logs or diagnostics.
 */

export type SecurityEventType =
  | 'AUTHORIZATION_CHECK'
  | 'CREDENTIAL_OPERATION'
  | 'PERMISSION_REQUEST'
  | 'CONSENT_REQUEST'
  | 'CATALOG_OPERATION'
  | 'PREFERENCES_OPERATION'
  | 'ROUTING_DECISION'
  | 'HEALTH_UPDATE'
  | 'SEND_CONFIRMATION_REQUEST'
  | 'MESSAGE_SEND'
  | 'INTEGRATION_CONNECT'
  | 'INTEGRATION_DISCONNECT'
  | 'MEDIA_CONTROL_ACTION'
  | 'DEVICE_PAIRING'
  | 'DEVICE_ACTION'
  | 'SMART_HOME_ACTION'
  | 'SMART_HOME_SECURITY_CONFIRMATION'
  | 'RECOVERY_CRASH_DETECTED'
  | 'RECOVERY_STARTUP_CHECK'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE'
  | 'BACKUP_RETENTION'
  | 'SELF_REPAIR_DIAGNOSTIC'
  | 'SELF_REPAIR_ACTION'

export type SecurityOutcome = 'PERMITTED' | 'DENIED' | 'CANCELLED' | 'ERROR'

export interface SecurityEvent {
  id: string
  timestamp: number
  type: SecurityEventType
  capabilityId?: string
  requester: string
  outcome: SecurityOutcome
  reason?: string
  details?: Record<string, unknown>
}

// Regex matching sensitive keys that must never be recorded in plaintext
const SENSITIVE_KEY_PATTERN = /key|secret|token|password|auth|credential|api_key|bearer/i

/**
 * Redacts any potential sensitive keys from a details payload recursively, including nested objects and arrays.
 */
export function redactSensitiveData(data?: unknown): any {
  if (!data) return data
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map((item) => {
      if (item && typeof item === 'object') {
        return redactSensitiveData(item)
      }
      return item
    })
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = redactSensitiveData(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export class SecurityLogger {
  private static instance: SecurityLogger | null = null
  private eventLog: SecurityEvent[] = []

  constructor(private readonly maxLogEntries = 200) {}

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger()
    }
    return SecurityLogger.instance
  }

  public logEvent(
    type: SecurityEventType,
    requester: string,
    outcome: SecurityOutcome,
    options?: {
      capabilityId?: string
      reason?: string
      details?: Record<string, unknown>
      [key: string]: unknown
    }
  ): SecurityEvent {
    const { capabilityId, reason, details, ...rest } = options ?? {}
    const rawDetails = { ...(details ?? {}), ...rest }
    const hasDetails = Object.keys(rawDetails).length > 0

    const event: SecurityEvent = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      requester,
      outcome,
      capabilityId: capabilityId as string | undefined,
      reason: reason as string | undefined,
      details: hasDetails ? redactSensitiveData(rawDetails) : undefined
    }

    this.eventLog.push(event)
    while (this.eventLog.length > this.maxLogEntries) {
      this.eventLog.shift()
    }

    return event
  }

  public getRecentEvents(limit = 50): readonly SecurityEvent[] {
    return this.eventLog.slice(-limit)
  }

  public clear(): void {
    this.eventLog = []
  }
}

export const securityLogger = SecurityLogger.getInstance()
