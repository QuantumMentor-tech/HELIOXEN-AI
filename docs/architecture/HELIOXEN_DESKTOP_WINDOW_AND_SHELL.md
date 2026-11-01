# HELIOXEN AI — Desktop Window, Custom Titlebar and Application Shell

**Document ID:** `HELIOXEN-ARCH-005`  
**Version:** `1.0.0`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 4: Desktop Application Shell and Command Center  
**Step:** Step 10 of 48 (Desktop Window, Custom Titlebar and Application Shell)  
**Status:** Approved Desktop Shell & Window Architecture  
**Date:** November 1, 2026  
**Authoritative Locations:**
- Electron Main Process: [`src/main/index.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/index.ts)
- Preload Window Bridge: [`src/preload/index.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/preload/index.ts)
- TypeScript Typings: [`src/renderer/src/env.d.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/env.d.ts)
- Custom Titlebar: [`src/renderer/src/components/layout/Titlebar.tsx`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/layout/Titlebar.tsx)
- Application Shell: [`src/renderer/src/components/layout/AppShell.tsx`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/layout/AppShell.tsx)

---

## 1. WINDOW-FRAME STRATEGY & RATIONALE

HELIOXEN adopts a **Frameless Custom Desktop Window** (`frame: false`) with a dedicated React titlebar rendered within the sandboxed local renderer.

```
+---------------------------------------------------------------------------------------+
| (H) HELIOXEN AI      |  STATUS: STANDBY  |  v0.1.0-alpha.1       |  -   [ ]   X   |  <- Custom Titlebar
+---------------------------------------------------------------------------------------+
|            |                                                                          |
|  NAV RAIL  |                       PRIMARY APPLICATION VIEWPORT                       |
|  (w-16 /   |                         (Active Core / Roadmap)                          |
|   w-56)    |                                                                          |
|            |                                                                          |
+---------------------------------------------------------------------------------------+
```

### 1.1 Architectural Rationale
1. **Design Consistency:** Standard operating-system titlebars introduce stark white or neutral gray chrome that conflicts with HELIOXEN's cinematic Deep Space (`#070a10`) and Neon Cyan palette.
2. **Ergonomic Titlebar Region:** The custom titlebar accommodates the official miniature orbital emblem, live status pills (`STANDBY`, `ACTIVE`), and compact window controls without wasting vertical canvas.
3. **Clean Drag & Native Control:** Utilizes standard Chromium `-webkit-app-region` styles to provide native window dragging while preserving full clickability and keyboard accessibility for controls.
4. **Clean-Room Enforcement:** Zero proprietary styling, textures, or code were copied from reference projects (Stonic, Brahma, IRIS). All components were authored from scratch.

---

## 2. BROWSERWINDOW CONFIGURATION & LIFECYCLE

The primary desktop window is initialized in [`src/main/index.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/index.ts) with the following security and geometry settings:

```typescript
mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 640,
  show: false,
  frame: false, // Frameless window enabling custom titlebar
  autoHideMenuBar: true,
  backgroundColor: '#070a10',
  icon: join(__dirname, '../../resources/icon.png'),
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true
  }
})
```

### 2.1 Window Lifecycle Sequence
1. **Ready-to-Show:** The window remains hidden (`show: false`) until initial DOM layout and stylesheet parsing complete, preventing white startup flashes.
2. **Maximize / Unmaximize Events:** The main process monitors native window maximization and emits `window:maximized-change` events to the renderer.
3. **Application Shutdown:** On Windows, closing the primary window initiates `app.quit()`, cleaning up all registered IPC handlers.

---

## 3. SECURE WINDOW-CONTROL IPC BRIDGE

To respect the principle of least privilege, the renderer is never given direct access to `BrowserWindow` or raw `ipcRenderer`. Communication is channeled through a narrowly scoped, typed bridge.

### 3.1 IPC Channel Contracts

| Channel Name | Direction | Payload | Return Value | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| `window:minimize` | Renderer -> Main | None | `Promise<void>` | Minimizes the authorized application window. |
| `window:maximize` | Renderer -> Main | None | `Promise<void>` | Toggles between maximized and restored states. |
| `window:close` | Renderer -> Main | None | `Promise<void>` | Closes the application via normal lifecycle. |
| `window:isMaximized` | Renderer -> Main | None | `Promise<boolean>` | Queries the current native maximized state. |
| `window:maximized-change`| Main -> Renderer | `boolean` | Event Push | Notifies the titlebar when native maximization changes. |

### 3.2 Sender Validation & Threat Mitigation
In [`src/main/index.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/index.ts), all window IPC handlers enforce:
```typescript
function isValidSender(event: IpcMainInvokeEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  return event.sender.id === mainWindow.webContents.id
}
```
- Requests from unauthorized frames, external URLs, or child webContents are rejected immediately.
- The renderer cannot pass arbitrary window IDs or privileged shell commands.

