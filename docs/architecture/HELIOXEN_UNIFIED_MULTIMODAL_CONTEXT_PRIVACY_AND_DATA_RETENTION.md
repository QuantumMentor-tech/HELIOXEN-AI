# HELIOXEN AI — UNIFIED MULTIMODAL CONTEXT, PRIVACY CONTROLS AND DATA RETENTION
## Architecture Specification & Security Blueprint

**Project:** HELIOXEN  
**Roadmap:** Phase 8 · Multimodal Input and Context  
**Step:** 24 of 48  
**Status:** Implemented & Validated  
**Date:** November 2, 2026

---

## 1. Executive Summary & Purpose

Step 24 of 48 establishes a unified, source-aware multimodal context layer that coordinates text messages, finalized voice transcripts, captured camera/screen images, and extracted document text within conversation and active task boundaries.

Key architectural foundations:
- **Unified Multimodal Context Envelope:** A common metadata structure represents all contextual modalities while keeping payloads modality-specific, avoiding unnecessary copying or conversion of binary data.
- **Strict Thread & Task Isolation:** All context items are strictly bound to their originating `conversationId`. Cross-conversation context leakage is prevented at the service boundary.
- **Explicit Provenance & Trust Classification:** Distinguishes trusted user instructions (`user`, `voice_input`) from untrusted external content (`external_untrusted` from documents, images, and screen captures). Untrusted context can never bypass tool permission checks or override system instructions.
- **Privacy Controls & UI Visibility:** The right-hand Contextual Intelligence Panel exposes all active sources, item sizes, and trust classifications, providing toggles for including/excluding items from AI requests and buttons for clearing transient buffers or resetting conversation context.
- **Data Retention & Lifecycle Enforcement:** Differentiates `transient_buffer` (volatile memory only; cleared on cancellation, session end, or explicit clear) from `conversation_ephemeral` (active conversation thread) and `user_persisted`.
- **Strict Anti-Scope Boundaries:** Step 24 does NOT implement long-term user memory, vector retrieval, or persistent embedding databases (deferred to Step 34).

---

## 2. Common Context-Item Model & Schemas

### 2.1 Types (`src/shared/context/types.ts`)

```typescript
export type ContextSourceType =
  | 'user_message'
  | 'assistant_response'
  | 'voice_transcript'
  | 'image_attachment'
  | 'camera_capture'
  | 'screen_capture'
  | 'extracted_document'

export type ContextTrustLevel =
  | 'system'
  | 'user'
  | 'voice_input'
  | 'external_untrusted'
  | 'assistant'

export type ContextItemStatus =
  | 'active'
  | 'excluded'
  | 'expired'
  | 'cleared'

export type RetentionPolicyType =
  | 'transient_buffer'
  | 'conversation_ephemeral'
  | 'user_persisted'

export interface MultimodalContextItem {
  id: string
  conversationId: string
  activeTaskId?: string
  sourceType: ContextSourceType
  trustLevel: ContextTrustLevel
  title: string
  status: ContextItemStatus
  retentionPolicy: RetentionPolicyType
  createdAt: number
  expiresAt?: number
  textPayload?: string
  imagePayload?: {
    mimeType: string
    dataUrl: string
    width?: number
    height?: number
    sizeBytes: number
  }
  documentMetadata?: {
    filename: string
    format: string
    pageCount?: number
    charCount: number
    isTruncated?: boolean
  }
  sizeBytes: number
  sourceRefId?: string
}
```

---

## 3. Context Assembly & Budgeting Flow

### 3.1 Assembly Workflow

```
[User Action / Draft Staging]
           │
           ▼
[UnifiedContextService.registerItem]
           │
           ▼
[UnifiedContextService.assembleContext]
           │
           ├─► Filter by active conversationId (Isolation Guarantee)
           ├─► Filter status === 'active' (Honor user exclusion toggles)
           ├─► Verify Model Vision Capability (via CURATED_MODELS)
           │    └─► If model lacks vision, omit image with explicit warning
           ├─► Enforce Resource Budgets (max items, max document chars)
           ├─► Delimit untrusted document context into [DOCUMENT CONTEXT: ...]
           ▼
[Assembled Multimodal Request Payload]
           │
           ▼
[AI Provider Adapter (Google Gemini / OpenAI)]
```

