/**
 * HELIOXEN AI — Step 27: Cooperative Cancellation Controller
 * Manages task- and step-scoped AbortControllers, cancellation checkpoints,
 * idempotent cancellation requests, and resource cleanup.
 */

import { TaskCancellationResult, TaskState } from './types'

export interface TaskCancellationRecord {
  readonly taskId: string
  readonly abortController: AbortController
  readonly requestedAt?: number
  readonly reason?: string
  cancellationRequested: boolean
  cancellationAccepted: boolean
  isTerminal: boolean
}

export class CancellationController {
  private readonly tasks = new Map<string, TaskCancellationRecord>()
  private readonly stepControllers = new Map<string, AbortController>()
  private readonly activeTimers = new Map<string, NodeJS.Timeout>()

  /**
   * Registers a new task for cancellation tracking.
   */
  public registerTask(taskId: string): AbortSignal {
    const existing = this.tasks.get(taskId)
    if (existing) {
      return existing.abortController.signal
    }

    const abortController = new AbortController()
    this.tasks.set(taskId, {
      taskId,
      abortController,
      cancellationRequested: false,
      cancellationAccepted: false,
      isTerminal: false
    })

    return abortController.signal
  }

  /**
   * Creates or registers an AbortSignal scoped to a specific step.
   * If the parent task has already requested cancellation, the step signal is aborted immediately.
   */
  public createStepSignal(taskId: string, stepId: string): AbortSignal {
    const taskRecord = this.tasks.get(taskId)
    const stepController = new AbortController()
    const stepKey = `${taskId}:${stepId}`
    this.stepControllers.set(stepKey, stepController)

    if (taskRecord?.cancellationRequested) {
      stepController.abort(new Error(`Task "${taskId}" cancellation was already requested`))
    }

    return stepController.signal
  }

  /**
   * Removes step controller when step completes or fails.
   */
  public releaseStepSignal(taskId: string, stepId: string): void {
    const stepKey = `${taskId}:${stepId}`
    this.stepControllers.delete(stepKey)
  }

  /**
   * Registers a retry delay timer so it can be aborted immediately if cancellation occurs.
   */
  public registerTimer(timerId: string, timer: NodeJS.Timeout): void {
    this.activeTimers.set(timerId, timer)
  }

  /**
   * Clears an active timer.
   */
  public clearTimer(timerId: string): void {
    const timer = this.activeTimers.get(timerId)
    if (timer) {
      clearTimeout(timer)
      this.activeTimers.delete(timerId)
    }
  }

  /**
   * Checks whether cancellation has been requested for a task.
   */
  public isCancellationRequested(taskId: string): boolean {
    return Boolean(this.tasks.get(taskId)?.cancellationRequested)
  }

  /**
   * Checks whether cancellation has been accepted by the execution engine.
   */
  public isCancellationAccepted(taskId: string): boolean {
    return Boolean(this.tasks.get(taskId)?.cancellationAccepted)
  }

  /**
   * Requests cancellation for an active task. Idempotent: repeated calls are safe.
   */
  public requestCancellation(
    taskId: string,
    reason: string = 'User requested cancellation'
  ): TaskCancellationResult {
    const taskRecord = this.tasks.get(taskId)

    if (!taskRecord) {
      return {
        taskId,
        accepted: false,
        currentState: 'failed',
        message: `Task "${taskId}" not found or already terminated.`
      }
    }

    if (taskRecord.isTerminal) {
      return {
        taskId,
        accepted: false,
        currentState: 'completed',
        message: `Task "${taskId}" is already terminal and cannot be cancelled.`
      }
    }

    if (taskRecord.cancellationRequested) {
      return {
        taskId,
        accepted: true,
        currentState: 'cancelling',
        message: `Cancellation already in progress for task "${taskId}".`
      }
    }

    // Mark cancellation requested and accepted
    taskRecord.cancellationRequested = true
    taskRecord.cancellationAccepted = true

    // Trigger task-level abort signal
    try {
      taskRecord.abortController.abort(new Error(reason))
    } catch {
      // AbortController abort is safe, catch any unexpected subscriber error
    }

    // Abort all active step controllers belonging to this task
    for (const [stepKey, stepCtrl] of this.stepControllers.entries()) {
      if (stepKey.startsWith(`${taskId}:`)) {
        try {
          stepCtrl.abort(new Error(reason))
        } catch {
          // ignore step abort error
        }
      }
    }

    // Cancel all active timers belonging to this task
    for (const [timerId, timer] of this.activeTimers.entries()) {
      if (timerId.startsWith(`${taskId}:`)) {
        clearTimeout(timer)
        this.activeTimers.delete(timerId)
      }
    }

    return {
      taskId,
      accepted: true,
      currentState: 'cancelling',
      message: `Cancellation accepted for task "${taskId}". Pending work will be halted.`
    }
  }

  /**
   * Marks a task as terminal and cleans up all task-owned listeners and controllers.
   */
  public markTerminal(taskId: string): void {
    const record = this.tasks.get(taskId)
    if (record) {
      record.isTerminal = true
    }

    // Clean up step controllers
    for (const key of Array.from(this.stepControllers.keys())) {
      if (key.startsWith(`${taskId}:`)) {
        this.stepControllers.delete(key)
      }
    }

    // Clean up timers
    for (const [timerId, timer] of Array.from(this.activeTimers.entries())) {
      if (timerId.startsWith(`${taskId}:`)) {
        clearTimeout(timer)
        this.activeTimers.delete(timerId)
      }
    }

    this.tasks.delete(taskId)
  }
}
