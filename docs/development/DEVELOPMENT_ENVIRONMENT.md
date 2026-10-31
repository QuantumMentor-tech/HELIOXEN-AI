# HELIOXEN AI — Development Environment Setup & Toolchain Guide

**Document ID:** `HELIOXEN-DEV-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 2: Technical Architecture and Project Foundation  
**Step:** 5 of 48 (Repository Initialization, Development Environment and Configuration)  
**Status:** Approved Developer Workflow Guide  
**Date:** October 31, 2026  
**Target Environment:** Windows 10/11 Desktop (64-bit)  

---

## 1. PURPOSE AND SYSTEM REQUIREMENTS

This guide provides the definitive instructions for setting up, configuring, and verifying the local development environment for **HELIOXEN AI**. 

### 1.1 Minimum System Specifications
- **Operating System:** Windows 10 (64-bit, version 19041+) or Windows 11 (64-bit).
- **Node.js:** v20.x or v22.x LTS (compatible with modern Node.js 64-bit).
- **Package Manager:** npm v10+ or v11+ (distributed with Node.js).
- **Git:** Git for Windows (v2.40+).
- **Memory (RAM):** 8GB minimum (16GB recommended for simultaneous 3D shader and test runs).
- **Storage:** At least 2GB of free disk space for `node_modules` and Electron binaries.

---

## 2. REPRODUCIBLE SETUP WORKFLOW

### Step 2.1: Clone & Navigate
Ensure the repository is located in a directory without spaces or special characters if possible:
```powershell
cd "d:\App Winrar Files\Helioxen Ai Assistant (working)"
```

### Step 2.2: Dependency Installation
Install dependencies using the authoritative lockfile:
```powershell
npm.cmd install
```
> [!NOTE]
> On Windows PowerShell where script execution policies restrict `.ps1` execution, use `npm.cmd` instead of `npm`.

### Step 2.3: Environment Configuration
Copy the development environment template:
```powershell
Copy-Item .env.example .env
```
*Note:* Do not put real API keys in `.env`. HELIOXEN uses the native Windows Credential Manager (`safeStorage`) for all provider secrets.

---

## 3. AVAILABLE DEVELOPER SCRIPTS

The following standardized scripts are configured in `package.json`:

| Script Command | Purpose & Underlying Tool | Expected Output |
| :--- | :--- | :--- |
| `npm.cmd run dev` | Starts Electron in development mode with Hot Module Replacement via `electron-vite dev`. | Opens the development window with instant live reload on file edit. |
| `npm.cmd run build` | Compiles and bundles production code for Main, Preload, and Renderer via `electron-vite build`. | Outputs bundled artifacts to `out/main/`, `out/preload/`, and `out/renderer/`. |
| `npm.cmd run preview` | Runs the compiled production bundles locally via `electron-vite preview`. | Launches the application from production bundles without Vite dev server. |
| `npm.cmd run typecheck:node` | Runs TypeScript compiler checks on Main process, Preload, and build configs. | Zero type errors on `tsconfig.node.json`. |
| `npm.cmd run typecheck:web` | Runs TypeScript compiler checks on React renderer components. | Zero type errors on `tsconfig.web.json`. |
| `npm.cmd run typecheck` | Executes both Node and Web TypeScript checks sequentially. | Complete compile-time type validation across the entire repository. |

---

## 4. ARCHITECTURAL PROCESS SEPARATION

```
src/
├── main/       -> Targets Node.js (Electron Main Process)
│   └── index.ts
├── preload/    -> Targets Isolated Preload (ContextBridge)
│   └── index.ts
└── renderer/   -> Targets Chromium DOM (React 18/19 Application)
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── index.css
```

- **Main Process:** Handles window lifecycle, native DPAPI credential vault, file operations, and IPC dispatchers.
- **Preload Bridge:** Strictly exposes typed functions onto `window.helioxen` via `contextBridge.exposeInMainWorld`. No raw `ipcRenderer` or Node internals are exposed.
- **Renderer Process:** Sandboxed React application. `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.

---

## 5. SECRET-HANDLING RULES FOR DEVELOPERS

1. **Zero Plaintext Secrets:** Never commit `.env`, API keys, or private tokens to Git.
2. **DPAPI Credential Storage:** In production, credentials entered via Settings are encrypted by Windows DPAPI via Electron's native `safeStorage` API.
3. **Automated Secret Scanning:** Automated CI scripts (`gitleaks`) reject commits containing patterns matching OpenAI, Google Gemini, or Anthropic API keys.

---

## 6. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Senior Build & Tooling Engineer | Initial Development Environment Guide created for Step 5 of 48. Details toolchain prerequisites, reproducible installation, available scripts, process boundaries, and secret-handling rules. |