### 3.2 Context Limits (`DEFAULT_CONTEXT_LIMITS`)
- Maximum items per conversation: 50 items
- Maximum total payload size: 25 MB
- Maximum extracted document characters: 100,000 chars
- Maximum image payload: 4 MB
- Conservative token estimation: 1 token ≈ 4 characters

---

## 4. Trust Boundaries & Indirect Injection Defense

1. **Untrusted Classification:** All text extracted from documents (`.pdf`, `.docx`, `.txt`, `.md`) and visual captures (`screen`, `camera`, image files) are classified as `external_untrusted`.
2. **Instruction Isolation:** Assembled context encloses external text in demarcated context blocks, ensuring LLMs distinguish user prompt instructions from reference materials.
3. **Zero Tool Permission Elevation:** Instructions discovered inside documents or screenshots cannot invoke privileged tools or bypass the Electron security gate.

---

## 5. Data-Lifecycle Inventory & Retention Policy Matrix

| Data Category | Storage Location | Owning Component | Retention Policy | Cleanup Triggers | Local Erasure Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Raw Microphone Audio** | Volatile RAM Buffer | `MicrophoneCaptureService` | `transient_buffer` | Session end, cancel, error | MediaStream tracks stopped, buffer array cleared |
| **Media Streams (Cam/Screen)** | Browser/Electron Tracks | `MediaCaptureCoordinator` | `transient_buffer` | Frame capture, modal dismiss | `track.stop()`, stream terminated |
| **Still Captures & Thumbnails** | Volatile RAM (base64) | `UnifiedContextService` | `transient_buffer` | Clear transient, convo reset | Map entry deleted, GC frees buffer |
| **Extracted Document Text** | Volatile RAM | `UnifiedContextService` | `transient_buffer` | Clear transient, convo reset | Map entry deleted, GC frees buffer |
| **Voice Transcripts** | Volatile RAM | `UnifiedContextService` | `conversation_ephemeral` | Thread reset, app reload | Conversation state reset |
| **Conversation Messages** | Session State / Ephemeral | `CommandCenter` | `conversation_ephemeral` | Clear conversation action | React state reset to `[]` |
| **AI Provider Keys** | OS Credential Vault / Keytar | `CredentialStorage` | `user_persisted` | Explicit user delete in Settings | Keytar vault record removed |

> [!IMPORTANT]
> **External Retention Limitation:** Local deletion and context clearing remove data from application memory. However, data previously submitted to external AI providers (Google Gemini, OpenAI) is governed by their respective API data privacy policies.

---

## 6. UI & Privacy Controls

- **Source Attribution & Visibility:** The right-hand Contextual Intelligence panel displays active multimodal items with source icons, byte sizes, and trust classifications.
- **Per-Item Exclusion:** Users can toggle individual items between included (`active`) and `excluded` before sending a prompt.
- **Clear Transient Context:** Clears temporary files, camera snapshots, screen grabs, and document extractions without deleting the conversation chat history.
- **Reset Conversation Context:** Clears the entire conversation history and associated context store.
- **Target Provider Disclosure:** Indicates which model and provider will receive included items upon submission.

---

## 7. Automated Testing Suite

1. `tests/context/contextContracts.test.ts` (9 tests):
   - Validates context item schemas, trust level mapping, retention policy defaults, and token estimation.
2. `tests/context/unifiedContextService.test.ts` (7 tests):
   - Tests registration across all 5 modalities, conversation isolation, inclusion toggling, capability checking, and transient clearing.
3. `tests/context/privacyAndRetention.test.ts` (3 tests):
   - Tests capacity limits, oldest transient eviction, expired item exclusion, and credential absence.
- Total test coverage: **38 test files, 226 unit/integration tests passing** with 0 regressions.
