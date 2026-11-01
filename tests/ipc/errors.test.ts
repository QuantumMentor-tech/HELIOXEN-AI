import { describe, it, expect } from 'vitest'
import { IpcException } from '../../src/shared/ipc'

describe('IPC Error Normalization and Exception Handling', () => {
  it('creates an IpcException with code, message, and details', () => {
    const err = new IpcException('UNAUTHORIZED_SENDER', 'Invalid sender WebContents', {
      senderId: 42
    })

    expect(err.code).toBe('UNAUTHORIZED_SENDER')
    expect(err.message).toBe('Invalid sender WebContents')
    expect(err.details).toEqual({ senderId: 42 })
    expect(err.name).toBe('IpcException')
  })

  it('serializes to safe payload without leaking internal stack traces', () => {
    const err = new IpcException('VALIDATION_ERROR', 'Field constraint violated', {
      field: 'root'
    })

    const payload = err.toPayload()
    expect(payload).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Field constraint violated',
      details: { field: 'root' }
    })

    // Verify stack is omitted from external payload
    expect((payload as unknown as Record<string, unknown>).stack).toBeUndefined()
  })

  it('reconstructs an IpcException from a serialized payload', () => {
    const original = new IpcException('OPERATION_UNAVAILABLE', 'Service window closed')
    const payload = original.toPayload()
    const reconstructed = IpcException.fromPayload(payload)

    expect(reconstructed).toBeInstanceOf(IpcException)
    expect(reconstructed.code).toBe('OPERATION_UNAVAILABLE')
    expect(reconstructed.message).toBe('Service window closed')
  })
})