### 3.3 Preload Bridge Interface
In [`src/preload/index.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/preload/index.ts), the API is exposed under `window.helioxen.window`:
```typescript
window: {
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }
    ipcRenderer.on('window:maximized-change', listener)
    return () => {
      ipcRenderer.removeListener('window:maximized-change', listener)
    }
  }
}
```

---

## 4. CUSTOM TITLEBAR COMPONENT (`Titlebar.tsx`)

The titlebar is implemented as a compact 36px (`h-9`) fixed component in [`src/renderer/src/components/layout/Titlebar.tsx`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/layout/Titlebar.tsx).

### 4.1 Draggable & Non-Draggable Regions
- **Draggable Region:** The container element uses `style={{ WebkitAppRegion: 'drag' }}`. Users can grab any empty area or the title to drag the window across monitors.
- **Double-Click Maximization:** Double-clicking the draggable area invokes `handleMaximizeToggle()`, mirroring native Windows OS behavior.
- **Non-Draggable Region:** Window control buttons and interactive elements use `style={{ WebkitAppRegion: 'no-drag' }}`, ensuring mouse clicks and keyboard focus are never intercepted by Chromium drag handling.

### 4.2 Window Controls Specification

| Control | Icon | Visual State | Accessible Name | Native Action |
| :--- | :--- | :--- | :--- | :--- |
| **Minimize** | `Minus` (14px) | `hover:bg-hx-hover` | `"Minimize Window"` | `mainWindow.minimize()` |
| **Maximize** | `Square` (14px) | `hover:bg-hx-hover` | `"Maximize Window"` | `mainWindow.maximize()` |
| **Restore** | `Copy` (14px) | `hover:bg-hx-hover` | `"Restore Window"` | `mainWindow.unmaximize()` |
| **Close** | `X` (16px) | `hover:bg-[#e81123] hover:text-white` | `"Close Application"` | `mainWindow.close()` |

---

## 5. APPLICATION SHELL ARCHITECTURE (`AppShell.tsx`)

The outer application shell is encapsulated in [`src/renderer/src/components/layout/AppShell.tsx`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/layout/AppShell.tsx):
```
AppShell (Viewport Root: h-screen w-screen overflow-hidden flex-col)
├── Titlebar (h-9 w-full shrink-0 z-hx-titlebar)
└── Viewport Body (flex-1 flex overflow-hidden min-h-0 relative)
    ├── NavRail (w-16 / w-56 shrink-0 h-full)
    └── ContentRegion (flex-1 h-full overflow-y-auto)
```

### 5.1 Geometry & Overflow Protection
- **No Window Scrollbars:** The root viewport enforces `overflow: hidden`.
- **Independent Content Scrolling:** The primary content area scrolls vertically within `ContentRegion` without displacing the Titlebar or Navigation Rail.
- **Resilience:** Resizing the window dynamically updates the flexible content region without causing layout jumps or clipped controls.

---

## 6. ACCESSIBILITY & SECURITY COMPLIANCE

1. **Keyboard Operability:** Window controls are reachable via `Tab` and activatable via `Enter` / `Space`. Each button has an explicit `focus-visible:ring-1 focus-visible:ring-hx-cyan` outline.
2. **Screen Reader Accuracy:** When maximized, the button's accessible name dynamically updates from `"Maximize Window"` to `"Restore Window"`.
3. **Strict Content Security Policy (CSP):** Retained `default-src 'self'` and `script-src 'self'`. Zero inline scripts or remote code injection.
4. **Sandboxed Renderer:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

---

## 7. DEFERRED ROADMAP WORK (STEPS 11 THROUGH 15)

The following capabilities are strictly deferred to subsequent roadmap milestones:
- **Step 11:** 3-panel command dashboard workspace (Left dock, Center canvas, Right context panel).
- **Step 12:** Dynamic 3D Three.js particle AI Core and persistent voice dock.
- **Step 13 & 14:** Formal typed IPC contract registry and privileged tool execution authorization.
