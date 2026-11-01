# HELIOXEN AI — Desktop Command Center & Voice Assistant

**Status:** Phase 7: Voice Input and Audio Interaction (Step 20 of 48: Real-Time Voice Sessions & Interruption)  
**Operating System Target:** Windows 10 / Windows 11 (64-bit)  
**Architecture:** Electron 32 + React 18 + TypeScript + Three.js + Web Audio + Windows DPAPI  
**License:** MIT  

---

## 1. PROJECT OVERVIEW

**HELIOXEN AI** is an intelligent, cinematic desktop AI command assistant designed as a unified operating layer for Windows. It integrates:
- **Stonic-Inspired 3-Panel Workspace:** Clean, distraction-free command center with navigation rail, central core workspace, and collapsible contextual panel.
- **Cinematic 3D Central AI Core:** Interactive Three.js particle and orbital visualizer that reacts in real-time to AI cognitive states (`idle`, `listening`, `thinking`, `speaking`, `error`).
- **Real-Time Voice Sessions:** Explicit, privacy-preserving voice interaction pipeline featuring 16 kHz Mono PCM audio buffering, live provisional transcripts, dynamic 8-segment VU meters, and offline speech synthesis.
- **Instantaneous User Interruption (<10ms):** Immediate cancellation of streaming generation and audio playback via keyboard (`Escape`) or the persistent voice dock.
- **Hardware-Encrypted Credential Vault:** Secure local storage for Google Gemini and OpenAI API keys powered by Windows Data Protection API (DPAPI via `safeStorage`).
- **Deterministic Model Router:** Intelligent task-based model selection, circuit-breaker health monitoring, and capability verification.

---

## 2. PREREQUISITES — WHAT YOU NEED TO DOWNLOAD

Before running HELIOXEN AI, ensure you have the following software installed:

