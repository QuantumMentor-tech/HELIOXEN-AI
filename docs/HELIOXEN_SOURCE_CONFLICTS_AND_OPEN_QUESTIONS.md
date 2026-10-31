# HELIOXEN AI — Source Conflicts, Security Findings, and Open Questions

**Document ID:** `HELIOXEN-SCOQ-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 1: Product Definition and Requirements  
**Step:** 1 of 48 (Consolidated Requirements and Feature Prioritization)  
**Status:** Baseline Audit & Risk Register (Approved for Architecture Phase)  
**Date:** October 31, 2026  

---

## 1. PURPOSE AND AUDIT SCOPE

This document provides a rigorous, evidence-based analysis of discrepancies, security vulnerabilities, licensing encumbrances, and architectural ambiguities discovered during the review of historical reference reports (Stonic V1, V2, V3; Brahma Echo; Brahma AI Evo; IRIS AI; and JARVIS concepts).

Rather than papering over inconsistencies, this document explicitly catalogs every confirmed conflict, unverified capability, and open architectural decision. This establishes the safety and clean-room implementation boundaries required for HELIOXEN AI.

---

## 2. EVIDENCE AND ARTIFACT AUDIT

### 2.1 Workspace Audit State
- **Workspace Path:** `d:\App Winrar Files\Helioxen Ai Assistant (working)`
- **Git Repository:** Not initialized in the root directory.
- **Pre-existing Codebase:** None. The workspace is a greenfield environment containing only:
  - `Done 1 to 48 steps.txt` (0 bytes, preserved).
  - `Futuristic Helioxen Orbital Logo.png` (337,490 bytes, validated: high-resolution brand asset featuring neon cyan orbital rings encircling a deep blue core "H").
- **External PRIS Report Files:** The raw external markdown/PDF files (`Stonic V1/V2/V3 PRIS`, `Brahma Echo PRIS`, `Brahma AI Evo PRIS`, `IRIS AI PRIS`, `IRIS AI detailed codebase scan report`, and reference screenshots) are **not physically present** in the local workspace directory.
- **Evidence Handling:** As mandated by the audit rules, all citations of these reports are derived strictly from the verified factual findings and security disclosures provided in the project prompt instructions. No claims are made of having inspected inaccessible physical files.

---

## 3. IN-DEPTH ANALYSIS OF REFERENCE DISCREPANCIES & CONFLICTS

### 3.1 Conflict Matrix: Stonic Evolution (V1 vs. V2 vs. V3)

| Dimension | Stonic V1 Report | Stonic V2 Report | Stonic V3 Report | Helioxen Architectural Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Repository Identity** | Early prototype, monolithic electron shell. | Modular multi-service refactor; incomplete boundary isolation. | Refined UI layer, revised state management. | **Original Greenfield:** HELIOXEN maintains a completely independent codebase with zero legacy inheritance. |
| **Credential Storage** | Local config JSON file in plaintext. | Documented critical finding: plaintext credentials stored in local storage, plus a hardcoded fallback API key in a test file. | Unverified remediation; documentation mentions credential vault but implementation unconfirmed. | **Strict OS Keychain (`FR-010`):** Use native Windows Credential Manager (`keytar` / DPAPI). Zero plaintext storage. |
| **Electron Web Security** | Default settings. | `webSecurity: false` explicitly documented, exposing the renderer to arbitrary cross-origin script injection. | Conflicting statements regarding renderer isolation. | **Hardened Security (`NFR-009`, `NFR-012`):** `webSecurity: true`, `nodeIntegration: false`, `contextIsolation: true`. |
| **Shell Command Execution** | Simple command runners. | Unrestricted raw shell capability exposed to the model without parameter sanitization or path guards. | Attempted whitelisting, but boundaries remained porous. | **Zero Unrestricted Shell (`NFR-011`):** No raw shell access. Whitelisted parameterized tools with mandatory modal approval. |

> [!WARNING]
> **Audit Finding SC-01 (Stonic Security Flaws):**  
> Under no circumstances may Stonic V2's insecure patterns (`webSecurity: false`, plaintext API keys in config/tests, or unvetted shell execution) be reproduced in HELIOXEN. They represent critical security vulnerabilities that would allow arbitrary remote code execution (RCE) via prompt injection.

---

### 3.2 Licensing and IP Encumbrances: Brahma Echo & Brahma AI Evo

| Source | Documented License / Status | Implications for HELIOXEN | Required Clean-Room Boundary |
| :--- | :--- | :--- | :--- |
| **Brahma Echo** | Source-available / proprietary restrictions documented in PRIS report. | Code, branding, UI graphics, and proprietary orchestration schemas **cannot be reused or copied**. | Conceptual borrowing strictly limited to architectural paradigms (e.g., modular tool execution, task planner). 100% original code. |
| **Brahma AI Evo** | Source-available / restrictive commercial terms. | Direct asset extraction, decompilation, or code transplantation is legally and ethically prohibited. | No code or design tokens reused. Independent implementation of agent concepts. |

> [!IMPORTANT]
> **Audit Finding SC-02 (Clean-Room Boundary):**  
> HELIOXEN must remain a pure clean-room project. All code, IPC protocols, CSS styling, components, and schemas must be authored from first principles, ensuring complete independence from Brahma and Stonic intellectual property.

---

### 3.3 IRIS AI Implementation Gaps vs. Claims

| Documented Capability in IRIS | Codebase Scan Finding | Helioxen Verification Status | Policy for HELIOXEN |
| :--- | :--- | :--- | :--- |
| **3D Reactive AI Sphere** | Canvas/Three.js visualizer present, but voice-reactivity synchronization was loosely coupled and unstable. | Partially functional in reference, required significant GPU tuning. | **Adopt with Engineering Hardening (`FR-003`):** Implement lightweight Canvas/WebGL shader with explicit 60fps budget and low-power fallback. |
| **System Telemetry & Monitoring** | Documented as "live hardware monitoring," but codebase scan revealed incomplete IPC wiring and fallback to mock data. | Telemetry channel was partially stubbed or returned synthetic metrics. | **Authentic Telemetry Mandate (`FR-037`):** Use real Windows OS APIs (`systeminformation`); strictly label any simulated data or disable unverified widgets. |
| **Mobile Device Bridge & ADB** | Documented as complete wireless ADB integration. | Codebase scan revealed incomplete IPC hooks, missing error handlers, and device disconnection crashes. | **Stage as P2 Capability (`FR-087`):** Do not block core release on wireless ADB; implement only in Phase 9 with rigorous pairing guards. |

---

### 3.4 JARVIS UI References: Cinema vs. Usability

| JARVIS Concept | Cinematic Appeal | Desktop Usability Reality | Helioxen Design Compromise |
| :--- | :--- | :--- | :--- |
| **Full-Screen Holographic HUD** | High sci-fi visual wow-factor. | Overcrowded, illegible text, high cognitive fatigue, poor accessibility. | **Stonic 3-Panel Simplicity (`FR-002`):** Maintain clean, readable panels. Limit holographic effects to the Central AI Core and World Monitor. |
| **Dense Circular Rotating Rings** | Evokes advanced alien/military AI. | Wastes screen real estate; high CPU/GPU load if rendered continuously. | **Restrained Luminous Accents (`NFR-017`):** Elegant, slim orbital rings surrounding the central core that react meaningfully to voice states. |

---

## 4. UNVERIFIED CAPABILITIES AND SIMULATION WARNINGS

To prevent misleading users with fake functionality, the following capabilities are flagged as requiring real service integration:

### 4.1 World Intelligence & News Feeds (`FR-070`)
- **Risk:** Previous AI projects frequently hardcoded static RSS samples or simulated headlines to look active.
- **HELIOXEN Mandate:** The World Monitor must fetch authentic, live RSS or news API feeds with timestamps and source URLs. If the network is offline or feeds fail, the UI must explicitly display an `OFFLINE / FEED UNAVAILABLE` state. Simulated data masquerading as live intelligence is strictly prohibited.

### 4.2 Hardware Telemetry & Thermal Sensors (`FR-037`)
- **Risk:** Some reference apps displayed synthetic CPU temperatures and GPU clock speeds when native bindings failed.
- **HELIOXEN Mandate:** Telemetry must be sourced from authentic OS queries. If native sensor permissions or bindings are unavailable on the host Windows machine, the metric must display `N/A (Sensor Unavailable)` rather than a random number generator.

### 4.3 Agent Town Multi-Agent Collaboration (`FR-075`)
- **Risk:** Visual "office" interfaces often run canned looping sprite animations of agents "typing" or "talking" even when no computational task is active.
- **HELIOXEN Mandate:** Agent Town is classified as `P2`. If implemented, agent visual stations must strictly reflect actual orchestration states (`Idle`, `Running Task #104`, `Awaiting Tool Output`). When no task is executing, agents must remain in an idle standby state.

