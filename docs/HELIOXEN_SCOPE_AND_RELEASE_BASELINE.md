# HELIOXEN AI — Product Scope and Release Baseline

**Document ID:** `HELIOXEN-SRB-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 1: Product Definition and Requirements  
**Step:** 3 of 48 (Acceptance Criteria, Threat Model and Project Scope Freeze)  
**Status:** Frozen Scope Baseline (Approved for Architecture Phase)  
**Date:** October 31, 2026  
**Target Environment:** Windows 10/11 Desktop (64-bit)  

---

## 1. PURPOSE AND SCOPE AUTHORITY

This document establishes the **formal, frozen product scope baseline** for the initial production release of **HELIOXEN AI** (`v0.1.0-Core`).

The purpose of freezing scope is to protect project momentum, maintain high engineering and security standards, and prevent scope creep. Advanced capabilities (such as spatial multi-agent offices, dynamic code synthesis, and smart-home bridges) are deliberately deferred into staged post-foundation milestones so that the core desktop experience, real-time voice, and essential automation are rock-solid, secure, and visually captivating.

This baseline derives authoritatively from:
- [HELIOXEN_PRODUCT_REQUIREMENTS.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_PRODUCT_REQUIREMENTS.md) (Step 1)
- [HELIOXEN_FEATURE_PRIORITIZATION.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_FEATURE_PRIORITIZATION.md) (Step 1)
- [HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md) (Step 2)
- [HELIOXEN_THREAT_MODEL.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_THREAT_MODEL.md) (Step 3)

---

## 2. PRODUCT GOALS FOR INITIAL RELEASE (`v0.1.0`)

1. **Intelligent Operating Layer:** Deliver a persistent, branded desktop command center that lives comfortably on Windows 10/11.
2. **Fluid Real-Time Voice:** Achieve natural, spoken voice interaction with sub-800ms response latency and instant user interruption (barge-in).
3. **Stonic Ergonomic Simplicity:** Provide a clean, three-panel workspace centered around the glowing orbital AI core, eliminating dashboard clutter.
4. **Zero-Trust Desktop Safety:** Guarantee zero plaintext credentials, zero raw shell commands, and mandatory two-tier modal confirmation for modifying file operations.
5. **Private & Persistent Memory:** Equip the assistant with long-term fact retention and a granular, transparent user memory inspector.

---

## 3. RELEASE SCOPE MATRIX

Every feature evaluated across Steps 1 and 2 is classified into an explicit scope status:
- `IN_SCOPE`: Formally committed for the initial release foundation (`v0.1.0`).
- `DEFERRED`: Planned for Phase 6–8 capability expansions (`v0.2.0`).
- `OPTIONAL`: Advanced or hardware-dependent capability staged for Phase 9 (`v0.3.0+`).
- `EXCLUDED`: Explicitly banned or rejected due to security or licensing boundaries.
- `UNRESOLVED`: Dependent on pending technical prototyping or user decisions.

### 3.1 Initial Release Scope (`IN_SCOPE` - P0 Foundation: 38 Features)

| Feature ID | Feature Name | Scope Status | User Value | Key Dependencies | Planned Step |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-001` | Desktop Shell & Custom Titlebar | `IN_SCOPE` | Branded frameless desktop framing. | Electron Main, Preload | Step 10 |
| `FR-002` | Stonic 3-Panel Command Center | `IN_SCOPE` | Calm, uncluttered desktop workspace. | Layout Store, CSS Grid | Step 11 |
| `FR-003` | Central AI Core & Orbital States | `IN_SCOPE` | Visual feedback on AI operational state. | Canvas / SVG Shaders | Step 12 |
| `FR-004` | Unified Voice & Text Command Bar | `IN_SCOPE` | Primary text and hotkey input modality. | Input Component | Step 11 |
| `FR-005` | Streaming Conversation History | `IN_SCOPE` | Formatted chat and copyable code blocks. | Markdown Parser, Store | Step 12 |
| `FR-006` | Persistent Voice Dock | `IN_SCOPE` | Always-accessible microphone widget. | Audio Service, UI Pill | Step 12 |
| `FR-007` | Connected Module Navigation | `IN_SCOPE` | Fast routing between Core, Memory, Settings. | App Router | Step 8 |
| `FR-008` | System Notifications & Badges | `IN_SCOPE` | Transparent alerts and status feedback. | Notification Manager | Step 8 |
| `FR-009` | Unified AI Provider Abstraction | `IN_SCOPE` | Vendor-neutral AI client architecture. | Provider Manager | Step 16 |
| `FR-010` | Secure Credential Storage Vault | `IN_SCOPE` | Eliminates plaintext key leakage. | OS Keychain / `keytar` | Step 15 |
| `FR-011` | Model Registry & Profiles | `IN_SCOPE` | Matches model capability to task. | Config Store | Step 17 |
| `FR-015` | Real-Time Voice Interaction | `IN_SCOPE` | Natural spoken dialogue (< 800ms). | Audio Worklet, Live API | Step 20 |
| `FR-016` | Real-Time User Interruption | `IN_SCOPE` | Natural conversational barge-in (< 100ms).| Local VAD, Audio Sink | Step 20 |
| `FR-017` | Audio Device & Volume Controls | `IN_SCOPE` | Headset and microphone management. | Web Audio API | Step 19 |
| `FR-018` | Streaming Live Transcription | `IN_SCOPE` | Immediate visual speech feedback. | Speech-to-Text Engine | Step 20 |
| `FR-023` | Authorized Screen Capture | `IN_SCOPE` | Screen and active window Q&A. | `desktopCapturer` API | Step 22 |
| `FR-024` | Authorized Camera Capture | `IN_SCOPE` | Physical document and object Q&A. | MediaDevices API | Step 22 |
| `FR-025` | Multimodal Visual Q&A | `IN_SCOPE` | Analysis of diagrams, screenshots, errors.| Vision API Adapter | Step 23 |
| `FR-026` | Multi-Format Document Ingestion | `IN_SCOPE` | Ingestion of PDF, DOCX, CSV, MD files. | Document Parsers | Step 23 |
| `FR-029` | Structured Tool Registry | `IN_SCOPE` | Safe, typed interface for desktop tools. | Zod Schema Validator | Step 25 |
| `FR-030` | Two-Tier Modal Permission Gate | `IN_SCOPE` | Blocks unauthorized system modifications.| Modal UI, Security Gate | Step 25 |
| `FR-031` | Autonomous Task Planner | `IN_SCOPE` | Breaks complex goals into discrete steps. | Planner Service | Step 26 |
| `FR-032` | Visible Execution Trace | `IN_SCOPE` | Transparent operational trace cards. | Telemetry UI | Step 27 |
| `FR-034` | Task Cancellation & Retries | `IN_SCOPE` | Stops runaway tasks; recovers from glitches.| AbortController | Step 27 |
| `FR-035` | Tool Execution Audit Log | `IN_SCOPE` | Immutable forensic record of actions. | Local JSON Logger | Step 27 |
| `FR-037` | Hardware & OS Telemetry | `IN_SCOPE` | Real-time CPU, RAM, network stats. | `systeminformation` | Step 28 |
| `FR-038` | App Discovery & Launching | `IN_SCOPE` | Voice launching of Start Menu apps. | Shell Launcher | Step 28 |
| `FR-039` | Scoped File Operations | `IN_SCOPE` | Safe search, read, and organize in user dirs.| Path Validator | Step 29 |
| `FR-040` | Reversible File Operations | `IN_SCOPE` | Windows Recycle Bin staged undo. | Windows Recycle Bin | Step 29 |
| `FR-041` | Clipboard Read & Write | `IN_SCOPE` | Fast summarization and text copying. | Electron Clipboard | Step 29 |
| `FR-045` | Web Search & Information | `IN_SCOPE` | Real-time web search with citations. | Search API Client | Step 32 |
| `FR-046` | Web Content Extraction | `IN_SCOPE` | Article text extraction without ads. | Readability Parser | Step 32 |
| `FR-051` | User Profile & Preferences | `IN_SCOPE` | Personalized responses, tone, style. | JSON Store | Step 34 |
| `FR-052` | Persistent Long-Term Memory | `IN_SCOPE` | Retains user facts across restarts. | SQLite WAL Database | Step 34 |
| `FR-053` | Memory Inspector & Delete UI | `IN_SCOPE` | Complete user privacy control over memory.| Memory View UI | Step 34 |
| `FR-055` | Character & Personality Settings| `IN_SCOPE` | Archetype picker (JARVIS, Minimalist). | Prompt Assembler | Step 34 |
| `FR-057` | Integrated Notes & Markdown | `IN_SCOPE` | Built-in local notes workspace. | Markdown Editor | Step 35 |
| `FR-058` | Task Management & To-Do System | `IN_SCOPE` | Priority task board and tracking. | Task Store | Step 35 |
| `FR-059` | Timers & System Reminders | `IN_SCOPE` | Hands-free alarms and timer alerts. | Timer Service | Step 35 |

