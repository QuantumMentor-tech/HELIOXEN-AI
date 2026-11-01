import { AiProviderId } from '../../shared/ai/types'
import {
  ProviderHealthRecord,
  ProviderHealthStatus
} from '../../shared/ai/routing'
import { AiErrorCode } from './errors'
import { securityLogger } from '../security/securityLogger'

export const HEALTH_CONFIG = {
  /** Maximum time (ms) a healthy observation remains valid before returning to unknown (5 minutes) */
  HEALTHY_TTL_MS: 5 * 60 * 1000,
  /** Duration (ms) a provider remains blocked after rate limiting (60 seconds) */
  RATE_LIMIT_COOLDOWN_MS: 60 * 1000,
  /** Duration (ms) a provider remains blocked after circuit breaker trip (30 seconds) */
  CIRCUIT_BREAKER_COOLDOWN_MS: 30 * 1000,
  /** Number of consecutive network/server failures required to trip circuit breaker */
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3
}

export class ProviderHealthService {
  private healthRecords: Map<AiProviderId, ProviderHealthRecord> = new Map()

  constructor() {
    this.reset()
  }

  /**
   * Resets health state to unknown baseline.
   */
  public reset(provider?: AiProviderId): void {
    const providers: AiProviderId[] = provider ? [provider] : ['google-gemini', 'openai']
    for (const p of providers) {
      this.healthRecords.set(p, {
        provider: p,
        status: 'unknown',
        consecutiveFailures: 0
      })
    }
  }

  /**
   * Records a verified successful provider interaction.
   * Clears failure streaks and resets circuit breaker.
   */
  public recordSuccess(provider: AiProviderId): void {
    const record = this.healthRecords.get(provider) || {
      provider,
      status: 'unknown',
      consecutiveFailures: 0
    }

    record.status = 'healthy'
    record.consecutiveFailures = 0
    record.lastSuccessTimestamp = Date.now()
    record.lastErrorMessage = undefined
    record.rateLimitResetTimestamp = undefined
    record.cooldownUntilTimestamp = undefined

    this.healthRecords.set(provider, record)

    securityLogger.logEvent('HEALTH_UPDATE', 'health-service', 'PERMITTED', {
      provider,
      status: 'healthy'
    })
  }

  /**
   * Records a provider failure and updates health states accordingly.
   * Differentiates model-specific issues from provider outages and rate limits.
   */
  public recordFailure(
    provider: AiProviderId,
    errorOrCode: AiErrorCode | { code: AiErrorCode; message: string } | Error,
    message?: string
  ): void {
    const now = Date.now()
    const record = this.healthRecords.get(provider) || {
      provider,
      status: 'unknown',
      consecutiveFailures: 0
    }

    const errorCode: AiErrorCode =
      typeof errorOrCode === 'object' && 'code' in errorOrCode
        ? (errorOrCode.code as AiErrorCode)
        : (errorOrCode as AiErrorCode)

    const errorMessage =
      message ||
      (typeof errorOrCode === 'object' && 'message' in errorOrCode
        ? errorOrCode.message
        : '')

    if (errorCode !== 'INVALID_MODEL') {
      record.consecutiveFailures += 1
    }
    record.lastFailureTimestamp = now
    record.lastErrorMessage = errorMessage

    switch (errorCode) {
      case 'AUTHENTICATION_FAILED':
        record.status = 'auth-failed'
        break

      case 'RATE_LIMIT_EXCEEDED':
        record.status = 'rate-limited'
        record.rateLimitResetTimestamp = now + HEALTH_CONFIG.RATE_LIMIT_COOLDOWN_MS
        break

      case 'NETWORK_ERROR':
      case 'TIMEOUT':
      case 'PROVIDER_ERROR':
        if (record.consecutiveFailures >= HEALTH_CONFIG.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
          record.status = 'unavailable'
          record.cooldownUntilTimestamp = now + HEALTH_CONFIG.CIRCUIT_BREAKER_COOLDOWN_MS
        } else {
          record.status = 'degraded'
        }
        break

      case 'INVALID_MODEL':
        // Model-specific error does NOT fail the entire provider
        if (record.status !== 'auth-failed' && record.status !== 'unavailable') {
          record.status = 'degraded'
        }
        break

      case 'CANCELLED':
      case 'MISSING_CREDENTIAL':
      case 'INTERNAL_ERROR':
        // Not a provider endpoint failure; do not change endpoint health
        break

      default:
        record.status = 'degraded'
        break
    }

    this.healthRecords.set(provider, record)

    securityLogger.logEvent('HEALTH_UPDATE', 'health-service', 'DENIED', {
      provider,
      status: record.status,
      errorCode,
      consecutiveFailures: record.consecutiveFailures
    })
  }

  /**
   * Evaluates state expiry and returns the active health record.
   */
  public getHealth(provider: AiProviderId): ProviderHealthRecord {
    const record = this.healthRecords.get(provider) || {
      provider,
      status: 'unknown',
      consecutiveFailures: 0
    }

    const now = Date.now()

    // 1. Check rate limit expiry
    if (record.status === 'rate-limited') {
      if (record.rateLimitResetTimestamp && now >= record.rateLimitResetTimestamp) {
        record.status = 'degraded' // half-open state allowing retry
        record.rateLimitResetTimestamp = undefined
      }
    }

    // 2. Check circuit breaker cooldown expiry
    if (record.status === 'unavailable') {
      if (record.cooldownUntilTimestamp && now >= record.cooldownUntilTimestamp) {
        record.status = 'degraded' // half-open state allowing retry probe
        record.cooldownUntilTimestamp = undefined
      }
    }

    // 3. Check healthy observation TTL expiry
    if (record.status === 'healthy') {
      if (
        record.lastSuccessTimestamp &&
        now - record.lastSuccessTimestamp > HEALTH_CONFIG.HEALTHY_TTL_MS
      ) {
        record.status = 'unknown' // stale evidence
      }
    }

    this.healthRecords.set(provider, record)
    return { ...record }
  }

  public getHealthRecord(provider: AiProviderId): ProviderHealthRecord {
    return this.getHealth(provider)
  }

  /**
   * Determines whether the provider is currently eligible to receive requests.
   */
  public isProviderAvailable(provider: AiProviderId): boolean {
    const health = this.getHealth(provider)
    return (
      health.status !== 'auth-failed' &&
      health.status !== 'unavailable' &&
      health.status !== 'rate-limited'
    )
  }

  /**
   * Returns current health records for all approved providers.
   */
  public getAllHealth(): Record<AiProviderId, ProviderHealthRecord> {
    return {
      'google-gemini': this.getHealth('google-gemini'),
      openai: this.getHealth('openai')
    }
  }
}
