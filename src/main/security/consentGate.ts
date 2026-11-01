import { securityLogger } from './securityLogger'

export interface ConsentRequest {
  requestId: string
  capabilityId: string
  targetSummary: string
  createdAt: number
  expiresAt: number
  isResolved: boolean
  isApproved: boolean
}

/**
 * Two-Tier Human Confirmation Gate.
 * Enforces explicit user consent for high-risk operations and binds approval
 * strictly to the specific requested action and parameters.
 */
export class ConsentGate {
  private activeRequests: Map<string, ConsentRequest> = new Map()
  private readonly defaultTtlMs = 60000 // 60 seconds TTL

  /**
   * Generates a unique, short-lived consent request bound to a capability and target summary.
   */
  public createRequest(capabilityId: string, targetSummary: string): ConsentRequest {
    const requestId = `consent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const now = Date.now()

    const request: ConsentRequest = {
      requestId,
      capabilityId,
      targetSummary,
      createdAt: now,
      expiresAt: now + this.defaultTtlMs,
      isResolved: false,
      isApproved: false
    }

    this.activeRequests.set(requestId, request)

    securityLogger.logEvent('CONSENT_REQUEST', 'system', 'PERMITTED', {
      capabilityId,
      details: { requestId, targetSummary }
    })

    return request
  }

  /**
   * Resolves a pending consent request with user decision.
   */
  public resolveRequest(requestId: string, approved: boolean): boolean {
    const request = this.activeRequests.get(requestId)
    if (!request || request.isResolved) {
      return false
    }

    if (Date.now() > request.expiresAt) {
      this.activeRequests.delete(requestId)
      securityLogger.logEvent('CONSENT_REQUEST', 'user', 'DENIED', {
        capabilityId: request.capabilityId,
        reason: 'Consent request expired prior to user resolution'
      })
      return false
    }

    request.isResolved = true
    request.isApproved = approved

    securityLogger.logEvent(
      'CONSENT_REQUEST',
      'user',
      approved ? 'PERMITTED' : 'CANCELLED',
      {
        capabilityId: request.capabilityId,
        reason: approved ? 'User approved operation' : 'User cancelled operation'
      }
    )

    return true
  }

  /**
   * Verifies that a valid, unexpired approval exists for this operation, then consumes it (one-time use).
   */
  public consumeConsent(requestId: string, expectedCapabilityId: string): boolean {
    const request = this.activeRequests.get(requestId)
    if (!request) return false

    // Single-use: remove after check
    this.activeRequests.delete(requestId)

    if (Date.now() > request.expiresAt) return false
    if (!request.isResolved || !request.isApproved) return false
    if (request.capabilityId !== expectedCapabilityId) return false

    return true
  }

  public clear(): void {
    this.activeRequests.clear()
  }
}

export const consentGate = new ConsentGate()