---

### 3.2 Post-Foundation Expansion (`DEFERRED` - P1 Expansion: 33 Features)

The following high-value capabilities are scheduled for Phase 6–8 (`v0.2.0`) after the P0 foundation is verified:
- `FR-012`: Task-Based Model Routing & Failovers.
- `FR-013`: Provider Health Monitoring & Quota Tracking.
- `FR-019`: Local Wake-Word Detection ("Hey Helioxen").
- `FR-020`: Assistant Voice Persona & Custom TTS.
- `FR-021`: Background Noise Suppression & Echo Cancellation.
- `FR-027`: Automated Local OCR Text Extraction.
- `FR-028`: Multimodal Context Sanitization & Credential Masking.
- `FR-033`: Specialized Sub-Agent Roles (Coder, Researcher, SysAdmin).
- `FR-036`: Fault-Tolerant Planner Self-Healing & Error Recovery.
- `FR-042`: Desktop Keyboard & Mouse Automation (Nut.js).
- `FR-043`: Window Management & Tiling Controls.
- `FR-044`: Sandboxed Script Execution with Code Preview.
- `FR-047`: Headless Browser Automation (Playwright).
- `FR-048`: Multi-Source Web Research Synthesis.
- `FR-049`: Web Page Full Screenshot Capture.
- `FR-054`: Semantic Vector Memory Search (`sqlite-vec`).
- `FR-056`: Memory Auto-Purge & Retention Rules.
- `FR-060`: Calendar Integration & Schedule Sync.
- `FR-061`: Automated Daily Morning Briefing.
- `FR-062`: Office Document Generation (PDF, DOCX, XLSX).
- `FR-064`: Interactive Mermaid & SVG Diagram Generator.
- `FR-065`: AI Image Generation Integration.
- `FR-066`: Media Gallery & Asset Browser.
- `FR-068`: Asset Export & Fast Clipboard Sharing.
- `FR-069`: Interactive 3D Holographic Globe.
- `FR-070`: Live Global News & Intelligence Ticker.
- `FR-071`: Local Weather & Atmospheric Telemetry.
- `FR-072`: Network Health & Latency Monitor.
- `FR-073`: Agent Activity & Tool Execution Stream.
- `FR-079`: Plugin & Skill Architecture Specification.
- `FR-080`: Plugin Manager & Permissions Inspector UI.
- `FR-081`: Isolated Worker Thread Plugin Sandbox.
- `FR-085`: Spotify Music Playback Control Integration.

