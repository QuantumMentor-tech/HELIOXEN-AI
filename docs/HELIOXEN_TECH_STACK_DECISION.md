# HELIOXEN AI — Technology Stack Selection & Dependency Blueprint

**Document ID:** `HELIOXEN-TSD-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 2: Technical Architecture and Project Foundation  
**Step:** 4 of 48 (Technology Stack Selection and Architecture Decisions)  
**Status:** Architecture Baseline Decision  
**Date:** October 31, 2026  
**Target Environment:** Windows 10/11 Desktop (64-bit)  

---

## 1. EXECUTIVE TECHNICAL RECOMMENDATION

HELIOXEN requires a high-performance, secure, local-first desktop application stack capable of:
1. Real-time, low-latency conversational audio streaming with user interruption (barge-in).
2. Hardware-accelerated 3D graphics for the Central AI Core and World Monitor.
3. Strict process separation, sandbox boundaries, and encrypted credential storage.
4. Fast, typed desktop and browser automation.
5. High-fidelity UI rendering reflecting the Stonic-inspired simplicity and cinematic JARVIS atmosphere.

### Core Stack Summary
- **Desktop Runtime:** Electron (v33+ LTS) on Node.js 20/22 LTS.
- **Application Bundler & Pipeline:** `electron-vite` (v2+) with `vite` (v5/v6).
- **Frontend Framework & Language:** React 18 / 19 with strict TypeScript 5.x.
- **Styling & Design System:** Tailwind CSS v3 with CSS Variables for glowing design tokens.
- **Iconography:** `lucide-react` (clean, lightweight, permissive ISC).
- **3D Graphics & Shaders:** Three.js (`three`) + `@react-three/fiber` with Canvas/SVG 2D fallback.
- **UI Animation:** `framer-motion` for panel transitions and micro-interactions.
- **State Management:** `zustand` (ultra-lightweight, zero boilerplate, outside-React vanilla store access).
- **Data Persistence:** `better-sqlite3` (synchronous WAL mode, atomic) + `sqlite-vec` (vector search).
- **Credential Vault:** Electron native `safeStorage` (Windows DPAPI) supplemented by `keytar`.
- **Primary AI Provider SDK:** `@google/genai` (official Google GenAI SDK for Gemini Live / Multimodal) + modular adapters for `openai` and `@anthropic-ai/sdk`.
- **System Telemetry:** `systeminformation` (native Windows hardware/OS queries).
- **Browser Automation:** `playwright-core` with headless Chromium profiles and SSRF protection.
- **Testing Suite:** `vitest` + `@testing-library/react` + `playwright` E2E.
- **Packaging & Updates:** `electron-builder` targeting Windows NSIS (`.exe`) + `electron-updater`.

---

## 2. COMPREHENSIVE TECHNOLOGY SELECTION TABLE

| Layer / Component | Preferred Technology | Recommended Version / Range | Primary Purpose in HELIOXEN | Evaluated Alternatives | Compatibility & Evidence | SPDX License | Priority | Decision Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Desktop Runtime** | **Electron** | `^33.0.0` (LTS) | Native windowing, IPC bridge, OS APIs, process isolation | Tauri (Rust), Flutter Desktop | Windows 10/11 64-bit native; full Node.js ecosystem | MIT | `P0` | **ACCEPTED** |
| **Build & Dev Tooling** | **electron-vite** | `^2.3.0` | Unified 3-process build (Main, Preload, Renderer) with HMR | Electron-Forge, Webpack | Instant Vite HMR; dedicated configs per process | MIT | `P0` | **ACCEPTED** |
| **Language** | **TypeScript** | `^5.6.0` | End-to-end compile-time type safety across IPC and tools | JavaScript (ESM) | Strict mode; shared types across Main and Renderer | Apache-2.0 | `P0` | **ACCEPTED** |
| **Frontend Framework** | **React** | `^18.3.0` / `^19.0.0` | Declarative, component-based UI for command center | Vue 3, Svelte 5 | Immense ecosystem; native Three.js fiber bindings | MIT | `P0` | **ACCEPTED** |
| **Styling Engine** | **Tailwind CSS** | `^3.4.0` | Utility-first styling with dynamic CSS design tokens | Vanilla CSS, Emotion | Zero runtime overhead; predictable desktop bundle | MIT | `P0` | **ACCEPTED** |
| **Icon Library** | **Lucide React** | `^0.450.0` | Minimalist, consistent high-tech UI iconography | FontAwesome, React-Icons| Highly optimized tree-shaking; consistent stroke width | ISC | `P0` | **ACCEPTED** |
| **3D Render Engine** | **Three.js** | `^0.169.0` | Real-time GPU rendering for Orbital AI Core & HoloGlobe | Babylon.js, Pure WebGL | Industry standard; lightweight shaders; broad GPU support | MIT | `P0` | **ACCEPTED** |
| **React 3D Bridge** | **@react-three/fiber** | `^8.17.0` | Declarative Three.js scene graph inside React tree | Vanilla Three.js canvas | Smooth state-to-prop binding; automatic disposal | MIT | `P0` | **ACCEPTED** |
| **UI Motion Engine** | **Framer Motion** | `^11.11.0` | Smooth panel sliding, modal transitions, voice meter | GSAP, React-Spring | Declarative gestures, layout animations, exit animations | MIT | `P0` | **ACCEPTED** |
| **State Management** | **Zustand** | `^5.0.0` | Lightweight store for active session, voice, and layout | Redux Toolkit, Jotai | 1.2KB footprint; direct access from IPC listeners | MIT | `P0` | **ACCEPTED** |
| **Local Database** | **better-sqlite3** | `^11.5.0` | Fast, ACID-compliant local storage for notes, memory | Lowdb, Nedb, IndexedDB | Synchronous C++ binding; WAL mode prevents corruption | MIT | `P0` | **ACCEPTED** |
| **Vector Search Extension**| **sqlite-vec** | `^0.1.3` | Local vector cosine similarity search for long-term memory | ChromaDB, LanceDB | Embedded in SQLite; zero external service or daemon | MIT / Apache-2.0| `P1` | **PROPOSED** |
| **Secure Credential Vault**| **Electron safeStorage**| Built-in (Electron) | Encrypted storage of API keys via Windows DPAPI | Plaintext JSON, `keytar` | Native OS encryption; zero additional dependencies | MIT (Electron) | `P0` | **ACCEPTED** |
| **Primary AI SDK** | **@google/genai** | `^0.1.0` (Current) | Unified client for Gemini Live, multimodal, and tools | Old `google-generative-ai`| Official Google GenAI SDK; native WebSocket Live | Apache-2.0 | `P0` | **ACCEPTED** |
| **Secondary AI SDK** | **openai** | `^4.70.0` | Provider fallback for text and tool reasoning | Direct `fetch()` calls | Official OpenAI Node.js SDK; streaming support | Apache-2.0 | `P0` | **ACCEPTED** |
| **Schema Validation** | **Zod** | `^3.23.0` | Runtime JSON schema validation for AI tools & IPC | Yup, Joi, TypeBox | Type inference; seamless export to OpenAI/Gemini schemas| MIT | `P0` | **ACCEPTED** |
| **Hardware Telemetry** | **systeminformation** | `^5.23.0` | Real-time CPU, RAM, GPU, network metrics | Native C++ addon | Comprehensive Windows OS queries; pure Node.js | MIT | `P0` | **ACCEPTED** |
| **Browser Automation** | **playwright-core** | `^1.48.0` | Headless Chromium automation for deep web research | Puppeteer, Selenium | Isolated browser contexts; robust network interception | Apache-2.0 | `P1` | **PROPOSED** |
| **Audio Processing** | **Web Audio API + VAD** | Built-in + Silero VAD | 16kHz PCM capture, voice activity, barge-in | SoX, PortAudio | Zero native binary compile issues; browser standard | MIT / W3C | `P0` | **ACCEPTED** |
| **Unit & Integration Test**| **Vitest** | `^2.1.0` | Blazing fast unit and IPC integration tests | Jest | Native Vite configuration sharing; ESM out of the box | MIT | `P0` | **ACCEPTED** |
| **Component Testing** | **@testing-library/react**| `^16.0.0` | UI component behavior testing | Enzyme | Tests user-observable behavior; accessibility checks | MIT | `P0` | **ACCEPTED** |
| **Packaging & Installer** | **electron-builder** | `^25.1.0` | Production Windows NSIS installer (`.exe`) & updates | Electron-Packager | Handles code signing, NSIS custom installer, auto-updater| MIT | `P0` | **ACCEPTED** |

---

## 3. RUNTIME AND TARGET ENVIRONMENT BASELINE

### 3.1 Operating System Baseline
- **Primary Target:** Windows 10 (Build 19041+) and Windows 11 (64-bit, x64).
- **Hardware Minimum Requirements:**
  - CPU: Dual-Core 64-bit Intel / AMD processor.
  - RAM: 4GB minimum (8GB+ recommended).
  - Storage: 500MB free disk space.
  - Graphics: DirectX 11 / OpenGL 3.3 compatible GPU (for Three.js orbital visualizer).
- **Graceful Fallback:** If WebGL fails or integrated GPU is detected, the AI Core automatically falls back to an ultra-lightweight SVG/Canvas 2D orbital animation mode.

---

## 4. ARCHITECTURAL DECISION JUSTIFICATIONS

### 4.1 Why Electron with electron-vite?
- **Rich Desktop Capabilities:** Electron provides direct access to Windows hardware, system information, Start Menu shortcuts, native notifications, and Windows Credential Manager.
- **electron-vite Advantages:** Traditional Electron setups suffer from fragmented Webpack configs. `electron-vite` unifies Main, Preload, and Renderer build pipelines using Vite's esbuild engine, reducing cold build times from ~30s to < 1.5s and providing instant Hot Module Replacement (HMR).

### 4.2 Why Zustand over Redux or Context?
- **Minimal Footprint:** Zustand is ~1.2KB, compared to Redux Toolkit (~30KB).
- **Outside-React Access:** Unlike React Context, Zustand stores can be read and mutated directly by IPC event listeners without requiring component re-renders.

### 4.3 Why better-sqlite3 over Pure JSON or Cloud DBs?
- **ACID Reliability:** Pure JSON configuration files (used in Stonic V1/V2) risk corruption if the application abruptly closes during a write. `better-sqlite3` utilizes SQLite Write-Ahead Logging (`WAL`), guaranteeing atomic transactions.
- **Embedded Performance:** Operates synchronously in the Node.js main process with sub-millisecond query execution, avoiding async IPC roundtrip latency for local database queries.

### 4.4 Why Official @google/genai SDK?
- **Gemini Live Multimodal Streaming:** The official `@google/genai` SDK is the supported vehicle for real-time bidirectional WebSocket sessions with Gemini Live, providing low-latency audio input/output and tool-calling capabilities in a single unified client.

---

## 5. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Principal Software Architect | Comprehensive Technology Stack Selection Blueprint established for Step 4 of 48. Evaluated 22 technology layers with version baselines, licensing compliance, compatibility evidence, and architectural rationales. |
