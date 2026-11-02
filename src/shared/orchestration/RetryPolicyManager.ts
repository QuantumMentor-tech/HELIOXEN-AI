/**
 * HELIOXEN AI — Step 27: Policy-Aware Retry Manager
 * Evaluates retry eligibility, enforces idempotency safeguards, bounds retry attempts,
 * and calculates exponential backoff with jitter.
 */

import { ToolDefinition, ToolRetryPolicy, DEFAULT_RETRY_POLICY, NO_RETRY_POLICY } from '../tools/types'

export interface RetryEvaluation {
  readonly eligible: boolean
  readonly reason: string
  readonly nextAttemptNumber?: number
  readonly backoffDelayMs?: number
}

const NON_RETRYABLE_ERROR_PATTERNS = [
  /validation/i,
  /schema/i,
  /authorization/i,
  /denied/i,
  /prohibited/i,
  /unsupported/i,
  /cancelled/i,
  /abort/i,
  /confirmation/i,
  /unknown outcome/i
]

export class RetryPolicyManager {
  /**
   * Evaluates whether a failed step attempt is eligible for an automated retry.
   */
  public evaluate(
    toolDef: ToolDefinition,
    currentAttempt: number,
    error: string,
    isCancellationRequested: boolean
  ): RetryEvaluation {
    // 1. Cancellation check — never retry if cancellation was requested
    if (isCancellationRequested) {
      return {
        eligible: false,
        reason: 'Retry rejected: Task cancellation has been requested'
      }
    }

    // 2. Resolve policy from tool definition or conservative fallback
    const policy: ToolRetryPolicy =
      toolDef.retryPolicy ||
      (toolDef.riskTier === 'prohibited' ? NO_RETRY_POLICY : DEFAULT_RETRY_POLICY)

    // 3. Check if maxRetries is 0
    if (policy.maxRetries <= 0) {
      return {
        eligible: false,
        reason: `Retry rejected: Tool "${toolDef.id}" does not permit automated retries (maxRetries = 0)`
      }
    }

    // 4. Idempotency safeguard — reject retry for non-idempotent side-effecting operations
    if (policy.hasSideEffects && !policy.isIdempotent) {
      return {
        eligible: false,
        reason: `Retry rejected: Tool "${toolDef.id}" has non-idempotent side effects and cannot be safely repeated`
      }
    }

    // 5. Budget check — attempt limit reached
    if (currentAttempt >= policy.maxRetries) {
      return {
        eligible: false,
        reason: `Retry budget exhausted: Attempt ${currentAttempt} reached limit of ${policy.maxRetries}`
      }
    }

    // 6. Error classification check — do not retry validation, authorization, or cancellation errors
    for (const pattern of NON_RETRYABLE_ERROR_PATTERNS) {
      if (pattern.test(error)) {
        return {
          eligible: false,
          reason: `Non-retryable error category detected: "${error}"`
        }
      }
    }

    // 7. Calculate bounded backoff delay with jitter
    const nextAttempt = currentAttempt + 1
    const baseDelay = policy.initialBackoffMs * Math.pow(policy.backoffFactor, currentAttempt)
    const cappedDelay = Math.min(baseDelay, policy.maxBackoffMs)
    // Add small random jitter (+/- 10%)
    const jitter = Math.floor(Math.random() * (cappedDelay * 0.2)) - Math.floor(cappedDelay * 0.1)
    const finalDelayMs = Math.max(policy.initialBackoffMs, cappedDelay + jitter)

    return {
      eligible: true,
      reason: `Eligible for retry attempt ${nextAttempt} after ${finalDelayMs}ms backoff`,
      nextAttemptNumber: nextAttempt,
      backoffDelayMs: finalDelayMs
    }
  }

  /**
   * Helper to wait for backoff delay while respecting cancellation.
   */
  public async waitForBackoff(
    delayMs: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) {
      throw new Error('Backoff aborted: Task was cancelled during retry delay')
    }

    return new Promise<void>((resolve, reject) => {
      let timer: NodeJS.Timeout

      const abortHandler = (): void => {
        clearTimeout(timer)
        reject(new Error('Backoff aborted: Task was cancelled during retry delay'))
      }

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true })
      }

      timer = setTimeout(() => {
        if (signal) {
          signal.removeEventListener('abort', abortHandler)
        }
        resolve()
      }, delayMs)
    })
  }
}