### Required Software:
1. **Node.js (LTS Version 20.x, 22.x, or 24.x):**
   - **Download:** [https://nodejs.org/](https://nodejs.org/)
   - **Installation Note:** Download the **LTS (Recommended for Most Users)** 64-bit Windows installer (`.msi`). During installation, ensure the box **"Add to PATH"** is checked.
   - **Verification:** Open PowerShell or Command Prompt and run:
     ```cmd
     node -v
     npm -v
     ```
     You should see versions like `v20.x.x` (or newer) and `10.x.x` (or newer).

### Recommended / Optional Components:
2. **Git for Windows (Optional):**
   - **Download:** [https://git-scm.com/](https://git-scm.com/)
   - Useful for version control and pulling repository updates.
3. **Microphone (Optional, for Voice Sessions):**
   - Any standard USB microphone, Bluetooth headset, or laptop built-in microphone for real-time voice capture and audio VU metering.
4. **Speakers or Headphones:**
   - For offline local speech synthesis playback.
5. **AI Provider API Key (Optional, for Live Online Reasoning):**
   - **Google Gemini API Key:** Free tier available at [Google AI Studio](https://aistudio.google.com/).
   - **OpenAI API Key:** Available at [OpenAI Platform](https://platform.openai.com/api-keys).
   - *(Note: You do not need to configure keys in files or environment variables; you can paste them directly into the in-app Settings UI, where they are encrypted with Windows DPAPI).*

---

## 3. HOW TO RUN

### Method 1: One-Click Quick Launch (`run.bat`) — Recommended

The easiest way to start the application on Windows:

1. Navigate to the project root folder:
   ```
   d:\App Winrar Files\Helioxen Ai Assistant (working)\
   ```
2. **Double-click `run.bat`** (or open Command Prompt and execute `run.bat`).
3. The launcher will automatically:
   - Confirm Node.js and npm are installed in your PATH.
   - Check for `node_modules` and automatically run `npm install` if launching for the first time.
   - Present a quick menu and **automatically launch development mode in 5 seconds** (or press `1` immediately).
4. The desktop Electron window with the glowing orbital AI core will open automatically.
5. To stop the application, close the desktop window or press `Ctrl+C` in the launcher console.

---

### Method 2: Manual Terminal Workflow (PowerShell / Command Prompt)

If you prefer using your terminal:

1. **Open your terminal in the project directory:**
   ```powershell
   cd "d:\App Winrar Files\Helioxen Ai Assistant (working)"
   ```

2. **Install Project Dependencies (First Time Only):**
   ```powershell
   npm.cmd install
   ```
   *(Note: On Windows PowerShell, use `npm.cmd` to bypass any PowerShell execution policy restrictions).*

3. **Launch in Development Mode (with Hot-Module Reloading):**
   ```powershell
   npm.cmd run dev
   ```
   This will spin up the Vite development server and open the Electron desktop app.

4. **Run the Automated Test Suite (133 Tests Across 23 Suites):**
   ```powershell
   npm.cmd test
   ```

5. **Run TypeScript Typechecks:**
   ```powershell
   npm.cmd run typecheck:node
   npm.cmd run typecheck:web
   ```

6. **Compile Production Distribution Bundles:**
   ```powershell
   npm.cmd run build
   ```

---

## 4. APPLICATION INTERACTION GUIDE

Once the HELIOXEN window opens:

### 1. Navigation (Left Rail)
- **AI Core (`Alt+1`):** Return to the main command center with the central 3D orbital visualizer and conversation panel.
- **Workspace (`Alt+2`):** Project files, command execution, and task automation.
- **Settings (`Alt+3`):** Configure your Google Gemini or OpenAI API keys, select active models, and configure task-based model routing.
- **Diagnostics (`Alt+4`):** Check provider health, latency, circuit-breaker states, and hardware permissions.

### 2. Interactive Voice Dock (Bottom Bar)
- **"Voice Session" Button:** Starts a real-time conversational voice session. Speaks and listens interactively.
- **"Interrupt (Esc)" Button:** While the assistant is listening, thinking, or speaking, clicking this button or pressing the **`Escape`** key instantly stops playback, cancels in-flight AI generation, and tags the turn as interrupted (<10ms latency).
- **Dynamic 8-Segment Audio VU Meter:** Displays real-time audio energy captured from your microphone.
- **Hardware Device Dropdown:** Click the microphone selector to switch between available input devices.
- **Raw Mic Capture Toggle:** Tests microphone hardware stream isolation.
- **Test Speech Button:** Tests local speech synthesis output.

### 3. Setting Up Your AI API Keys (Optional)
1. Click the **Settings** icon on the left rail.
2. Under **AI Providers & API Credentials**, paste your **Google Gemini** or **OpenAI** API key.
3. Click **"Save API Key"**. The key is immediately encrypted using Windows DPAPI and stored locally.
4. Return to the Command Center and start chatting!

---

## 5. TROUBLESHOOTING COMMON ISSUES

- **Issue: `node` is not recognized as an internal or external command:**
  - **Fix:** Install Node.js from [nodejs.org](https://nodejs.org/) and make sure the checkbox "Add to PATH" is checked during setup. Close and reopen your terminal or launcher.
- **Issue: PowerShell execution policy error (`npm.ps1 cannot be loaded because running scripts is disabled`):**
  - **Fix:** Always use `npm.cmd` instead of `npm`, or run `run.bat` directly.
- **Issue: Microphone Permission Denied:**
  - **Fix:** Open Windows Settings ➔ Privacy & Security ➔ Microphone ➔ Ensure "Let desktop apps access your microphone" is set to **On**.
- **Issue: Port 5173 is already in use:**
  - **Fix:** Vite automatically detects busy ports and will fall back to port 5174 or 5175 without failing.

---

## 6. PROJECT REPOSITORY STRUCTURE

```
HELIOXEN/
├── src/
│   ├── main/                 # Electron main process (DPAPI vault, model router, IPC)
│   ├── preload/              # Secure contextBridge preload scripts and typed API
│   ├── renderer/             # React 18 UI components, Three.js AI Core, Voice Dock
│   └── shared/               # Shared TypeScript types, Zod contracts, and schemas
├── docs/                     # Complete architecture specifications & ADRs
├── tests/                    # 133 automated unit and integration tests (Vitest)
├── run.bat                   # One-click Windows desktop application launcher
└── package.json              # Project dependencies and script definitions
```
