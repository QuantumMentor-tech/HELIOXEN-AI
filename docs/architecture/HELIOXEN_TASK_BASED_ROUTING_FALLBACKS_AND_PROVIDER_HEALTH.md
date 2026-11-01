# HELIOXEN Architecture Document: Task-Based Routing, Fallbacks & Provider Health Monitoring

**Document ID:** `HELIOXEN-ARCH-STEP-18`  
**Version:** 1.0.0 (Step 18 of 48)  
**Phase:** Phase 6: AI Provider and Model Infrastructure  
**Status:** Approved & Implemented  
**Date:** November 1, 2026  

---

## 1. Executive Summary & Routing Architecture

HELIOXEN implements a deterministic, policy-controlled AI model-routing layer that builds directly upon the existing secure credential vault (Step 15), provider adapters (Step 16), and capability registry (Step 17). 

The routing system satisfies two non-negotiable principles:
1. **User Control Takes Precedence:** Manual explicit model selections made by the user are strictly respected; the router never silently replaces an explicit user model choice merely because another model scores higher.
2. **Deterministic & Capability-Bound:** Routing decisions, fallback candidates, and health transitions are fully explainable, bounded, and audited. Untrusted model outputs cannot alter routing policies, and unknown capabilities are strictly rejected for required task dimensions.

