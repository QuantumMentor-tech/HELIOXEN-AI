# HELIOXEN AI — Product Requirements Specification (PRS)

**Document ID:** `HELIOXEN-PRS-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 1: Product Definition and Requirements  
**Step:** 1 of 48 (Consolidated Requirements and Feature Prioritization)  
**Status:** Baseline Specification (Approved for Architecture Phase)  
**Date:** October 31, 2026  
**Target Environment:** Windows 10/11 Desktop (64-bit)  

---

## 1. DOCUMENT PURPOSE AND REVISION STATUS

### 1.1 Purpose
This document establishes the definitive, comprehensive, and prioritized product requirements specification for **HELIOXEN AI**, an original, cinematic desktop AI command assistant. It consolidates functional capabilities, non-functional constraints, user experience architectures, and security boundaries derived from the project vision, reference benchmark audits, and user mandates.

This specification serves as the formal foundation for subsequent architectural design (Steps 2–6), user interface design (Steps 7–12), core systems engineering (Steps 13–18), voice and multimodal subsystems (Steps 19–24), tool and agent orchestration (Steps 25–33), and workspace intelligence modules (Steps 34–48).

### 1.2 Scope & Implementation Constraints
- **Execution Mode:** Read-Only Repository Audit + Requirements Documentation.
- **Application Source Code:** Strictly preserved. No source code, runtime components, dependencies, or package manifests are created or modified during Step 1.
- **Clean-Room Enforcement:** All requirements mandate 100% original implementation. Direct code copying, proprietary asset theft, or unauthorized replication of reference designs is strictly prohibited.

---

## 2. PRODUCT VISION AND PHILOSOPHY

HELIOXEN is conceived as an **intelligent desktop operating layer** rather than a passive chatbot trapped in a generic window. It provides a persistent, futuristic, yet remarkably clean command center that unites conversational intelligence, real-time voice interaction, multimodal vision, operating-system automation, task-oriented agent orchestration, persistent memory, and an extensible skill system.

### 2.1 Core Pillars
1. **Desktop Operating Layer:** HELIOXEN lives on the desktop as an always-accessible command hub with awareness of system state, user activity, active workflows, and connected peripherals.
2. **Real-Time Voice First:** Instantaneous, low-latency conversational voice control with interruptibility, streaming transcripts, and responsive visual states.
3. **Controlled Desktop Automation:** Safe, audited, reversible desktop manipulation (files, windows, system settings, clipboard, and browser tasks) that respects user security and explicit authorization boundaries.
4. **Autonomous Agent Orchestration:** Multi-step problem solving with specialized sub-agents, visible progress tracking, safe retries, and comprehensive audit trails.
5. **Private & Persistent Memory:** User-controlled long-term memory, contextual note taking, and preference adaptation with granular inspection and instant erasure capabilities.
6. **Cinematic Clean Aesthetics:** A fusion of Stonic AI's functional simplicity and JARVIS-inspired orbital holographic elegance, grounded in HELIOXEN's original neon cyan and deep orbital blue visual identity.

---

## 3. USER ROLES AND PRIMARY USE CASES

### 3.1 Target Audience
- **Power Users & Developers:** Requiring local workflow automation, command shortcuts, system telemetry, browser automation, code generation, and multi-agent task execution.
- **Knowledge Workers & Researchers:** Needing rapid synthesis of web documents, multi-file analysis, automated daily briefings, notes organization, and task tracking.
- **Creative & Technical Enthusiasts:** Seeking a futuristic, cinematic desktop AI companion with real-time voice, reactive 3D core visuals, and multimodal vision analysis.

### 3.2 Primary Use Cases
- **UC-01: Voice-Driven Desktop Command:** The user invokes HELIOXEN via wake-word or hotkey, speaks a complex request ("Summarize the open PDF and organize today's meeting notes"), and receives real-time spoken feedback while watching progress indicators.
- **UC-02: Multimodal Screen & Camera Analysis:** The user asks HELIOXEN to examine an active visual diagram on screen or inspect an object via webcam, asking architectural or debugging questions with instantaneous multimodal context.
- **UC-03: Multi-Step Agent Task Execution:** The user assigns an exploratory research task ("Find recent benchmark data on model X, compile a comparative spreadsheet, and generate a markdown briefing"). An autonomous planner orchestrates browser searches, extracts data, formats the file, and reports results.
- **UC-04: System Telemetry & Health Monitoring:** The user glances at the central command dashboard to check CPU/GPU temperatures, network bandwidth, background agent activity, and global events via an integrated intelligence feed.
- **UC-05: Controlled File & Workspace Automation:** The user requests workspace maintenance ("Organize my downloads folder by project and date"), which HELIOXEN inspects, drafts a reversible staging plan for, and executes only after explicit user confirmation.

---

## 4. REFERENCE HIERARCHY AND CLEAN-ROOM ARCHITECTURE

### 4.1 Reference Hierarchy
To achieve the optimal balance between functional power and interface clarity, HELIOXEN follows a strict reference hierarchy:

| Reference Source | Role | Key Borrowed Concepts | Excluded / Rejected Patterns |
| :--- | :--- | :--- | :--- |
| **Stonic AI** | **Primary UI/UX Reference** | Clean 3-panel command layout, central AI core, modular sidebar navigation, restrained futuristic aesthetic, simple accessible voice dock. | Plaintext credentials, disabled Electron `webSecurity`, raw unrestricted shell execution, hardcoded test secrets. |
| **IRIS AI** | **Secondary Reference** | Reactive 3D AI sphere, voice-responsive audio visualizer, camera/screen controls, system telemetry feeds, media gallery. | Incomplete IPC wiring, mock telemetry disguised as real, tight coupling of UI and logic. |
| **JARVIS Reference** | **Secondary Visual Reference** | Cinematic orbital rings, circular holographic HUDs, luminous status rings, mission-control typography. | Overly cluttered, non-functional decorative sci-fi elements that impede productivity. |
| **Brahma Echo / AI Evo** | **Supplementary Architecture** | Structured tool execution pipelines, dynamic skill registries, self-repair concepts, multi-agent coordination. | Proprietary/source-available licensing entanglements, overcrowded multi-widget dashboards that overwhelm users. |

### 4.2 Clean-Room Implementation Mandate
1. **Independent Implementation:** All application code, IPC bridges, state stores, tool runners, and UI components must be engineered completely from scratch.
2. **Original Visual Assets:** Use only the approved HELIOXEN brand identity derived from `Futuristic Helioxen Orbital Logo.png` (featuring orbital neon cyan rings and deep blue core styling).
3. **No Code Reuse:** Zero lines of code or non-free assets may be copied or decompiled from Stonic, IRIS, Brahma, or related proprietary repositories.

---

## 5. EVIDENCE CLASSIFICATION FRAMEWORK

Findings and requirements are categorized according to evidential origin:
- `[SOURCE-SUPPORTED]`: Verified directly from accessible documentation, reports, or project artifacts.
- `[USER-REQUIREMENT]`: Explicitly requested by the user in project prompts or direct mandates.
- `[PROPOSED]`: Architectural or functional recommendations engineered to fulfill requirements safely, subject to user ratification.
- `[INFERRED]`: Deductions logically required by desktop/Electron platforms or industry standards.
- `[UNKNOWN]`: Unresolved areas lacking empirical validation or external API access.
- `[CONFLICT]`: Inconsistent claims across reference versions (e.g., Stonic V1 vs V2 vs V3).

---

## 6. CONSOLIDATED FUNCTIONAL REQUIREMENTS

### 6.1 Core Desktop Experience (FR-001 – FR-008)

#### `FR-001`: Desktop Application Shell and Custom Window Framing
- **Purpose:** Provide a frameless, futuristic, high-performance desktop window with custom branding and system controls.
- **Expected Behavior:** Launches into a sleek, dark-themed frameless window with a custom titlebar featuring the HELIOXEN orbital logo, window minimize/maximize/close controls, and drag region.
- **Inputs/Outputs:** System window events; renders unified UI shell.
- **Dependencies:** Electron Main Process, Preload Bridge, Custom Titlebar Component.
- **Priority:** `P0`
- **Acceptance Criteria:** Custom window renders seamlessly on Windows 10/11; drag regions operate smoothly; snap-to-edge works; window states persist across restarts.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** Context isolation enabled; `nodeIntegration` disabled; safe IPC window handlers.

#### `FR-002`: Stonic-Inspired Command Center & Three-Panel Architecture
- **Purpose:** Maintain a focused, uncluttered, professional workspace.
- **Expected Behavior:** Three primary collapsible zones:
  1. *Left Navigation & Module Dock:* Direct access to Core, Memory, Skills, Character, Tools, Telemetry, and Settings.
  2. *Center Primary Workspace:* Hosts the Central AI Core, active task displays, and primary interaction surface.
  3. *Right Context Panel:* Collapsible conversation history, tool audit stream, and agent activity details.
- **Inputs/Outputs:** Navigation events, layout toggle triggers; renders adaptive panels.
- **Dependencies:** Layout management store, responsive CSS grid/flexbox.
- **Priority:** `P0`
- **Acceptance Criteria:** User can toggle or resize panels; central core remains prominent; no clipped text or overlapping controls at standard resolutions (1280x720 up to 4K).
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-003`: Central AI Core & Orbital State Visualizer
- **Purpose:** Serve as the visual and emotional heart of HELIOXEN, communicating real-time operational status.
- **Expected Behavior:** A central glowing holographic orbital orb inspired by the Helioxen logo with distinctive visual states: *Idle/Standby* (gentle breathing pulse), *Listening* (reactive cyan waveform/rings), *Thinking* (spinning orbital rings, acceleration), *Speaking* (synchronized voice pulsation), *Error* (amber/crimson warning aura), *Offline* (dimmed low-energy ring).
- **Inputs/Outputs:** Audio stream levels, AI state events (idle, listen, process, speak, error).
- **Dependencies:** State machine, Canvas/WebGL or CSS/SVG orbital visualizer.
- **Priority:** `P0`
- **Acceptance Criteria:** Smooth 60fps animations on integrated GPUs; latency between state change and visual transition < 50ms; reduced-motion setting dampens animations appropriately.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-004`: Unified Voice & Text Command Entry
- **Purpose:** Allow seamless input switching between keyboard typing and spoken voice.
- **Expected Behavior:** Centered or docked command bar with auto-resizing text input, speech-to-text toggle, attachment button, and mode selector. Pressing Enter sends command; clicking mic or using hotkey toggles voice.
- **Inputs/Outputs:** String input, audio microphone input; emits user prompt object.
- **Dependencies:** Voice Capture Service, Text Input Component.
- **Priority:** `P0`
- **Acceptance Criteria:** Typing never stutters; multiline input supported (Shift+Enter); command bar retains history (Up/Down arrow recall).
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-005`: Conversation Transcript & Multi-Turn History
- **Purpose:** Display clean, readable, threaded dialog with rich formatting.
- **Expected Behavior:** Displays user messages and assistant responses with Markdown rendering, code syntax highlighting, copy-to-clipboard buttons, and embedded tool execution chips.
- **Inputs/Outputs:** Message stream; renders chat feed.
- **Dependencies:** Markdown renderer, Conversation Store.
- **Priority:** `P0`
- **Acceptance Criteria:** Messages stream token-by-token without flickering; code blocks display syntax colors and copy confirmation; auto-scrolls smoothly on incoming tokens unless user scrolls up.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-006`: Persistent Voice Dock
- **Purpose:** Provide an always-accessible voice control widget regardless of active view.
- **Expected Behavior:** Floating or docked pill bar showing microphone mute/unmute status, audio level meter, voice activity indicator, and quick disconnect button.
- **Inputs/Outputs:** Audio levels, mute toggles.
- **Dependencies:** Voice Service, Audio Visualizer Component.
- **Priority:** `P0`
- **Acceptance Criteria:** Accessible from any view or screen within the app; one-click mute/unmute with immediate visual confirmation.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-007`: Connected Module Navigation (Memory, Skills, Character, Settings)
- **Purpose:** Clean separation of secondary concerns away from the primary command screen.
- **Expected Behavior:** Left rail or header icons seamlessly switch the center workspace into dedicated views for Memory inspection, Skill management, Character personality tuning, and System Settings, with instant return to Core.
- **Inputs/Outputs:** Navigation route selection.
- **Dependencies:** App Router / View State Manager.
- **Priority:** `P0`
- **Acceptance Criteria:** View transitions occur instantaneously (< 100ms); active background tasks or voice conversations persist uninterrupted during view navigation.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-008`: System Notifications, Status Badges, and Error Handling
- **Purpose:** Inform user of background task results, connectivity issues, and system warnings.
- **Expected Behavior:** Non-intrusive toast notifications and top-bar status badges displaying network health, provider connectivity, and operation results.
- **Inputs/Outputs:** System alert events.
- **Dependencies:** Notification Manager, Toast Component.
- **Priority:** `P0`
- **Acceptance Criteria:** Toasts auto-dismiss after configurable duration; critical errors persist until acknowledged; error messages contain actionable remediation steps.
- **Classification:** `[SOURCE-SUPPORTED]`

---

### 6.2 AI Provider and Model Management (FR-009 – FR-014)

#### `FR-009`: Unified AI Provider Abstraction Interface
- **Purpose:** Decouple application logic from specific LLM vendors.
- **Expected Behavior:** An adapter layer providing standardized methods (`generateText`, `streamChat`, `generateEmbeddings`, `processMultimodal`, `realtimeSession`) across multiple AI backends (e.g., Google Gemini, OpenAI, Anthropic, Local LLMs via Ollama/vLLM).
- **Inputs/Outputs:** Standardized request/response interfaces; provider-specific payloads.
- **Dependencies:** Main-process provider manager.
- **Priority:** `P0`
- **Acceptance Criteria:** Switching providers in Settings requires zero UI or tool code changes; provider errors map to uniform internal error codes.
- **Classification:** `[PROPOSED]`
- **Security/Privacy:** API keys handled exclusively in secure main process; never exposed to renderer window.

#### `FR-010`: Secure Provider Credential Storage Vault
- **Purpose:** Prevent credential theft and plaintext key leakage.
- **Expected Behavior:** Encrypts and stores API keys using operating-system native keychains (Windows Credential Manager via `keytar` or DPAPI safeStorage).
- **Inputs/Outputs:** Key set/get requests.
- **Dependencies:** OS Keychain API, Electron `safeStorage`.
- **Priority:** `P0`
- **Acceptance Criteria:** Zero plaintext keys written to disk, config files, or logs; passes credential extraction audit; rejects keys hardcoded in test files.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-011`: Model Registry and Capability Profiling
- **Purpose:** Maintain up-to-date metadata on available models and their token limits, multimodal support, and tool-calling capabilities.
- **Expected Behavior:** Configurable catalog listing model identifiers, context window sizes, input costs, tool support, and vision capabilities.
- **Inputs/Outputs:** Query model capabilities; returns capability flags.
- **Dependencies:** Model Configuration Store.
- **Priority:** `P0`
- **Acceptance Criteria:** Prevents assigning multimodal or tool-calling tasks to unsupported models.
- **Classification:** `[PROPOSED]`

