import { CAPABILITIES, AllowedRequester } from '../../shared/security/capabilities'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from './securityLogger'
import { consentGate } from './consentGate'

export interface AuthorizationContext {
  requester: AllowedRequester
  consentRequestId?: string
  operationDescription?: string
}

export class Authorizer {
  /**
   * Evaluates authorization for an execution request.
   * Enforces least privilege, deny-by-default, and consent binding.
   * Throws IpcException if authorization fails.
   */
  public authorize(capabilityId: string, context: AuthorizationContext): boolean {
    const capability = CAPABILITIES[capabilityId]

    // 1. Deny unknown capabilities by default
    if (!capability) {
      securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'DENIED', {
        capabilityId,
        reason: 'Unknown capability: denied by default'
      })
      throw new IpcException(
        'UNAUTHORIZED_SENDER',
        `Access denied: Unknown or unregistered capability '${capabilityId}'`
      )
    }

    // 2. Reject permanently prohibited capabilities
    if (capability.status === 'prohibited' || capability.riskTier === 'prohibited') {
      securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'DENIED', {
        capabilityId,
        reason: 'Permanently prohibited capability requested'
      })
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Access denied: Capability '${capabilityId}' is permanently banned by security policy`
      )
    }

    // 3. Reject deferred roadmap capabilities
    if (capability.status === 'deferred') {
      securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'DENIED', {
        capabilityId,
        reason: 'Deferred roadmap capability requested before activation'
      })
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Access denied: Capability '${capabilityId}' belongs to a future roadmap milestone and is not yet active`
      )
    }

    // 4. Validate allowed requester origin
    if (capability.allowedRequester === 'main-only' && context.requester !== 'main-only') {
      securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'DENIED', {
        capabilityId,
        reason: 'Main-only capability attempted from unprivileged origin'
      })
      throw new IpcException(
        'UNAUTHORIZED_SENDER',
        `Access denied: Capability '${capabilityId}' is restricted to internal trusted main-process execution`
      )
    }

    // 5. Evaluate Two-Tier Human Confirmation Gate if required
    if (capability.requiresHumanConsent) {
      if (!context.consentRequestId) {
        securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'DENIED', {
          capabilityId,
          reason: 'High-risk operation requested without consent verification token'
        })
        throw new IpcException(
          'UNAUTHORIZED_SENDER',
          `Access denied: High-risk capability '${capabilityId}' requires explicit user confirmation`
        )
      }

      const isConsentValid = consentGate.consumeConsent(context.consentRequestId, capabilityId)
      if (!isConsentValid) {
        securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'DENIED', {
          capabilityId,
          reason: 'Consent token was invalid, expired, or rejected'
        })
        throw new IpcException(
          'OPERATION_UNAVAILABLE',
          `Access denied: Human confirmation was rejected or expired for '${capabilityId}'`
        )
      }
    }

    // 6. Record authorization grant
    securityLogger.logEvent('AUTHORIZATION_CHECK', context.requester, 'PERMITTED', {
      capabilityId,
      reason: `Authorized ${capability.riskTier}-risk capability for ${context.requester}`
    })

    return true
  }
}

export const authorizer = new Authorizer()
