# HELIOXEN AI — Process Boundaries, Preload Bridge, and Renderer Isolation

**Document Version:** 1.0.0  
**Phase:** Phase 5 — Secure Desktop Runtime and Process Architecture  
**Step:** 13 of 48  
**Status:** Approved & Enforced  
**Date:** November 2026  

---

## 1. Process Architecture & 3-Ring Execution Model

In accordance with `ADR-006` and the HELIOXEN Threat Model, HELIOXEN strictly enforces a **3-Ring Process Separation Model** inside the Electron runtime:

```
┌─────────────────────────────────────────────────────────────────┐
│ RING 0: PRIVILEGED ELECTRON MAIN PROCESS (Node.js + Chromium)   │
│ - Window Lifecycle, Native Sizing, CSP, Single-Instance Lock    │
│ - IPC Registration, Sender Validation, Frame Origin Check       │
│ - Direct OS Access Strictly Confined to Trusted Modules         │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                 Strict ContextBridge IPC Boundary
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│ RING 1: FROZEN PRELOAD BRIDGE (Isolated Context)                │
│ - contextBridge.exposeInMainWorld('helioxen', frozenApi)        │
│ - Narrow, Explicit Capabilities Only; Zero Raw ipcRenderer      │
│ - Strict Type Definitions (src/preload/types.ts)                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                   Isolated DOM / JS Context
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│ RING 2: UNPRIVILEGED RENDERER PROCESS (Sandboxed Chromium)      │
│ - React 18, Three.js WebGL, TailwindCSS Design System           │
│ - nodeIntegration: false, contextIsolation: true, sandbox: true │
│ - Zero Node.js APIs (require, process, fs, child_process)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Process Boundary Reference Table

| Layer | Actual Responsibilities | Permitted Capabilities | Explicitly Prohibited Capabilities | Verification Method |
|---|---|---|---|---|
| **Ring 0: Main Process** (`src/main/index.ts`) | Lifecycle management, window creation, single-instance gating, native window control handling, CSP header enforcement, navigation security | Native OS windowing, session request interception, registering named IPC handlers | UI DOM manipulation, direct client audio rendering, unvalidated shell URL execution | Static code audit, TypeScript node checks, sender frame validation |
| **Ring 1: Preload Bridge** (`src/preload/index.ts`) | Mediation between renderer and main process; exposing frozen API surface; managing typed listener subscriptions | Exposing frozen `window.helioxen` object with named helper methods (`minimize`, `maximize`, `close`, `isMaximized`, `onMaximizedChange`) | Exposing raw `ipcRenderer`, arbitrary channel dispatch, shell command execution, filesystem access | Runtime `contextBridge` inspection, object mutability check (`Object.isFrozen`) |
| **Ring 2: Renderer Process** (`src/renderer/`) | Presentation layer, React component tree, Command Center three-panel workspace, Three.js WebGL AI core | DOM rendering, WebGL canvas shaders, CSS animations, consuming `window.helioxen` methods | Direct Node.js integration, `require()`, importing `electron`, filesystem reads/writes, privileged shell access | Build bundle analysis, zero-node import grep checks, sandbox enforcement |

---

## 3. Exposed Capability Inventory

| Capability | Actual API / Channel | Consumer | Main-Process Operation | Security Checks | Current Status |
|---|---|---|---|---|---|
| **Window Minimize** | `window.helioxen.window.minimize()` / `'window:minimize'` | `Titlebar.tsx` | Calls `mainWindow.minimize()` | `isValidSender`: Validates sender ID and top-level frame (`!event.senderFrame.parent`) | **ACTIVE** |
| **Window Maximize** | `window.helioxen.window.maximize()` / `'window:maximize'` | `Titlebar.tsx` | Toggles `mainWindow.maximize()` or `unmaximize()` | `isValidSender`: Rejects if sender window destroyed or frame spoofed | **ACTIVE** |
| **Window Close** | `window.helioxen.window.close()` / `'window:close'` | `Titlebar.tsx` | Calls `mainWindow.close()` | `isValidSender`: Rejects non-window senders | **ACTIVE** |
| **Query Maximize State** | `window.helioxen.window.isMaximized()` / `'window:isMaximized'` | `Titlebar.tsx` | Returns `mainWindow.isMaximized()` boolean | `isValidSender`: Returns `false` on invalid sender | **ACTIVE** |
| **Maximize State Events** | `window.helioxen.window.onMaximizedChange(callback)` / `'window:maximized-change'` | `Titlebar.tsx` | `mainWindow.webContents.send('window:maximized-change', isMaximized)` | Clean subscription removal handle returned to caller | **ACTIVE** |
| **Platform Info** | `window.helioxen.platform` | System badges | Returns static string (`process.platform`) | Frozen scalar; no dynamic execution | **ACTIVE** |
| **Environment Info**| `window.helioxen.environment` | Diagnostic badges | Returns static string (`'development'` or `'production'`) | Frozen scalar | **ACTIVE** |
| **Version Info** | `window.helioxen.version` | Diagnostic header | Returns static semver string (`'0.1.0-alpha.1'`) | Frozen scalar | **ACTIVE** |

---

## 4. BrowserWindow Security Configuration

The primary desktop window is initialized with the following verified security options in `src/main/index.ts`:

```typescript
mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 640,
  show: false,
  frame: false,
  autoHideMenuBar: true,
  backgroundColor: '#070a10',
  icon: join(__dirname, '../../resources/icon.png'),
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,              // Enforces separate JavaScript execution context
    nodeIntegration: false,             // Strictly disables Node.js in renderer
    sandbox: true,                      // Enables Chromium OS sandbox for renderer
    webSecurity: true,                  // Enforces same-origin policy
    allowRunningInsecureContent: false  // Blocks mixed content loading
  }
})
```

---

## 5. Defense-in-Depth Security Controls

### 5.1 Content Security Policy (CSP)
Enforced at two independent layers:
1. **HTTP/File Response Headers:** Intercepted via `session.defaultSession.webRequest.onHeadersReceived`:
   ```
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*;
   ```
2. **HTML Document Meta Tag:** Declared in `src/renderer/index.html`.

### 5.2 Navigation & External URL Protection
- **Window Open Handler:** Blocks child window and popup creation (`{ action: 'deny' }`). Validates external URLs using `isSafeExternalUrl(url)`: only `http:` and `https:` protocols are permitted to be dispatched to `shell.openExternal`. Dangerous protocols (`file:`, `javascript:`, `data:`, `smb:`) are rejected.
- **In-App Navigation Handler (`will-navigate`):** Prevents the renderer from navigating away from the local application origin (`file:` or `http://localhost:5173`).

