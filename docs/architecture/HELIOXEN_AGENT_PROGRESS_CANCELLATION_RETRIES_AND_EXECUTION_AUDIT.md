# HELIOXEN: Agent Progress, Cancellation, Retries and Execution Audit Trail
**Architecture Documentation — Step 27 of 48 (Phase 9: Agent Orchestration)**

---

## 1. Executive Summary and Architectural Principles

Step 27 extends the Step 26 Task Planner and Execution Engine with:
1. **Truthful Progress Reporting**: Progress reflects concrete, verified milestones (`step:dispatched`, `step:succeeded`, etc.) with monotonic sequence numbers and verifiable integer step counters (`completedStepCount` / `totalStepCount`). No fabricated percentage curves.
2. **Cooperative Cancellation**: Immediate acceptance of cancellation requests (`cancelling`), preventing any undispatched steps or pending retry timers from firing, while propagating cancellation signals (`AbortSignal`) to active cancellable tool executions. Uncancellable operations are acknowledged honestly without false claims of rollback.
3. **Policy-Aware Retries**: Retries are governed strictly by trusted tool metadata (`retryPolicy`) and runtime error classification. Non-idempotent operations with side effects are strictly forbidden from automatic retries. Retries employ bounded counts and exponential backoff with jitter.
4. **Structured Execution Audit Trail**: Ordered, monotonic, immutable audit events record significant lifecycle transitions with ring-buffer memory bounding (500 events/task, 5000 global). Sensitive credentials, passwords, tokens, and raw binary buffers (audio/images/documents) are stripped or redacted.

---

## 2. Canonical Execution Lifecycles & State Transitions

### 2.1 Task State Machine

| State | Description | Permitted Next States |
|---|---|---|
| `created` | Task instantiated from authorized request | `planning`, `failed`, `cancellation_requested`, `cancelled` |
| `planning` | LLM or decomposition heuristic generating plan | `validating`, `awaiting_clarification`, `failed`, `cancelling`, `cancelled` |
| `validating` | Structural and security validation against registry | `ready`, `awaiting_approval`, `failed`, `cancelled` |
| `awaiting_approval` | Pending explicit user consent for high-risk operations | `ready`, `failed`, `cancellation_requested`, `cancelled` |
| `ready` | Plan validated and authorized for dispatch | `executing`, `cancellation_requested`, `cancelled` |
| `executing` | Step execution in progress | `completed`, `partially_completed`, `failed`, `cancellation_requested`, `cancelling`, `outcome_unknown` |
| `cancellation_requested` | User requested cancellation; execution engine acknowledging | `cancelling`, `cancelled` |
| `cancelling` | Engine actively aborting running tools, cancelling timers | `cancelled`, `partially_completed`, `outcome_unknown` |
| `cancelled` | All active operations halted or reconciled | Terminal state |
| `completed` | All required steps succeeded | Terminal state |
| `partially_completed` | Some steps succeeded, but execution stopped prematurely | Terminal state |
| `failed` | Unrecoverable error occurred during execution | Terminal state |
| `outcome_unknown` | Execution stopped or severed with uncertain side effects | Terminal state |

### 2.2 Step State Machine

| State | Description | Permitted Next States |
|---|---|---|
| `pending` | Step waiting for prior dependencies to resolve | `waiting_for_dependencies`, `ready`, `cancelled`, `skipped` |
| `waiting_for_dependencies`| Actively awaiting completion of preceding step outputs | `ready`, `cancelled`, `skipped` |
| `ready` | Dependencies resolved; ready for dispatch | `dispatching`, `cancelled`, `skipped` |
| `dispatching` | Tool resolution, capability, and authorizer verification | `running`, `failed`, `cancelled` |
| `running` | Tool invocation actively executing | `succeeded`, `failed`, `retry_eligible`, `cancelling`, `outcome_unknown` |
| `retry_eligible` | Step failed with retryable error and policy permits retry | `retry_scheduled`, `failed` |
| `retry_scheduled` | Backoff timer active prior to subsequent attempt | `retrying`, `cancelled` |
| `retrying` | Step executing attempt $N > 1$ | `succeeded`, `failed`, `retry_eligible`, `cancelling`, `outcome_unknown` |
| `succeeded` | Tool produced valid output matching schema | Terminal step state |
| `failed` | Execution failed and retries exhausted or disallowed | Terminal step state |
| `cancelling` | Abort signal propagated to active step | `cancelled`, `outcome_unknown` |
| `cancelled` | Step stopped or aborted before completion | Terminal step state |
| `skipped` | Step omitted because upstream dependency failed/cancelled | Terminal step state |
| `outcome_unknown` | Step timed out or severed with potential side effects | Terminal step state |

---

## 3. Progress Event Contract and UI Streaming

Progress events are delivered from the main process orchestration engine to renderer consumers via the typed channel `ORCHESTRATION_PROGRESS_EVENT` (`orchestration:progress-event`).

### 3.1 Event Schema

```typescript
export interface TaskProgressEvent {
  readonly id: string                          // Unique event identifier
  readonly taskId: string                      // Task identifier
  readonly stepId?: string                     // Optional step identifier
  readonly sequenceNumber: number              // Strictly monotonic sequence number (task-scoped)
  readonly eventType: TaskProgressEventType    // Event category
  readonly previousState?: string              // Prior lifecycle state
  readonly newState: string                    // Updated lifecycle state
  readonly message: string                     // User-safe status message
  readonly timestamp: number                   // Epoch timestamp
  readonly retryAttempt?: number               // Attempt counter (1-indexed for retries)
  readonly completedStepCount?: number         // Verifiable completed step count
  readonly totalStepCount?: number             // Total plan step count
  readonly errorCategory?: string              // Normalized failure code
  readonly durationMs?: number                 // Step or task duration in ms
  readonly sourceComponent: string             // Originator (e.g., 'task_executor')
}
```