#### `FR-012`: Task-Based Model Selection & Automatic Fallback
- **Purpose:** Route specialized tasks to optimal models and recover from outages.
- **Expected Behavior:** Allows assigning fast/light models to voice conversation, deep-reasoning models to agent planning, and local models to offline tasks. Automatically fails over to backup provider on 429 rate limits or 5xx server errors.
- **Inputs/Outputs:** Prompt and task type; selects best available model.
- **Dependencies:** Model Router, Health Monitor.
- **Priority:** `P1`
- **Acceptance Criteria:** Seamless fallback on provider timeout without dropping conversation context; user is notified of fallback occurrence.
- **Classification:** `[PROPOSED]`

#### `FR-013`: Provider Health Monitoring & Error Classification
- **Purpose:** Continuous visibility into external API connectivity and quotas.
- **Expected Behavior:** Tracks round-trip latency, rate-limit headers, and authentication validity.
- **Inputs/Outputs:** Ping/heartbeat requests; returns status dashboard metrics.
- **Dependencies:** Network service.
- **Priority:** `P1`
- **Acceptance Criteria:** Provider outage immediately indicated by yellow/red status badge in UI header.
- **Classification:** `[PROPOSED]`

#### `FR-014`: Local Offline Model Integration (Ollama / Local Runners)
- **Purpose:** Enable full air-gapped or zero-cost local AI execution.
- **Expected Behavior:** Detects local Ollama or compatible OpenAI-compliant endpoints; allows executing core chat and tools without internet access.
- **Inputs/Outputs:** Local HTTP endpoints.
- **Dependencies:** Local runner daemon.
- **Priority:** `P2`
- **Acceptance Criteria:** Graceful degradation when internet is disconnected; local models clearly tagged in model selector.
- **Classification:** `[PROPOSED]`

---

### 6.3 Voice Assistant & Audio Processing (FR-015 – FR-022)

#### `FR-015`: Real-Time Conversational Voice Interaction
- **Purpose:** Deliver fluid, low-latency spoken conversations.
- **Expected Behavior:** Captures microphone audio, streams to real-time speech-to-text or multimodal live API, receives streaming text/audio responses, and outputs speech through system audio.
- **Inputs/Outputs:** Audio stream input; audio output buffer.
- **Dependencies:** Audio capture worklet, Realtime Voice API / TTS engine.
- **Priority:** `P0`
- **Acceptance Criteria:** End-to-end voice latency < 800ms; speech output is clear and natural; audio levels visually drive the AI core orbital rings.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-016`: Real-Time User Interruption (Barge-In)
- **Purpose:** Enable natural conversational flow by letting the user speak over the assistant.
- **Expected Behavior:** When the user speaks while HELIOXEN is uttering audio, speech playback halts instantly (< 100ms), the generation stream cancels, and the system transitions to Listening mode.
- **Inputs/Outputs:** Voice Activity Detection (VAD) trigger during audio playback.
- **Dependencies:** Local VAD processor, Audio Player interrupt handler.
- **Priority:** `P0`
- **Acceptance Criteria:** Assistant stops speaking immediately upon user voice detection; no audio buffer echo or self-interruption from speaker playback.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-017`: Audio Device Selection and Volume Control
- **Purpose:** Ensure seamless hardware compatibility across microphones and headsets.
- **Expected Behavior:** User can select input microphone, output speaker device, and adjust volume/gain within settings or voice dock.
- **Inputs/Outputs:** Device enumerations, volume floats.
- **Dependencies:** Web Audio API, MediaDevices.
- **Priority:** `P0`
- **Acceptance Criteria:** Device switching takes effect immediately without restarting the application; handles device unplugging gracefully without crashes.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-018`: Streaming Live Transcription
- **Purpose:** Provide immediate visual confirmation of speech recognition.
- **Expected Behavior:** Displays live user words in real time within the conversation panel or voice overlay as words are spoken.
- **Inputs/Outputs:** Partial STT tokens.
- **Dependencies:** Speech-to-text engine.
- **Priority:** `P0`
- **Acceptance Criteria:** Partial transcripts appear with < 250ms latency; corrects misrecognitions as phonetic context stabilizes.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-019`: Configurable Wake-Word Activation
- **Purpose:** Enable hands-free voice invocation ("Hey Helioxen" or custom trigger).
- **Expected Behavior:** Runs an ultra-lightweight, private, local wake-word detector on background audio without streaming raw audio to the cloud until wake-word triggers.
- **Inputs/Outputs:** Local microphone stream; emits wake trigger event.
- **Dependencies:** Local ONNX wake-word engine (e.g., OpenWakeWord).
- **Priority:** `P1`
- **Acceptance Criteria:** Wake-word triggers within 300ms of utterance; false positive rate < 1 per 24 hours of normal room speech; zero external network packets sent prior to wake trigger.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** Strict local-only listening; visual indicator shows when wake-word engine is active.

