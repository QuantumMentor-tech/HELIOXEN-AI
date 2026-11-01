/**
 * Standardized IPC error codes across the HELIOXEN runtime.
 */
export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED_SENDER'
  | 'UNAUTHORIZED_FRAME'
  | 'OPERATION_UNAVAILABLE'
  | 'INTERNAL_ERROR'

/**
 * Normalized error envelope for structured IPC failure reporting.
 * Never leaks internal file paths, stack traces, or privileged memory.
 */
export interface IpcErrorPayload {
  code: IpcErrorCode
  message: string
  details?: Record<string, unknown>
}

/**
 * Custom error class for IPC failures.
 */
export class IpcException extends Error {
  public readonly code: IpcErrorCode
  public readonly details?: Record<string, unknown>

  constructor(code: IpcErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'IpcException'
    this.code = code
    this.details = details

    // Maintain prototype chain
    Object.setPrototypeOf(this, IpcException.prototype)
  }

  public toPayload(): IpcErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {})
    }
  }

  public static fromPayload(payload: IpcErrorPayload): IpcException {
    return new IpcException(payload.code, payload.message, payload.details)
  }
}
