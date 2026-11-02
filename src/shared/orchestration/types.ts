/**
 * HELIOXEN AI — Step 27: Agent Progress, Cancellation, Retries and Execution Audit Trail
 * Authoritative types, task/step lifecycle state machines, progress event contracts,
 * cooperative cancellation tokens, retry policies, and privacy-conscious audit schema.
 */

export type TaskState =
  | 'created'
  | 'planning'
  | 'awaiting_clarification'
  | 'plan_ready'
  | 'validating'
  | 'validation_failed'
  | 'awaiting_approval'
  | 'ready_for_execution'
  | 'executing'
  | 'cancellation_requested'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'rejected'
  | 'outcome_unknown'

export type StepState =
  | 'pending'
  | 'waiting_for_dependencies'
  | 'ready'
  | 'awaiting_approval'
  | 'dispatching'
  | 'running'
  | 'retry_eligible'
  | 'retry_scheduled'
  | 'retrying'
  | 'succeeded'
  | 'completed'
  | 'failed'
  | 'cancellation_requested'
  | 'cancelling'
  | 'cancelled'
  | 'outcome_unknown'
  | 'skipped'

export type ApprovalStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'

export interface PlannerLimits {
  /** Maximum allowable steps in a single plan */
  readonly maxSteps: number
  /** Maximum dependency depth (DAG path length) */
  readonly maxDependencyDepth: number
  /** Maximum number of direct prerequisite dependencies per step */
  readonly maxDependenciesPerStep: number
  /** Maximum total size of serialized plan JSON in bytes */
  readonly maxPlanPayloadBytes: number
  /** Default execution timeout per step in milliseconds */
  readonly defaultStepTimeoutMs: number
  /** Maximum total task execution duration in milliseconds */
  readonly maxTaskTimeoutMs: number
}

export const DEFAULT_PLANNER_LIMITS: PlannerLimits = {
  maxSteps: 10,
  maxDependencyDepth: 5,
  maxDependenciesPerStep: 5,
  maxPlanPayloadBytes: 256 * 1024, // 256 KB
  defaultStepTimeoutMs: 30000,     // 30 seconds
  maxTaskTimeoutMs: 120000         // 2 minutes
} as const

/**
 * Data binding reference format: "$step.<stepId>.output.<propertyPath>"
 * Example: "$step.get_time_step.output.timezone"
 */
export interface DataBindingRef {
  readonly sourceStepId: string
  readonly outputPropertyPath: string
}

export interface PlanStep {
  /** Unique identifier for this step within the plan */
  readonly id: string
  /** Authoritative tool identifier registered in ToolRegistry (e.g., "system:get_time") */
  readonly toolId: string
  /** Concise description of what this operation accomplishes */
  readonly description: string
  /** Input arguments: may contain literal values or data binding tokens ("$step.<id>.output.<path>") */
  readonly input: Record<string, unknown>
  /** Array of prerequisite step IDs that must complete before this step executes */
  readonly dependencies: readonly string[]
  /** Whether this specific step requires explicit human approval before execution */
  readonly requiresConfirmation?: boolean
}

export interface TaskPlan {
  /** Unique plan identifier */
  readonly id: string
  /** Task identifier to which this plan belongs */
  readonly taskId: string
  /** Owning conversation thread identifier for context isolation */
  readonly conversationId: string
  /** Plan contract semantic version */
  readonly version: string
  /** High-level summary of the intended outcome */
  readonly intent: string
  /** Whether tool operations are required (false for pure conversational queries) */
  readonly requiresTools: boolean
  /** Request for user clarification if the intent or parameters are ambiguous */
  readonly clarificationNeeded?: string
  /** Finite sequence of planned steps */
  readonly steps: readonly PlanStep[]
  /** Creation timestamp (epoch ms) */
  readonly createdAt: number
}

export type StepExecutionStatus =
  | 'succeeded'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'outcome_unknown'

export interface StepExecutionResult {
  readonly stepId: string
  readonly toolId: string
  readonly status: StepExecutionStatus
  readonly input: unknown
  readonly output?: unknown
  readonly error?: string
  readonly durationMs: number
  readonly startedAt: number
  readonly finishedAt: number
  readonly retryAttempts: number
}

export type TaskExecutionStatus =
  | 'completed'
  | 'partially_completed'
  | 'partial'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'outcome_unknown'

export interface TaskExecutionResult {
  readonly taskId: string
  readonly planId: string
  readonly status: TaskExecutionStatus
  readonly stepResults: Record<string, StepExecutionResult>
  readonly finalOutput?: unknown
  readonly error?: string
  readonly totalDurationMs: number
  readonly startedAt: number
  readonly finishedAt: number
}

export interface TaskRecord {
  readonly id: string
  readonly conversationId: string
  readonly userPrompt: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly state: TaskState
  readonly plan?: TaskPlan
  readonly executionResult?: TaskExecutionResult
  readonly approvalStatus: ApprovalStatus
  readonly cancellationRequested?: boolean
  readonly cancellationReason?: string
  readonly error?: string
}

export interface TaskPlannerRequest {
  readonly taskId?: string
  readonly conversationId: string
  readonly userPrompt: string
  readonly contextSummary?: string
  readonly availableToolIds?: readonly string[]
}