#### `FR-020`: Assistant Voice Persona & Speech Synthesis Preferences
- **Purpose:** Customize assistant tone, voice style, and pacing.
- **Expected Behavior:** User can select from multiple voice models (different accents, genders, tones) and adjust speech pitch, rate, and style.
- **Inputs/Outputs:** TTS configuration settings.
- **Dependencies:** TTS engine (Cloud Neural TTS or Local Piper/Kokoro TTS).
- **Priority:** `P1`
- **Acceptance Criteria:** Voice preview button plays sample audio; settings persist across sessions.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-021`: Background Noise Suppression & Acoustic Echo Cancellation
- **Purpose:** Ensure clean speech capture in noisy desktop environments.
- **Expected Behavior:** Applies DSP filtering (AEC, noise suppression, auto-gain) to microphone stream before recognition.
- **Inputs/Outputs:** Raw PCM audio; filtered PCM audio.
- **Dependencies:** WebRTC DSP or Web Audio filters.
- **Priority:** `P1`
- **Acceptance Criteria:** Audio recognition succeeds in presence of moderate background fan or typing noise; speaker audio does not trigger false interruptions.
- **Classification:** `[PROPOSED]`

#### `FR-022`: Audio Session Telemetry & Latency Diagnostics
- **Purpose:** Diagnose network jitter and voice processing bottlenecks.
- **Expected Behavior:** Developer/Settings view displaying round-trip audio latency, jitter buffer depth, packet drop rate, and token turnaround time.
- **Inputs/Outputs:** Network and audio metrics.
- **Dependencies:** Audio pipeline telemetry.
- **Priority:** `P2`
- **Acceptance Criteria:** Metrics update in real-time during active voice sessions.
- **Classification:** `[PROPOSED]`

---

### 6.4 Multimodal Vision and Context (FR-023 – FR-028)

#### `FR-023`: Explicitly Authorized Desktop Screen & Window Capture
- **Purpose:** Allow HELIOXEN to inspect the user's desktop, active application, or specific window.
- **Expected Behavior:** User triggers screen capture via button or command; displays selection modal (Entire Screen, Specific Window, or Region); captures high-resolution screenshot and attaches to prompt context.
- **Inputs/Outputs:** Desktop capture stream; encoded JPEG/PNG image buffer.
- **Dependencies:** Electron `desktopCapturer`, Permission Manager.
- **Priority:** `P0`
- **Acceptance Criteria:** Screen capture requires explicit user initiation or persistent session grant; visual banner clearly indicates active capture; captures crisp text.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** Never captures screen in background without user consent; provides red border or notification during active capture.

#### `FR-024`: Explicitly Authorized Camera Capture
- **Purpose:** Enable webcam-based visual questions and real-world physical object inspection.
- **Expected Behavior:** User toggles camera button; camera activates with preview thumbnail; user can snap frame or maintain continuous live stream for visual Q&A.
- **Inputs/Outputs:** Webcam stream; image frames.
- **Dependencies:** MediaDevices API, Camera Permission Handler.
- **Priority:** `P0`
- **Acceptance Criteria:** Camera light activates only during active preview/capture; one-click immediate shutoff; frames cleared from memory upon session end.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** Strict opt-in; hardware indicator respect; zero continuous background recording.

#### `FR-025`: Multimodal Visual Question Answering (VQA)
- **Purpose:** Explain, debug, translate, or extract insights from captured images.
- **Expected Behavior:** User submits an image (screenshot, photo, diagram) with a question ("What is causing this code error?", "Transcribe this whiteboard"); model provides detailed analysis.
- **Inputs/Outputs:** Image buffer + text query; formatted analysis response.
- **Dependencies:** Multimodal AI Provider Adapter.
- **Priority:** `P0`
- **Acceptance Criteria:** Accurate identification of UI controls, text, errors, and visual structures; handles high-resolution images with automatic intelligent downscaling if token limits require.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-026`: Multi-Format File Attachments & Document Ingestion
- **Purpose:** Allow attaching PDFs, Word docs, code files, text files, and spreadsheets to conversations.
- **Expected Behavior:** User drags & drops files into command bar; files appear as removable chips; files are parsed and contextually injected into model context.
- **Inputs/Outputs:** File paths / Blobs; parsed text/structured content.
- **Dependencies:** Document Parser (PDF parser, plaintext reader, sheet parser).
- **Priority:** `P0`
- **Acceptance Criteria:** Supports `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.docx`; files > 10MB warn user about token usage; provides instant preview.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-027`: Automated OCR and Document Text Extraction
- **Purpose:** Extract readable text from rasterized scans or screenshot snippets.
- **Expected Behavior:** Extracts clean, selectable text and tabular data from images without requiring cloud LLM tokens if local OCR is available.
- **Inputs/Outputs:** Raster image; plain text or markdown table.
- **Dependencies:** Local OCR library (e.g., Tesseract.js / Windows OCR API) or Cloud Vision fallback.
- **Priority:** `P1`
- **Acceptance Criteria:** Extracts text with > 95% accuracy on clear digital screenshots; formats tables into Markdown tables.
- **Classification:** `[PROPOSED]`

#### `FR-028`: Unified Multimodal Context Buffer & Privacy Scrubbing
- **Purpose:** Manage multimodal memory footprint and sanitize sensitive visual data.
- **Expected Behavior:** Assembles text, images, and tool responses into clean prompt payloads; automatically clears large image buffers from RAM after inference; option to blur detected API keys, credit cards, or passwords before transmission.
- **Inputs/Outputs:** Raw context items; sanitized model payload.
- **Dependencies:** Privacy Filter, Memory Manager.
- **Priority:** `P1`
- **Acceptance Criteria:** Sensitive credential patterns detected in images/text flag an alert to user before transmission.
- **Classification:** `[PROPOSED]`

---

### 6.5 AI Tool System and Agent Orchestration (FR-029 – FR-036)

#### `FR-029`: Structured Tool Registry & Typed Schema Validation
- **Purpose:** Provide a safe, extensible mechanism for the model to invoke desktop capabilities.
- **Expected Behavior:** Central registry defining all tools with strict JSON schema parameters, return types, descriptions, and danger classifications (Read-Only, Modifying, Destructive).
- **Inputs/Outputs:** Tool invocation requests; validated JSON arguments; execution outputs.
- **Dependencies:** Schema validator (e.g., Zod), Tool Dispatcher.
- **Priority:** `P0`
- **Acceptance Criteria:** Model cannot invoke unregistered tools; invalid parameters are rejected with descriptive schema errors before execution.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-030`: Two-Tier Permission Check & Explicit Approval Workflow
- **Purpose:** Prevent unauthorized execution of high-impact or destructive operations.
- **Expected Behavior:** Low-risk tools (read file, web search, system time) execute automatically. High-risk tools (delete file, write file outside sandbox, execute shell command, modify system settings) trigger a modal dialog showing exact parameters, target paths, and explicit [Approve] / [Deny] buttons.
- **Inputs/Outputs:** Tool execution request; user consent event.
- **Dependencies:** Security Approval Modal, IPC Security Gate.
- **Priority:** `P0`
- **Acceptance Criteria:** Destructive operations NEVER proceed without user clicking Approve; denial returns a clean rejection message to model to adjust plan.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** Protection against prompt injection attacks attempting unauthorized system commands.

