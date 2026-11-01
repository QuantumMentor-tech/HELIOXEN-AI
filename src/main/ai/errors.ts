/**
 * Normalized AI Provider Error types and classification.
 * Prevents secret leakage while preserving actionable diagnostic context.
 */

export type AiErrorCode =
  | 'MISSING_CREDENTIAL'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_MODEL'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR'

export class AiProviderException extends Error {
  public readonly code: AiErrorCode
  public readonly provider: string
  public readonly httpStatus?: number
  public readonly retryable: boolean

  constructor(params: {
    code: AiErrorCode
    provider: string
    message: string
    httpStatus?: number
    retryable?: boolean
  }) {
    super(params.message)
    this.name = 'AiProviderException'
    this.code = params.code
    this.provider = params.provider
    this.httpStatus = params.httpStatus
    this.retryable = params.retryable ?? false
    Object.setPrototypeOf(this, AiProviderException.prototype)
  }

  public toSafeObject(): {
    code: AiErrorCode
    provider: string
    message: string
    httpStatus?: number
    retryable: boolean
  } {
    return {
      code: this.code,
      provider: this.provider,
      message: this.message,
      httpStatus: this.httpStatus,
      retryable: this.retryable
    }
  }
}
