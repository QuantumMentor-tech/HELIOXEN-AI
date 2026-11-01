import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProviderHealthService } from '../../src/main/ai/ProviderHealthService'
import { AiProviderException } from '../../src/main/ai/errors'

describe('ProviderHealthService (Evidence-Based Provider Health & Circuit Breaking)', () => {
  let healthService: ProviderHealthService

  beforeEach(() => {
    healthService = new ProviderHealthService()
  })

  it('initializes provider health status as unknown with 0 consecutive failures', () => {
    const gemini = healthService.getHealthRecord('google-gemini')
    const openAi = healthService.getHealthRecord('openai')

    expect(gemini.status).toBe('unknown')
    expect(gemini.consecutiveFailures).toBe(0)
    expect(openAi.status).toBe('unknown')
    expect(openAi.consecutiveFailures).toBe(0)

    // Initially available because not blocked
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)
  })

  it('records successful requests and updates status to healthy with reset failure count', () => {
    healthService.recordSuccess('google-gemini')
    const record = healthService.getHealthRecord('google-gemini')

    expect(record.status).toBe('healthy')
    expect(record.consecutiveFailures).toBe(0)
    expect(record.lastSuccessTimestamp).toBeDefined()
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)
  })

  it('records authentication rejection as auth-failed and marks provider unavailable', () => {
    const authError = new AiProviderException({
      code: 'AUTHENTICATION_FAILED',
      provider: 'google-gemini',
      message: 'Invalid API key'
    })

    healthService.recordFailure('google-gemini', authError)
    const record = healthService.getHealthRecord('google-gemini')

    expect(record.status).toBe('auth-failed')
    expect(record.lastErrorMessage).toContain('Invalid API key')
    expect(healthService.isProviderAvailable('google-gemini')).toBe(false)
  })

  it('records rate limit error with 60-second cooldown and marks provider unavailable during cooldown', () => {
    const rateLimitError = new AiProviderException({
      code: 'RATE_LIMIT_EXCEEDED',
      provider: 'openai',
      message: 'Rate limit hit'
    })

    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    healthService.recordFailure('openai', rateLimitError)
    const record = healthService.getHealthRecord('openai')

    expect(record.status).toBe('rate-limited')
    expect(record.rateLimitResetTimestamp).toBe(now + 60_000)
    expect(healthService.isProviderAvailable('openai')).toBe(false)

    // After cooldown expires (61 seconds)
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    expect(healthService.isProviderAvailable('openai')).toBe(true)
    expect(healthService.getHealthRecord('openai').status).toBe('degraded')

    vi.restoreAllMocks()
  })

  it('trips circuit breaker to unavailable after 3 consecutive network failures', () => {
    const now = 1000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const netError = new AiProviderException({
      code: 'NETWORK_ERROR',
      provider: 'google-gemini',
      message: 'Connection timeout'
    })

    // Failure 1
    healthService.recordFailure('google-gemini', netError)
    expect(healthService.getHealthRecord('google-gemini').status).toBe('degraded')
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)

    // Failure 2
    healthService.recordFailure('google-gemini', netError)
    expect(healthService.getHealthRecord('google-gemini').status).toBe('degraded')
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)

    // Failure 3 -> Circuit breaker trips!
    healthService.recordFailure('google-gemini', netError)
    const record = healthService.getHealthRecord('google-gemini')
    expect(record.status).toBe('unavailable')
    expect(record.consecutiveFailures).toBe(3)
    expect(record.cooldownUntilTimestamp).toBe(now + 30_000)
    expect(healthService.isProviderAvailable('google-gemini')).toBe(false)

    // During cooldown, provider remains unavailable
    vi.spyOn(Date, 'now').mockReturnValue(now + 15_000)
    expect(healthService.isProviderAvailable('google-gemini')).toBe(false)

    // After 30s cooldown, half-open state: status degrades to allow a probe request
    vi.spyOn(Date, 'now').mockReturnValue(now + 31_000)
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)
    expect(healthService.getHealthRecord('google-gemini').status).toBe('degraded')

    // Successful probe restores healthy status
    healthService.recordSuccess('google-gemini')
    expect(healthService.getHealthRecord('google-gemini').status).toBe('healthy')
    expect(healthService.getHealthRecord('google-gemini').consecutiveFailures).toBe(0)

    vi.restoreAllMocks()
  })

  it('does not trip circuit breaker for model-specific INVALID_MODEL errors', () => {
    const modelError = new AiProviderException({
      code: 'INVALID_MODEL',
      provider: 'google-gemini',
      message: 'Model not found'
    })

    healthService.recordFailure('google-gemini', modelError)
    healthService.recordFailure('google-gemini', modelError)
    healthService.recordFailure('google-gemini', modelError)

    const record = healthService.getHealthRecord('google-gemini')
    // Consecutive failures for provider circuit breaker should not increment for model-level error
    expect(record.consecutiveFailures).toBe(0)
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)
  })

  it('expires healthy status to unknown after 5 minutes without evidence', () => {
    const now = 1000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    healthService.recordSuccess('google-gemini')
    expect(healthService.getHealthRecord('google-gemini').status).toBe('healthy')

    // 5 minutes + 1 second later
    vi.spyOn(Date, 'now').mockReturnValue(now + 300_001)
    expect(healthService.getHealthRecord('google-gemini').status).toBe('unknown')

    vi.restoreAllMocks()
  })

  it('resets provider health on manual intervention', () => {
    const authError = new AiProviderException({
      code: 'AUTHENTICATION_FAILED',
      provider: 'google-gemini',
      message: 'Revoked key'
    })
    healthService.recordFailure('google-gemini', authError)
    expect(healthService.isProviderAvailable('google-gemini')).toBe(false)

    healthService.reset('google-gemini')
    expect(healthService.getHealthRecord('google-gemini').status).toBe('unknown')
    expect(healthService.isProviderAvailable('google-gemini')).toBe(true)
  })
})