#### `FR-031`: Autonomous Task Planner & Multi-Step Execution Engine
- **Purpose:** Break complex user goals into logical, sequential sub-tasks.
- **Expected Behavior:** When given an open-ended goal ("Research competitors and compile a report"), the planner generates a structured execution plan with discrete steps, dynamically executing tools, evaluating intermediate outputs, and adjusting steps as needed.
- **Inputs/Outputs:** High-level objective; execution plan graph; final consolidated deliverable.
- **Dependencies:** Task Planner Service, Orchestration Engine.
- **Priority:** `P0`
- **Acceptance Criteria:** Visual execution plan shows pending, running, completed, and failed steps in the UI; user can pause or cancel at any step.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-032`: Visible Tool Execution Trace (No Private Chain-of-Thought Leaks)
- **Purpose:** Provide transparent progress visibility without exposing raw internal model thinking.
- **Expected Behavior:** Displays clean execution cards in the UI showing: *Action Name*, *Parameters* (sanitized), *Execution Status*, and *Result Summary*. Model internal reasoning traces are stripped or formatted cleanly for user readability.
- **Inputs/Outputs:** Tool telemetry events.
- **Dependencies:** Execution Trace UI Component.
- **Priority:** `P0`
- **Acceptance Criteria:** User clearly sees what HELIOXEN is doing without being overwhelmed by raw model log dumps.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-033`: Specialized Agent Roles (Researcher, Coder, System Admin, Writer)
- **Purpose:** Route specialized tasks to dedicated sub-agent personas with tailored system prompts and restricted toolsets.
- **Expected Behavior:** Sub-agents have defined capabilities: *Researcher* has browser/search tools; *Coder* has code analysis/diff tools; *System Admin* has diagnostic tools.
- **Inputs/Outputs:** Task assignment; sub-agent report.
- **Dependencies:** Agent Coordinator.
- **Priority:** `P1`
- **Acceptance Criteria:** Sub-agents cannot invoke tools outside their assigned capability boundary.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-034`: Task Cancellation, Timeout, and Safe Retry Policies
- **Purpose:** Prevent runaway agent loops and infinite tool calls.
- **Expected Behavior:** Every tool execution has configurable timeout (default 30s); user has instant global [Stop Task] button; transient network failures retry up to 3 times with exponential backoff.
- **Inputs/Outputs:** Cancellation signal, timeout timers.
- **Dependencies:** Async Task Controller.
- **Priority:** `P0`
- **Acceptance Criteria:** Clicking Stop immediately aborts active HTTP requests and child processes; max recursion depth prevents runaway agent loops.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-035`: Comprehensive Tool Execution Audit Log
- **Purpose:** Complete forensic record of all operations performed on the host system.
- **Expected Behavior:** Appends every tool call, timestamp, user approval status, parameters, output summary, and duration to a local encrypted or protected audit log file.
- **Inputs/Outputs:** Tool execution events; structured JSON log files.
- **Dependencies:** Audit Logger Service.
- **Priority:** `P0`
- **Acceptance Criteria:** Audit logs are searchable in Settings; cannot be modified by the AI model itself.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-036`: Fault-Tolerant Self-Healing and Error Correction
- **Purpose:** Recover gracefully when a tool call returns an unexpected error.
- **Expected Behavior:** If a tool call fails (e.g., file not found, syntax error in generated script), the error output is fed back to the planner to formulate an alternative approach or ask the user for clarification.
- **Inputs/Outputs:** Tool error object; revised action plan.
- **Dependencies:** Planner Error Recovery Module.
- **Priority:** `P1`
- **Acceptance Criteria:** Model attempts sensible recovery (e.g., alternative file path search) before giving up; aborts gracefully if stuck after 3 attempts.
- **Classification:** `[SOURCE-SUPPORTED]`

---

### 6.6 Desktop and System Automation (FR-037 – FR-044)

#### `FR-037`: Hardware & Operating System Telemetry
- **Purpose:** Monitor host system performance, resource load, and environment health.
- **Expected Behavior:** Gathers real-time CPU usage, RAM utilization, GPU usage, battery status, disk space, and network latency; displays clean status badges in the UI.
- **Inputs/Outputs:** System metrics; telemetry data stream.
- **Dependencies:** System information module (`systeminformation` or native node addons in main process).
- **Priority:** `P0`
- **Acceptance Criteria:** CPU/RAM poll rate throttles when window is minimized; updates every 2 seconds when visible; zero noticeable CPU overhead (< 0.5% CPU).
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-038`: Installed Application Discovery and Controlled Launching
- **Purpose:** Open or switch to applications by voice or text command.
- **Expected Behavior:** Indexes installed applications via standard Windows Start Menu shortcuts and registry paths; allows commands like "Open Spotify", "Launch Visual Studio Code".
- **Inputs/Outputs:** App name string; launches application process.
- **Dependencies:** Application Indexer, Process Launcher.
- **Priority:** `P0`
- **Acceptance Criteria:** Correctly resolves common app aliases; rejects executing arbitrary unverified binary paths or URLs without user consent.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-039`: Scoped File Discovery and Controlled File Operations
- **Purpose:** Search, read, create, rename, and organize workspace files.
- **Expected Behavior:** Fast file search within user-designated directories (Documents, Projects, Downloads); controlled move, copy, rename, and delete actions.
- **Inputs/Outputs:** File paths, search queries; file system operations.
- **Dependencies:** File Service, Path Whitelist Validator.
- **Priority:** `P0`
- **Acceptance Criteria:** Read operations permitted in user folders; write/delete operations outside application sandbox require explicit user confirmation.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** System directories (`C:\Windows`, `Program Files`) strictly protected and blocked from write/delete.

#### `FR-040`: Reversible File Operations (Recycle Bin / Staged Undo)
- **Purpose:** Prevent accidental data loss during automated file maintenance.
- **Expected Behavior:** File deletion operations move files to the Windows Recycle Bin rather than executing permanent unlinked deletion; bulk organization tasks create an undo manifest.
- **Inputs/Outputs:** File targets; undo log.
- **Dependencies:** Native trash utility / staging manager.
- **Priority:** `P0`
- **Acceptance Criteria:** User can click [Undo Last Operation] to restore organized or deleted files to original paths.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-041`: Clipboard Reading and Writing
- **Purpose:** Allow HELIOXEN to summarize clipboard contents or copy generated text/code to clipboard.
- **Expected Behavior:** Commands like "Summarize what I just copied" or "Copy that python script to clipboard".
- **Inputs/Outputs:** System clipboard string/images.
- **Dependencies:** Electron `clipboard` API.
- **Priority:** `P0`
- **Acceptance Criteria:** User receives subtle toast notification whenever clipboard content is read or written.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-042`: Controlled Keyboard and Mouse Automation
- **Purpose:** Automate repetitive UI clicks and keystrokes when APIs are unavailable.
- **Expected Behavior:** Simulates keystrokes or mouse clicks to interact with desktop windows when explicitly requested.
- **Inputs/Outputs:** Coordinate points, key sequences.
- **Dependencies:** Native automation library (e.g., `robotjs` / `nut.js`).
- **Priority:** `P1`
- **Acceptance Criteria:** Emergency escape key (e.g., Escape held for 1 second) immediately terminates automation; never active in background without user knowledge.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-043`: Window Management (Focus, Minimize, Tile)
- **Purpose:** Assist user with desktop window organization.
- **Expected Behavior:** Enumerates open window titles; allows commands like "Bring browser to front", "Minimize all windows".
- **Inputs/Outputs:** Window handles, titles.
- **Dependencies:** Native Windows API bindings.
- **Priority:** `P1`
- **Acceptance Criteria:** Operates smoothly on Windows 10/11 without administrative elevation.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-044`: Sandboxed Script & Command Execution with Confirmation
- **Purpose:** Run terminal commands or developer scripts safely.
- **Expected Behavior:** When code execution is needed (e.g., Python calculation, Git query), the script is shown to the user with syntax highlighting and risk assessment before running.
- **Inputs/Outputs:** Command string; execution stdout/stderr.
- **Dependencies:** Child Process Runner, Execution Sandbox.
- **Priority:** `P1`
- **Acceptance Criteria:** Zero raw shell execution by default; dangerous commands (`rmdir /s`, `format`, `reg delete`) are hard-blocked by policy.
- **Classification:** `[USER-REQUIREMENT]`

---

### 6.7 Browser and Web Intelligence (FR-045 – FR-050)

#### `FR-045`: Web Search and Information Retrieval
- **Purpose:** Answer questions requiring real-time online data.
- **Expected Behavior:** Executes search queries via web search APIs or privacy-focused scrapers; extracts top snippet results and synthesizes clear answers with citations.
- **Inputs/Outputs:** Search query string; summarized answers with source links.
- **Dependencies:** Search API client / Scraper engine.
- **Priority:** `P0`
- **Acceptance Criteria:** Returns search answers with clickable source markdown links; avoids hallucinated URLs.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-046`: Web Page Content Extraction and Article Summarization
- **Purpose:** Read and distill information from specific URLs.
- **Expected Behavior:** Fetches HTML content, extracts readable text (stripping navigation, ads, and boilerplate), and summarizes key points.
- **Inputs/Outputs:** URL string; structured summary.
- **Dependencies:** HTTP Fetcher, Readability / DOM parser.
- **Priority:** `P0`
- **Acceptance Criteria:** Successfully extracts content from major news, blog, and documentation sites; respects `robots.txt` and anti-scraping policies gracefully.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-047`: Embedded Headless Browser Automation (Puppeteer / Playwright)
- **Purpose:** Perform multi-step web navigation, form filling, and dynamic content extraction.
- **Expected Behavior:** Launches isolated headless browser instance to render SPA web pages, take screenshots, click buttons, or download resources.
- **Inputs/Outputs:** Navigation actions; rendered page data.
- **Dependencies:** Playwright or Puppeteer engine.
- **Priority:** `P1`
- **Acceptance Criteria:** Isolated browser profile; zero access to user's main Chrome/Edge cookies unless explicitly authorized; strict URL navigation whitelist/blacklist.
- **Classification:** `[SOURCE-SUPPORTED]`
- **Security/Privacy:** Blocks navigation to malicious domains, file:// protocol, and local loopback addresses (SSRF protection).

#### `FR-048`: Web Research Multi-Source Synthesis
- **Purpose:** Autonomous deep research across multiple publications.
- **Expected Behavior:** Searches multiple queries, reads 3–5 relevant articles, compares findings, notes discrepancies, and compiles a comprehensive research briefing.
- **Inputs/Outputs:** Research topic; formatted research report.
- **Dependencies:** Agent Planner, Browser Extraction Service.
- **Priority:** `P1`
- **Acceptance Criteria:** Produces structured reports with executive summary, detailed analysis, and verified bibliography.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-049`: Web Page Screenshot Capture
- **Purpose:** Capture full-page or viewport screenshots of websites for visual analysis.
- **Expected Behavior:** Renders URL and returns high-resolution image to multimodal context.
- **Inputs/Outputs:** URL; PNG image buffer.
- **Dependencies:** Headless Browser Engine.
- **Priority:** `P1`
- **Acceptance Criteria:** Handles responsive viewport resizing; captures full scrolling height when requested.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-050`: Controlled Form Interaction and Download Safety
- **Purpose:** Automate routine form submissions or file downloads safely.
- **Expected Behavior:** Previews form fields and values before clicking submit; validates downloaded file extensions against malicious executable types (`.exe`, `.bat`, `.scr`).
- **Inputs/Outputs:** Form schemas, download URLs.
- **Dependencies:** Browser Controller, Download Inspector.
- **Priority:** `P2`
- **Acceptance Criteria:** Automatic downloads of executable binaries blocked by default; warns user before downloading large files.
- **Classification:** `[PROPOSED]`

---

### 6.8 Memory, Personalization, and Knowledge (FR-051 – FR-056)

#### `FR-051`: User Profile & Preference Storage
- **Purpose:** Personalize assistant responses to user identity, name, role, and style preferences.
- **Expected Behavior:** Stores user name, preferred language, tone (concise, technical, conversational), coding style, and default models in local config.
- **Inputs/Outputs:** Profile settings JSON.
- **Dependencies:** Profile Store.
- **Priority:** `P0`
- **Acceptance Criteria:** Personalization reflected across all AI responses; easily editable in Settings.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-052`: Persistent Long-Term Memory (Facts, Projects, Preferences)
- **Purpose:** Remember critical context across days and application restarts.
- **Expected Behavior:** Assistant detects persistent facts during conversation ("I am working on the Helioxen project in Rust", "My dog's name is Nova") and saves them to a structured long-term memory store.
- **Inputs/Outputs:** Extracted facts; indexed memory records.
- **Dependencies:** Memory Extractor, Local Database / Vector Store (e.g., SQLite / SQLite-Vec).
- **Priority:** `P0`
- **Acceptance Criteria:** Relevant memories automatically retrieved and injected into prompt context when related topics arise; stores timestamp and origin message.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-053`: Granular Memory Inspector, Editor, and Deletion UI
- **Purpose:** Full transparency and user control over stored memories.
- **Expected Behavior:** Dedicated Memory view listing all remembered facts categorized by topic; user can edit any memory text, manually add memories, or delete individual/all items with a single click.
- **Inputs/Outputs:** Memory records; CRUD operations.
- **Dependencies:** Memory View Component, Memory Store.
- **Priority:** `P0`
- **Acceptance Criteria:** Deleting a memory permanently purges it from local disk and vector indices; instant update in UI.
- **Classification:** `[USER-REQUIREMENT]`
- **Security/Privacy:** Memory is 100% local by default; zero external cloud sync without explicit user configuration.

#### `FR-054`: Semantic Vector Search & Context Retrieval
- **Purpose:** Retrieve relevant historical facts without exceeding model token limits.
- **Expected Behavior:** Uses local embedding model (e.g., MiniLM via ONNX or cloud embedding API) to perform semantic cosine similarity search against user memory and past notes.
- **Inputs/Outputs:** Query string; top-k relevant memory chunks.
- **Dependencies:** Vector Store, Embedding Generator.
- **Priority:** `P1`
- **Acceptance Criteria:** Sub-50ms retrieval of relevant context across thousands of stored memory items.
- **Classification:** `[PROPOSED]`

#### `FR-055`: Assistant Character & Personality Customization
- **Purpose:** Adjust HELIOXEN's demeanor, humor level, and conversational style.
- **Expected Behavior:** Dedicated Character screen with preset archetypes (e.g., "JARVIS Professional", "Cyberpunk AI", "Direct Minimalist", "Custom") allowing custom system prompt customization.
- **Inputs/Outputs:** Character prompt template.
- **Dependencies:** Character View, Prompt Assembler.
- **Priority:** `P0`
- **Acceptance Criteria:** Changes take effect immediately on subsequent conversational turns.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-056`: Data Retention & Auto-Purge Controls
- **Purpose:** Comply with user privacy preferences and disk space constraints.
- **Expected Behavior:** Configurable data retention policies (e.g., auto-purge conversation history after 7, 30, or 90 days; or keep indefinitely).
- **Inputs/Outputs:** Retention settings.
- **Dependencies:** Maintenance Job Runner.
- **Priority:** `P1`
- **Acceptance Criteria:** Auto-purge executes cleanly without corrupting database integrity.
- **Classification:** `[PROPOSED]`

