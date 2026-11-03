/**
 * HELIOXEN AI — Step 27: Task Execution Engine with Progress, Cancellation, Retries, and Audit Trail
 * Sequential, dependency-aware, capability-checked execution orchestrator.
 * Enforces pre-dispatch schema re-validation, output validation, cooperative cancellation,
 * bounded retries with exponential backoff, and privacy-conscious execution audit trail.
 */

import { ToolRegistry } from '../tools'
import { ToolDispatcher, ToolExecutionContext } from './ToolDispatcher'
import { PlanValidator } from './PlanValidator'
import { ExecutionAuditTrail } from './ExecutionAuditTrail'
import { CancellationController } from './CancellationController'
import { RetryPolicyManager } from './RetryPolicyManager'
import {
  DEFAULT_PLANNER_LIMITS,
  PlannerLimits,
  PlanStep,
  StepExecutionResult,
  TaskExecutionResult,
  TaskPlan,
  TaskRecord,
  TaskState,
  StepState,
  TaskProgressEvent,
  TaskProgressEventType,
  TaskCancellationResult,
  AuditEvent
} from './types'
import { substituteDataBindings } from './contracts'
import type { AllowedRequester } from '../security/capabilities'

export interface AuthorizerLike {
  authorize(
    capabilityId: string,
    context: {
      requester: AllowedRequester
      consentRequestId?: string
      operationDescription?: string
      [key: string]: unknown
    }
  ): boolean
}

export interface ExecutionOptions {
  /** Map of approved step IDs to their approved inputs for confirmation policy enforcement */
  readonly approvedConfirmations?: Set<string>
  readonly signal?: AbortSignal
}

export type ProgressListener = (event: TaskProgressEvent) => void

export class TaskExecutionEngine {
  private readonly toolRegistry: ToolRegistry
  private readonly dispatcher: ToolDispatcher
  private readonly validator: PlanValidator
  private readonly authorizer?: AuthorizerLike
  private readonly limits: PlannerLimits
  private readonly auditTrail: ExecutionAuditTrail
  private readonly cancellationController: CancellationController
  private readonly retryPolicyManager: RetryPolicyManager

  /** Active task execution lock to prevent duplicate dispatch */
  private readonly activeTaskIds = new Set<string>()

  /** Authoritative task state records */
  private readonly tasks = new Map<string, TaskRecord>()

  /** Monotonic sequence counter per task for progress events */
  private readonly taskSequenceCounters = new Map<string, number>()

  /** Active progress event listeners */
  private readonly progressListeners = new Set<ProgressListener>()

  constructor(
    toolRegistry: ToolRegistry,
    dispatcher: ToolDispatcher,
    authorizer?: AuthorizerLike,
    limits: PlannerLimits = DEFAULT_PLANNER_LIMITS,
    auditTrail?: ExecutionAuditTrail
  ) {
    this.toolRegistry = toolRegistry
    this.dispatcher = dispatcher
    this.validator = new PlanValidator(toolRegistry, limits)
    this.authorizer = authorizer
    this.limits = limits
    this.auditTrail = auditTrail || new ExecutionAuditTrail()
    this.cancellationController = new CancellationController()
    this.retryPolicyManager = new RetryPolicyManager()
  }

  /**
   * Retrieves the execution audit trail service.
   */
  public getAuditTrail(): ExecutionAuditTrail {
    return this.auditTrail
  }

  /**
   * Retrieves recorded audit events for a task.
   */
  public getTaskAudit(taskId: string): readonly AuditEvent[] {
    return this.auditTrail.getTaskAudit(taskId)
  }

