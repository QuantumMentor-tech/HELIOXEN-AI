# HELIOXEN AI — AI Provider Adapters & Secure Credential Vault Integration
**Document Version:** 1.0.0  
**Phase:** Phase 6, AI Provider and Model Infrastructure  
**Step:** Step 16 of 48  
**Classification:** Core System Architecture Document  
**Official Research Date:** November 1, 2026  

---

## 1. Executive Summary & Purpose

This document specifies the AI Provider Infrastructure for **HELIOXEN AI**, establishing the bridge between the Electron desktop shell, conversation pipeline, and external Large Language Model (LLM) APIs.

Step 16 integrates the secure DPAPI credential vault created in Step 15 with provider-neutral adapter abstractions and provider-specific SDK integrations. It establishes a genuine, streaming text-generation pipeline from the user conversation interface without exposing long-lived credentials to renderer processes, persistent web storage, or diagnostics.

---

## 2. Approved Provider Inventory

Per `HELIOXEN_TECH_STACK_DECISION.md` and `ADR-004`:

| Provider | Status | SDK / Transport | Approved Models | Default Model | Authentication Header / Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Gemini** | **Primary (Active)** | `@google/genai` (`^2.32.0`) | `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-4-argon` | `gemini-3.8-flash` | `x-goog-api-key: [SECRET]` or client init |
| **OpenAI** | **Secondary (Active)** | `openai` (`^7.47.0`) | `gpt-4o-mini`, `gpt-4o` | `gpt-4o-mini` | `Authorization: Bearer [SECRET]` |

> [!IMPORTANT]
> **Legacy Gemini Model Deprecation Notice:**
> Per Google Gemini API documentation, legacy models (`gemini-1.5-*`, `gemini-2.0-*`, `gemini-2.5-*`) are deprecated. The `GeminiAdapter` actively rejects legacy model identifiers and directs requests to `gemini-3.8-flash`.

---

## 3. Trust Boundaries & Credential Lifecycle

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS (Untrusted)                    │
│  - ConversationPanel & Composer                                        │
│  - CredentialSettingsPanel (Masked Input, Ephemeral State)             │
│  - Preload Bridge (window.helioxen.ai / credentials)                   │
│  - NO access to native safeStorage / NO decrypted keys stored          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ [ContextBridge / Typed IPC Channels]
                                    │ [assertValidSender & validateIpcPayload]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TRUSTED MAIN PROCESS (Coordinator)                   │