---

### 6.9 Productivity and Daily Workflows (FR-057 – FR-063)

#### `FR-057`: Integrated Notes & Markdown Workspace
- **Purpose:** Fast note-taking, idea capture, and AI document editing.
- **Expected Behavior:** Built-in Markdown editor with live preview, syntax highlighting, folder organization, and direct AI assistance ("Improve writing", "Summarize notes", "Generate outline").
- **Inputs/Outputs:** Markdown files; edited text.
- **Dependencies:** Markdown Editor Component.
- **Priority:** `P0`
- **Acceptance Criteria:** Supports standard GFM syntax; saves notes automatically to local directory as `.md` files; instant search across notes.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-058`: Task Management & Priority To-Do System
- **Purpose:** Organize daily tasks and monitor execution status.
- **Expected Behavior:** Task board / list supporting task creation, priority tags (P0, P1, P2), due dates, completion checkboxes, and natural language addition ("Add task: Submit report by 4pm").
- **Inputs/Outputs:** Task items.
- **Dependencies:** Task Store.
- **Priority:** `P0`
- **Acceptance Criteria:** Tasks persist locally; assistant can read active tasks and suggest next actions.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-059`: Timers, Stopwatches, and System Reminders
- **Purpose:** Keep user focused and on schedule via voice or text.
- **Expected Behavior:** Commands like "Set a timer for 25 minutes", "Remind me to call John at 3 PM". Triggers audio chime and system toast notification upon expiry.
- **Inputs/Outputs:** Duration / target time string; timer alerts.
- **Dependencies:** Timer Service, Windows Toast Notifications.
- **Priority:** `P0`
- **Acceptance Criteria:** Timers fire accurately even if app is minimized; handles system sleep/wake transitions.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-060`: Calendar Integration & Schedule Sync
- **Purpose:** Read and organize user daily calendar events.
- **Expected Behavior:** Connects to local `.ics` calendars or Google/Outlook Calendar APIs to display today's agenda and warn of upcoming meetings.
- **Inputs/Outputs:** Calendar credentials / iCal feeds; agenda view.
- **Dependencies:** Calendar Service.
- **Priority:** `P1`
- **Acceptance Criteria:** Requires explicit OAuth authorization; displays clean daily timeline.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-061`: Automated Daily Morning Briefing
- **Purpose:** Kickstart the day with a consolidated spoken and visual summary.
- **Expected Behavior:** Single command ("Give me my morning briefing") synthesizes: weather forecast, today's schedule, pending high-priority tasks, and top news headlines into a spoken overview and visual dashboard card.
- **Inputs/Outputs:** Weather + Calendar + Tasks + News; spoken & formatted briefing.
- **Dependencies:** Briefing Aggregator.
- **Priority:** `P1`
- **Acceptance Criteria:** Briefing delivers concise summary in < 45 seconds of speech; fully customizable sections in Settings.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-062`: Office Document Generation (PDF, DOCX, XLSX)
- **Purpose:** Generate polished professional documents on command.
- **Expected Behavior:** Generates formatted PDF reports, Word documents, or Excel spreadsheets from conversational data or research outputs.
- **Inputs/Outputs:** Structured data; exported file buffers.
- **Dependencies:** Document Generator libraries (e.g., `pdfkit`, `docx`, `exceljs`).
- **Priority:** `P1`
- **Acceptance Criteria:** Generated documents open without corruption in Microsoft Office, LibreOffice, and PDF viewers; clean typography and styling.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-063`: Meeting Transcription & Action-Item Extraction
- **Purpose:** Transcribe audio recordings or live meetings and extract actionable follow-ups.
- **Expected Behavior:** Ingests recorded audio or listens to meeting; generates speaker-separated transcript, executive summary, and bulleted action items with assignees.
- **Inputs/Outputs:** Audio file / stream; structured meeting notes.
- **Dependencies:** Whisper / Speech API, Meeting Summarizer.
- **Priority:** `P2`
- **Acceptance Criteria:** Identifies distinct action items and allows one-click conversion into tasks in FR-058.
- **Classification:** `[SOURCE-SUPPORTED]`

---

### 6.10 Visual Intelligence Workspace (FR-064 – FR-068)

#### `FR-064`: Interactive Diagram Generation (Mermaid & SVG)
- **Purpose:** Visualize architectures, flowcharts, sequences, and mindmaps.
- **Expected Behavior:** Assistant detects when a diagram is requested or beneficial; generates valid Mermaid.js code; renders an interactive, zoomable, pannable diagram directly in the workspace.
- **Inputs/Outputs:** Mermaid code; interactive SVG canvas.
- **Dependencies:** Mermaid.js renderer, Pan/Zoom controller.
- **Priority:** `P1`
- **Acceptance Criteria:** Clean rendering; syntax error recovery; one-click export to PNG or SVG file.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-065`: Image Generation Integration
- **Purpose:** Create custom illustrations, mockups, and visual assets.
- **Expected Behavior:** Connects to image generation providers (e.g., Imagen, DALL-E, Stable Diffusion) to generate visual assets from text prompts; displays results with aspect-ratio controls.
- **Inputs/Outputs:** Prompt string; generated image buffers.
- **Dependencies:** Image Provider Adapter.
- **Priority:** `P1`
- **Acceptance Criteria:** Displays generation loading state; generated images saved to project media folder; supports prompt revision.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-066`: Media Gallery & Asset Browser
- **Purpose:** Browse, filter, and inspect all generated images, diagrams, and captured screenshots.
- **Expected Behavior:** Dedicated VisualHub / Media Gallery view displaying asset thumbnails, creation dates, prompt metadata, and dimensions.
- **Inputs/Outputs:** Media directory records.
- **Dependencies:** Media Gallery Component.
- **Priority:** `P1`
- **Acceptance Criteria:** Fast thumbnail grid rendering; lightbox preview with zoom; click to reveal in Windows Explorer.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-067`: Video Preview & Media Playback
- **Purpose:** Review audio/video recordings and generated animations within the app.
- **Expected Behavior:** Lightweight media player supporting MP4, WebM, WAV, MP3 with scrubber, play/pause, and volume controls.
- **Inputs/Outputs:** Media file paths.
- **Dependencies:** HTML5 Media Player.
- **Priority:** `P2`
- **Acceptance Criteria:** Hardware-accelerated smooth playback; no memory leaks during repeated media loads.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-068`: Asset Export and Sharing Management
- **Purpose:** Quickly copy, convert, or export visual assets to other workflows.
- **Expected Behavior:** Context menu on any media asset to Copy to Clipboard, Export as (PNG, JPEG, WebP), or Reveal in File Explorer.
- **Inputs/Outputs:** File export commands.
- **Dependencies:** File Export Service.
- **Priority:** `P1`
- **Acceptance Criteria:** Instant clipboard copy of raw image bitmap for pasting directly into Slack, Discord, or Figma.
- **Classification:** `[SOURCE-SUPPORTED]`

