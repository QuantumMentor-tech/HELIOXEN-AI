# HELIOXEN: Browser Service, Browser Sessions and Tab Management
**Architecture Documentation — Step 31 of 48 (Phase 11: Browser Services and Web Interaction)**

---

## 1. Executive Summary and Primary Engineering Principle

Step 31 implements a secure, modular browser subsystem for HELIOXEN AI:
1. **Primary Engineering Principle**: Web pages are untrusted content. Browser navigation, session storage, tab management, and application permissions must remain strictly under trusted HELIOXEN control. A remote webpage must never gain access to privileged Electron APIs, the credential vault, or application preload bridges merely because it is displayed inside the application.
2. **Untrusted Content Isolation**: All browser tabs render using modern Electron `WebContentsView` with strict security settings: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`, and `preload: undefined`. The privileged HELIOXEN preload bridge is never attached to browser tab views.
3. **Partition Isolation**: Browser sessions utilize dedicated Electron partitions:
   - Persistent sessions: `persist:helioxen_browser_<sessionId>`
   - Ephemeral in-memory sessions: `helioxen_browser_temp_<sessionId>`
   - The Electron default session is never reused for web browsing.
4. **Default-Deny Permissions**: `session.setPermissionRequestHandler` and `session.setPermissionCheckHandler` deny all sensitive capabilities (camera, microphone, geolocation, notifications, midi, media, pointerLock) by default.
5. **Download and Popup Containment**:
   - Downloads are cancelled by default via `will-download` (`item.cancel()`, `event.preventDefault()`).
   - Untrusted popups and new windows are blocked via `setWindowOpenHandler` (`{ action: 'deny' }`), preventing uncontrolled native window creation.
6. **Strict Navigation Policy**: Only HTTP and HTTPS protocols are accepted. `file:`, `javascript:`, `data:`, `vbscript:`, and custom schemes are rejected. Embedded credentials (`http://user:pass@host`) and oversized URLs are rejected.
7. **Strict Stop Boundary**: Step 31 implements browser sessions and tab lifecycle management only. It does NOT implement web search, scraping, visual capture, DOM automation, or password auto-fill (reserved for Steps 32 and 33).

---

## 2. Architecture & Subsystem Diagram

```mermaid
flowchart TD
    subgraph Renderer ["Renderer Process / UI"]
        UI[Browser Tab Bar & Controls]
        Bridge[Preload Bridge: window.helioxen.browser]
        UI --> Bridge
    end

    subgraph IPC ["Strict IPC Layer"]
        Bridge -->|BROWSER_* IPC Channels| IPCHandler[Main Process IPC Handlers]
    end

    subgraph MainSecurity ["Main Security Layer"]
        IPCHandler --> Auth[Authorizer: Capabilities & ConsentGate]
        IPCHandler --> Zod[Zod Contracts & Validations]
    end

    subgraph BrowserCore ["Main Process Browser Engine"]
        Auth --> SessionMgr[BrowserSessionManager]
        Auth --> TabMgr[BrowserTabManager]
        TabMgr --> NavPolicy[NavigationPolicy]
        SessionMgr --> Partitions["Isolated Partitions (persist / temp)"]
        TabMgr --> Views["WebContentsView Pool (nodeIntegration=false, sandbox=true)"]
    end

    subgraph Orchestration ["Agent & Task Orchestration"]
        Agent[TaskExecutionEngine] --> Dispatcher[ToolDispatcher]
        Dispatcher -->|browser:* tools| TabMgr
        Dispatcher -->|browser:* tools| SessionMgr
    end
```

---

## 3. Capabilities, IPC Channels & Tool Catalog Matrix

### 3.1 Security Capabilities (`src/shared/security/capabilities.ts`)

| Capability Identifier | Description | Risk Tier |
|---|---|---|
| `browser:createSession` | Create or configure isolated browser sessions | `moderate` |
| `browser:manageTabs` | Open, close, switch, reload, and list browser tabs | `moderate` |
| `browser:navigate` | Navigate browser tabs to validated HTTP/HTTPS URLs | `moderate` |
| `browser:clearSession` | Clear cookies, cache, and storage data from browser sessions | `moderate` |
| `browser:closeSession` | Terminate browser sessions and destroy associated tabs | `moderate` |

### 3.2 Canonical Tools (`BUILTIN_TOOL_CATALOG`)

