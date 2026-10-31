# HELIOXEN AI — Architecture Decision Records (ADRs)

**Document ID:** `HELIOXEN-ADR-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 2: Technical Architecture and Project Foundation  
**Step:** 4 of 48 (Technology Stack Selection and Architecture Decisions)  
**Status:** Architecture Decision Register (20 Formal Records)  
**Date:** October 31, 2026  

---

## ADR SUMMARY TABLE

| ADR ID | Decision Title | Status | Primary Technology / Choice | Target Step |
| :--- | :--- | :--- | :--- | :--- |
| `ADR-001` | Desktop Runtime & Operating System Target | `ACCEPTED` | Electron (v33+ LTS) on Windows 10/11 64-bit | Step 10 |
| `ADR-002` | Frontend Framework & Type System | `ACCEPTED` | React 18/19 with Strict TypeScript 5.x | Step 8 |
| `ADR-003` | Build System & Development Pipeline | `ACCEPTED` | electron-vite (v2+) with Vite 5/6 | Step 5 |
| `ADR-004` | Styling Architecture & Design Token Strategy | `ACCEPTED` | Tailwind CSS v3 with CSS Variables | Step 7 |
| `ADR-005` | Animation Engine & 3D Visualizer Architecture| `ACCEPTED` | Three.js + @react-three/fiber + Framer Motion | Step 9, 12 |
| `ADR-006` | Multi-Process Architecture & Process Isolation| `ACCEPTED` | 3-Ring Process Separation (Main, Preload, Renderer)| Step 13 |
| `ADR-007` | IPC Protocol & Privileged Operation Boundaries| `ACCEPTED` | Strictly Typed IPC Contracts via ContextBridge | Step 14 |
| `ADR-008` | AI Provider Abstraction Interface | `ACCEPTED` | Unified Provider Adapter Architecture | Step 16 |
| `ADR-009` | Real-Time Voice Transport & Low-Latency Audio| `ACCEPTED` | WebSockets / Web Audio API Worklet (< 800ms) | Step 19, 20 |
| `ADR-010` | Task-Based Model Capability & Routing System | `PROPOSED` | Capability Registry with Automatic Fallback | Step 17, 18 |
| `ADR-011` | Data Persistence, Schema & Migration Engine | `ACCEPTED` | better-sqlite3 with WAL Mode & Atomic Migrations | Step 34 |
| `ADR-012` | Native Credential Storage & Secrets Vault | `ACCEPTED` | Windows DPAPI safeStorage via Electron Native | Step 15 |
| `ADR-013` | Tool Registry, Schema Validation & Execution Gate| `ACCEPTED`| Zod Runtime Schemas + Two-Tier Approval Gate | Step 25 |
| `ADR-014` | Agent Orchestration & Background Task Engine | `ACCEPTED` | Deterministic Sequential Planner with AbortSignal | Step 26, 27 |
| `ADR-015` | Browser Automation Engine & Navigation Safety | `PROPOSED` | Headless Playwright with Isolated Contexts & SSRF | Step 31, 33 |
| `ADR-016` | UI & Session State Management Strategy | `ACCEPTED` | Zustand Lightweight Stores (Vanilla + React) | Step 8, 11 |
| `ADR-017` | Structured Logging, Diagnostics & Redaction | `ACCEPTED` | Local JSON Logger with Automatic Secret Redaction | Step 27, 46 |
| `ADR-018` | Quality Assurance, Testing Stack & Mocks | `ACCEPTED` | Vitest + React Testing Library + Playwright E2E | Step 47 |
| `ADR-019` | Application Packaging, Updates & Signing | `ACCEPTED` | electron-builder targeting Windows NSIS Installer | Step 48 |
| `ADR-020` | Extensibility, Dynamic Skills & Sandboxing | `PROPOSED` | Node.js Worker Threads with Injected Capabilities | Step 41, 42 |

---

## 1. RUNTIME, BUILD & FRONTEND ARCHITECTURE

### `ADR-001`: Desktop Runtime & Operating System Target
- **Status:** `ACCEPTED`
- **Context:** HELIOXEN requires rich desktop windowing, OS notifications, native hardware queries, audio capture, and local database storage.
- **Decision:** Select **Electron (v33+ LTS)** targeting **Windows 10/11 64-bit (x64)**.
- **Rationale:** Electron provides the most mature, battle-tested runtime for rich desktop AI assistants. Tauri was evaluated but lacks direct Node.js ecosystem bindings for complex tools and audio worklets without substantial custom Rust overhead.
- **Trade-offs:** Higher baseline memory (~150MB) compared to native C++, mitigated by aggressive garbage collection and shader throttling.
- **Security:** Requires strict enforcement of `nodeIntegration: false` and `contextIsolation: true`.

### `ADR-002`: Frontend Framework & Type System
- **Status:** `ACCEPTED`
- **Context:** The UI requires a reactive, component-driven architecture for multi-panel views and streaming dialogue.
- **Decision:** Select **React 18 / 19** with **TypeScript 5.x** in strict mode.
- **Rationale:** React provides exceptional integration with Three.js via `@react-three/fiber`, vast UI component ecosystem, and unmatched community testing tooling. TypeScript guarantees compile-time type safety across IPC contracts.

### `ADR-003`: Build System & Development Pipeline
- **Status:** `ACCEPTED`
- **Context:** Multi-process Electron development often suffers from sluggish build times and complex bundling.
- **Decision:** Select **electron-vite (v2+)** powered by **Vite**.
- **Rationale:** Unifies Main, Preload, and Renderer builds under a single configuration (`electron.vite.config.ts`), provides sub-second HMR, and bundles clean ESM/CJS outputs.

### `ADR-004`: Styling Architecture & Design Token Strategy
- **Status:** `ACCEPTED`
- **Context:** HELIOXEN requires a futuristic, dark-space visual identity with neon cyan accents while maintaining Stonic-style layout simplicity.
- **Decision:** Select **Tailwind CSS v3** coupled with **CSS Custom Properties (Variables)**.
- **Rationale:** Utility-first styling eliminates CSS bloat. CSS variables (`--hx-neon-cyan`, `--hx-bg-space`) permit dynamic real-time theme shifts (e.g., core pulsing amber on warning).

### `ADR-005`: Animation Engine & 3D Visualizer Architecture
- **Status:** `ACCEPTED`
- **Context:** The Central AI Core requires an orbital particle visualizer that reflects voice activity and operational states.
- **Decision:** Select **Three.js** with **@react-three/fiber** for the 3D orbital core, and **Framer Motion** for 2D UI panel transitions. Provide an automatic Canvas/SVG 2D fallback for low-power GPUs or when `prefers-reduced-motion` is active.
- **Rationale:** Keeps GPU render loops cleanly decoupled from standard DOM UI updates.

---

## 2. SECURITY, IPC & CREDENTIAL ARCHITECTURE

### `ADR-006`: Multi-Process Architecture & Process Isolation
- **Status:** `ACCEPTED`
- **Context:** Prevent XSS or malicious web content from accessing the host operating system.
- **Decision:** Enforce strict **3-Ring Process Separation**:
  1. *Untrusted Renderer:* Sandboxed Chromium with zero Node.js access.
  2. *Preload Boundary:* ContextBridge providing strictly typed, frozen global APIs.
  3. *Privileged Main:* Hosts OS bindings, database, tool runner, and AI adapters.

### `ADR-007`: IPC Protocol & Privileged Operation Boundaries
- **Status:** `ACCEPTED`
- **Context:** Stonic V2 exposed arbitrary shell commands through permissive IPC.
- **Decision:** Mandate **Typed Function-Level IPC Contracts** via `window.helioxen`. Raw `ipcRenderer.send` or event emitters are strictly blocked from the frontend.

### `ADR-012`: Native Credential Storage & Secrets Vault
- **Status:** `ACCEPTED`
- **Context:** Eliminating plaintext API key storage vulnerabilities identified in Stonic V2.
- **Decision:** Utilize **Electron native `safeStorage`** backed by Windows Data Protection API (DPAPI).
- **Rationale:** Native OS-level hardware-backed encryption. Zero plaintext secrets on disk, in config JSONs, or in Git repositories.

---

## 3. AI PROVIDER, VOICE & AUDIO ARCHITECTURE

### `ADR-008`: AI Provider Abstraction Interface
- **Status:** `ACCEPTED`
- **Context:** Decouple application logic from specific LLM vendors (Gemini, OpenAI, Anthropic).
- **Decision:** Implement a unified `AIProviderAdapter` interface defining `sendChat()`, `streamVoice()`, and `callTool()`.
- **Primary SDK:** Official `@google/genai` SDK for Google Gemini 3.8 Flash / Gemini Live. Secondary adapter for OpenAI.

### `ADR-009`: Real-Time Voice Transport & Low-Latency Audio
- **Status:** `ACCEPTED`
- **Context:** Conversational voice requires < 800ms end-to-end turnaround with barge-in interruption.
- **Decision:** Implement bidirectional **WebSockets streaming 16kHz PCM audio** via Web Audio API `AudioWorkletNode`, coupled with local Voice Activity Detection (VAD) for instant playback interruption (< 100ms).

### `ADR-010`: Task-Based Model Capability & Routing System
- **Status:** `PROPOSED`
- **Context:** Optimizing costs and latency by routing audio turns to fast models and planning to reasoning models.
- **Decision:** Model Router maps task types (`VOICE_STREAM`, `DEEP_PLAN`, `CODE_DIFF`, `SUMMARY`) to capability profiles, with automatic 429/503 provider failovers.

---

## 4. TOOL SYSTEM, AGENTS & AUTOMATION

### `ADR-013`: Tool Registry, Schema Validation & Execution Gate
- **Status:** `ACCEPTED`
- **Context:** Prevent model hallucination or prompt injection from executing unauthorized system actions.
- **Decision:** All tools defined with strict **Zod runtime schemas**. Modifying/destructive actions trigger a mandatory **Two-Tier Human Confirmation Modal**. Raw shell execution is permanently banned.

### `ADR-014`: Agent Orchestration & Background Task Engine
- **Status:** `ACCEPTED`
- **Context:** Multi-step problem solving without infinite loops or frozen UI threads.
- **Decision:** Sequential Task Planner executing deterministic step graphs with mandatory 30s timeouts, max recursion depth of 10, and global `AbortController` cancellation.

### `ADR-015`: Browser Automation Engine & Navigation Safety
- **Status:** `PROPOSED`
- **Context:** Autonomous web research across dynamic SPAs.
- **Decision:** Use **Playwright Core** launching isolated headless Chromium profiles. Restrict navigation to public domains, block automatic binary downloads, and enforce private network SSRF guards.

---

## 5. PERSISTENCE, LOGGING, TESTING & PACKAGING

### `ADR-011`: Data Persistence, Schema & Migration Engine
- **Status:** `ACCEPTED`
- **Context:** Reliable local storage for conversations, memory, notes, and tasks.
- **Decision:** Use **better-sqlite3** with Write-Ahead Logging (`WAL` mode) and synchronous atomic writes. Schema migrations managed via structured SQL migration scripts.

### `ADR-016`: UI & Session State Management Strategy
- **Status:** `ACCEPTED`
- **Context:** Coordinate transient UI state (voice mute, active view) and background task state.
- **Decision:** Select **Zustand**. Provides micro-footprint (~1.2KB) and direct read/write access from main process IPC push listeners.

### `ADR-017`: Structured Logging, Diagnostics & Redaction
- **Status:** `ACCEPTED`
- **Context:** Forensic auditability without leaking user credentials or confidential prompts.
- **Decision:** Local append-only JSON logger. Automatic regex sanitizer scrubs API keys and credential strings before disk write.

### `ADR-018`: Quality Assurance, Testing Stack & Mocks
- **Status:** `ACCEPTED`
- **Context:** Thorough automated testing without incurring cloud API costs.
- **Decision:** **Vitest** for unit/integration tests with deterministic provider mocks; `@testing-library/react` for UI component testing; Playwright for Electron desktop packaging E2E.

### `ADR-019`: Application Packaging, Updates & Signing
- **Status:** `ACCEPTED`
- **Context:** Reliable Windows 10/11 desktop installer.
- **Decision:** **electron-builder** compiling to Windows NSIS executable (`.exe`) with auto-update integration via `electron-updater`.

### `ADR-020`: Extensibility, Dynamic Skills & Sandboxing
- **Status:** `PROPOSED` (Deferred to Phase 8)
- **Context:** Safe execution of user plugins or AI-synthesized skills.
- **Decision:** Execute extension code inside isolated Node.js `worker_threads` with frozen global prototypes, capability-injected APIs, and mandatory user code review modals.

---

## 6. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Principal Software Architect | Formally authored all 20 Architecture Decision Records (`ADR-001` through `ADR-020`) for Step 4 of 48. Comprehensive coverage of runtime, build tooling, frontend, 3D shaders, security boundaries, voice streaming, data persistence, and extension sandboxing. |
