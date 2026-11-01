import { describe, it, expect } from 'vitest'
import {
  SecurityLogger,
  redactSensitiveData
} from '../../src/main/security/securityLogger'

describe('SecurityLogger and Sensitive Data Redaction', () => {
  it('redacts sensitive keys including key, secret, token, password, and credential', () => {
    const rawData = {
      apiKey: 'sk-1234567890abcdef',
      providerToken: 'bearer-secret-token',
      userPassword: 'plaintext-password',
      secretData: 'super-sensitive',
      safeField: 'normal-value',
      nested: {
        nestedCredential: 'nested-secret-value',
        nestedPublic: 'visible'
      }
    }

    const sanitized = redactSensitiveData(rawData)
    expect(sanitized).toBeDefined()
    expect(sanitized?.apiKey).toBe('[REDACTED]')
    expect(sanitized?.providerToken).toBe('[REDACTED]')
    expect(sanitized?.userPassword).toBe('[REDACTED]')
    expect(sanitized?.secretData).toBe('[REDACTED]')
    expect(sanitized?.safeField).toBe('normal-value')

    const nested = sanitized?.nested as Record<string, unknown>
    expect(nested.nestedCredential).toBe('[REDACTED]')
    expect(nested.nestedPublic).toBe('visible')
  })

  it('records security events in memory buffer with timestamps and redacted details', () => {
    const logger = new SecurityLogger(5)

    logger.logEvent('AUTHORIZATION_CHECK', 'renderer-main-window', 'PERMITTED', {
      capabilityId: 'window:minimize'
    })

    logger.logEvent('CREDENTIAL_OPERATION', 'system', 'DENIED', {
      secretKey: 'leaked-attempt',
      reason: 'Failed authorization'
    })

    const events = logger.getRecentEvents()
    expect(events.length).toBe(2)
    expect(events[0].type).toBe('AUTHORIZATION_CHECK')
    expect(events[0].outcome).toBe('PERMITTED')

    expect(events[1].type).toBe('CREDENTIAL_OPERATION')
    expect(events[1].outcome).toBe('DENIED')
    expect(events[1].details?.secretKey).toBe('[REDACTED]')
  })

  it('enforces maximum buffer size to prevent memory leaks', () => {
    const logger = new SecurityLogger(3)
    logger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED')
    logger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED')
    logger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED')
    logger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED')

    const events = logger.getRecentEvents()
    expect(events.length).toBe(3)
  })
})