---

### 6.11 World Monitor and Intelligence Dashboard (FR-069 – FR-074)

#### `FR-069`: Interactive 3D Holographic Globe
- **Purpose:** Provide a cinematic, JARVIS/IRIS-inspired spatial view of global information.
- **Expected Behavior:** Interactive 3D globe rendered with Three.js/WebGL featuring dark aesthetic, glowing neon orbital lines, rotation controls, and geographic coordinate markers.
- **Inputs/Outputs:** Geographic coordinates; 3D viewport canvas.
- **Dependencies:** Three.js / WebGL renderer.
- **Priority:** `P1`
- **Acceptance Criteria:** Runs at consistent 60fps on modern GPUs; graceful fallback to 2D stylized map on low-power devices; pauses rendering when tab is inactive.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-070`: Live Global News & Current Event Intelligence
- **Purpose:** Surface curated international news headlines and breaking events.
- **Expected Behavior:** Ingests RSS feeds or news APIs across tech, world news, and science; displays scrolling ticker or cards. Clicking headline provides an AI summary.
- **Inputs/Outputs:** News feed URLs / API responses.
- **Dependencies:** News Aggregator.
- **Priority:** `P1`
- **Acceptance Criteria:** Clearly distinguishes verified live news feeds from simulated data; includes publisher attribution and timestamps.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-071`: Local Weather & Atmospheric Telemetry
- **Purpose:** Show current weather, temperature, humidity, and forecasts.
- **Expected Behavior:** Fetches weather via free/open weather API based on user-configured city or IP geolocation (opt-in); renders animated weather icon and forecast.
- **Inputs/Outputs:** Location coordinates / city; weather metrics.
- **Dependencies:** Weather API client.
- **Priority:** `P1`
- **Acceptance Criteria:** Updates hourly; zero location tracking without user consent; handles offline state gracefully.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-072`: Network Health & Latency Monitor
- **Purpose:** Continuously display internet connectivity, gateway ping, and DNS status.
- **Expected Behavior:** Shows ping to primary gateway and DNS; displays latency sparkline and offline warning.
- **Inputs/Outputs:** Ping metrics.
- **Dependencies:** Network Diagnostic Module.
- **Priority:** `P1`
- **Acceptance Criteria:** Non-intrusive lightweight polling (every 10s); detects network disconnection immediately.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-073`: Agent Activity & Tool Execution Stream
- **Purpose:** Real-time visual feed of all background operations occurring across the system.
- **Expected Behavior:** Scrolling terminal-style or card-style telemetry stream showing active agent tasks, tool executions, and file access events.
- **Inputs/Outputs:** System event bus.
- **Dependencies:** Telemetry Event Bus, Stream Component.
- **Priority:** `P1`
- **Acceptance Criteria:** Filterable by severity (Info, Warning, Error); user can pause stream.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-074`: System Performance Dashboard Widgets
- **Purpose:** Dedicated deep-dive view into CPU cores, GPU engines, memory allocations, and disk I/O.
- **Expected Behavior:** Detailed telemetry charts showing multi-core CPU usage, process memory footprint, and disk read/write throughput.
- **Inputs/Outputs:** OS diagnostic APIs.
- **Dependencies:** Telemetry Service.
- **Priority:** `P2`
- **Acceptance Criteria:** Accurate metrics matching Windows Task Manager; low self-consumption.
- **Classification:** `[SOURCE-SUPPORTED]`

---

### 6.12 Agent Town & Spatial Multi-Agent Workspace (FR-075 – FR-078)

#### `FR-075`: Functional Agent Town Spatial Visualization
- **Purpose:** Represent multi-agent orchestration states through an intuitive, visual office metaphor.
- **Expected Behavior:** Dedicated view where specialized sub-agents (Researcher, Coder, Reviewer, Coordinator) have visual avatar stations representing their real operational state (*Idle*, *Thinking*, *Collaborating*, *Error*).
- **Inputs/Outputs:** Agent orchestration events.
- **Dependencies:** Canvas/SVG renderer, Agent Manager.
- **Priority:** `P2`
- **Acceptance Criteria:** Strictly reflects genuine underlying orchestration state; never plays simulated fake work animations; clicking an agent opens its active execution log.
- **Classification:** `[PROPOSED]`

#### `FR-076`: Agent Task Handoff & Communication Visualization
- **Purpose:** Display inter-agent messages and collaborative workflows.
- **Expected Behavior:** When the Coordinator agent delegates a sub-task to the Coder, animated connection paths illuminate, showing data handoff and intermediate completion.
- **Inputs/Outputs:** Agent message bus events.
- **Dependencies:** Agent Event Stream.
- **Priority:** `P2`
- **Acceptance Criteria:** Clear timeline of which agent handled which sub-goal; provides complete transparency.
- **Classification:** `[PROPOSED]`

#### `FR-077`: Interactive Agent Role Configuration
- **Purpose:** Customize sub-agent personas, toolsets, and autonomy levels.
- **Expected Behavior:** User can adjust sub-agent parameters, assign specific models to specific roles, and enable/disable individual agents.
- **Inputs/Outputs:** Agent role configuration JSON.
- **Dependencies:** Agent Configuration Store.
- **Priority:** `P2`
- **Acceptance Criteria:** Changes immediately apply to future multi-step planner runs.
- **Classification:** `[PROPOSED]`

#### `FR-078`: Multi-Agent Swarm Collaboration Mode
- **Purpose:** Coordinate parallel execution across multiple agents for large-scale tasks.
- **Expected Behavior:** Allows parallel execution of independent research or coding tasks, joining outputs before final synthesis.
- **Inputs/Outputs:** Parallel task trees.
- **Dependencies:** Parallel Execution Manager.
- **Priority:** `P2`
- **Acceptance Criteria:** Rate limits managed cleanly; joins partial results even if one sub-agent fails.
- **Classification:** `[PROPOSED]`

---

### 6.13 Plugins and Dynamic Skills (FR-079 – FR-084)

#### `FR-079`: Plugin & Skill Architecture Specification
- **Purpose:** Enable modular extension of HELIOXEN capabilities without modifying core code.
- **Expected Behavior:** Plugins structured as self-contained bundles containing manifest (`plugin.json`), typed tools, UI panels (optional), and permission requests.
- **Inputs/Outputs:** Plugin packages / directories; registered tool schemas.
- **Dependencies:** Plugin Loader, Sandbox Engine.
- **Priority:** `P1`
- **Acceptance Criteria:** Plugins load dynamically at startup or runtime; crashes in a plugin do not crash the main application.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-080`: Plugin Manager & Permissions Inspector UI
- **Purpose:** Discover, enable, disable, and configure installed skills and plugins.
- **Expected Behavior:** Dedicated Skills view displaying all installed skills, authors, versions, requested permissions (Network, Filesystem, Clipboard), and toggle switches.
- **Inputs/Outputs:** Skill states.
- **Dependencies:** Skill Registry Component.
- **Priority:** `P1`
- **Acceptance Criteria:** Disabling a skill instantly unregisters its tools from model schemas; displays clear permission badges.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-081`: Isolated Sandbox Execution for Plugins
- **Purpose:** Prevent untrusted plugin code from compromising the host system.
- **Expected Behavior:** Executes plugin JavaScript/TypeScript inside isolated Node.js `worker_threads` or sandboxed VMs with restricted global APIs and explicit capability injection.
- **Inputs/Outputs:** Sandbox IPC channels.
- **Dependencies:** Worker Thread Manager, Capability Gate.
- **Priority:** `P1`
- **Acceptance Criteria:** Plugin code cannot access Node `process`, `child_process`, or arbitrary filesystem paths without declared permissions.
- **Classification:** `[PROPOSED]`
- **Security/Privacy:** Enforces least-privilege containment.

#### `FR-082`: Dynamic AI Skill Builder & Code Generator
- **Purpose:** Allow HELIOXEN to generate new skills on the fly to fulfill novel user requests.
- **Expected Behavior:** When user requests a capability not currently supported ("Create a tool to convert currency via API X"), the skill builder drafts tool code, parameters schema, and tests.
- **Inputs/Outputs:** Natural language requirement; generated plugin bundle.
- **Dependencies:** Code Generation Engine, AST Validator.
- **Priority:** `P2`
- **Acceptance Criteria:** Generated code undergoes strict static analysis (AST parsing for forbidden imports) and unit testing before presenting to user for approval.
- **Classification:** `[PROPOSED]`

#### `FR-083`: User Verification & Staged Approval for Generated Skills
- **Purpose:** Human-in-the-loop validation of AI-created tools.
- **Expected Behavior:** Displays generated code, requested permissions, and test outputs in a review modal with explicit [Approve & Register] or [Reject] controls.
- **Inputs/Outputs:** Verification modal triggers.
- **Dependencies:** Skill Approval UI.
- **Priority:** `P2`
- **Acceptance Criteria:** Dynamic skills NEVER auto-register or execute without explicit user review and approval.
- **Classification:** `[USER-REQUIREMENT]`

#### `FR-084`: Skill Versioning, Rollback, and Diagnostics
- **Purpose:** Safe updates and recovery from faulty plugin versions.
- **Expected Behavior:** Tracks plugin versions; provides one-click rollback if an updated plugin fails; logs plugin execution errors in dedicated diagnostics view.
- **Inputs/Outputs:** Version records, error logs.
- **Dependencies:** Version Manager.
- **Priority:** `P2`
- **Acceptance Criteria:** Faulty plugin quarantined automatically if it encounters repeated fatal exceptions.
- **Classification:** `[PROPOSED]`

---

### 6.14 Integrations and Connected Devices (FR-085 – FR-090)

#### `FR-085`: Spotify & Media Playback Control Integration
- **Purpose:** Control desktop music playback via voice or text.
- **Expected Behavior:** Voice commands like "Play Synthwave on Spotify", "Pause music", "Next track". Connects via Spotify Web API or local media keys.
- **Inputs/Outputs:** Media playback commands.
- **Dependencies:** Media Key Service / Spotify API Adapter.
- **Priority:** `P1`
- **Acceptance Criteria:** Immediate playback response; displays current track info in voice dock or telemetry widget.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-086`: Communication Integrations (WhatsApp, Discord, Slack)
- **Purpose:** Read and send messages via user-authorized chat channels.
- **Expected Behavior:** Allows sending messages ("Send John on WhatsApp: I will be 10 minutes late") via official APIs or desktop automation hooks.
- **Inputs/Outputs:** Message payloads; contact queries.
- **Dependencies:** Messaging Connectors / Webhooks.
- **Priority:** `P2`
- **Acceptance Criteria:** Every outgoing message requires user preview and confirmation; no background message snooping.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-087`: Android Device Bridge (Wireless ADB)
- **Purpose:** Connect to user's Android smartphone for notification mirroring and file transfer.
- **Expected Behavior:** Discovers local Android device via wireless ADB; allows battery status check, file transfer, and sending SMS.
- **Inputs/Outputs:** ADB commands, device status.
- **Dependencies:** ADB Client Module.
- **Priority:** `P2`
- **Acceptance Criteria:** Strict pairing confirmation on device; zero automatic root operations.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-088`: Smart Home & IoT Automation (Home Assistant / Philips Hue)
- **Purpose:** Control smart lights and home devices by voice.
- **Expected Behavior:** Commands like "Turn on office lights", "Set ambient lighting to cyan". Connects to Home Assistant REST API or local Hue bridge.
- **Inputs/Outputs:** Device state JSON.
- **Dependencies:** Smart Home Adapter.
- **Priority:** `P2`
- **Acceptance Criteria:** Discovers local devices; syncs light color with HELIOXEN UI theme if enabled.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-089`: Cloud Productivity Integrations (Google Workspace / Microsoft 365)
- **Purpose:** Read emails, drafts, and cloud documents with user consent.
- **Expected Behavior:** Connects via standard OAuth2 to read recent emails, search Drive, or create draft replies.
- **Inputs/Outputs:** OAuth tokens; email/doc payloads.
- **Dependencies:** Cloud API Services.
- **Priority:** `P2`
- **Acceptance Criteria:** Secure token refresh; tokens stored in OS keychain; clear list of read permissions.
- **Classification:** `[SOURCE-SUPPORTED]`

#### `FR-090`: Remote External Dashboard & Web Companion View
- **Purpose:** Access HELIOXEN status and tasks from a mobile browser on local LAN.
- **Expected Behavior:** Optional local authenticated web server streaming status, chat, and telemetry to a local mobile browser.
- **Inputs/Outputs:** Local HTTP/WebSocket server; mobile web client.
- **Dependencies:** Web Companion Server.
- **Priority:** `P2`
- **Acceptance Criteria:** Disabled by default; requires strong random PIN/token authentication; binds only to local network interface.
- **Classification:** `[PROPOSED]`

---

## 7. NON-FUNCTIONAL REQUIREMENTS

Assigning stable identifiers `NFR-001` through `NFR-025`.

### 7.1 Reliability & Resilience

#### `NFR-001`: Predictable Clean Startup and Shutdown
- The application must initialize all core subsystems (IPC bridge, audio drivers, database connections) in < 1.5 seconds on baseline modern hardware (SSD, Quad-Core CPU, 16GB RAM). Shutdown must release all OS locks, child processes, camera handles, and audio streams within 500ms without zombie processes.

#### `NFR-002`: Graceful Failure Recovery & Provider Degradation
- If external AI APIs, cloud voice services, or network connections fail, the application must remain fully interactive, display clear diagnostic error badges, and allow offline local operations (notes, local search, settings) without crashing or locking the UI thread.

#### `NFR-003`: Database Integrity and Corruption Prevention
- Local SQLite / Vector databases must utilize Write-Ahead Logging (`WAL` mode) and atomic transactions. In the event of an abrupt power loss or application kill, database recovery must execute automatically without data loss.

#### `NFR-004`: Safe Self-Repair and Subsystem Isolation
- Failures within individual modules (e.g., a crashed telemetry widget or faulty plugin) must be isolated to their respective container and must not terminate the main application shell or active voice session.

---

### 7.2 Performance & Resource Management

#### `NFR-005`: Responsive UI Thread Execution
- The primary UI rendering thread must never be blocked by intensive disk I/O, network requests, or cryptographic operations. All heavy workloads must execute in background worker threads or the Node.js main process. UI interactions must register < 16ms response times (maintaining 60fps).

#### `NFR-006`: Controlled Memory Footprint
- Standby baseline memory consumption (RAM) must remain < 250MB for the entire application (Main + Renderer + GPU process). Peak usage during complex multimodal sessions must not exceed 750MB, with prompt garbage collection of image and audio buffers upon task completion.

#### `NFR-007`: CPU and Battery Efficiency
- In idle background state (minimized to tray or inactive), CPU consumption must remain < 0.5%. Orbital visualizer animations must throttle to 1fps or pause completely when the window is occluded or minimized.

#### `NFR-008`: Audio & Streaming Latency Benchmarks
- End-to-end voice latency from speech completion to initial audio response must aim for < 800ms when using cloud live APIs. Streaming text token rendering must achieve > 30 tokens/second without UI stuttering.

---

### 7.3 Security Architecture & Hardening

#### `NFR-009`: Complete Process and Privilege Separation
- Strict adherence to modern Electron security standards: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on all renderer windows. No direct Node.js API access from the frontend; all system interaction routed through strictly typed, validated IPC bridges.

#### `NFR-010`: OS Keychain Native Credential Security
- All sensitive tokens, API keys, and credentials must be stored using the native Windows Credential Manager (`keytar` / DPAPI). Zero plaintext secrets in configuration files, local storage, environment dumps, or application logs.

#### `NFR-011`: Zero Unrestricted Shell Execution
- The application must NEVER expose an unrestricted raw bash/powershell execution tool. All system actions must use parameterized, whitelist-validated commands. Consequential operations (file deletion, process killing) require mandatory explicit modal authorization.

#### `NFR-012`: Web Security & Injection Prevention
- Web security (`webSecurity: true`) must remain permanently enabled. All user and external web content must be sanitized before rendering to eliminate Cross-Site Scripting (XSS). Content Security Policy (`CSP`) headers must strictly restrict script execution sources.

#### `NFR-013`: Comprehensive Forensic Audit Logging
- Every automated system action, tool call, external network transmission, and permission grant must be appended to an immutable, local, structured JSON audit log.

---

### 7.4 Privacy & Data Sovereignty

#### `NFR-014`: Local-First Data Sovereignty
- All user notes, tasks, memory items, conversation history, and configuration files must reside exclusively on the user's local disk. No automated telemetry, analytics, or behavioral tracking data shall be transmitted to external servers without explicit, opt-in consent.

#### `NFR-015`: Transparent Hardware Sensor Privacy
- Microphone and camera hardware must never activate silently. Clear, unambiguous visual banners and status rings must indicate active recording. Hardware resources must be closed immediately upon session end.

#### `NFR-016`: Granular Data Erasure & Right to Forget
- The user must possess one-click capabilities to permanently delete individual memories, wipe entire conversation histories, or factory-reset the entire application database.

---

### 7.5 Usability, Aesthetics, and Accessibility

#### `NFR-017`: High-Contrast Futuristic Visual Aesthetics
- Dark-mode primary palette utilizing deep space blues (`#0a0e17`, `#0f172a`), neon cyan accents (`#00f0ff`, `#38bdf8`), and high-legibility crisp typography (Inter / Outfit / JetBrains Mono) with contrast ratios exceeding WCAG AA standards (> 4.5:1 for body text).