---

## 5. OPEN ARCHITECTURAL & TECHNICAL QUESTIONS

The following questions represent critical architectural decisions that must be formally resolved in subsequent phases (specifically Step 4: Technology Stack Selection and Step 13–18: Core Architecture):

### OQ-01: Real-Time Voice Transport: WebSockets vs. WebRTC vs. Native Audio Pipeline
- **Context:** Delivering sub-800ms conversational voice with barge-in requires low-latency bidirectional streaming.
- **Options:**
  1. *Multimodal Live API over WebSockets:* Direct PCM streaming to Gemini Live API / OpenAI Realtime API.
  2. *Hybrid Pipeline:* Local Whisper/VAD for STT -> LLM streaming text -> Cloud/Local TTS (Piper/ElevenLabs).
- **Decision Phase:** Step 4 (Technology Stack) and Step 19 (Voice Architecture).

### OQ-02: Local Vector Store & Memory Search Engine
- **Context:** `FR-052` and `FR-054` require persistent long-term memory with semantic retrieval.
- **Options:**
  1. *SQLite with `sqlite-vec`:* Embedded, zero-process, highly portable single-file database.
  2. *LanceDB / DuckDB:* High performance vector search, but larger binary distribution size.
  3. *Pure In-Memory Flat Index:* Simple JSON with cosine similarity in memory, but scales poorly past 5,000 memories.