| Tool Identifier | Description | Category | Required Capabilities | Confirmation |
|---|---|---|---|---|
| `browser:create_session` | Create an isolated persistent or in-memory browsing session | `system` | `['browser:createSession']` | `none` |
| `browser:create_tab` | Open a new browser tab with optional initial URL | `system` | `['browser:manageTabs']` | `none` |
| `browser:navigate` | Navigate an existing browser tab to a validated HTTP/HTTPS URL | `system` | `['browser:navigate']` | `none` |
| `browser:switch_tab` | Bring a specific browser tab into active foreground view | `system` | `['browser:manageTabs']` | `none` |
| `browser:close_tab` | Close a browser tab and release its WebContentsView | `system` | `['browser:manageTabs']` | `none` |
| `browser:get_tab_state` | Retrieve current status, URL, title, and navigation state | `system` | `['browser:manageTabs']` | `none` |
| `browser:list_tabs` | Enumerate all open tabs in a session or application-wide | `system` | `['browser:manageTabs']` | `none` |
| `browser:reload` | Reload the current page in a browser tab | `system` | `['browser:manageTabs']` | `none` |
| `browser:stop` | Halt active network loading for a browser tab | `system` | `['browser:manageTabs']` | `none` |
| `browser:go_back` | Navigate back in the tab's navigation history | `system` | `['browser:manageTabs']` | `none` |
| `browser:go_forward` | Navigate forward in the tab's navigation history | `system` | `['browser:manageTabs']` | `none` |
| `browser:clear_session` | Wipe cookies, cache, and local storage data | `system` | `['browser:clearSession']` | `none` |

### 3.3 Strict IPC Channels (`src/shared/ipc/channels.ts`)

- `BROWSER_CREATE_SESSION`: `helioxen:browser:createSession`
- `BROWSER_GET_SESSION`: `helioxen:browser:getSession`
- `BROWSER_LIST_SESSIONS`: `helioxen:browser:listSessions`
- `BROWSER_CLEAR_SESSION`: `helioxen:browser:clearSession`
- `BROWSER_CLOSE_SESSION`: `helioxen:browser:closeSession`
- `BROWSER_CREATE_TAB`: `helioxen:browser:createTab`
- `BROWSER_NAVIGATE_TAB`: `helioxen:browser:navigateTab`
- `BROWSER_SWITCH_TAB`: `helioxen:browser:switchTab`
- `BROWSER_CLOSE_TAB`: `helioxen:browser:closeTab`
- `BROWSER_GET_TAB_STATE`: `helioxen:browser:getTabState`
- `BROWSER_LIST_TABS`: `helioxen:browser:listTabs`
- `BROWSER_RELOAD_TAB`: `helioxen:browser:reloadTab`
- `BROWSER_STOP_TAB`: `helioxen:browser:stopTab`
- `BROWSER_GO_BACK`: `helioxen:browser:goBack`
- `BROWSER_GO_FORWARD`: `helioxen:browser:goForward`
- `BROWSER_SET_BOUNDS`: `helioxen:browser:setBounds`

---

## 4. Tab Lifecycle & Crash Recovery

Each tab maintains a type-safe `TabLoadingStatus`:
- `'empty'`: Initial tab created (`about:blank`), awaiting navigation.
- `'loading'`: Actively loading resources from validated URL (`did-start-loading`).
- `'loaded'`: Successfully completed navigation (`did-stop-loading`, `did-finish-load`).
- `'failed'`: Navigation failed due to network error or DNS resolution (`did-fail-load`). Error recorded in tab state.
- `'crashed'`: Renderer process terminated unexpectedly (`render-process-gone`). Tab state is updated to `'crashed'` with reason, preventing white screens or application lockup.
- `'closed'`: Tab closed and view cleanly destroyed.

---

## 5. Security & Verification Summary

- **Isolated View Preferences**: Verified via `tests/browser/browserSecurity.test.ts`.
- **Default Deny Permissions**: Verified via `tests/browser/browserSecurity.test.ts`.
- **Blocked Downloads & Popups**: Verified via `tests/browser/browserSecurity.test.ts`.
- **URL Protocol Smuggling Rejection**: Verified via `tests/browser/navigationPolicy.test.ts`.
- **Strict Zod Contract Validation**: Verified via `tests/browser/browserContracts.test.ts`.
- **Session Lifecycle & Clean Clearing**: Verified via `tests/browser/browserSessions.test.ts`.
- **Tab Creation & History Switching**: Verified via `tests/browser/tabManagement.test.ts`.
- **Tool Dispatch & Agent Orchestration**: Verified via `tests/browser/browserToolsIntegration.test.ts`.
- **Total Test Suite Health**: 75 test files, 457 tests passing cleanly (100% green).