---

### 3.3 Advanced & Optional Capabilities (`OPTIONAL` - P2: 19 Features)

Staged for Phase 9 (`v0.3.0+`) or experimental feature flags:
- `FR-014`: Local Offline AI Models (Ollama / Local Runners).
- `FR-022`: Audio Pipeline Latency & Jitter Telemetry.
- `FR-050`: Controlled Form Interaction & Download Safety.
- `FR-063`: Live Meeting Transcription & Diarization.
- `FR-067`: In-App Video & Audio Media Player.
- `FR-074`: Multi-Core CPU & GPU Diagnostic Widgets.
- `FR-075`: Functional Agent Town Spatial Visualization.
- `FR-076`: Inter-Agent Communication & Data Handoff Paths.
- `FR-077`: Interactive Agent Role Customization.
- `FR-078`: Multi-Agent Swarm Mode (Parallel Execution).
- `FR-082`: Dynamic AI Skill Builder & Code Generator.
- `FR-083`: Mandatory Human Review for AI Skills.
- `FR-084`: Skill Versioning & Rollback Management.
- `FR-086`: WhatsApp / Discord / Slack Integrations.
- `FR-087`: Wireless Android Bridge (ADB).
- `FR-088`: Smart Home & IoT Automation (Home Assistant / Hue).
- `FR-089`: Cloud Productivity Integrations (Google Workspace / M365).
- `FR-090`: Remote LAN Mobile Companion Server.