│  - Authorizer: Checks capability ('ai:chat', 'credentials:set')        │
│  - ProviderService: Orchestrates adapters & request lifecycle          │
│  - CredentialStorageService: DPAPI safeStorage decryption              │
│  - SecurityLogger: Redacted event audit logging                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL AI PROVIDERS                           │
│  - Google Gemini API (https://generativelanguage.googleapis.com)       │
│  - OpenAI API (https://api.openai.com)                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Credential Lifecycle Table

| Stage | Trusted Owner | Secret Exposed to Renderer? | Storage / Memory Behavior | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Key Entry** | Renderer UI | Temporary masked input | Cleared immediately upon successful IPC save | Discards on error; shows actionable notice |
| **Persistence** | Main Process | No | Encrypted with Windows DPAPI -> Atomic write to `credentials.json` | Fails closed; throws `OPERATION_UNAVAILABLE` |
| **Retrieval** | Main Process | No | In-memory decryption strictly for duration of provider request | Throws `MISSING_CREDENTIAL`; prompts user |
| **Status Query** | Preload / Renderer | No | Returns boolean `configured: true` and non-sensitive label | Returns `configured: false` |
| **Deletion** | Main Process | No | Key removed from DPAPI storage index -> Atomic write | Returns `false` if not found |

---

## 4. Provider-Neutral Architecture & Contracts

Shared contracts are defined in [`src/shared/ai/types.ts`](../../src/shared/ai/types.ts) and validated via Zod in [`src/shared/ai/contracts.ts`](../../src/shared/ai/contracts.ts).

### 4.1 Interface Specification
```typescript
export interface AiProviderAdapter {
  readonly providerId: AiProviderId
  readonly defaultModel: string
  generateText(
    request: AiGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse>
  streamText(
    request: AiGenerationRequest,
    apiKey: string,
    onChunk: (chunk: AiStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<AiGenerationResponse>
}
```

### 4.2 Streaming Protocol
1. Renderer invokes `window.helioxen.ai.generateText({ provider, messages, stream: true })`.
2. Main process initializes an `AbortController` and invokes `adapter.streamText(...)`.
3. As the provider returns deltas, main sends `IPC_CHANNELS.AI_STREAM_CHUNK` events to the caller `WebContents`.
4. The renderer updates the assistant message incrementally and sets the AI Core state to `'speaking'`.
5. Upon stream completion (`chunk.isDone = true`), main process resolves the invocation with the complete `AiGenerationResponse`.

---

## 5. Normalized Error Model

The adapter layer normalizes provider-specific error responses into structured `AiProviderException` instances:

| Internal Error Code | Provider Condition | User-Facing Safe Behavior | Retryable? |
| :--- | :--- | :--- | :--- |
| `MISSING_CREDENTIAL` | No API key in DPAPI vault | "AI Provider Key Required: Please open Settings to configure your key." | No |
| `AUTHENTICATION_FAILED` | HTTP 401 / 403 / Invalid Key | "Authentication Rejected: Stored API key was rejected by provider." | No |
| `RATE_LIMIT_EXCEEDED` | HTTP 429 / RESOURCE_EXHAUSTED | "Rate Limit Exceeded: Quota reached. Please wait before retrying." | Yes |
| `INVALID_MODEL` | Deprecated or unapproved model | "Model not recognized or legacy. Using approved default." | No |
| `NETWORK_ERROR` | Connection drop / DNS failure | "Network connection to AI provider failed. Check internet connectivity." | Yes |
| `TIMEOUT` | Request exceeded deadline | "Request timed out while awaiting provider response." | Yes |
| `CANCELLED` | Aborted via `AbortController` | Stream halted; UI returns smoothly to idle state | No |
| `PROVIDER_ERROR` | HTTP 500 / 503 Internal Error | "AI provider service error. Please try again shortly." | Yes |

---

## 6. Minimal Credential Management UI

Implemented in [`src/renderer/src/components/settings/CredentialSettingsPanel.tsx`](../../src/renderer/src/components/settings/CredentialSettingsPanel.tsx):
- Embedded directly into the Navigation Rail's **Settings** destination.
- Provider cards for **Google Gemini** and **OpenAI**.
- Displays non-sensitive status badge (`CONFIGURED` / `NOT CONFIGURED`).
- Masked key input with show/hide toggle.
- Save Key: passes key to main process, saves in DPAPI vault, and immediately clears component state.
- Delete Key: purges key from DPAPI vault.
- Test Connection: explicit user-initiated button that performs a single 1-token ping request and displays measured round-trip latency.

---

## 7. Automated Test Evidence

Automated tests are located in [`tests/ai/`](../../tests/ai/):

| Test Suite | Tests | Coverage Scope | Result |
| :--- | :--- | :--- | :--- |
| `tests/ai/geminiAdapter.test.ts` | 7 | Unary generation, streaming chunks, cancellation, legacy model rejection, 401 & 429 normalization | **PASS** |
| `tests/ai/openAiAdapter.test.ts` | 4 | Unary generation, streaming chunks, model validation, 401 normalization | **PASS** |
| `tests/ai/providerService.test.ts` | 6 | Capability authorization, vault retrieval, missing key rejection, status listing, deletion, connection test | **PASS** |
| `tests/ai/contracts.test.ts` | 4 | Zod request/credential payload validation, rejection of empty messages & unapproved providers | **PASS** |

**Total Repository Unit Tests:** 54 passing tests across 11 test suites.

---

## 8. Unsupported & Deferred Capabilities (Strict Scope Boundaries)

In compliance with Step 16 execution boundaries:
- **NO Task-Based Model Routing or Fallback:** Reserved for Step 18.
- **NO Model Registry or Catalog UI:** Reserved for Step 17.
- **NO Real-Time Audio / Voice Sessions:** Reserved for Steps 19–21.
- **NO Camera or Screen Capture:** Reserved for Steps 22–24.
- **NO Tool Calling or Agent Execution:** Reserved for Steps 25–28.