### 3.2 Ordering and Stale-Event Mitigation
- Events include a strictly increasing integer `sequenceNumber`.
- Consumers track `highestSeenSequenceNumber` per task and drop out-of-order or duplicate updates.
- Autoritative state remains in `TaskExecutionEngine`; renderer UI components never alter or dictate state transitions.

---

## 4. Cooperative Cancellation Architecture

### 4.1 Request Sequence
1. User clicks cancellation control or IPC invokes `ORCHESTRATION_CANCEL`.
2. Execution engine validates task ownership and cancellable state.
3. `CancellationController` accepts request, marking task as `cancelling`.
4. Undispatched steps and scheduled retry timers are immediately halted.
5. Task-level and step-level `AbortController` triggers `abort('User requested cancellation')`.
6. Running tools observing `context.signal` abort their asynchronous operations.
7. Post-abort cleanup invalidates temporary callbacks and releases task resources.
8. Terminal outcome is resolved:
   - If prior steps completed successfully: `partially_completed`
   - If no steps completed: `cancelled`
   - If an uncancellable operation had uncertain side effects: `outcome_unknown`

### 4.2 Idempotency and Non-Rollback Guarantees
- Repeated cancellation requests return the current cancellation status safely without duplicating cleanup or throwing errors.
- Cancellation does NOT imply rollback: completed real-world operations (e.g., file writes, external API calls) are preserved with verified results.

---

## 5. Retry Policy & Idempotency Safeguards

### 5.1 Retry Classification Table

| Tool / Capability | Idempotent? | Has Side Effects? | Max Retries | Retryable Failure Codes |
|---|---|---|---|---|
| `system:get_time` | Yes | No | 3 | `temporary_provider_failure`, `timeout_before_dispatch`, `network_unavailable` |
| `workspace:get_context_summary` | Yes | No | 2 | `temporary_provider_failure`, `timeout_before_dispatch`, `rate_limited` |
| `documents:extract_text` | Yes | No | 2 | `temporary_provider_failure`, `resource_exhausted` |
| `media:get_capture_sources` | Yes | No | 2 | `temporary_provider_failure`, `timeout_before_dispatch` |
| `models:list_available` | Yes | No | 3 | `temporary_provider_failure`, `rate_limited`, `network_unavailable` |
| `prohibited:shell_execute` | No | Yes | 0 (No retry) | None |

### 5.2 Non-Retryable Error Classes
- `validation_failure`: Malformed inputs violate schema; retrying without changing inputs is futile.
- `authorization_failure`: Requester lacks required capability or user denied consent.
- `confirmation_rejected`: User rejected explicit confirmation prompt.
- `unsupported_capability`: Capability not available in runtime environment.
- `cancelled`: Task was aborted by user or system policy.
- `unknown_outcome`: Operation may have partially succeeded; blind retries could cause duplicate side effects.

### 5.3 Exponential Backoff with Jitter
For retryable errors, delay is calculated as:
$$\text{delay} = \min\left(\text{maxDelayMs}, \text{initialDelayMs} \times \text{backoffMultiplier}^{\text{attempt}-1}\right) \times (1 + \text{jitter})$$
where $\text{jitter} \in [-0.10, +0.10]$.
Backoff waiting is cooperative and terminates immediately if the cancellation signal fires.

---

## 6. Structured Execution Audit Trail

### 6.1 Audit Schema
```typescript
export interface AuditEvent {
  readonly id: string
  readonly schemaVersion: '1.0.0'
  readonly taskId: string
  readonly stepId?: string
  readonly sequenceNumber: number
  readonly timestamp: number
  readonly eventType: AuditEventType
  readonly toolId?: string
  readonly toolVersion?: string
  readonly attemptNumber: number
  readonly previousState?: string
  readonly newState: string
  readonly resultCategory?: string
  readonly authorizationOutcome?: 'granted' | 'denied'
  readonly confirmationOutcome?: 'not_required' | 'approved' | 'rejected'
  readonly durationMs?: number
  readonly sourceComponent: string
  readonly sanitizedMetadata?: Record<string, unknown>
}
```

### 6.2 Data Privacy & Sanitization Rules
1. **Credential Stripping**: Any key matching `/(?:key|token|secret|password|credential|auth|bearer|signature|cookie|payload)/i` is replaced with `'[REDACTED]'`.
2. **Binary Buffer Suppression**: `Buffer` or `Uint8Array` instances are replaced with `[Binary buffer: N bytes]` rather than dumping byte arrays.
3. **Payload Truncation**: Strings exceeding 256 characters are truncated with `... [TRUNCATED]`.
4. **Ring-Buffer Bounding**: Maximum 500 events stored per task, maximum 5000 global events across all tasks.
5. **Immutability**: Every created audit event is frozen via `Object.freeze()` to prevent post-hoc modification.

---

## 7. Verification and Testing Summary

- **Progress Lifecycle**: Validated ordered progression, monotonic sequence numbers, accurate completed/total step counts, and terminal states.
- **Cancellation**: Validated pre-dispatch cancellation, active tool abort propagation via `AbortSignal`, downstream step skipping, and `partially_completed` outcomes.
- **Retries**: Validated bounded attempt limits, idempotency guards, exclusion of non-idempotent side effects, non-retryable error classification, and cancellation during backoff.
- **Audit Trail**: Validated sequential recording, immutability, privacy redaction, buffer suppression, ring buffer limits, query filtering, and task purging.
- **Test Suite Results**: 51 test files, 308 tests passing, 0 failures. Typecheck clean for Node and Web. Production build clean.