- **Decision Phase:** Step 4 (Technology Stack) and Step 34 (Memory System).

### OQ-03: Dynamic Plugin Sandbox Isolation Mechanism
- **Context:** `FR-081` and `FR-082` require executing third-party or AI-generated plugins safely.
- **Options:**
  1. *Node.js `worker_threads` with capability-injected context:* Fast, low memory, but requires strict prototype freeze to prevent sandbox escape.
  2. *Isolated V8 Context (`isolated-vm`):* True memory and CPU isolation, but higher compilation complexity on Windows.
  3. *Out-of-Process Child Runner:* Standalone child process running under restricted OS user tokens.
- **Decision Phase:** Step 15 (Security Architecture) and Step 41 (Plugin Framework).

### OQ-04: Desktop Window Framing & Native OS Blur Effects
- **Context:** To achieve the cinematic aesthetic, window transparency or Acrylic / Mica effects are desirable.
- **Options:**
  1. *Windows 11 Mica / Acrylic via Electron Native Bindings:* Stunning visual integration, but can cause window drag lag on certain multi-monitor setups.
  2. *Custom Frameless Window with Dark CSS Glassmorphism:* Highly reliable, zero driver conflicts, works identically on Windows 10 and 11.
- **Decision Phase:** Step 7 (Design Tokens) and Step 10 (Application Shell).

### OQ-05: Local Model Engine Support vs. Cloud-Only for Initial Release
- **Context:** Supporting local models (Ollama/vLLM) provides privacy, but increases installer/user setup friction.
- **Recommendation:** Maintain unified provider interface (`FR-009`) in `P0`, but defer automated local model bundling to `P2`. Focus `P0` on robust cloud API adapters.
- **Decision Phase:** Step 4 (Technology Stack) and Step 17 (Model Registry).

---

## 6. DELIBERATELY DEFERRED DECISIONS (STEP 1 BOUNDARY)

To maintain strict compliance with Step 1's read-only mandate, the following items are intentionally deferred:

1. **Specific Frontend Framework:** (React vs. Vue vs. Svelte vs. Vanilla TS) — Deferred to Step 4.
2. **Specific Build Tooling:** (Vite vs. Electron-Forge vs. Turbopack) — Deferred to Step 4.
3. **Specific CSS Framework / Preprocessor:** — Deferred to Step 4 and Step 7.
4. **Final Model Identifiers & Pricing Rates:** — Deferred to Step 16 and Step 17.
5. **Exact Audio DSP Library Selection:** — Deferred to Step 19.
6. **Package Manifests & Dependency Installation:** — Strictly prohibited in Step 1; deferred to Step 5.

---

## 7. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Lead Product Architect & Security Reviewer | Baseline analysis of reference conflicts (Stonic security flaws, Brahma licensing encumbrances, IRIS integration gaps), unverified capabilities, and architectural open questions established for Step 1 of 48. |
