# HELIOXEN AI — STEP 18 COMPLETION REPORT
**Step 18 of 48:** Task-Based Model Routing, Fallbacks and Provider Health Monitoring  
**Phase:** Phase 6: AI Provider and Model Infrastructure  
**Execution Status:** `PASS` (All mandatory criteria satisfied with verifiable test evidence)  
**Date:** November 1, 2026  
**System Target:** Windows 10/11 Desktop (Electron + React + TypeScript + DPAPI)  

---

## 1. Overall Status & Executive Summary

Step 18 has been completed with an evaluation of **`PASS`**. 

A deterministic, capability-aware, policy-controlled model-routing layer has been implemented and integrated with HELIOXEN's existing provider adapters (Step 16), DPAPI secure credential storage (Step 15), and model registry (Step 17). 

Crucially, the implementation preserves strict user control:
- Manual user model selections take precedence by default.
- Task-based intelligent routing activates only when explicitly enabled by the user in Settings.
- Cross-provider fallback is disabled by default and requires explicit user consent accompanied by clear privacy disclosure.
- Provider health monitoring is strictly evidence-based, bounded, uses a 3-failure circuit breaker and rate-limit backoff, and introduces zero continuous background polling or paid network probes.
- In streaming operations, if one or more chunks have been delivered to the user interface, fallback is strictly blocked to prevent contradictory or hallucinated cross-model token blending.

---

## 2. Steps 1–17 Pre-Implementation Audit & Baseline Verification

