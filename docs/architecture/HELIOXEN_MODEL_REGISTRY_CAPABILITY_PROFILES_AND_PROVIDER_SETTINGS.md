# HELIOXEN AI — Model Registry, Capability Profiles and Provider Settings
**Document Version:** 1.0.0  
**Phase:** Phase 6, AI Provider and Model Infrastructure  
**Step:** Step 17 of 48  
**Classification:** Core System Architecture Document  
**Official Research Date:** November 1, 2026  

---

## 1. Executive Summary & Purpose

This architecture document specifies the **Model Registry, Capability Profiles, and Provider Settings** foundation for **HELIOXEN AI**. 

Step 17 establishes an authoritative, maintainable, evidence-backed registry of AI providers and models, allowing users to:
1. Inspect configured AI providers (`google-gemini` and `openai`).
2. Clearly distinguish between **Provider-Level Capabilities**, **Model-Level Capabilities**, and **HELIOXEN Desktop Runtime Support**.
3. Select an active provider and model explicitly with persistent preferences.
4. Refresh model catalogs on-demand through official provider listing endpoints without startup polling or secret leakage.
5. Control conversation text generation through user-selected models without hardcoding or unauthorized automatic model switching.

Automatic task routing, cost/latency fallback, automated health polling, and tool execution remain strictly prohibited and deferred to subsequent roadmap steps (Step 18+).

---

## 2. System Architecture & Component Interaction

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS (Untrusted)                    │
│  - ProviderSettingsPanel (Model Selector, Capabilities Table, Vault)   │
│  - CommandCenter (Dialogue Composer using active preferences)          │
│  - Preload APIs: window.helioxen.models & preferences                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ [Typed IPC Channels]
                                    │ - models:getCatalog, models:refresh
                                    │ - preferences:get, preferences:set
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TRUSTED MAIN PROCESS (Coordinator)                   │
│                                                                        │
│  ┌────────────────────────┐         ┌────────────────────────┐         │
│  │     ModelRegistry      │         │   PreferencesStorage   │         │
│  │  - Curated Catalog     │         │  - Atomic Disk I/O     │         │
│  │  - Discovered Cache    │         │  - Schema Validation   │         │
│  │  - Model Verification  │         │  - Default Recovery    │         │
│  └───────────┬────────────┘         └───────────┬────────────┘         │
│              │                                  │                      │
│              ▼                                  ▼                      │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │                      ProviderService                      │         │
│  │  - Validates model ownership (rejects cross-provider)     │         │
│  │  - Retrieves DPAPI secret key strictly inside Main        │         │
│  │  - Dispatches to GeminiAdapter or OpenAiAdapter           │         │
│  └───────────────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Approved Provider Registry Inventory

| Provider ID | Actual Adapter | Discovery Strategy | Credential State Source | Integration Status |
| :--- | :--- | :--- | :--- | :--- |
| **`google-gemini`** | `GeminiAdapter` (`@google/genai` v2.32.0) | Curated catalog + manual API discovery (`v1beta/models`) | Native DPAPI Secure Vault (`credentials.json`) | **Active & Verified** |
| **`openai`** | `OpenAiAdapter` (`openai` v7.47.0) | Curated catalog + manual API discovery (`v1/models`) | Native DPAPI Secure Vault (`credentials.json`) | **Active & Verified** |

---

## 4. Official Model Research Sources & Evidence

