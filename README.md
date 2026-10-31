# HELIOXEN AI — Desktop Command Layer & Assistant

**Status:** Phase 2: Technical Architecture and Project Foundation (Step 5 of 48: Foundation Setup)  
**Target Environment:** Windows 10/11 Desktop (64-bit)  
**Primary UI/UX Reference:** Stonic AI (Clean 3-panel command layout + orbital AI core)  
**License:** MIT (Original Clean-Room Implementation)  

---

## 1. PROJECT OVERVIEW

**HELIOXEN** is an original, cinematic desktop AI command assistant designed to act as an intelligent operating layer on Windows 10/11. It unites real-time conversational voice interaction, multimodal camera and screen understanding, local desktop automation, persistent long-term memory, and task-oriented agent orchestration.

The interface prioritizes **calm visual simplicity** inspired by Stonic AI, complemented by a cinematic orbital visualizer reflecting the official HELIOXEN brand identity (neon cyan and deep orbital blue).

---

## 2. CURRENT DEVELOPMENT STATUS

The project has completed **Phase 1 (Product Definition & Requirements)** and is establishing **Phase 2 (Technical Foundation)**:
- **Step 1:** Consolidated Requirements & Feature Prioritization (`FR-001` to `FR-090`, `NFR-001` to `NFR-025`) — `PASS`
- **Step 2:** Reference Analysis, Clean-Room Policy & License Review — `PASS`
- **Step 3:** Acceptance Criteria Framework & Security Threat Model — `PASS`
- **Step 4:** Technology Stack Selection & Architecture Blueprint (`ADR-001` to `ADR-020`) — `PASS`
- **Step 5 (Current):** Repository Initialization, Development Environment & Configuration.

> [!NOTE]
> The current application shell is a **minimal development bootstrap** confirming that the Electron, React, TypeScript, and Vite pipelines operate securely. The full Stonic-inspired 3-panel dashboard, custom titlebar, and Three.js Central AI Core will be implemented in subsequent roadmap steps (Steps 7–12).

---

## 3. CORE TECHNOLOGY STACK

- **Desktop Runtime:** Electron (v33+ LTS) on Node.js (v20+ / v22+ LTS).
- **Build Tooling:** `electron-vite` with `vite`.
- **Frontend Framework:** React with strict TypeScript.
- **Styling:** Tailwind CSS with dynamic CSS design tokens.
- **Security Baseline:** Renderer context isolation (`contextIsolation: true`), disabled Node integration (`nodeIntegration: false`), Chromium sandboxing (`sandbox: true`), and strict Content Security Policy (CSP).
- **Credentials:** Windows Data Protection API (DPAPI via `safeStorage`).
- **Local Database:** `better-sqlite3` with Write-Ahead Logging (`WAL` mode).

---

## 4. HOW TO RUN & DEVELOPMENT WORKFLOW

### Prerequisites
- **Node.js:** v20.x, v22.x, or v26.x LTS (64-bit).
- **Package Manager:** npm (v10+ or v11+).
- **Operating System:** Windows 10 or 11 (64-bit).

---

### Option A: One-Click Quick Launch (`run.bat`) — Recommended for Windows

The easiest way to start HELIOXEN AI is using the bundled **`run.bat`** launcher:

1. **Double-click `run.bat`** in the project folder (or execute `.\run.bat` in PowerShell / Command Prompt).
2. The launcher will automatically:
   - Verify Node.js and npm are installed in your PATH.
   - Automatically run `npm install` if `node_modules` is missing.
   - Launch the Vite development server and open the Electron desktop application window.
3. To stop the application, press `Ctrl+C` in the launcher console window.

---

### Option B: Manual Command-Line Workflow

If you prefer using the terminal (Command Prompt, PowerShell, or Windows Terminal):

1. **Install Dependencies:**
   ```powershell
   npm install
   ```
   *(Note for PowerShell users: if you experience an execution policy error with `npm`, run `npm.cmd install`)*

2. **Launch Development Application:**
   ```powershell
   npm run dev
   ```
   *(Or `npm.cmd run dev`)*
   This starts the Vite HMR server and launches the Electron desktop window.

3. **Verify Type Checking:**
   ```powershell
   npm run typecheck
   ```
   Validates type safety across Node processes (main/preload) and browser process (renderer).

4. **Production Build:**
   ```powershell
   npm run build
   ```
   Compiles and packages production bundles into the `out/` directory.

---

### What to Expect on First Launch
When launched, HELIOXEN AI opens a secure desktop window displaying the **Step 5 Development Bootstrap Status Screen**:
- Confirms Electron v33+, React 18, and Vite 5 runtime operational status.
- Validates that Electron security settings (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP) are active.
- Confirms the environment is ready for subsequent roadmap implementation steps (custom titlebar, Stonic-style 3-panel layout, and 3D Central AI Core).

---

### Troubleshooting Common Issues
- **PowerShell Script Policy Error (`npm.ps1 cannot be loaded`):**
  Use `run.bat` or run `npm.cmd run dev` instead of `npm run dev`.
- **Port Conflict (Vite Dev Server):**
  If port 5173 is in use, Vite will automatically switch to the next available port (e.g. 5174).
- **Node.js Not Found:**
  Ensure Node.js is installed and the box "Add to PATH" was selected during Node.js setup. Restart your terminal after installing.

---

## 5. REPOSITORY ARCHITECTURE

```
HELIOXEN/
├── docs/
│   ├── development/
│   │   ├── DEVELOPMENT_ENVIRONMENT.md
│   │   └── FOUNDATION_DECISIONS.md
│   ├── HELIOXEN_PRODUCT_REQUIREMENTS.md
│   ├── HELIOXEN_FEATURE_PRIORITIZATION.md
│   ├── HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md
│   ├── HELIOXEN_ACCEPTANCE_CRITERIA.md
│   ├── HELIOXEN_THREAT_MODEL.md
│   ├── HELIOXEN_TECH_STACK_DECISION.md
│   └── HELIOXEN_SYSTEM_ARCHITECTURE.md
├── src/
│   ├── main/          # Privileged Electron main process
│   ├── preload/       # Strictly typed, sandboxed contextBridge
│   └── renderer/      # React 18/19 UI and rendering pipeline
├── electron.vite.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
├── LICENSE
├── run.bat            # One-click Windows development launcher
└── README.md
```

---

## 6. CLEAN-ROOM & SECURITY COMPLIANCE

HELIOXEN adheres to strict clean-room engineering policies:
- **100% Original Code:** Zero source code, schemas, or non-free assets are copied from reference projects (Stonic, Brahma, IRIS).
- **Zero Plaintext Secrets:** API keys are never stored in plaintext configuration files or Git commits.
- **Zero Raw Shell Tools:** Raw unrestricted bash/powershell tools are permanently banned.

For detailed architecture and security specifications, refer to the documentation in [`docs/`](./docs).
