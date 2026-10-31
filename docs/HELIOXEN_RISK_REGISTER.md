# HELIOXEN AI — Consolidated Project Risk Register

**Document ID:** `HELIOXEN-RR-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 1: Product Definition and Requirements  
**Step:** 3 of 48 (Acceptance Criteria, Threat Model and Project Scope Freeze)  
**Status:** Baseline Risk Register  
**Date:** October 31, 2026  

---

## 1. RISK MANAGEMENT METHODOLOGY

This register tracks operational, architectural, security, licensing, and performance risks across the entire 48-step lifecycle of **HELIOXEN AI**. 

### 1.1 Risk Rating Framework
- **Likelihood:** Low (1), Medium (2), High (3).
- **Impact:** Low (1), Medium (2), High (3), Critical (4).
- **Severity Score:** Calculated as `Likelihood * Impact`:
  - `1 - 2`: Low
  - `3 - 4`: Medium
  - `6`: High
  - `8 - 12`: **CRITICAL**

---

## 2. CONSOLIDATED RISK INVENTORY

| Risk ID | Risk Title & Description | Cause | Likelihood | Impact | Severity Score | Related Req / Step | Preventive Control | Mitigation & Contingency Plan | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RSK-001` | **Excessive Scope / Delivery Delay**<br>Attempting to implement all 90 features simultaneously causing architectural paralysis. | Complex vision combining Stonic, Brahma, and IRIS concepts. | Medium (2) | High (3) | **6 (High)** | `FR-001`–`FR-090`<br>Phase 1 | Scope freeze in [HELIOXEN_SCOPE_AND_RELEASE_BASELINE.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_SCOPE_AND_RELEASE_BASELINE.md). Focus on 38 P0 features for initial release. | Strict milestone gating; defer P1/P2 features until P0 foundation is verified. | Low |
| `RSK-002` | **Licensing Infringement on Brahma / IRIS Assets**<br>Accidental copying of source-available code or proprietary schemas. | High similarity of agent workflows to reference projects. | Low (1) | Critical (4) | **4 (Medium)** | Clean-Room Policy<br>Step 2 | Clean-Room Policy ([HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md)) mandating 100% original code. | Automated license and plagiarism checks; pre-release code provenance audits. | Low |
| `RSK-003` | **API Key & Credential Leakage**<br>Exposure of user provider tokens via local storage, git commits, or debug logs. | Insecure credential handling patterns (as seen in Stonic V2). | Low (1) | Critical (4) | **4 (Medium)** | `FR-010`, `NFR-010`<br>Step 15 | Native OS Keychain integration (`keytar`/DPAPI); zero plaintext in config or logs. | Automated secret scanner in CI (`gitleaks`); instant credential invalidation alert. | Low |
| `RSK-004` | **Prompt Injection Triggering Destructive Actions**<br>Untrusted web pages or documents manipulating the planner to delete files. | Indirect prompt injection embedded in scraped content or attachments. | Medium (2) | Critical (4) | **8 (Critical)** | `FR-030`, `FR-039`<br>Step 25 | Two-tier modal permission gate; prompt context delimiters separating data from directives. | Mandatory explicit user approval modal for all modifying/destructive tool operations. | Low |
| `RSK-005` | **Arbitrary Remote Code Execution (RCE)**<br>Exposing unrestricted shell execution tools to the AI model. | Using generic `child_process.exec` tools (as seen in Stonic V2). | Low (1) | Critical (4) | **4 (Medium)** | `NFR-011`<br>Step 25, 28 | Complete ban on raw shell tools. All desktop actions are strictly typed and whitelisted. | Hardcoded whitelist rejecting arbitrary bash/powershell strings at schema level. | Zero |
| `RSK-006` | **Electron Renderer Compromise**<br>Cross-site scripting (XSS) escaping into Node.js environment. | Permissive Electron configurations (`webSecurity: false`, `nodeIntegration: true`). | Low (1) | Critical (4) | **4 (Medium)** | `NFR-009`, `NFR-012`<br>Step 13 | Strict Electron context isolation, sandboxing, and strict Content Security Policy (CSP). | Automated unit test asserting `window.require` is undefined in renderer. | Low |
| `RSK-007` | **Audio Latency & Buffer Underruns**<br>Voice interaction exceeding 800ms latency or suffering audio stuttering. | Network jitter, unoptimized audio worklets, or heavy LLM time-to-first-token. | Medium (2) | High (3) | **6 (High)** | `FR-015`, `NFR-008`<br>Step 19, 20 | Web Audio worklet buffering; direct WebSocket streaming to low-latency Live APIs. | Dynamic jitter buffer; graceful fallback to text if audio latency spikes > 2s. | Medium |
| `RSK-008` | **GPU Overheating / Lag from 3D Shaders**<br>Orbital AI Core or 3D Globe causing high CPU/GPU load on integrated laptops. | Complex particle shaders running unthrottled in background. | Medium (2) | Medium (2) | **4 (Medium)** | `FR-003`, `NFR-007`<br>Step 12, 38 | Throttling animations to 1fps when window is minimized; reduced-motion 2D vector fallback. | Performance benchmarking gate (`UXAC-001`); auto-downgrade to lightweight SVG mode. | Low |
| `RSK-009` | **Database Corruption from Power Loss**<br>SQLite database damaged during sudden shutdown or power cut. | Interrupted write transactions during memory indexing or note saving. | Low (1) | Critical (4) | **4 (Medium)** | `FR-052`, `NFR-003`<br>Step 34 | SQLite Write-Ahead Logging (`WAL` mode) with synchronous atomic transactions. | Automatic WAL recovery on startup; daily automated database snapshots. | Low |
| `RSK-010` | **Accidental File Deletion / User Data Loss**<br>Automated file organization deleting unintended user documents. | Model misinterpreting relative file paths or ambiguous user prompts. | Medium (2) | High (3) | **6 (High)** | `FR-039`, `FR-040`<br>Step 29 | Recycle Bin staging instead of permanent unlinked deletion; mandatory approval modal. | Staged undo manifest allowing instant one-click restoration of all altered files. | Low |
| `RSK-011` | **External AI Provider Outages & Quotas**<br>Application becoming unusable when cloud provider encounters 5xx or rate limits. | Vendor API downtime, network outages, or exhausted user billing quotas. | High (3) | Medium (2) | **6 (High)** | `FR-009`, `FR-012`<br>Step 18 | Multi-provider architecture supporting Gemini, OpenAI, Anthropic, and local endpoints. | Automatic failover to secondary provider; clear diagnostic status badge in UI. | Low |
| `RSK-012` | **Camera / Screen Privacy Violations**<br>Background capture of confidential user documents or passwords. | Automated multimodal tools running without explicit user consent. | Low (1) | Critical (4) | **4 (Medium)** | `FR-023`, `FR-024`<br>Step 22 | Mandatory session consent modal; visual indicator banners; hardware LED synchronization. | Privacy filter (`FR-028`) masking credit cards and passwords before cloud transmission. | Low |
| `RSK-013` | **Dynamic Skill Sandbox Escape**<br>AI-generated skills executing malicious system code or exfiltrating data. | Inadequate sandbox isolation relying solely on AST syntax checks. | Medium (2) | Critical (4) | **8 (Critical)** | `FR-081`, `FR-082`<br>Step 41, 42 | Node.js `worker_threads` with frozen global prototypes and zero capability injection. | Feature deferred to P2; mandatory human code review modal before skill registration. | Low |
| `RSK-014` | **Simulated / Fake Data Disguised as Live**<br>Displaying mock telemetry or fake news tickers when APIs fail. | Developers stubbing incomplete IPC channels (as observed in IRIS scan). | Low (1) | High (3) | **3 (Medium)** | `FR-037`, `FR-070`<br>Step 28, 38 | Strict anti-simulation policy: all widgets display `OFFLINE / N/A` when live data fails. | Code review audit gate ensuring zero random number generators driving telemetry. | Zero |
| `RSK-015` | **Infinite Loops in Autonomous Agent Planner**<br>Sub-agents repeatedly executing failed tools, consuming user API tokens. | Ambiguous user goals or unexpected tool errors. | Medium (2) | High (3) | **6 (High)** | `FR-031`, `FR-034`<br>Step 26, 27 | Hard execution depth limit (maximum 10 steps); 30-second timeout per tool call. | Prominent global [Stop Task] button; automatic abort after 3 identical tool errors. | Low |
| `RSK-016` | **Windows Installer & Packaging Failures**<br>Desktop application failing to install or launch on target Windows 10/11 machines. | Missing Visual C++ redistributables or architecture mismatch (x64 vs ARM64). | Low (1) | High (3) | **3 (Medium)** | Phase 10<br>Step 48 | Standard Electron-Builder configuration targeting Windows 64-bit with code signing. | Automated installation test on clean Windows sandbox environment in Step 48. | Low |

---

## 3. RISKS REQUIRING USER DECISION PRIOR TO PHASE 2/3

The following strategic decisions are logged for user awareness and confirmation:
1. **Primary AI Cloud Backend:** Recommendation is Google Gemini 3.8 Flash for real-time low-latency voice and multimodal vision, with OpenAI as secondary fallback. *(Decision point: Step 4 / Step 16)*.
2. **Local Model Engine Inclusion:** Recommended to defer local Ollama daemon bundling to P2 (`v0.3.0`) to keep installer size < 120MB. *(Confirmed in Scope Baseline)*.
3. **Dynamic Skill Builder Activation:** Recommended to keep dynamic AI skill generation disabled by default until isolated worker-thread sandboxing passes Step 42 audit. *(Confirmed in Scope Baseline)*.

---

## 4. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Senior Project & Security Risk Architect | Consolidated Project Risk Register established for Step 3 of 48. Detailed 16 critical risks across operational, security, performance, licensing, and reliability domains. Established quantitative severity scoring, preventive controls, mitigation/contingency plans, and residual risk tracking. |
