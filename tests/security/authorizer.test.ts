import { describe, it, expect } from 'vitest'
import { Authorizer } from '../../src/main/security/authorizer'
import { IpcException } from '../../src/shared/ipc/errors'
import { consentGate } from '../../src/main/security/consentGate'

describe('Authorizer (Capability Authorization and Trust Boundaries)', () => {
  const authorizer = new Authorizer()

  it('permits authorized low-risk window capabilities for renderer', () => {
    expect(
      authorizer.authorize('window:minimize', { requester: 'renderer-main-window' })
    ).toBe(true)
    expect(
      authorizer.authorize('window:maximize', { requester: 'renderer-main-window' })
    ).toBe(true)
    expect(
      authorizer.authorize('window:close', { requester: 'renderer-main-window' })
    ).toBe(true)
    expect(
      authorizer.authorize('window:isMaximized', { requester: 'renderer-main-window' })
    ).toBe(true)
  })

  it('denies unknown capabilities by default (fail-closed)', () => {
    expect(() =>
      authorizer.authorize('unknown:arbitraryCapability', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)

    try {
      authorizer.authorize('system:formatDrive', { requester: 'renderer-main-window' })
    } catch (err) {
      expect((err as IpcException).code).toBe('UNAUTHORIZED_SENDER')
    }
  })

  it('permanently rejects prohibited capabilities regardless of requester', () => {
    expect(() =>
      authorizer.authorize('shell:executeCommand', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)

    expect(() =>
      authorizer.authorize('shell:executeCommand', { requester: 'main-only' })
    ).toThrow(IpcException)

    expect(() =>
      authorizer.authorize('os:runScript', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)
  })

  it('rejects deferred roadmap capabilities before their authorized phase', () => {
    expect(() =>
      authorizer.authorize('ai:providerInvoke', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)

    expect(() =>
      authorizer.authorize('audio:microphoneCapture', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)
  })

  it('denies main-only capabilities when attempted from renderer', () => {
    expect(() =>
      authorizer.authorize('credentials:storeSecret', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)

    expect(() =>
      authorizer.authorize('credentials:retrieveSecret', { requester: 'renderer-main-window' })
    ).toThrow(IpcException)
  })

  it('permits main-only capabilities when called strictly from internal main process', () => {
    expect(
      authorizer.authorize('credentials:storeSecret', { requester: 'main-only' })
    ).toBe(true)
    expect(
      authorizer.authorize('credentials:retrieveSecret', { requester: 'main-only' })
    ).toBe(true)
  })

  it('enforces human consent token verification for high-risk operations requiring confirmation', () => {
    // Attempting without consent token must fail
    expect(() =>
      authorizer.authorize('credentials:deleteAllSecrets', { requester: 'main-only' })
    ).toThrow(IpcException)

    // Create consent request and approve it
    const req = consentGate.createRequest(
      'credentials:deleteAllSecrets',
      'Purge all stored credentials'
    )
    consentGate.resolveRequest(req.requestId, true)

    // Authorize with valid consent token
    expect(
      authorizer.authorize('credentials:deleteAllSecrets', {
        requester: 'main-only',
        consentRequestId: req.requestId
      })
    ).toBe(true)

    // Attempting replay with already consumed consent token must fail
    expect(() =>
      authorizer.authorize('credentials:deleteAllSecrets', {
        requester: 'main-only',
        consentRequestId: req.requestId
      })
    ).toThrow(IpcException)
  })
})
