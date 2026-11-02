/**
 * HELIOXEN AI — Step 27: Structured Execution Audit Trail
 * Records immutable, ordered, privacy-sanitized lifecycle events for agent orchestration.
 * Strict exclusion of sensitive payloads, secrets, audio/image binaries, and full document contents.
 */

import { AuditEvent, AuditEventType, AuditQueryFilter } from './types'

export interface AuditTrailOptions {
  readonly maxEventsPerTask?: number
  readonly maxGlobalEvents?: number
}

const SENSITIVE_KEYS_REGEX = /(?:key|token|secret|password|credential|auth|bearer|signature|cookie|payload)/i

/**
 * Sanitizes arbitrary metadata objects by stripping any keys matching sensitive patterns,
 * truncating long strings, and omitting raw binary buffers.
 */
export function sanitizeAuditMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    if (value === null || value === undefined) {
      sanitized[key] = value
    } else if (typeof value === 'string') {
      // Truncate strings longer than 256 characters to prevent log/payload bloat
      sanitized[key] = value.length > 256 ? `${value.slice(0, 256)}... [TRUNCATED]` : value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value
    } else if (Array.isArray(value)) {
      sanitized[key] = `[Array length: ${value.length}]`
    } else if (typeof value === 'object') {
      // Avoid deep circular or binary inspection
      if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        sanitized[key] = `[Binary buffer: ${(value as any).length} bytes]`
      } else {
        sanitized[key] = sanitizeAuditMetadata(value as Record<string, unknown>)
      }
    } else {
      sanitized[key] = String(value)
    }
  }

  return sanitized
}

export class ExecutionAuditTrail {
  private readonly eventsByTask = new Map<string, AuditEvent[]>()
  private readonly globalEventLog: AuditEvent[] = []
  private readonly maxEventsPerTask: number
  private readonly maxGlobalEvents: number
  private sequenceCounter = 0

  constructor(options: AuditTrailOptions = {}) {
    this.maxEventsPerTask = options.maxEventsPerTask ?? 500
    this.maxGlobalEvents = options.maxGlobalEvents ?? 5000
  }

  /**
   * Appends an immutable audit event to the task log and global audit sequence.
   */
  public recordEvent(params: {
    taskId: string
    stepId?: string
    eventType: AuditEventType
    toolId?: string
    toolVersion?: string
    attemptNumber?: number
    previousState?: string
    newState: string
    resultCategory?: string
    authorizationOutcome?: 'granted' | 'denied'
    confirmationOutcome?: 'not_required' | 'approved' | 'rejected'
    durationMs?: number
    sourceComponent?: string
    metadata?: Record<string, unknown>
  }): AuditEvent {
    this.sequenceCounter += 1

    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      schemaVersion: '1.0.0',
      taskId: params.taskId,
      stepId: params.stepId,
      sequenceNumber: this.sequenceCounter,
      timestamp: Date.now(),
      eventType: params.eventType,
      toolId: params.toolId,
      toolVersion: params.toolVersion,
      attemptNumber: params.attemptNumber ?? 0,
      previousState: params.previousState,
      newState: params.newState,
      resultCategory: params.resultCategory,
      authorizationOutcome: params.authorizationOutcome,
      confirmationOutcome: params.confirmationOutcome,
      durationMs: params.durationMs,
      sourceComponent: params.sourceComponent ?? 'orchestrator',
      sanitizedMetadata: sanitizeAuditMetadata(params.metadata)
    }

    // Freeze event object to guarantee immutability
    Object.freeze(event)

    // Store in task-specific log with bounded cap
    let taskList = this.eventsByTask.get(params.taskId)
    if (!taskList) {
      taskList = []
      this.eventsByTask.set(params.taskId, taskList)
    }

    if (taskList.length >= this.maxEventsPerTask) {
      taskList.shift() // Evict oldest event in ring buffer
    }
    taskList.push(event)

    // Store in global log with bounded cap
    if (this.globalEventLog.length >= this.maxGlobalEvents) {
      this.globalEventLog.shift()
    }
    this.globalEventLog.push(event)

    return event
  }

  /**
   * Queries audit events for a task, optionally filtered by stepId or eventTypes.
   */
  public query(filter: AuditQueryFilter): readonly AuditEvent[] {
    const taskList = this.eventsByTask.get(filter.taskId) || []

    let result = taskList
    if (filter.stepId) {
      result = result.filter((e) => e.stepId === filter.stepId)
    }
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      const typeSet = new Set(filter.eventTypes)
      result = result.filter((e) => typeSet.has(e.eventType))
    }
    if (filter.limit && filter.limit > 0) {
      result = result.slice(-filter.limit)
    }

    return Object.freeze([...result])
  }

  /**
   * Retrieves all recorded audit events for a task in monotonic sequence order.
   */
  public getTaskAudit(taskId: string): readonly AuditEvent[] {
    return this.query({ taskId })
  }

  /**
   * Purges audit events for a given task upon conversation or task deletion.
   */
  public purgeTaskAudit(taskId: string): boolean {
    return this.eventsByTask.delete(taskId)
  }

  /**
   * Returns current count of recorded events across all tasks.
   */
  public get totalEventCount(): number {
    return this.globalEventLog.length
  }
}