#### `NFR-018`: Comprehensive Keyboard Navigation
- Every primary application action must be fully accessible via keyboard shortcuts (e.g., `Ctrl+K` for command palette, `Ctrl+M` for mic toggle, `Escape` to dismiss/cancel, `Tab` navigation across all controls).

#### `NFR-019`: Configurable Visual Intensity & Reduced Motion
- Provide a user setting to scale visual effects from *Cinematic High* (full 3D globe, orbital particle effects, glowing rings) to *Clean Minimal* (static vector icons, zero particle animations) to respect user preference and system performance. Respect OS `prefers-reduced-motion`.

#### `NFR-020`: Dynamic Window Rescaling & HiDPI Support
- Seamless UI scaling across high-DPI displays (100% to 250% Windows display scaling) without blurry text, misaligned borders, or clipped panels. Responsive resizing down to 1024x640 window dimensions.

---

### 7.6 Maintainability, Modularity, and Extensibility

#### `NFR-021`: Strict Modular Architecture
- Decoupled, single-responsibility architecture separating UI Components, State Stores, IPC Contracts, Provider Adapters, and System Services. No monolithic files or circular dependencies.

#### `NFR-022`: 100% Type Safety
- End-to-end TypeScript enforcement across Main, Preload, and Renderer processes. All IPC messages and tool schemas validated via compile-time types and runtime schema definitions.