### 5.3 Hardware Permission Request Gating
- `session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))`
- Explicitly rejects all runtime permission requests (camera, microphone, geolocation, screen capture, MIDI, notifications) during Step 13.

### 5.4 IPC Sender & Frame Validation
The `isValidSender` gate verifies:
1. `!mainWindow || mainWindow.isDestroyed()`: Window exists and is not disposed.
2. `event.sender.id === mainWindow.webContents.id`: Request originates strictly from the authorized window's webContents.
3. `!event.senderFrame.parent`: Request originates strictly from the top-level frame, rejecting child iframes or embedded frames.

### 5.5 Object Freezing in Preload
All objects exposed through `contextBridge.exposeInMainWorld` are deeply frozen with `Object.freeze()` prior to registration, preventing prototype pollution or client-side monkey patching.

---

## 6. Official Electron Documentation Research References

- **Electron Version:** 33.2.0 (Chromium 130, Node 20.18.0, V8 13.0)
- **Official Documentation Sources Consulted (November 2026):**
  - Process Model: [https://www.electronjs.org/docs/latest/tutorial/process-model](https://www.electronjs.org/docs/latest/tutorial/process-model)
  - Context Isolation: [https://www.electronjs.org/docs/latest/tutorial/context-isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
  - Inter-Process Communication: [https://www.electronjs.org/docs/latest/tutorial/ipc](https://www.electronjs.org/docs/latest/tutorial/ipc)
  - Process Sandboxing: [https://www.electronjs.org/docs/latest/tutorial/sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox)
  - Security Recommendations: [https://www.electronjs.org/docs/latest/tutorial/security](https://www.electronjs.org/docs/latest/tutorial/security)
  - Preload Scripts: [https://www.electronjs.org/docs/latest/tutorial/tutorial-preload](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload)

---

## 7. Deferred Security Responsibilities

- **Step 14:** Typed IPC request/response envelopes, runtime Zod schema validation, centralized error normalization, and malformed payload rejection.
- **Step 15:** Fine-grained execution permissions, DPAPI encrypted credential vault (`safeStorage`), and external tool execution authorization boundaries.