---

### 3.4 Explicit Architectural Exclusions (`EXCLUDED`)

The following patterns are permanently banned from HELIOXEN:
1. **Raw Unrestricted Shell Access (`CONCEPT-024`):** Prohibited due to prompt-injection and RCE vulnerabilities.
2. **Plaintext Credential Storage (`CONCEPT-022`):** Prohibited. All secrets must use OS Keychain.
3. **Disabled Electron Web Security (`CONCEPT-023`):** Prohibited. `webSecurity` and `contextIsolation` remain locked.
4. **Simulated / Fake Telemetry & Intelligence:** Prohibited. Any metric or feed without live data must state `OFFLINE`.
5. **Proprietary Code Reuse:** Prohibited. Zero code or assets from Brahma or Stonic repositories.

---

## 4. RELEASE MILESTONES (MAPPING THE 48-STEP ROADMAP)

```
[ Milestone A: Requirements & Design Baseline ]  -> Steps 1–3  (COMPLETED IN STEP 3)
         |
[ Milestone B: Architecture & Foundation ]      -> Steps 4–6  (Stack, Config, CI Rules)
         |
[ Milestone C: Visual & Desktop Foundation ]    -> Steps 7–15 (Design Tokens, Shell, Core UI, IPC, Vault)
         |
[ Milestone D: AI & Multimodal Core ]          -> Steps 16–24 (Providers, Live Voice, Vision, Docs)
         |
[ Milestone E: Tools & Productivity ]          -> Steps 25–39 (Tools, Planner, Files, Notes, Web, Gallery)
         |
[ Milestone F: Advanced Extensibility ]        -> Steps 40–45 (Agent Town, Plugins, Device Bridges)
         |
[ Milestone G: Reliability & Final Release ]   -> Steps 46–48 (Self-Repair, Audits, Windows Installer)
```

| Milestone | Roadmap Scope | Key Exit Deliverable | Approval Gate |
| :--- | :--- | :--- | :--- |
| **Milestone A** | Steps 1–3 | Baseline PRS, Clean-Room Policy, Acceptance Criteria, Threat Model, Frozen Scope. | Phase 1 Complete (Current) |
| **Milestone B** | Steps 4–6 | Stack selection, repo init, CI scripts, development guidelines. | Tech Stack Frozen |
| **Milestone C** | Steps 7–15 | Working custom desktop shell, 3-panel layout, orbital AI core, hardened IPC bridge, credential vault. | Shell & Security Pass |
| **Milestone D** | Steps 16–24 | Working live voice assistant (< 800ms, barge-in), authorized screen capture, document analysis. | Voice & Vision Pass |
| **Milestone E** | Steps 25–39 | Safe tool runner, task planner, file automation + undo, web search, memory inspector, notes/tasks. | Core Automation Pass |
| **Milestone F** | Steps 40–45 | P1/P2 extensions (Mermaid diagrams, 3D globe, plugin sandbox, Spotify). | Extension Audit Pass |
| **Milestone G** | Steps 46–48 | Automated regression suite, final security audit, production Windows Installer (`.exe`). | **v0.1.0 Release Approval** |

---

## 5. SCOPE CHANGE CONTROL POLICY

To protect the frozen baseline, any subsequent proposed addition, removal, or priority change must follow a formal 4-step impact assessment:

1. **Submission:** Proposed scope change submitted with rationale, user value, and target milestone.
2. **Impact Assessment:** Senior Architect and Security Reviewer evaluate:
   - Impact on 48-step schedule.
   - New security threats or trust boundary alterations.
   - Impact on performance targets (RAM, CPU, audio latency).
   - Clean-room and licensing compliance.
3. **Formal Approval:** Scope modification must be documented as an addendum to this baseline.
4. **Zero Silent Expansion:** Coding agents are strictly prohibited from implementing features outside their assigned roadmap step.

---

## 6. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Senior Product Architect & Release Manager | Formal Scope and Release Baseline established for Step 3 of 48. Froze initial release scope (`v0.1.0-Core` with 38 P0 features), defined deferred P1 capabilities (33 features), staged optional P2 capabilities (19 features), permanently excluded 5 security anti-patterns, mapped roadmap Milestones A–G, and established formal change control policy. |
