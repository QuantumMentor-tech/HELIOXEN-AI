# HELIOXEN AI — Data Architecture and Security Boundaries Specification

**Document ID:** `HELIOXEN-DSB-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 2: Technical Architecture and Project Foundation  
**Step:** 4 of 48 (Technology Stack Selection and Architecture Decisions)  
**Status:** Approved Security Architecture Baseline  
**Date:** October 31, 2026  
**Target Environment:** Windows 10/11 Desktop (64-bit)  

---

## 1. PURPOSE AND DEFENSIVE ARCHITECTURE

This document establishes the **formal data classification, boundary enforcement, and operational security architecture** for HELIOXEN AI.

By defining explicit barriers between untrusted web content, the sandboxed Chromium UI, the privileged Node.js main process, and external cloud AI services, HELIOXEN ensures that:
1. No user credentials, personal memories, or files are exposed to unauthorized access.
2. The AI model cannot execute destructive host operations without explicit human consent.
3. Memory and note data remain completely local-first and under total user sovereignty.

---

## 2. DATA CATEGORIES AND OWNERSHIP CLASSIFICATION

| Data Category ID | Data Category Name | Storage Mechanism | Process Ownership | Sensitivity Tier | External Transmission Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DAT-001` | **Provider API Keys & Tokens** | Encrypted Windows DPAPI (`safeStorage`) | Main Process Only | **TIER 1 (CRITICAL)** | Injected into outbound HTTPS/WSS headers only; never transmitted in chat. |
| `DAT-002` | **Long-Term Memory & Facts** | Local SQLite Database (`WAL` mode) | Main Process (MemoryService) | **TIER 2 (HIGH)** | Relevant snippets injected into prompt context; zero background sync. |
| `DAT-003` | **Conversation Transcript History**| Local SQLite Database (`WAL` mode) | Main Process (ChatStore) | **TIER 2 (HIGH)** | Active multi-turn messages sent to AI model; never sent to third parties. |
| `DAT-004` | **Local Notes & Task Records** | Plaintext Markdown & SQLite DB | Main Process (Productivity) | **TIER 2 (HIGH)** | 100% Local. Injected into context only when user asks about notes/tasks. |
| `DAT-005` | **Real-Time Audio Streams (Mic)**| RAM Buffer / AudioWorklet | Renderer -> Main -> Cloud | **TIER 2 (HIGH)** | Streamed directly to user-authorized voice API session; zero disk caching. |
| `DAT-006` | **Screen & Camera Captures** | Temporary RAM Buffer | Main Process (VisionService) | **TIER 2 (HIGH)** | User-confirmed frames sent to vision API; purged from RAM on completion. |
| `DAT-007` | **Tool Execution Audit Logs** | Local Append-Only JSON File | Main Process (AuditLogger) | **TIER 3 (INTERNAL)** | 100% Local. Retained for user forensics; auto-scrubbed of secret tokens. |
| `DAT-008` | **Application UI & Layout State**| Zustand Local UI Store | Renderer Process | **TIER 4 (PUBLIC)** | Non-sensitive transient view states; never transmitted. |

---

## 3. PROCESS PRIVILEGE AND TRUST BOUNDARIES

```
+---------------------------------------------------------------------------------------+
|  ZONE 1: UNTRUSTED RENDERER (Chromium Sandbox)                                        |
|  - Capabilities: DOM rendering, Three.js canvas, audio playback, user event capture. |
|  - Restrictions: nodeIntegration: false, contextIsolation: true, sandbox: true.       |
|  - Strict CSP: script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'. |
+---------------------------------------------------------------------------------------+
                                           |
                                [ PRELOAD GATEWAY ]
                                           v
+---------------------------------------------------------------------------------------+
|  ZONE 2: PRIVILEGED MAIN PROCESS (Node.js Environment)                                |
|  - Capabilities: OS APIs, DPAPI safeStorage, SQLite DB, child processes, audio bridge.|
|  - Restrictions: Two-tier permission gate intercepts all modifying tool calls.        |
+---------------------------------------------------------------------------------------+
        |                                                                  |
        v                                                                  v
+-----------------------------------+             +-------------------------------------+
|  ZONE 3: OS FILESYSTEM SANDBOX    |             |  ZONE 4: EXTERNAL PROVIDER CHANNELS |
|  - Allowed: %APPDATA%/Helioxen,   |             |  - Protocol: TLS 1.3 / WSS          |
|    User Documents, Downloads.     |             |  - Targets: Gemini Live, OpenAI     |
|  - Blocked: C:\Windows, Program   |             |  - Data: Scrubbed text & PCM audio  |
|    Files, .ssh, System Registry.  |             |  - Keys: Injected in memory only    |
+-----------------------------------+             +-------------------------------------+
```

---

## 4. IPC CONTRACT AUTHORIZATION RULES