```
+-----------------------------------------------------------------------------------+
|                           RENDERER (Command Center / UI)                          |
|  - Generation Request with explicit taskType ('conversation' | 'fast-response'..)  |
|  - Real-time stream consumer & fallback indicators                                |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Typed IPC Boundary ('ai:chat')
                                          v
+-----------------------------------------------------------------------------------+
|                        MAIN PROCESS: ProviderService                              |
|                                                                                   |
|  +---------------------------+        +----------------------------------------+  |
|  |     ModelRouter           |        |         ProviderHealthService          |  |
|  |  - Manual / Task-Based    |------->|  - Evidence-based health tracking      |  |
|  |  - Deterministic Ranking  |        |  - Circuit Breaker (3 fails, 30s cool) |  |
|  |  - Fallback Candidate Gen |        |  - Rate Limit Backoff (60s cooldown)   |  |
|  +---------------------------+        |  - Zero continuous background polling  |  |
|               |                       +----------------------------------------+  |
|               v                                                                   |
|  +---------------------------+                                                    |
|  |  ModelEligibilityService  |                                                    |
|  |  - Model-level validation |                                                    |
|  |  - HELIOXEN runtime check |                                                    |
|  |  - DPAPI credential check |                                                    |
|  +---------------------------+                                                    |
|               |                                                                   |
|               v                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Provider Adapter Execution (Gemini / OpenAI) via DPAPI Credential Vault     |  |
|  | - Single attempt execution with controlled fallback loop                   |  |
|  | - CRITICAL: Zero partial-stream blending across providers                   |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Supported Task Categories & Capability Matrix

The router defines four explicit internal task categories. Arbitrary prompt-injected task strings are prohibited.

| Task Category | Internal Key | Required Model Capabilities | Preferred Tier | Initial HELIOXEN Purpose |
|---|---|---|---|---|
| **General Dialogue** | `conversation` | `textGeneration`, `streaming` | `balanced` | Standard multi-turn interactive conversation in Command Center. |
| **Fast Response** | `fast-response` | `textGeneration`, `streaming` | `ultra-fast` | Rapid latency-sensitive interactions, command confirmations, short queries. |
| **Complex Reasoning** | `complex-reasoning` | `textGeneration`, `streaming` | `flagship-reasoning` | Deep analytical synthesis, architectural auditing, complex troubleshooting. |
| **Structured Extraction** | `structured-extraction` | `textGeneration`, `structuredOutput` | `balanced` | Entity extraction and structured data parsing. |

---

## 3. Policy & Selection Matrix

The routing policy dictates selection and fallback permissions for each task category:

| Task Category | Required Capabilities | Selection Policy | Fallback Permitted | User-Control Requirements |
|---|---|---|---|---|
| `conversation` | `textGeneration`, `streaming` | Manual default; Tier-based ranking if task-based mode enabled | Same-provider: Permitted (opt-out). Cross-provider: Strict opt-in | Explicit active model selection honored; requires toggle to activate task-based selection. |
| `fast-response` | `textGeneration`, `streaming` | Selects lowest latency ultra-fast registered model (e.g. `gemini-3.5-flash-lite`, `gpt-4o-mini`) | Same-provider: Permitted. Cross-provider: Strict opt-in | User can override to force flagship or manual selection. |
| `complex-reasoning`| `textGeneration`, `streaming` | Selects highest capacity reasoning tier (e.g. `gemini-4-argon`, `gpt-4o`) | Same-provider: Permitted. Cross-provider: Strict opt-in | Requires explicit user consent before dispatching high-context requests. |
| `structured-extraction` | `textGeneration`, `structuredOutput` | Selects registered model verifying verified `structuredOutput` support | Same-provider: Permitted. Cross-provider: Strict opt-in | Rejects candidates if structured output is unsupported or unverified. |

---

## 4. Model Eligibility Engine

`ModelEligibilityService` evaluates registered candidates across five distinct gates:
1. **Model Registration:** Model must exist in the authoritative curated or verified catalog.
2. **Policy Status:** Model must have an operational status of `active` or `preview`. Models marked `disabled` or `deprecated` are rejected (`EXCLUDED_BY_POLICY`).
3. **Credential Availability:** DPAPI vault must contain an active API key for the model's provider (`MISSING_CREDENTIAL`).
4. **Provider Operational Health:** Provider must not be blocked by circuit breaker (`status === 'unavailable'`), rate-limiting (`status === 'rate-limited'`), or authentication rejection (`status === 'auth-failed'`).
5. **Two-Tier Capability Verification:**
   - **Model-Level Verification:** Model must explicitly support the required capability (`supported`). Missing or `unknown` metadata is treated as unsupported.
   - **HELIOXEN Runtime Verification:** Capability must be actively integrated in the current desktop runtime phase. Unsupported capabilities (such as tool calling in Phase 6) are rejected (`HELIOXEN_RUNTIME_UNSUPPORTED`).

---

## 5. Candidate Ordering & Deterministic Scoring

When `routingMode === 'task-based'`, eligible models are ranked using a deterministic scoring algorithm:
- **Base Score:** 0
- **Preferred Tier Match:** +100 points if `model.capabilities.tier === task.preferredTier`.
- **Active Provider Affinity:** +20 points if `model.providerId === preferences.activeProvider`.
- **Default Model Affinity:** +10 points if `model.isDefault === true`.
- **Deterministic Tie-Breaking:** If two models have equal scores, candidate ordering is resolved alphabetically by canonical model ID (`localeCompare`). No randomized or opaque scoring is used.

---

## 6. Controlled Fallbacks & Failure Policy

Fallbacks are strictly bounded and transparently audited.

### 6.1 Failure & Fallback Policy Table

| Failure Category | Retry Allowed | Cross-Provider Fallback Allowed | User Intervention Required | Rationale |
|---|---|---|---|---|
| `AUTHENTICATION_FAILED` | ❌ No | ❌ No (same-provider) / ✅ Yes (cross-provider if enabled) | ✅ Yes | Invalid credentials cannot self-heal; re-attempting identical provider is futile and risks lockout. |
| `RATE_LIMIT_EXCEEDED` | ✅ Yes (same-provider model) | ✅ Yes (if enabled) | ❌ No (automatic fallback to secondary model) | Transient quota depletion on one model can often succeed on a different model or alternate provider. |
| `NETWORK_ERROR` / `TIMEOUT` | ✅ Yes (same-provider model) | ✅ Yes (if enabled) | ❌ No | Transient network resets can be recovered via alternative model/provider. |
| `INVALID_MODEL` | ❌ No | ❌ No | ✅ Yes | Configuration error; request payload must be corrected. |
| `CANCELLED` | ❌ No | ❌ No | ❌ No | User initiated cancellation; aborts all execution immediately. |
| `MISSING_CREDENTIAL` | ❌ No | ❌ No | ✅ Yes | API key missing from DPAPI vault. Requires key entry in Settings. |

### 6.2 Critical Rule: Partial Stream Preservation
In `ProviderService.streamText`, if one or more stream chunks (`chunksEmitted > 0`) have already been delivered to the UI before an error occurs, the service **STRICTLY REFUSES TO FALL BACK**. Blending partial output from one model with another produces corrupted, halluncinated, or contradictory responses. The stream is halted immediately with an explicit error.

---

## 7. Bounded Provider Health Monitoring

`ProviderHealthService` maintains bounded health records derived exclusively from real user-authorized transactions and manual connectivity tests.

### 7.1 Health State Table

| State | Evidence Required | Expiry or Recovery Condition | Routing Consequence |
|---|---|---|---|
| `unknown` | Initial baseline; or healthy record older than 5 minutes | First user-initiated request or manual connection test | Fully eligible for requests. |
| `healthy` | Successful completion of text or stream generation request | Expires to `unknown` after 300,000ms (5 minutes) without new evidence | Fully eligible for primary selection and fallback. |
| `degraded` | Single network or timeout error; or recovery from circuit breaker/rate limit | Restored to `healthy` on next successful request | Eligible for routing, but penalized in fallback ordering. |
| `rate-limited` | HTTP 429 response from provider | Automatic cooldown expiry after 60,000ms (60s) to `degraded` | Ineligible for routing until cooldown expires. |
| `unavailable` | 3 consecutive network/provider errors (circuit breaker trip) | Automatic cooldown expiry after 30,000ms (30s) to `degraded` (half-open) | Ineligible for routing until cooldown expires. |
| `auth-failed` | HTTP 401/403 or `AUTHENTICATION_FAILED` exception | Manual credential update or key deletion in Settings | Ineligible for routing until user updates credential in vault. |

### 7.2 Zero Background Polling
HELIOXEN desktop does **not** employ recurring background timers, cloud pings, or unapproved paid generation probes. Health state updates purely on demand as real requests execute.

---

## 8. Configuration & User Privacy Controls

### 8.1 Settings UI Integration
The Provider Settings panel (`ProviderSettingsPanel.tsx`) incorporates:
- **Provider Health Badges:** Real-time visual status pills next to each provider tab (`Healthy`, `Degraded`, `Rate Limited`, `Auth Failed`, `Unavailable`, `Untested`).
- **Routing Strategy Switcher:** Radio toggle between `Manual Explicit Selection` and `Task-Based Intelligent Selection`.
- **Fallback Controls:**
  - Checkbox: `Allow Same-Provider Model Fallback` (Default: `true`).
  - Checkbox: `Allow Cross-Provider Fallback` (Default: `false`).
- **Privacy Warning Disclosure:** When cross-provider fallback is checked, an amber alert clearly informs the user that prompt context will cross cloud vendor data boundaries (Google <-> OpenAI) in the event of primary provider failure.

---

## 9. Security & Auditing Boundaries

1. **DPAPI Credential Isolation:** The router never receives or logs API keys. It works exclusively with provider identifiers (`google-gemini`, `openai`).
2. **Untrusted Renderer Protection:** The renderer cannot pass arbitrary adapter IDs or unregistered model names; all inputs are validated against `AiGenerationRequestSchema` and `ModelRegistry`.
3. **Security Event Logging:** Every routing decision, fallback execution, and health transition is logged via `securityLogger.logEvent` with sensitive token content redacted.

---

## 10. Verification Evidence & Automated Test Results

Automated regression test coverage (Vitest):
- `tests/ai/modelEligibility.test.ts`: 7/7 tests passing (registration, missing credential, unhealthy provider, capability verification, runtime status).
- `tests/ai/providerHealth.test.ts`: 8/8 tests passing (evidence tracking, auth failure, rate limit cooldown, circuit breaker trips at 3 failures, TTL expiry).
- `tests/ai/modelRouter.test.ts`: 7/7 tests passing (manual mode, fast-response tier, complex reasoning tier, same-provider fallback, cross-provider gate).
- `tests/ai/providerService.test.ts`: 11/11 tests passing (routed generation, same-provider fallback, partial stream preservation, health reporting).
- `tests/ai/contracts.test.ts`: 8/8 tests passing (AiTaskTypeSchema, RoutingModeSchema, UserAiPreferencesSchema).
- **Total AI Test Suite:** 16 test suites, **96 tests passing**.
- **Typecheck:** 0 errors across Node SSR and Web Renderer.
- **Production Bundle:** Built cleanly via `electron-vite build`.