  /**
   * Subscribes a listener to receive real-time task progress events.
   * Returns an unsubscribe function.
   */
  public onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener)
    return () => {
      this.progressListeners.delete(listener)
    }
  }

  /**
   * Requests cooperative cancellation for an actively executing or queued task.
   * Idempotent and safe against repeated calls.
   */
  public requestCancellation(
    taskId: string,
    reason: string = 'User requested cancellation'
  ): TaskCancellationResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return {
        taskId,
        accepted: false,
        currentState: 'failed',
        message: `Task "${taskId}" not found.`
      }
    }

    const cancelResult = this.cancellationController.requestCancellation(taskId, reason)

    if (cancelResult.accepted) {
      this.updateTaskState(
        taskId,
        task.conversationId,
        task.userPrompt,
        'cancellation_requested',
        task.plan,
        undefined,
        reason
      )

      this.auditTrail.recordEvent({
        taskId,
        eventType: 'CANCELLATION_REQUESTED',
        previousState: task.state,
        newState: 'cancellation_requested',
        metadata: { reason }
      })

      this.emitProgress(
        taskId,
        'task:cancellation_requested',
        task.state,
        'cancellation_requested',
        `Cancellation requested: ${reason}`,
        0,
        task.plan?.steps.length || 0
      )
    }

    return cancelResult
  }

  /**
   * Retrieves the current persisted record of a task.
   */
  public getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * Executes a candidate or pre-validated task plan under strict security gates,
   * reporting real progress events, respecting cancellation, and handling retries.
   */
  public async executePlan(
    plan: TaskPlan,
    options: ExecutionOptions = {}
  ): Promise<TaskExecutionResult> {
    const taskId = plan.taskId
    const startedAt = Date.now()

    // 1. Guard against duplicate dispatch / concurrent execution of the same task
    if (this.activeTaskIds.has(taskId)) {
      throw new Error(`Duplicate dispatch rejected: Task "${taskId}" is already executing`)
    }

    this.activeTaskIds.add(taskId)

    // Register cooperative cancellation signal
    const taskSignal = this.cancellationController.registerTask(taskId)

    // Record initial Task creation
    this.updateTaskState(taskId, plan.conversationId, plan.intent, 'validating', plan)
    this.auditTrail.recordEvent({
      taskId,
      eventType: 'TASK_CREATED',
      newState: 'validating',
      metadata: { intent: plan.intent, conversationId: plan.conversationId }
    })
    this.emitProgress(
      taskId,
      'task:validating',
      'created',
      'validating',
      'Validating task plan contracts and dependency graph',
      0,
      plan.steps.length
    )

    try {
      // Check cancellation checkpoint
      if (this.cancellationController.isCancellationRequested(taskId)) {
        return this.handleCancelledTaskOutcome(plan, startedAt, 'Cancelled before plan validation completed')
      }

      // 2. Comprehensive Plan Validation prior to any dispatch
      const validation = this.validator.validate(plan)
      if (!validation.valid) {
        const errorMsg = `Plan validation failed: ${validation.errors.join('; ')}`
        this.updateTaskState(taskId, plan.conversationId, plan.intent, 'validation_failed', plan, undefined, errorMsg)

        this.auditTrail.recordEvent({
          taskId,
          eventType: 'PLAN_VALIDATION_FAILED',
          previousState: 'validating',
          newState: 'validation_failed',
          resultCategory: 'VALIDATION_ERROR',
          metadata: { errors: validation.errors }
        })

        this.emitProgress(
          taskId,
          'task:failed',
          'validating',
          'validation_failed',
          errorMsg,
          0,
          plan.steps.length,
          'VALIDATION_ERROR'
        )

        return {
          taskId,
          planId: plan.id,
          status: 'rejected',
          stepResults: {},
          error: errorMsg,
          totalDurationMs: Date.now() - startedAt,
          startedAt,
          finishedAt: Date.now()
        }
      }

      const executionOrder = validation.topologicalOrder || []

      this.auditTrail.recordEvent({
        taskId,
        eventType: 'PLAN_VALIDATED',
        previousState: 'validating',
        newState: 'plan_ready',
        metadata: { stepCount: executionOrder.length, topologicalOrder: executionOrder }
      })

      // If plan requires no tools, complete immediately
      if (executionOrder.length === 0) {
        this.updateTaskState(taskId, plan.conversationId, plan.intent, 'completed', plan)
        this.auditTrail.recordEvent({
          taskId,
          eventType: 'TASK_COMPLETED',
          previousState: 'plan_ready',
          newState: 'completed',
          metadata: { requiresTools: false }
        })
        this.emitProgress(
          taskId,
          'task:completed',
          'plan_ready',
          'completed',
          'Task completed without requiring tool execution',
          0,
          0
        )
        return {
          taskId,
          planId: plan.id,
          status: 'completed',
          stepResults: {},
          totalDurationMs: Date.now() - startedAt,
          startedAt,
          finishedAt: Date.now()
        }
      }

      this.updateTaskState(taskId, plan.conversationId, plan.intent, 'executing', plan)
      this.auditTrail.recordEvent({
        taskId,
        eventType: 'TASK_EXECUTION_STARTED',
        previousState: 'plan_ready',
        newState: 'executing',
        metadata: { stepCount: executionOrder.length }
      })
      this.emitProgress(
        taskId,
        'step:running',
        'plan_ready',
        'executing',
        `Beginning execution of ${executionOrder.length} planned steps`,
        0,
        executionOrder.length
      )

      const stepMap = new Map<string, PlanStep>()
      for (const step of plan.steps) {
        stepMap.set(step.id, step)
      }

      const stepOutputs: Record<string, unknown> = {}
      const stepResults: Record<string, StepExecutionResult> = {}
      let planFailed = false
      let planCancelled = false
      let planError: string | undefined
      let completedSteps = 0

      // 3. Sequential Execution in Validated Topological Order
      for (const stepId of executionOrder) {
        const step = stepMap.get(stepId)!

        // Cancellation checkpoint before dispatching step
        if (this.cancellationController.isCancellationRequested(taskId) || taskSignal.aborted) {
          planCancelled = true
          stepResults[stepId] = {
            stepId,
            toolId: step.toolId,
            status: 'cancelled',
            input: step.input,
            error: 'Operation cancelled before dispatch',
            durationMs: 0,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            retryAttempts: 0
          }
          this.auditTrail.recordEvent({
            taskId,
            stepId,
            eventType: 'STEP_CANCELLED',
            newState: 'cancelled',
            metadata: { reason: 'Cancellation accepted prior to step dispatch' }
          })
          this.emitProgress(
            taskId,
            'step:cancelled',
            'pending',
            'cancelled',
            `Step "${stepId}" cancelled before dispatch`,
            completedSteps,
            executionOrder.length,
            undefined,
            stepId
          )
          continue
        }

        // Check if plan execution exceeded max overall duration
        if (Date.now() - startedAt > this.limits.maxTaskTimeoutMs) {
          planFailed = true
          planError = `Task execution exceeded maximum allowed time limit (${this.limits.maxTaskTimeoutMs}ms)`
          stepResults[stepId] = {
            stepId,
            toolId: step.toolId,
            status: 'skipped',
            input: step.input,
            error: 'Execution skipped due to task timeout limit',
            durationMs: 0,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            retryAttempts: 0
          }
          break
        }

        // Check prerequisites: if any prerequisite failed, skip this dependent step
        const prerequisiteFailed = step.dependencies.some(
          (depId) => stepResults[depId] && stepResults[depId].status !== 'completed' && stepResults[depId].status !== 'succeeded'
        )

        if (prerequisiteFailed || planFailed || planCancelled) {
          const skipReason = planCancelled
            ? 'Skipped due to task cancellation'
            : 'Skipped due to prerequisite step failure'

          stepResults[stepId] = {
            stepId,
            toolId: step.toolId,
            status: planCancelled ? 'cancelled' : 'skipped',
            input: step.input,
            error: skipReason,
            durationMs: 0,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            retryAttempts: 0
          }
          this.emitProgress(
            taskId,
            planCancelled ? 'step:cancelled' : 'step:skipped',
            'waiting_for_dependencies',
            planCancelled ? 'cancelled' : 'skipped',
            skipReason,
            completedSteps,
            executionOrder.length,
            undefined,
            stepId
          )
          continue
        }

        // Execute Step with Retries and Cooperative Cancellation
        const stepResult = await this.executeStepWithRetries(
          plan,
          step,
          stepOutputs,
          options,
          completedSteps,
          executionOrder.length
        )

        stepResults[stepId] = stepResult

        if (stepResult.status === 'completed' || stepResult.status === 'succeeded') {
          stepOutputs[stepId] = stepResult.output
          completedSteps += 1
        } else if (stepResult.status === 'cancelled') {
          planCancelled = true
          planError = stepResult.error || `Step "${stepId}" was cancelled`
        } else {
          // Fail-fast on step failure
          planFailed = true
          planError = stepResult.error || `Step "${stepId}" failed`
        }
      }

      // Determine final task outcome
      let finalStatus: TaskExecutionResult['status']
      let finalTaskState: TaskState

      if (planCancelled) {
        finalStatus = completedSteps > 0 ? 'partially_completed' : 'cancelled'
        finalTaskState = completedSteps > 0 ? 'partially_completed' : 'cancelled'
      } else if (planFailed) {
        finalStatus = completedSteps > 0 ? 'partial' : 'failed'
        finalTaskState = completedSteps > 0 ? 'partially_completed' : 'failed'
      } else {
        finalStatus = 'completed'
        finalTaskState = 'completed'
      }

      const lastCompletedStepId = executionOrder
        .filter((id) => stepResults[id]?.status === 'completed' || stepResults[id]?.status === 'succeeded')
        .pop()
      const finalOutput = lastCompletedStepId ? stepOutputs[lastCompletedStepId] : undefined

      const executionResult: TaskExecutionResult = {
        taskId,
        planId: plan.id,
        status: finalStatus,
        stepResults,
        finalOutput,
        error: planError,
        totalDurationMs: Date.now() - startedAt,
        startedAt,
        finishedAt: Date.now()
      }

      this.updateTaskState(
        taskId,
        plan.conversationId,
        plan.intent,
        finalTaskState,
        plan,
        executionResult,
        planError
      )

      // Audit final resolution
      const finalAuditEventType =
        finalTaskState === 'completed'
          ? 'TASK_COMPLETED'
          : finalTaskState === 'cancelled'
          ? 'TASK_CANCELLED'
          : finalTaskState === 'partially_completed'
          ? 'TASK_PARTIAL_COMPLETION'
          : 'TASK_FAILED'

      this.auditTrail.recordEvent({
        taskId,
        eventType: finalAuditEventType,
        newState: finalTaskState,
        durationMs: Date.now() - startedAt,
        metadata: {
          completedSteps,
          totalSteps: executionOrder.length,
          error: planError
        }
      })

      const finalProgressType =
        finalTaskState === 'completed'
          ? 'task:completed'
          : finalTaskState === 'cancelled'
          ? 'task:cancelled'
          : finalTaskState === 'partially_completed'
          ? 'task:partially_completed'
          : 'task:failed'

      this.emitProgress(
        taskId,
        finalProgressType,
        'executing',
        finalTaskState,
        planError || `Task execution finished with status: ${finalTaskState}`,
        completedSteps,
        executionOrder.length
      )

      return executionResult
    } finally {
      this.cancellationController.markTerminal(taskId)
      this.activeTaskIds.delete(taskId)
    }
  }

  /**
   * Coordinates step execution with retry attempts and cancellation checkpoints.
   */
  private async executeStepWithRetries(
    plan: TaskPlan,
    step: PlanStep,
    stepOutputs: Record<string, unknown>,
    options: ExecutionOptions,
    completedSteps: number,
    totalSteps: number
  ): Promise<StepExecutionResult> {
    const toolDef = this.toolRegistry.get(step.toolId)
    let attempt = 0
    let lastResult: StepExecutionResult

    while (true) {
      // Step cancellation checkpoint
      if (this.cancellationController.isCancellationRequested(plan.taskId)) {
        return {
          stepId: step.id,
          toolId: step.toolId,
          status: 'cancelled',
          input: step.input,
          error: 'Execution cancelled before attempt',
          durationMs: 0,
          startedAt: Date.now(),
          finishedAt: Date.now(),
          retryAttempts: attempt
        }
      }

      // Execute single attempt
      lastResult = await this.executeStepOnce(
        plan,
        step,
        stepOutputs,
        options,
        attempt,
        completedSteps,
        totalSteps
      )

      // If succeeded, completed, or cancelled, return immediately
      if (lastResult.status === 'completed' || lastResult.status === 'succeeded' || lastResult.status === 'cancelled') {
        return lastResult
      }

      // Check if toolDef is available for retry evaluation
      if (!toolDef) {
        return lastResult
      }

      // Evaluate retry eligibility
      const isCancelled = this.cancellationController.isCancellationRequested(plan.taskId)
      const retryEval = this.retryPolicyManager.evaluate(
        toolDef,
        attempt,
        lastResult.error || 'Execution failure',
        isCancelled
      )

      if (!retryEval.eligible) {
        // Record retry exhaustion / permanent failure
        this.auditTrail.recordEvent({
          taskId: plan.taskId,
          stepId: step.id,
          eventType: 'STEP_RETRY_EXHAUSTED',
          toolId: step.toolId,
          attemptNumber: attempt,
          newState: 'failed',
          resultCategory: 'RETRY_EXHAUSTED',
          metadata: { reason: retryEval.reason }
        })
        return lastResult
      }

      // Schedule retry
      const delayMs = retryEval.backoffDelayMs || 500
      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_RETRY_SCHEDULED',
        toolId: step.toolId,
        attemptNumber: attempt,
        newState: 'retry_scheduled',
        metadata: {
          nextAttempt: retryEval.nextAttemptNumber,
          backoffDelayMs: delayMs,
          reason: retryEval.reason
        }
      })

      this.emitProgress(
        plan.taskId,
        'step:retry_scheduled',
        'failed',
        'retry_scheduled',
        `Scheduling retry attempt ${retryEval.nextAttemptNumber} in ${delayMs}ms`,
        completedSteps,
        totalSteps,
        undefined,
        step.id,
        retryEval.nextAttemptNumber
      )

      // Wait for backoff delay respecting cancellation
      const stepSignal = this.cancellationController.createStepSignal(plan.taskId, step.id)
      try {
        await this.retryPolicyManager.waitForBackoff(delayMs, stepSignal)
      } catch (backoffErr: any) {
        return {
          stepId: step.id,
          toolId: step.toolId,
          status: 'cancelled',
          input: step.input,
          error: backoffErr.message || 'Cancelled during retry delay',
          durationMs: 0,
          startedAt: Date.now(),
          finishedAt: Date.now(),
          retryAttempts: attempt
        }
      } finally {
        this.cancellationController.releaseStepSignal(plan.taskId, step.id)
      }

      attempt += 1

      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_RETRY_ATTEMPT',
        toolId: step.toolId,
        attemptNumber: attempt,
        newState: 'retrying',
        metadata: { attempt }
      })

      this.emitProgress(
        plan.taskId,
        'step:retrying',
        'retry_scheduled',
        'retrying',
        `Dispatching retry attempt ${attempt} for step "${step.id}"`,
        completedSteps,
        totalSteps,
        undefined,
        step.id,
        attempt
      )
    }
  }

  /**
   * Executes a single attempt of a planned step with pre-dispatch re-validation,
   * capability checks, cancellation checks, and output validation.
   */
  private async executeStepOnce(
    plan: TaskPlan,
    step: PlanStep,
    stepOutputs: Record<string, unknown>,
    options: ExecutionOptions,
    attemptNumber: number,
    completedSteps: number,
    totalSteps: number
  ): Promise<StepExecutionResult> {
    const stepStart = Date.now()

    // 1. Resolve Tool Definition from Authoritative Registry
    const toolDef = this.toolRegistry.get(step.toolId)
    if (!toolDef) {
      const error = `Tool "${step.toolId}" not found in authoritative registry`
      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_OPERATION_FAILED',
        toolId: step.toolId,
        attemptNumber,
        newState: 'failed',
        resultCategory: 'TOOL_NOT_FOUND',
        metadata: { error }
      })
      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'failed',
        input: step.input,
        error,
        durationMs: Date.now() - stepStart,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    }

    // 2. Security Authorizer Capability Verification
    const grantedCapabilities: string[] = []
    if (this.authorizer && toolDef.requiredCapabilities.length > 0) {
      for (const capId of toolDef.requiredCapabilities) {
        try {
          const isApproved = Boolean(options.approvedConfirmations?.has(step.id))
          const authorized = this.authorizer.authorize(capId, {
            requester: 'renderer-main-window',
            taskId: plan.taskId,
            stepId: step.id,
            consentRequestId: isApproved ? `engine_approved_${step.id}` : undefined
          })
          if (!authorized) {
            const error = `Authorization denied for capability: "${capId}"`
            this.auditTrail.recordEvent({
              taskId: plan.taskId,
              stepId: step.id,
              eventType: 'STEP_AUTHORIZATION_EVALUATED',
              toolId: step.toolId,
              toolVersion: toolDef.version,
              attemptNumber,
              newState: 'failed',
              authorizationOutcome: 'denied',
              metadata: { capabilityId: capId }
            })
            return {
              stepId: step.id,
              toolId: step.toolId,
              status: 'failed',
              input: step.input,
              error,
              durationMs: Date.now() - stepStart,
              startedAt: stepStart,
              finishedAt: Date.now(),
              retryAttempts: attemptNumber
            }
          }
          grantedCapabilities.push(capId)
        } catch (authErr: any) {
          const error = `Security authorization exception for capability "${capId}": ${authErr.message}`
          this.auditTrail.recordEvent({
            taskId: plan.taskId,
            stepId: step.id,
            eventType: 'STEP_AUTHORIZATION_EVALUATED',
            toolId: step.toolId,
            attemptNumber,
            newState: 'failed',
            authorizationOutcome: 'denied',
            metadata: { error }
          })
          return {
            stepId: step.id,
            toolId: step.toolId,
            status: 'failed',
            input: step.input,
            error,
            durationMs: Date.now() - stepStart,
            startedAt: stepStart,
            finishedAt: Date.now(),
            retryAttempts: attemptNumber
          }
        }
      }

      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_AUTHORIZATION_EVALUATED',
        toolId: step.toolId,
        attemptNumber,
        newState: 'dispatching',
        authorizationOutcome: 'granted',
        metadata: { grantedCapabilities }
      })
    } else {
      grantedCapabilities.push(...toolDef.requiredCapabilities)
    }

    // 3. Pre-execution Eligibility & Capability Recheck
    const eligibility = this.toolRegistry.evaluateEligibility(step.toolId, grantedCapabilities)
    if (!eligibility.eligible) {
      const error = `Tool eligibility check failed at execution time: ${eligibility.reason}`
      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_OPERATION_FAILED',
        toolId: step.toolId,
        attemptNumber,
        newState: 'failed',
        resultCategory: 'ELIGIBILITY_DENIED',
        metadata: { reason: eligibility.reason }
      })
      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'failed',
        input: step.input,
        error,
        durationMs: Date.now() - stepStart,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    }

    // 4. Human Confirmation Policy Enforcement
    const requiresConfirmation =
      toolDef.confirmationPolicy === 'user_confirmation' || Boolean(step.requiresConfirmation)

    if (requiresConfirmation) {
      const isApproved = options.approvedConfirmations?.has(step.id)
      if (!isApproved) {
        const error = `Execution blocked: Step "${step.id}" requires explicit user confirmation before proceeding`
        this.auditTrail.recordEvent({
          taskId: plan.taskId,
          stepId: step.id,
          eventType: 'TASK_APPROVAL_DECISION',
          toolId: step.toolId,
          attemptNumber,
          newState: 'awaiting_approval',
          confirmationOutcome: 'rejected',
          metadata: { requiresConfirmation: true }
        })
        this.emitProgress(
          plan.taskId,
          'step:awaiting_approval',
          'ready',
          'awaiting_approval',
          `Step "${step.id}" is waiting for user confirmation`,
          completedSteps,
          totalSteps,
          undefined,
          step.id
        )
        return {
          stepId: step.id,
          toolId: step.toolId,
          status: 'failed',
          input: step.input,
          error,
          durationMs: Date.now() - stepStart,
          startedAt: stepStart,
          finishedAt: Date.now(),
          retryAttempts: attemptNumber
        }
      }
    }

    // 5. Data Binding Resolution from Prerequisite Outputs
    const { resolved: resolvedInput, missingBindings } = substituteDataBindings(
      step.input,
      stepOutputs
    )

    if (missingBindings.length > 0) {
      const error = `Data binding resolution failed: ${missingBindings.join('; ')}`
      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_OPERATION_FAILED',
        toolId: step.toolId,
        attemptNumber,
        newState: 'failed',
        resultCategory: 'DATA_BINDING_ERROR',
        metadata: { missingBindings }
      })
      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'failed',
        input: step.input,
        error,
        durationMs: Date.now() - stepStart,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    }

    // 6. Schema Validation of Resolved Input Immediately Prior to Dispatch
    const inputValidation = this.toolRegistry.validateInput(step.toolId, resolvedInput)
    if (!inputValidation.valid) {
      const errMsgs = inputValidation.errors.map((e) => `${e.field ? e.field + ': ' : ''}${e.message}`)
      const error = `Input schema validation failed immediately before dispatch: ${errMsgs.join(', ')}`
      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_INPUT_VALIDATED',
        toolId: step.toolId,
        attemptNumber,
        newState: 'failed',
        resultCategory: 'SCHEMA_VALIDATION_ERROR',
        metadata: { errors: errMsgs }
      })
      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'failed',
        input: resolvedInput,
        error,
        durationMs: Date.now() - stepStart,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    }

    this.auditTrail.recordEvent({
      taskId: plan.taskId,
      stepId: step.id,
      eventType: 'STEP_INPUT_VALIDATED',
      toolId: step.toolId,
      attemptNumber,
      newState: 'running'
    })

    // Check cancellation checkpoint immediately before invoking handler
    if (this.cancellationController.isCancellationRequested(plan.taskId)) {
      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'cancelled',
        input: inputValidation.data,
        error: 'Cancelled immediately before dispatch',
        durationMs: Date.now() - stepStart,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    }

    // 7. Dispatch Execution to Trusted Implementation Handler with Timeout
    const stepSignal = this.cancellationController.createStepSignal(plan.taskId, step.id)
    const executionContext: ToolExecutionContext = {
      taskId: plan.taskId,
      stepId: step.id,
      conversationId: plan.conversationId,
      signal: stepSignal
    }

    const timeoutMs = Math.min(
      toolDef.limits.timeoutMs || this.limits.defaultStepTimeoutMs,
      this.limits.defaultStepTimeoutMs
    )

    this.auditTrail.recordEvent({
      taskId: plan.taskId,
      stepId: step.id,
      eventType: 'STEP_DISPATCH_STARTED',
      toolId: step.toolId,
      toolVersion: toolDef.version,
      attemptNumber,
      newState: 'running',
      metadata: { timeoutMs }
    })

    this.emitProgress(
      plan.taskId,
      'step:dispatched',
      'ready',
      'running',
      `Dispatching tool "${step.toolId}" for step "${step.id}"`,
      completedSteps,
      totalSteps,
      undefined,
      step.id,
      attemptNumber
    )

    try {
      const rawOutput = await this.runWithTimeout(
        () => this.dispatcher.dispatch(toolDef, inputValidation.data, executionContext),
        timeoutMs,
        `Step "${step.id}" timed out after ${timeoutMs}ms`,
        stepSignal
      )

      // Post-execution cancellation check
      if (stepSignal.aborted || this.cancellationController.isCancellationRequested(plan.taskId)) {
        return {
          stepId: step.id,
          toolId: step.toolId,
          status: 'cancelled',
          input: inputValidation.data,
          error: 'Operation aborted during cancellation',
          durationMs: Date.now() - stepStart,
          startedAt: stepStart,
          finishedAt: Date.now(),
          retryAttempts: attemptNumber
        }
      }

      // 8. Validate Output Against Registered Output Schema
      const outputParsed = toolDef.outputSchema.safeParse(rawOutput)
      if (!outputParsed.success) {
        const error = `Output validation failed for tool "${step.toolId}": ${outputParsed.error.message}`
        this.auditTrail.recordEvent({
          taskId: plan.taskId,
          stepId: step.id,
          eventType: 'STEP_OUTPUT_VALIDATED',
          toolId: step.toolId,
          attemptNumber,
          newState: 'failed',
          resultCategory: 'OUTPUT_VALIDATION_ERROR',
          metadata: { error }
        })
        return {
          stepId: step.id,
          toolId: step.toolId,
          status: 'failed',
          input: inputValidation.data,
          error,
          durationMs: Date.now() - stepStart,
          startedAt: stepStart,
          finishedAt: Date.now(),
          retryAttempts: attemptNumber
        }
      }

      const durationMs = Date.now() - stepStart

      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_OPERATION_SUCCEEDED',
        toolId: step.toolId,
        toolVersion: toolDef.version,
        attemptNumber,
        newState: 'succeeded',
        durationMs
      })

      this.emitProgress(
        plan.taskId,
        'step:succeeded',
        'running',
        'succeeded',
        `Step "${step.id}" completed successfully in ${durationMs}ms`,
        completedSteps + 1,
        totalSteps,
        undefined,
        step.id,
        attemptNumber
      )

      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'completed',
        input: inputValidation.data,
        output: outputParsed.data,
        durationMs,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    } catch (dispatchErr: any) {
      const isAbort = stepSignal.aborted || this.cancellationController.isCancellationRequested(plan.taskId)
      const durationMs = Date.now() - stepStart

      if (isAbort) {
        this.auditTrail.recordEvent({
          taskId: plan.taskId,
          stepId: step.id,
          eventType: 'STEP_CANCELLED',
          toolId: step.toolId,
          attemptNumber,
          newState: 'cancelled',
          durationMs
        })
        return {
          stepId: step.id,
          toolId: step.toolId,
          status: 'cancelled',
          input: inputValidation.data,
          error: 'Step execution cancelled',
          durationMs,
          startedAt: stepStart,
          finishedAt: Date.now(),
          retryAttempts: attemptNumber
        }
      }

      const error = dispatchErr.message || `Execution error in step "${step.id}"`

      this.auditTrail.recordEvent({
        taskId: plan.taskId,
        stepId: step.id,
        eventType: 'STEP_OPERATION_FAILED',
        toolId: step.toolId,
        attemptNumber,
        newState: 'failed',
        resultCategory: 'EXECUTION_ERROR',
        durationMs,
        metadata: { error }
      })

      return {
        stepId: step.id,
        toolId: step.toolId,
        status: 'failed',
        input: inputValidation.data,
        error,
        durationMs,
        startedAt: stepStart,
        finishedAt: Date.now(),
        retryAttempts: attemptNumber
      }
    } finally {
      this.cancellationController.releaseStepSignal(plan.taskId, step.id)
    }
  }

  /**
   * Helper to handle a task cancelled before plan execution.
   */
  private handleCancelledTaskOutcome(
    plan: TaskPlan,
    startedAt: number,
    reason: string
  ): TaskExecutionResult {
    const taskId = plan.taskId
    this.updateTaskState(taskId, plan.conversationId, plan.intent, 'cancelled', plan, undefined, reason)
    this.auditTrail.recordEvent({
      taskId,
      eventType: 'TASK_CANCELLED',
      newState: 'cancelled',
      metadata: { reason }
    })
    this.emitProgress(
      taskId,
      'task:cancelled',
      'created',
      'cancelled',
      reason,
      0,
      plan.steps.length
    )
    return {
      taskId,
      planId: plan.id,
      status: 'cancelled',
      stepResults: {},
      error: reason,
      totalDurationMs: Date.now() - startedAt,
      startedAt,
      finishedAt: Date.now()
    }
  }

  /**
   * Runs an asynchronous operation with an enforced timeout and cooperative cancellation.
   */
  private async runWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
    signal?: AbortSignal
  ): Promise<T> {
    let timer: any
    let abortListener: () => void

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })

    const abortPromise = new Promise<never>((_, reject) => {
      if (signal?.aborted) {
        reject(new Error('Operation aborted'))
        return
      }
      abortListener = () => reject(new Error('Operation aborted'))
      signal?.addEventListener('abort', abortListener, { once: true })
    })

    try {
      return await Promise.race([operation(), timeoutPromise, abortPromise])
    } finally {
      clearTimeout(timer)
      if (signal && abortListener!) {
        signal.removeEventListener('abort', abortListener)
      }
    }
  }

  /**
   * Dispatches a monotonic progress event to all active listeners.
   */
  private emitProgress(
    taskId: string,
    eventType: TaskProgressEventType,
    previousState: TaskState | StepState,
    newState: TaskState | StepState,
    message: string,
    completedStepCount: number,
    totalStepCount: number,
    errorCategory?: string,
    stepId?: string,
    retryAttempt?: number
  ): void {
    const seq = (this.taskSequenceCounters.get(taskId) || 0) + 1
    this.taskSequenceCounters.set(taskId, seq)

    const event: TaskProgressEvent = {
      id: `prog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      stepId,
      sequenceNumber: seq,
      eventType,
      previousState,
      newState,
      message,
      timestamp: Date.now(),
      retryAttempt,
      completedStepCount,
      totalStepCount,
      errorCategory
    }

    Object.freeze(event)

    for (const listener of this.progressListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[TaskExecutionEngine] Progress listener error:', err)
      }
    }
  }

  /**
   * Atomically records task status transitions.
   */
  private updateTaskState(
    taskId: string,
    conversationId: string,
    userPrompt: string,
    state: TaskState,
    plan?: TaskPlan,
    result?: TaskExecutionResult,
    error?: string
  ): void {
    const existing = this.tasks.get(taskId)
    const now = Date.now()

    this.tasks.set(taskId, {
      id: taskId,
      conversationId,
      userPrompt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      state,
      plan: plan || existing?.plan,
      executionResult: result || existing?.executionResult,
      approvalStatus: existing?.approvalStatus || 'none',
      cancellationRequested: existing?.cancellationRequested || this.cancellationController.isCancellationRequested(taskId),
      error
    })
  }
}
