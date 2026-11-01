import { describe, it, expect } from 'vitest'
import {
  validateIpcPayload,
  WindowMinimizeRequestSchema,
  WindowMaximizedChangeEventSchema,
  IpcException
} from '../../src/shared/ipc'

describe('Runtime Request & Event Validation', () => {
  it('successfully validates legitimate empty requests', () => {
    expect(() => validateIpcPayload(WindowMinimizeRequestSchema, undefined)).not.toThrow()
    expect(() => validateIpcPayload(WindowMinimizeRequestSchema, null)).not.toThrow()
    expect(() => validateIpcPayload(WindowMinimizeRequestSchema, {})).not.toThrow()
  })

  it('rejects unexpected primitive arguments with VALIDATION_ERROR', () => {
    expect(() => validateIpcPayload(WindowMinimizeRequestSchema, 'malicious_input')).toThrow(
      IpcException
    )

    try {
      validateIpcPayload(WindowMinimizeRequestSchema, 1337)
    } catch (err) {
      expect(err).toBeInstanceOf(IpcException)
      const ipcErr = err as IpcException
      expect(ipcErr.code).toBe('VALIDATION_ERROR')
      expect(ipcErr.message).toContain('Malformed IPC request payload')
    }
  })

  it('rejects unexpected object properties with VALIDATION_ERROR', () => {
    try {
      validateIpcPayload(WindowMinimizeRequestSchema, { unauthorizedField: 'exploit' })
    } catch (err) {
      expect(err).toBeInstanceOf(IpcException)
      const ipcErr = err as IpcException
      expect(ipcErr.code).toBe('VALIDATION_ERROR')
    }
  })

  it('validates event payloads strictly and rejects non-boolean types', () => {
    expect(validateIpcPayload(WindowMaximizedChangeEventSchema, true)).toBe(true)
    expect(validateIpcPayload(WindowMaximizedChangeEventSchema, false)).toBe(false)

    expect(() => validateIpcPayload(WindowMaximizedChangeEventSchema, 'true')).toThrow(
      IpcException
    )
    expect(() => validateIpcPayload(WindowMaximizedChangeEventSchema, null)).toThrow(
      IpcException
    )
  })
})
