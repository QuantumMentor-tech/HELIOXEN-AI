import { describe, it, expect } from 'vitest'
import { ConsentGate } from '../../src/main/security/consentGate'

describe('ConsentGate (Two-Tier Human Confirmation Gate)', () => {
  it('generates a unique, short-lived consent request bound to a capability and target', () => {
    const gate = new ConsentGate()
    const request = gate.createRequest('credentials:deleteAllSecrets', 'Purge all stored credentials')

    expect(request.requestId).toMatch(/^consent-/)
    expect(request.capabilityId).toBe('credentials:deleteAllSecrets')
    expect(request.targetSummary).toBe('Purge all stored credentials')
    expect(request.isResolved).toBe(false)
    expect(request.isApproved).toBe(false)
    expect(request.expiresAt).toBeGreaterThan(Date.now())
  })

  it('approves a request and allows single-use consumption', () => {
    const gate = new ConsentGate()
    const request = gate.createRequest('credentials:deleteAllSecrets', 'Purge all stored credentials')

    gate.resolveRequest(request.requestId, true)

    // First consumption succeeds
    const consumed = gate.consumeConsent(request.requestId, 'credentials:deleteAllSecrets')
    expect(consumed).toBe(true)

    // Second consumption (replay attack prevention) must fail
    const replay = gate.consumeConsent(request.requestId, 'credentials:deleteAllSecrets')
    expect(replay).toBe(false)
  })

  it('rejects consumption if user denied consent', () => {
    const gate = new ConsentGate()
    const request = gate.createRequest('credentials:deleteAllSecrets', 'Purge all stored credentials')

    gate.resolveRequest(request.requestId, false)

    const consumed = gate.consumeConsent(request.requestId, 'credentials:deleteAllSecrets')
    expect(consumed).toBe(false)
  })

  it('rejects consumption if capability ID does not match bound capability (action-binding)', () => {
    const gate = new ConsentGate()
    const request = gate.createRequest('credentials:deleteAllSecrets', 'Purge all stored credentials')

    gate.resolveRequest(request.requestId, true)

    // Attempting to use approval token for a different capability must fail
    const consumed = gate.consumeConsent(request.requestId, 'window:close')
    expect(consumed).toBe(false)
  })

  it('rejects consumption for non-existent or expired request IDs', () => {
    const gate = new ConsentGate()
    expect(gate.consumeConsent('invalid-nonexistent-id', 'credentials:deleteAllSecrets')).toBe(false)
  })
})