#### `NFR-023`: Comprehensive Testability
- Core services (Provider Adapters, Tool Dispatcher, Memory Store, IPC handlers) must be architected with dependency injection to allow automated unit testing without requiring real GUI or live API connections.

#### `NFR-024`: Stable Public Plugin Contracts
- Extension points and tool registry interfaces must maintain versioned semantic contracts to ensure backward compatibility across application updates.

#### `NFR-025`: Clean-Room IP Protection
- The entire codebase must be authored cleanly with explicit licensing headers, zero unlicensed third-party dependencies, and zero code copied from audited reference repositories.

---

## 8. UI/UX REQUIREMENTS & DESIGN DIRECTION

### 8.1 Visual Theme and Atmospheric Direction
The visual identity of HELIOXEN combines:
- **Stonic AI's Architectural Simplicity:** Uncluttered layouts, logical 3-panel division, rapid navigation, and practical toolbars.
- **JARVIS/Holographic Cinematic Atmosphere:** Luminous orbital rings, reactive soundwaves, telemetry readouts, and restrained neon glowing accents.
- **HELIOXEN Original Brand Identity:** Anchored by `Futuristic Helioxen Orbital Logo.png` featuring a stylized cyan/deep-blue orbital "H" with dynamic orbiting particles and a central energy core.

### 8.2 Layout Structure
```
+---------------------------------------------------------------------------------------+
|  [H] HELIOXEN AI    | Status: READY | Model: Gemini 3.8 Flash |  _  [ ]  X            |  <- Custom Titlebar
+---------------------+-----------------------------------------+-----------------------+
|                     |                                         |                       |
|  [CORE]             |        ( * H O L O G R A P H I C * )     |  [ CONVERSATION ]     |
|  [MEMORY]           |        (     O R B I T A L       )     |                       |
|  [SKILLS]           |        (        C O R E          )     |  User: Check system   |
|  [CHARACTER]        |                                         |  status and news      |
|  [TOOLS]            |        Status: LISTENING...             |                       |
|  [MONITOR]          |                                         |  AI: Systems nominal. |
|  [SETTINGS]         |  +-----------------------------------+  |  Global feeds online. |
|                     |  |  > Type command or prompt...  [M] |  |                       |
|                     |  +-----------------------------------+  |  [Execution Trace]    |
|                     |                                         |  - Ping: 18ms         |
|                     |  [Voice Dock: (o) LIVE | Vol: 85% ]     |  - CPU: 12%           |
+---------------------+-----------------------------------------+-----------------------+
|  System: Windows 11 64-bit | RAM: 32GB (28% used) | Network: 1 Gbps | Secure Vault: LOCKED   |  <- Footer Bar
+---------------------------------------------------------------------------------------+
```

### 8.3 Interaction States
1. **Standby / Idle:** AI core emits a slow, rhythmic cyan/blue breathing pulse (0.5 Hz). System status reads `STANDBY`.
2. **Listening:** AI core expands outer orbital rings; a dynamic circular waveform tracks live microphone input volume in real-time. Text reads `LISTENING...`.
3. **Processing / Thinking:** Orbital rings rotate along dual axes at accelerated speed with particle trails radiating toward the center. Text reads `ANALYZING...`.
4. **Speaking:** Central orb pulses in synchrony with speech synthesis frequency bands. Outer rings stabilize in harmonic orbital motion. Text reads `SPEAKING...`.
5. **Awaiting Approval:** Orbital core transitions to warm amber; modal dialog overlays center workspace detailing tool action and requesting permission.
6. **Error / Blocked:** Orbital rings flash crimson red once, transitioning to a steady low-intensity amber warning ring with actionable error description.

---

## 9. SECURITY, PRIVACY, AND PERMISSION BOUNDARIES

### 9.1 Zero-Trust Desktop Boundary
HELIOXEN operates under a Zero-Trust desktop execution model. The AI model is an untrusted planner; it never possesses direct operating-system execution capabilities. All requests must pass through three verification gates:
1. **Schema & Argument Gate:** Validates data types, lengths, path boundaries, and command formats against strict schemas.
2. **Security Classification Gate:** Classifies tool as Safe (automatic execution) vs Sensitive (requires explicit user confirmation).
3. **OS Execution Sandbox:** Runs authorized operations with least privilege, sanitized arguments, and non-elevated user permissions.

### 9.2 Path & File Boundaries
- **Permitted Read/Write Sandbox:** Application data directory (`%APPDATA%/Helioxen/`), user documents, and user-specified workspace folders.
- **Strictly Prohibited Paths:** `C:\Windows\`, `C:\Program Files\`, `C:\ProgramData\`, system registry hives, and user credential directories (`.ssh`, `.aws`, `.gnupg`).

### 9.3 Network Security
- All outgoing API calls enforce TLS 1.3 encryption with strict certificate validation.
- Direct external URL fetching by the assistant enforces Server-Side Request Forgery (`SSRF`) protections, blocking loopback addresses (`127.0.0.1`, `localhost`), link-local addresses (`169.254.169.254`), and private LAN ranges unless explicitly configured.

---

## 10. REQUIREMENTS TRACEABILITY MATRIX

| Objective | Requirement ID | Priority | Key Dependency | Acceptance Criterion | Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Branding & Shell** | `FR-001`, `FR-002` | `P0` | Electron Main, CSS Grid | Custom titlebar, 3-panel layout, no clipping | Phase 2 (Steps 7–11) |
| **AI Visualizer** | `FR-003`, `FR-006` | `P0` | State Machine, Canvas/SVG | 60fps orbital core, 5 visual states | Phase 2 (Step 12) |
| **Command & Chat** | `FR-004`, `FR-005` | `P0` | Markdown Parser, Store | Streaming text, multiline input, code copy | Phase 2 (Steps 11–12) |
| **Security Vault** | `FR-010`, `NFR-010` | `P0` | OS Keychain, SafeStorage | Zero plaintext keys, encrypted vault | Phase 3 (Steps 15–16) |
| **Model Routing** | `FR-009`, `FR-011` | `P0` | Provider Adapters | Multi-provider support, capability checks | Phase 3 (Steps 16–18) |
| **Voice Control** | `FR-015`, `FR-016` | `P0` | Audio Worklet, Realtime API | < 800ms voice latency, instant barge-in | Phase 4 (Steps 19–21) |
| **Multimodal Vision**| `FR-023`, `FR-025` | `P0` | DesktopCapturer, Vision API | User-approved screen capture, image Q&A | Phase 4 (Steps 22–24) |
| **Tool Execution** | `FR-029`, `FR-030` | `P0` | Schema Validator, Modal Gate | Schema validation, explicit approval modal | Phase 5 (Steps 25–27) |
| **Desktop Automation**| `FR-037`, `FR-039` | `P0` | System APIs, Path Sandbox | Telemetry monitoring, scoped safe file ops | Phase 5 (Steps 28–30) |
| **Web Intelligence** | `FR-045`, `FR-046` | `P0` | Search API, Readability | Live web search, content summarization | Phase 6 (Steps 31–33) |
| **Memory & Profile** | `FR-051`, `FR-053` | `P0` | SQLite WAL, Memory View | Persistent facts, one-click memory delete | Phase 6 (Step 34) |
| **Productivity** | `FR-057`, `FR-058` | `P0` | Markdown Editor, Task Store | Local notes workspace, to-do task system | Phase 7 (Step 35) |
| **Visual Hub** | `FR-064`, `FR-066` | `P1` | Mermaid.js, Media Store | Interactive diagrams, media asset gallery | Phase 7 (Steps 36–37) |
| **World Monitor** | `FR-069`, `FR-070` | `P1` | Three.js / WebGL, News RSS | 3D holographic globe, verified news feeds | Phase 7 (Steps 38–39) |
| **Agent Town** | `FR-075`, `FR-076` | `P2` | Canvas Renderer, Agent Bus | Visual multi-agent orchestration states | Phase 8 (Step 40) |
| **Plugins & Skills** | `FR-079`, `FR-081` | `P1` | Worker Threads, Sandbox | Dynamic skill registration, sandbox safety | Phase 8 (Steps 41–42) |
| **Device Bridges** | `FR-085`, `FR-087` | `P2` | Media Keys, ADB Client | Spotify controls, optional Android bridge | Phase 9 (Steps 44–45) |
| **Hardened Testing** | `NFR-001`–`NFR-025`| `P0` | Test Runners, CI Audit | Unit tests, security audit, installer pack | Phase 10 (Steps 46–48) |

---

## 11. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Lead Product Architect | Initial consolidated requirements baseline for Step 1 of 48. Exhaustive feature inventory, non-functional requirements, UI/UX architecture, security boundaries, and traceability matrix established. Clean-room boundary enforced. |