Model specifications and capabilities were verified against official provider documentation as of **November 1, 2026**:
- **Google Gemini Documentation:**
  - Official Models Overview: [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
  - Text Generation Guide: [ai.google.dev/gemini-api/docs/text-generation](https://ai.google.dev/gemini-api/docs/text-generation)
  - Canonical Identifiers: `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-4-argon`
- **OpenAI Documentation:**
  - Official Models Reference: [developers.openai.com/api/reference/resources/models](https://developers.openai.com/api/reference/resources/models)
  - Text Generation & Chat Guide: [developers.openai.com/api/docs/guides/text](https://developers.openai.com/api/docs/guides/text)
  - Canonical Identifiers: `gpt-4o-mini`, `gpt-4o`

---

## 5. Three-Level Capability Profiles

A central principle of HELIOXEN AI is the separation of capability tiers:
1. **Provider-Level Support:** Features supported in the cloud infrastructure of the provider.
2. **Model-Level Support:** What the specific LLM architecture is documented to handle.
3. **HELIOXEN Runtime Support:** Features actually implemented and authorized in the local Electron runtime.

> [!CAUTION]
> **No Capability Illusion:** A capability documented by a cloud provider (such as audio or vision) is NEVER presented as an active HELIOXEN feature until the corresponding roadmap milestone is reached.

### 5.1 Capability Reference Matrix

| Capability Dimension | Evidence Source | Model-Level Support | HELIOXEN Runtime Status | UI Presentation & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Text Generation** | Official API Reference | Supported | **Active (Step 16)** | Enabled; primary prompt completion |
| **Incremental Streaming** | Official API Reference | Supported | **Active (Step 16)** | Enabled; real-time token rendering |
| **Structured Output** | Official API Reference | Supported | **Active (Step 16)** | Enabled; JSON schema generation |
| **Multimodal Vision** | Official Model Specs | Supported (Gemini/GPT-4o) | **Roadmap Phase 8** | Badged as "Roadmap Phase 8"; inputs disabled |
| **Native Voice / Audio** | Official Model Specs | Supported (Gemini 3.8/GPT-4o) | **Roadmap Phase 7** | Badged as "Roadmap Phase 7"; hardware gate closed |
| **Tool / Function Calling** | Official Model Specs | Supported | **Roadmap Phase 9** | Badged as "Roadmap Phase 9"; execution gated |

### 5.2 Capability Value Semantics
- `'supported'`: Verified through official provider documentation or active runtime code.
- `'unsupported'`: Verified not supported by the model or explicitly blocked at the HELIOXEN roadmap stage.
- `'unknown'`: Returned by external model listing endpoints where official documentation has not yet cataloged the model's modal limits.
- `'not-verified'`: Candidate feature not yet tested in the current testing suite.

---

## 6. Curated & Discovered Model Catalog

| Provider | Canonical Model ID | Display Name | Tier | Context Window | Max Output | Source | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `google-gemini` | `gemini-3.8-flash` | Gemini 3.8 Flash | `balanced` | 1,048,576 | 8,192 | `curated` | Active (Default) |
| `google-gemini` | `gemini-3.5-flash-lite` | Gemini 3.5 Flash-Lite | `ultra-fast` | 1,048,576 | 8,192 | `curated` | Active |
| `google-gemini` | `gemini-4-argon` | Gemini 4 Argon | `flagship-reasoning` | 1,048,576 | 8,192 | `curated` | Active |
| `openai` | `gpt-4o-mini` | GPT-4o Mini | `balanced` | 128,000 | 16,384 | `curated` | Active (Default) |
| `openai` | `gpt-4o` | GPT-4o | `flagship-reasoning` | 128,000 | 4,096 | `curated` | Active |

---

## 7. Model Discovery & Cache Lifecycle

1. **User-Triggered Refresh:** Dynamic discovery occurs ONLY when the user clicks **"Refresh Catalog"** in `ProviderSettingsPanel`. It is never executed on application startup or settings page open.
2. **Main-Process Isolation:** All listing requests execute in the Electron main process via `ModelRegistry.refreshCatalog()`. Credentials remain within the trusted boundary.
3. **Atomic Cache File:** Discovered models are persisted to `app.getPath('userData')/model_catalog.json` using atomic temporary file renaming (`.tmp` -> target).
4. **Transient Failure Resilience:** If dynamic discovery fails (network error, invalid key, rate limit), previously cached and curated models remain active without application corruption.

---

## 8. User Preference Persistence

- File: `app.getPath('userData')/ai_preferences.json`
- Schema:
  ```ts
  {
    activeProvider: 'google-gemini' | 'openai',
    activeModel: string,
    temperature?: number (0.0 - 2.0),
    maxTokens?: number,
    stream: boolean
  }
  ```
- Cross-provider validation: `PreferencesStorage.setPreferences()` verifies that `activeModel` belongs to `activeProvider` via `ModelRegistry.isModelValidForProvider()`. Invalid combinations throw `IpcException('VALIDATION_ERROR')`.
- Safe recovery: Missing or corrupt preference files automatically fall back to `DEFAULT_AI_PREFERENCES`.

---

## 9. Conversation Request Integration

When the user enters a prompt in `CommandCenter.tsx`:
1. `CommandCenter` retrieves persisted `aiPreferences`.
2. The placeholder assistant message displays the canonical `activeModel`.
3. The request is dispatched to `window.helioxen.ai.generateText({ provider, model, ... })`.
4. `ProviderService.ts` validates that the requested model belongs to the requested provider before retrieving credentials or dispatching requests.
5. If a cross-provider mismatch is attempted, `ProviderService` rejects the call immediately with `AiProviderException({ code: 'INVALID_MODEL' })`.

---

## 10. Security & Privacy Guarantees

1. **Zero Secret Leakage:** Neither `ModelRegistry` nor `PreferencesStorage` receives or persists plaintext API keys.
2. **Untrusted Metadata Sanitization:** Dynamic model discovery strips unapproved generation methods and restricts accepted identifiers to alphanumeric/hyphen patterns.
3. **Endpoint Restrictions:** Only official provider endpoints (`generativelanguage.googleapis.com` and `api.openai.com`) are contacted. No arbitrary custom endpoints are permitted.
4. **Audit Logging:** Catalog operations and preference updates are logged to `securityLogger` with full redaction.

---

## 11. Testing & Verification Summary

All 69 unit and integration tests passed across 13 suites:
- `tests/ai/modelRegistry.test.ts`: Curated catalog, dynamic discovery, capability tiers, cache corruption recovery.
- `tests/ai/preferencesStorage.test.ts`: Atomic persistence, validation, cross-provider mismatch rejection, corrupt file fallback.
- `tests/ai/providerService.test.ts`: Rejection of cross-provider model mismatches in `generateText`, catalog retrieval.
- `tests/ai/contracts.test.ts`: Validation of Zod contracts for preferences and refresh requests.

---

## 12. Deferrals for Step 18

The following capabilities are deliberately prohibited and deferred to Step 18:
- Task-based automatic model routing.
- Cost- and latency-based model switching.
- Cross-provider automatic fallback.
- Automatic background provider health polling.
- Silent model substitution.