Before implementing Step 18, an audit of prior work was conducted:
1. **Model Registry & Capability Profiles (Step 17):** Verified `ModelRegistry.ts`, `CURATED_MODELS`, and `CURATED_PROVIDERS`. Confirmed model identifiers (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-4-argon`, `gpt-4o`, `gpt-4o-mini`, `o3-mini`) and verified capabilities.
2. **Provider Adapters & Vault Integration (Step 16):** Verified `GoogleGeminiAdapter`, `OpenAiAdapter`, DPAPI encryption via `CredentialStorageService`, and `ProviderService`.
3. **Security Architecture (Steps 13–15):** Verified typed IPC contracts, `assertValidSender`, capability authorizer (`authorizer.authorize`), DPAPI vault isolation, and `securityLogger`.
4. **Baseline Validation:** Ran `npm.cmd test`; verified all 69 existing unit and integration tests passing.

---

## 3. Architecture & Implemented Components

### 3.1 Model Eligibility Service (`src/main/ai/ModelEligibilityService.ts`)
Validates model eligibility against five distinct boundaries:
- **Registration:** Verifies candidate exists in the authoritative registry.
- **Policy Status:** Requires model status to be `active` or `preview` (rejects `disabled` or `deprecated`).
- **DPAPI Credential:** Checks whether the provider's API key is stored in the DPAPI vault.
- **Provider Health:** Ensures provider is not in `unavailable` (circuit breaker open), `auth-failed`, or active `rate-limited` cooldown.
- **Two-Tier Capability Check:** Validates model-level support (`supported`) and HELIOXEN runtime status (`supported`). Unknown capabilities for required task dimensions are strictly rejected.

### 3.2 Provider Health Service (`src/main/ai/ProviderHealthService.ts`)
Maintains evidence-based health tracking:
- **States:** `unknown`, `healthy`, `degraded`, `rate-limited`, `unavailable`, and `auth-failed`.
- **Circuit Breaker:** Trips to `unavailable` after 3 consecutive network/timeout errors with a 30-second cooldown, transitioning to `degraded` (half-open) to permit a recovery probe.
- **Rate Limit Backoff:** Sets `rate-limited` state with an automatic 60-second cooldown.
- **Expiry:** Healthy observations expire to `unknown` after 5 minutes (300,000ms) without evidence.
- **Resource Discipline:** Zero continuous background polling and zero automated paid network probes.

### 3.3 Model Router (`src/main/ai/ModelRouter.ts`)
Implements deterministic selection and fallback candidate generation:
- **Task Types:** `conversation`, `fast-response`, `complex-reasoning`, `structured-extraction`.
- **Manual Mode (Default):** Strictly routes to user's selected active model.
- **Task-Based Mode:** Evaluates eligible models and scores them deterministically:
  - Preferred tier match: +100
  - Active provider affinity: +20
  - Default model affinity: +10
  - Tie-breaker: Alphabetical comparison of model ID.
- **Fallback Candidate Generator:** Generates same-provider candidates (if enabled) and cross-provider candidates (strictly gated by user consent).

### 3.4 Provider Service Coordination (`src/main/ai/ProviderService.ts`)
- Replaces hardcoded dispatch with routed execution.
- Employs a controlled fallback loop for eligible failures.
- **Partial Stream Preservation:** If `chunksEmitted > 0`, fallbacks are strictly prohibited to protect conversation integrity from conflicting token blending.

### 3.5 Preload Bridge & IPC Contracts
- Added `window.helioxen.health.getStatus()` and `window.helioxen.routing.getTaskDefinitions()`.
- Extended typed schemas: `AiTaskTypeSchema`, `RoutingModeSchema`, `UserAiPreferencesSchema` with `routingMode`, `allowSameProviderFallback`, and `allowCrossProviderFallback`.

### 3.6 Settings UI Integration (`src/renderer/src/components/settings/ProviderSettingsPanel.tsx`)
- Real-time health status pills next to provider tabs (`Healthy`, `Degraded`, `Rate Limited`, `Auth Failed`, `Unavailable`, `Untested`).
- Routing Strategy Switcher (`Manual Explicit Selection` vs `Task-Based Intelligent Selection`).
- Fallback check-boxes with amber privacy disclosure for cross-provider data transfers.

---

## 4. Policy Tables

### 4.1 Routing Policy Table

| Task Category | Required Capabilities | Selection Policy | Fallback Permitted | User-Control Requirements |
|---|---|---|---|---|
| `conversation` | `textGeneration`, `streaming` | Manual default; Tier-based ranking if task-based mode enabled | Same-provider: Permitted (opt-out). Cross-provider: Strict opt-in | Explicit active model selection honored; requires toggle to activate task-based selection. |
| `fast-response` | `textGeneration`, `streaming` | Selects lowest latency ultra-fast registered model (`gemini-3.5-flash-lite`, `gpt-4o-mini`) | Same-provider: Permitted. Cross-provider: Strict opt-in | User can override to force manual selection. |
| `complex-reasoning`| `textGeneration`, `streaming` | Selects highest capacity reasoning tier (`gemini-4-argon`, `gpt-4o`) | Same-provider: Permitted. Cross-provider: Strict opt-in | Requires explicit user consent before dispatching high-context requests. |
| `structured-extraction` | `textGeneration`, `structuredOutput` | Selects registered model verifying verified `structuredOutput` support | Same-provider: Permitted. Cross-provider: Strict opt-in | Rejects candidates if structured output is unsupported or unverified. |

### 4.2 Error Classification & Fallback Table

| Failure Category | Retry Allowed | Cross-Provider Fallback Allowed | User Intervention Required | Rationale |
|---|---|---|---|---|
| `AUTHENTICATION_FAILED` | ❌ No | ❌ No (same-provider) / ✅ Yes (cross-provider if enabled) | ✅ Yes | Invalid credentials cannot self-heal; re-attempting identical provider is futile. |
| `RATE_LIMIT_EXCEEDED` | ✅ Yes (same-provider model) | ✅ Yes (if enabled) | ❌ No (automatic fallback to secondary model) | Transient quota depletion on one model can often succeed on a different model. |
| `NETWORK_ERROR` / `TIMEOUT` | ✅ Yes (same-provider model) | ✅ Yes (if enabled) | ❌ No | Transient network resets can be recovered via alternative model/provider. |
| `INVALID_MODEL` | ❌ No | ❌ No | ✅ Yes | Configuration error; request payload must be corrected. |
| `CANCELLED` | ❌ No | ❌ No | ❌ No | User initiated cancellation; aborts all execution immediately. |
| `MISSING_CREDENTIAL` | ❌ No | ❌ No | ✅ Yes | API key missing from DPAPI vault. Requires key entry in Settings. |

### 4.3 Health State Table

| State | Evidence Required | Expiry or Recovery Condition | Routing Consequence |
|---|---|---|---|
| `unknown` | Initial baseline; or healthy record older than 5 minutes | First user-initiated request or manual connection test | Fully eligible for requests. |
| `healthy` | Successful completion of text or stream generation request | Expires to `unknown` after 300,000ms (5 minutes) without new evidence | Fully eligible for primary selection and fallback. |
| `degraded` | Single network or timeout error; or recovery from circuit breaker/rate limit | Restored to `healthy` on next successful request | Eligible for routing, but penalized in fallback ordering. |
| `rate-limited` | HTTP 429 response from provider | Automatic cooldown expiry after 60,000ms (60s) to `degraded` | Ineligible for routing until cooldown expires. |
| `unavailable` | 3 consecutive network/provider errors (circuit breaker trip) | Automatic cooldown expiry after 30,000ms (30s) to `degraded` (half-open) | Ineligible for routing until cooldown expires. |
| `auth-failed` | HTTP 401/403 or `AUTHENTICATION_FAILED` exception | Manual credential update or key deletion in Settings | Ineligible for routing until user updates credential in vault. |

---

## 5. Security & Privacy Validation

- **Credential Isolation:** The router only handles provider IDs (`google-gemini`, `openai`). DPAPI decrypted secrets remain encapsulated within `ProviderService.getApiKey()` in the main process.
- **Cross-Provider Data Flow:** Prompt context is NEVER transmitted to an alternative vendor infrastructure unless the user has explicitly checked "Allow Cross-Provider Fallback" in Settings.
- **Redaction in Auditing:** All routing events logged via `securityLogger` log only metadata (correlation ID, taskType, model, provider, strategy) with zero prompt or token content.
- **Zero Hallucinated Capabilities:** If a model's capability in `ModelRegistry` is marked `unknown` or `unsupported`, `ModelEligibilityService` strictly rejects it for tasks requiring that dimension.

---

## 6. Verification & Automated Test Results

The test suite was executed via `npm.cmd test` (Vitest):

```
✓ tests/ai/providerHealth.test.ts  (8 tests)
✓ tests/ai/modelRegistry.test.ts  (6 tests)
✓ tests/ai/modelRouter.test.ts  (7 tests)
✓ tests/security/credentialStorage.test.ts  (8 tests)
✓ tests/ai/providerService.test.ts  (11 tests)
✓ tests/ai/modelEligibility.test.ts  (7 tests)
✓ tests/ai/geminiAdapter.test.ts  (7 tests)
✓ tests/security/authorizer.test.ts  (7 tests)
✓ tests/ai/contracts.test.ts  (8 tests)
✓ tests/security/consentGate.test.ts  (5 tests)
✓ tests/ai/preferencesStorage.test.ts  (5 tests)
✓ tests/ai/openAiAdapter.test.ts  (4 tests)
✓ tests/security/securityLogger.test.ts  (3 tests)
✓ tests/ipc/validation.test.ts  (4 tests)
✓ tests/ipc/contracts.test.ts  (3 tests)
✓ tests/ipc/errors.test.ts  (3 tests)

Test Files  16 passed (16)
Tests       96 passed (96)
```

- **Typecheck (Node SSR):** `npm.cmd run typecheck:node` passed with 0 errors.
- **Typecheck (Web Renderer):** `npm.cmd run typecheck:web` passed with 0 errors.
- **Production Bundle:** `npm.cmd run build` transformed 2,089 modules with zero build errors (`out/main/index.js`, `out/preload/index.js`, `out/renderer/`).

---

## 7. Inventory of Modified & Created Files

| File Path | Status | Purpose |
|---|---|---|
| `src/shared/ai/routing.ts` | Created | Authoritative types, task definitions, health interfaces, and fallback candidate contracts. |
| `src/main/ai/ModelEligibilityService.ts` | Created | Deterministic capability, status, credential, and health validation engine. |
| `src/main/ai/ProviderHealthService.ts` | Created | Evidence-based health tracker with 3-failure circuit breaker and rate limit backoff. |
| `src/main/ai/ModelRouter.ts` | Created | Deterministic routing coordinator and controlled fallback evaluator. |
| `src/shared/ai/models.ts` | Modified | Added routing preferences (`routingMode`, fallback flags) and defaults. |
| `src/shared/ai/types.ts` | Modified | Added optional `taskType` to `AiGenerationRequest` and made `provider` optional for routed calls. |
| `src/shared/ai/contracts.ts` | Modified | Runtime Zod schemas for `AiTaskTypeSchema`, `RoutingModeSchema`, and generation/preferences requests. |
| `src/shared/ai/index.ts` | Modified | Exported routing contracts and types. |
| `src/shared/ipc/channels.ts` | Modified | Registered `HEALTH_GET_STATUS` and `ROUTING_GET_TASK_DEFINITIONS` channels. |
| `src/shared/security/capabilities.ts` | Modified | Registered capabilities for health and routing channels. |
| `src/main/security/securityLogger.ts` | Modified | Added `ROUTING_DECISION` and `HEALTH_UPDATE` security event types. |
| `src/main/ai/index.ts` | Modified | Re-exported `ModelEligibilityService`, `ProviderHealthService`, and `ModelRouter`. |
| `src/main/ai/ProviderService.ts` | Modified | Integrated `ModelRouter`, `ProviderHealthService`, fallback loop, and partial-stream guard. |
| `src/main/index.ts` | Modified | Initialized router services, wired IPC handlers, and added cleanup. |
| `src/preload/types.ts` | Modified | Added `health` and `routing` APIs to `HelioxenApi`. |
| `src/preload/index.ts` | Modified | Exposed safe `health` and `routing` bridges to renderer. |
| `src/renderer/src/components/settings/ProviderSettingsPanel.tsx` | Modified | Added health status badges, routing mode selectors, fallback gates, and privacy disclosure. |
| `src/renderer/src/components/workspace/CommandCenter.tsx` | Modified | Dispatched generation requests with explicit `taskType: 'conversation'`. |
| `tests/ai/modelEligibility.test.ts` | Created | Automated unit tests for capability-aware eligibility engine. |
| `tests/ai/providerHealth.test.ts` | Created | Automated unit tests for evidence-based health tracking and circuit breaking. |
| `tests/ai/modelRouter.test.ts` | Created | Automated unit tests for deterministic task routing and candidate ranking. |
| `tests/ai/providerService.test.ts` | Modified | Added integration tests for routed calls, same-provider fallback, and stream protection. |
| `tests/ai/contracts.test.ts` | Modified | Added tests for new routing schemas and preference contracts. |
| `docs/architecture/HELIOXEN_TASK_BASED_ROUTING_FALLBACKS_AND_PROVIDER_HEALTH.md` | Created | Comprehensive architectural specification and policy tables. |
| `docs/STEP_18_COMPLETION_REPORT.md` | Created | Duplicate copy of completion report for documentation consistency. |
| `STEP_18_COMPLETION_REPORT.md` | Created | Authoritative completion report for Step 18. |

---

## 8. Target Rollback Summary

Should a rollback of Step 18 be required, revert the modified files:
- Revert `src/main/ai/ProviderService.ts` to dispatch directly to the provider adapter from request/preferences without `ModelRouter`.
- Delete `src/main/ai/ModelRouter.ts`, `src/main/ai/ModelEligibilityService.ts`, and `src/main/ai/ProviderHealthService.ts`.
- Revert `src/preload/index.ts` and `src/preload/types.ts` to remove `health` and `routing` namespaces.
- Remove the "Model Routing & Fallback Rules" card from `ProviderSettingsPanel.tsx`.
- Delete `tests/ai/modelEligibility.test.ts`, `tests/ai/providerHealth.test.ts`, and `tests/ai/modelRouter.test.ts`.

---

## 9. Strict Stop Boundary & Recommended Next Step

**STRICT STOP APPLIED AT STEP 18.**
- No Phase 7 (Microphone Capture, Audio Buffering and Speech Playback) code has been introduced.
- No real-time voice sessions, wake-word detection, or media capture APIs have been implemented.
- No agent orchestration, dynamic tool execution, or OS automation was started.

**Recommended Next Step:**
When explicitly authorized by the user, proceed to **Phase 7, Step 19 of 48: Microphone Capture, Audio Buffering and Speech Playback**.