export interface TaskPlannerResponse {
  readonly taskId: string
  readonly plan: TaskPlan
  readonly requiresTools: boolean
  readonly clarificationNeeded?: string
}

export interface PlanValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly topologicalOrder?: readonly string[]
}

// ============================================================================
// STEP 27: PROGRESS EVENT CONTRACTS
// ============================================================================

export type TaskProgressEventType =
  | 'task:started'
  | 'task:planning'
  | 'task:validating'
  | 'task:validated'
  | 'task:awaiting_approval'
  | 'step:ready'
  | 'step:awaiting_approval'
  | 'step:dispatched'
  | 'step:running'
  | 'step:retry_scheduled'
  | 'step:retrying'
  | 'step:succeeded'
  | 'step:failed'
  | 'step:cancelled'
  | 'step:skipped'
  | 'step:outcome_unknown'
  | 'task:cancellation_requested'
  | 'task:cancelling'
  | 'task:cancelled'
  | 'task:completed'
  | 'task:partially_completed'
  | 'task:failed'
  | 'task:rejected'
  | 'task:outcome_unknown'

export interface TaskProgressEvent {
  /** Unique progress event identifier */
  readonly id: string
  /** Task identifier */
  readonly taskId: string
  /** Optional step identifier if this event pertains to a step */
  readonly stepId?: string
  /** Strictly monotonic sequence number scoped to this task */
  readonly sequenceNumber: number
  /** Categorical event type */
  readonly eventType: TaskProgressEventType
  /** Previous state before this transition */
  readonly previousState?: TaskState | StepState
  /** Authoritative new state after this transition */
  readonly newState: TaskState | StepState
  /** Human-readable status summary */
  readonly message: string
  /** Timestamp in epoch ms */
  readonly timestamp: number
  /** Current retry attempt number (1-indexed for retries, 0 for initial attempt) */
  readonly retryAttempt?: number
  /** Number of required steps successfully finished */
  readonly completedStepCount: number
  /** Total required steps in the plan */
  readonly totalStepCount: number
  /** Error category if transition represents failure */
  readonly errorCategory?: string
  /** Duration in milliseconds of the operation */
  readonly durationMs?: number
}

// ============================================================================
// STEP 27: CANCELLATION CONTRACTS
// ============================================================================

export interface TaskCancellationRequest {
  readonly taskId: string
  readonly reason?: string
  readonly requestedBy?: string
}

export interface TaskCancellationResult {
  readonly taskId: string
  readonly accepted: boolean
  readonly currentState: TaskState
  readonly message: string
}

// ============================================================================
// STEP 27: AUDIT TRAIL CONTRACTS
// ============================================================================

export type AuditEventType =
  | 'TASK_CREATED'
  | 'PLAN_VALIDATED'
  | 'PLAN_VALIDATION_FAILED'
  | 'TASK_APPROVAL_REQUESTED'
  | 'TASK_APPROVAL_DECISION'
  | 'TASK_EXECUTION_STARTED'
  | 'STEP_DISPATCH_STARTED'
  | 'STEP_AUTHORIZATION_EVALUATED'
  | 'STEP_INPUT_VALIDATED'
  | 'STEP_OUTPUT_VALIDATED'
  | 'STEP_OPERATION_SUCCEEDED'
  | 'STEP_OPERATION_FAILED'
  | 'STEP_RETRY_SCHEDULED'
  | 'STEP_RETRY_ATTEMPT'
  | 'STEP_RETRY_EXHAUSTED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLATION_ACCEPTED'
  | 'STEP_CANCELLED'
  | 'TASK_CANCELLED'
  | 'STEP_OUTCOME_UNKNOWN'
  | 'TASK_OUTCOME_UNKNOWN'
  | 'TASK_COMPLETED'
  | 'TASK_PARTIAL_COMPLETION'
  | 'TASK_FAILED'

export interface AuditEvent {
  /** Unique audit event identifier */
  readonly id: string
  /** Schema version */
  readonly schemaVersion: '1.0.0'
  /** Task identifier */
  readonly taskId: string
  /** Optional step identifier */
  readonly stepId?: string
  /** Strictly monotonic sequence number */
  readonly sequenceNumber: number
  /** Event timestamp in epoch ms */
  readonly timestamp: number
  /** Audit event classification */
  readonly eventType: AuditEventType
  /** Tool identifier where applicable */
  readonly toolId?: string
  /** Semantic contract version of tool */
  readonly toolVersion?: string
  /** Attempt number (0 for initial, 1+ for subsequent retries) */
  readonly attemptNumber: number
  /** Previous state string */
  readonly previousState?: string
  /** New state string */
  readonly newState: string
  /** Error or result category */
  readonly resultCategory?: string
  /** Authorization gate outcome */
  readonly authorizationOutcome?: 'granted' | 'denied'
  /** Human confirmation gate outcome */
  readonly confirmationOutcome?: 'not_required' | 'approved' | 'rejected'
  /** Duration in milliseconds */
  readonly durationMs?: number
  /** Source component generating the event */
  readonly sourceComponent: string
  /** Sanitized, non-sensitive summary metadata */
  readonly sanitizedMetadata?: Record<string, unknown>
}

export interface AuditQueryFilter {
  readonly taskId: string
  readonly stepId?: string
  readonly eventTypes?: readonly AuditEventType[]
  readonly limit?: number
}