All communication across the Preload boundary enforces 5 non-negotiable security rules:
1. **No Raw Event Emitters:** Neither `ipcRenderer.send` nor `ipcRenderer.invoke` is exposed on `window`. Only discrete, typed methods (e.g., `window.helioxen.vault.saveKey()`) are published via `contextBridge`.
2. **Sender Frame Verification:** The Main process verifies `event.senderFrame` to ensure IPC messages originate strictly from the authorized local application URL (`file://` or `http://localhost:5173`), rejecting any unauthorized external origins.
3. **Runtime Schema Validation:** All payloads received across IPC are validated using Zod schemas. Invalid structures are rejected with structured error codes.
4. **Structured Error Normalization:** Internal Node.js stack traces or sensitive file paths are never passed back across IPC to the renderer. Errors map to uniform safe codes (e.g., `ERR_AUTH_FAILED`, `ERR_PATH_RESTRICTED`).
5. **No Synchronous IPC:** All IPC calls must be asynchronous (`invoke`/`handle`) to prevent renderer thread lockups.

---

## 5. HARDWARE SENSOR & CAPTURE BOUNDARIES

### 5.1 Microphone & Audio Privacy
- **No Background Listening without UI Indicator:** The microphone hardware stream is never active without an illuminated green/cyan indicator in the Persistent Voice Dock and system tray.
- **Immediate Disconnect:** Clicking Mute or Disconnect instantly terminates the `AudioWorkletNode` and closes the hardware stream handle.
- **Local Wake-Word Processing:** When wake-word detection is enabled (`FR-019`, P1), audio is processed strictly by a local ONNX model in memory. Zero audio packets are transmitted to external networks prior to the wake trigger.

### 5.2 Screen & Camera Privacy
- **Explicit Modal Consent:** Screen and camera capture can never be initiated by a background agent autonomously. Every capture requires explicit user initiation.
- **Visual Bounding:** Active screen capture renders a visible high-contrast border around the captured display or window.
- **Privacy Masking (`FR-028`):** Captured frames pass through an automated pre-flight regex scanner that flags visible credit card numbers, passwords, and API key patterns, alerting the user before cloud transmission.

---

## 6. TOOL EXECUTION PERMISSION ARCHITECTURE

```
AI Model Generates Tool Call: "delete_file" (path: "C:/Docs/old_draft.txt")
                          |
                          v
         [ Schema & Argument Validation Gate ]
         - Validates path format, checks for traversal (../)
                          |
                          v
         [ Security Classification Gate ]
         - Classified as DESTRUCTIVE
                          |
                          v
         [ Human-in-the-Loop Confirmation Modal ]
         - Renders modal showing exact path and action
                          |
             +------------+------------+
             |                         |
       User Clicks [DENY]        User Clicks [APPROVE]
             |                         |
             v                         v
     Cancel Execution           Execute Operation via
     Return Rejection to Model  Windows Recycle Bin + Log Undo
```

### 6.1 Two-Tier Execution Classification
- **Tier 1 (Safe / Automatic):** Read-only operations that do not alter state: `web_search`, `read_note`, `get_system_time`, `get_cpu_usage`, `list_directory`.
- **Tier 2 (Modifying / Destructive - Requires Modal Approval):** Operations that alter the host system: `delete_file`, `write_file_outside_sandbox`, `launch_unverified_binary`, `kill_process`, `send_external_message`.

---

## 7. BROWSER AUTOMATION & NETWORK SSRF GUARDS

1. **Isolated Browser Profiles:** Headless Playwright instances run inside separate, isolated temporary profiles that have zero access to the user's primary Edge/Chrome browser cookies, logins, or history.
2. **SSRF Blocking Policy:** Headless browser navigation and HTTP content fetchers strictly block access to private network IP ranges:
   - `127.0.0.0/8` (Localhost loopback)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private RFC 1918 subnets)
   - `169.254.0.0/16` (Link-local metadata services)
3. **Executable Download Prevention:** Automatic downloading of files with executable extensions (`.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.msi`) is permanently blocked.

---

## 8. EXTENSION & DYNAMIC SKILL ISOLATION

1. **Worker Thread Containment:** Third-party plugins and AI-generated skills execute inside isolated Node.js `worker_threads` with frozen global prototypes.
2. **Capability Injection:** Sandboxed threads do not possess global `process` or `child_process`. They interact with the core engine solely through injected, permission-gated capability handles.
3. **Mandatory Human Code Review:** Any dynamic skill generated by HELIOXEN must display an AST analysis, permission requests, and test outputs in an interactive review modal before being registered into the tool registry.

---

## 9. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Desktop Security Architect | Formally established Data Architecture and Security Boundaries Specification for Step 4 of 48. Detailed 8 data sensitivity tiers, process privilege isolation, IPC authorization rules, sensor privacy gates, two-tier tool execution classification, and SSRF network defenses. |
