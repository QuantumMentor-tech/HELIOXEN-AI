# HELIOXEN: System Telemetry, Installed Applications and Window Discovery
**Architecture Documentation — Step 28 of 48 (Phase 10: Desktop Awareness and System Interaction)**

---

## 1. Executive Summary and Architectural Principles

Step 28 implements a secure, read-only desktop-awareness subsystem for HELIOXEN AI:
1. **System-Health Telemetry**: Non-invasive retrieval of OS diagnostics, CPU utilization sampled over measured windows ($\Delta\text{total} - \Delta\text{idle}$), host and process memory metrics, system/process uptime, and primary volume capacity via `fs.statfs`.
2. **Installed-Application Discovery**: Safe enumeration of registered desktop applications from standard Windows Start Menu locations (`%ProgramData%` and `%APPDATA%`), normalized into typed entries with in-memory caching (60s TTL), search/filtering, and clear completeness status.
3. **Desktop Window Discovery**: Non-intrusive enumeration of HELIOXEN application windows (`BrowserWindow.getAllWindows()`) and visible desktop windows (`desktopCapturer.getSources`), mapping them to safe opaque internal identifiers (`win_helioxen_*`, `win_ext_*`) with optional sensitive title redaction.
4. **Security & Process Boundaries**: The renderer remains isolated via typed IPC and context bridge. All OS operations remain read-only; discovery never authorizes application launching, process termination, window manipulation, filesystem alteration, or mouse/keyboard control.

---

## 2. System-Health Telemetry Architecture

### 2.1 Metric Definitions and Sources

| Metric Identifier | Source API | Units | Semantic Description |
|---|---|---|---|
| `os.platform`, `os.release`, `os.type`, `os.arch` | `os.platform()`, `os.release()`, `os.type()`, `os.arch()` | String | Operating system kernel family, build release, and CPU architecture. |
| `os.logicalCpuCount` | `os.cpus().length` | Count | Number of available logical CPU execution threads. |
| `cpu.utilizationPercent` | $\Delta\text{total} - \Delta\text{idle}$ over sample window | Percentage $[0, 100]$ | Normalized CPU busy time during sampling interval. |
| `cpu.sampleDurationMs` | Measured sampling timer | Milliseconds | Sampling duration (bounded between 50ms and 1000ms). |
| `memory.hostTotalBytes` | `os.totalmem()` | Bytes | Total physical RAM installed on host. |
| `memory.hostFreeBytes` | `os.freemem()` | Bytes | Instantaneous available physical RAM. |
| `memory.hostUsedBytes` | `os.totalmem() - os.freemem()` | Bytes | Instantaneous utilized physical RAM. |
| `memory.hostUsagePercent` | $(\text{Used} / \text{Total}) \times 100$ | Percentage $[0, 100]$ | Percentage of physical RAM in use. |
| `memory.processRssBytes` | `process.memoryUsage().rss` | Bytes | Resident Set Size of the HELIOXEN main process. |
| `memory.processHeapTotalBytes` | `process.memoryUsage().heapTotal` | Bytes | Total allocated V8 heap for HELIOXEN. |
| `memory.processHeapUsedBytes` | `process.memoryUsage().heapUsed` | Bytes | Actively used V8 heap memory for HELIOXEN. |
| `uptime.systemSeconds` | `os.uptime()` | Seconds | Elapsed time since host operating system boot. |
| `uptime.processSeconds` | `process.uptime()` | Seconds | Elapsed time since HELIOXEN process startup. |
| `storage.totalBytes` | `fs.statfs(root).blocks * bsize` | Bytes | Total storage capacity of the primary volume. |
| `storage.availableBytes` | `fs.statfs(root).bavail * bsize` | Bytes | Available non-privileged storage capacity. |
| `storage.usedBytes` | $(\text{blocks} - \text{bavail}) \times \text{bsize}$ | Bytes | Allocated storage on the primary volume. |
| `storage.usagePercent` | $(\text{Used} / \text{Total}) \times 100$ | Percentage $[0, 100]$ | Storage utilization percentage. |

### 2.2 CPU Sampling Algorithm
To avoid confusing cumulative CPU times with instantaneous utilization:
1. Sample $T_0$: Read `os.cpus()`, calculate $\text{total}_0 = \sum(\text{user} + \text{nice} + \text{sys} + \text{idle} + \text{irq})$ and $\text{idle}_0 = \sum \text{idle}$ across all cores.
2. Wait bounded interval $\Delta t \in [50, 1000]\text{ ms}$ (default 100ms).
3. Sample $T_1$: Read `os.cpus()`, calculate $\text{total}_1$ and $\text{idle}_1$.
4. $\Delta\text{total} = \text{total}_1 - \text{total}_0$, $\Delta\text{idle} = \text{idle}_1 - \text{idle}_0$.
5. If $\Delta\text{total} > 0$:
   $$\text{Utilization } \% = \max\left(0, \min\left(100, \frac{\Delta\text{total} - \Delta\text{idle}}{\Delta\text{total}} \times 100\right)\right)$$
6. Concurrent sampling requests reuse an active sampling promise to prevent CPU polling spikes.

---

## 3. Installed-Application Discovery Architecture

### 3.1 Discovery Mechanism
The inventory manager inspects standard Windows Start Menu directories without subprocesses or shell execution:
- **System-wide applications**: `%ProgramData%\Microsoft\Windows\Start Menu\Programs`
- **User-specific applications**: `%APPDATA%\Microsoft\Windows\Start Menu\Programs`

### 3.2 Traversal Guardrails
- **Bounded Depth**: Maximum directory recursion depth of 2 (covers publisher directories like `Google/`, `Microsoft Office/`, `Accessories/`).
- **Bounded Result Count**: Capped at 200 entries maximum to protect IPC bandwidth.
- **Exclusion Filters**: Files starting with `.`, `desktop.ini`, and uninstaller shortcuts (`*uninstall*.lnk`) are excluded.
- **Publisher & Category Inference**: Parent directory names provide publisher hints; category heuristics infer types (`Browser`, `Developer Tools`, `Productivity`, `Multimedia`, `Utilities`, `General`).
- **Stable Identifiers**: Format `app_${scope}_${sanitizedSlug}` (e.g., `app_system_google_chrome`).
- **In-Memory Cache**: Cached for 60 seconds. Supports explicit invalidation via `forceRefresh: true` or `clearCache()`.

### 3.3 Inventory Coverage & Known Omissions
- **Included**: All applications registering standard shortcuts in Windows Start Menu programs folders.
- **Omissions**: Portable standalone `.exe` files located in arbitrary download folders, background Windows services lacking UI shortcuts, and package-isolated Windows Store (UWP) apps lacking standard desktop shortcuts.

---

## 4. Desktop Window Discovery Architecture

### 4.1 Window Discovery Mechanism
1. **HELIOXEN Application Windows**:
   - Enumerated via `BrowserWindow.getAllWindows()`.
   - Captures bounds (`x`, `y`, `width`, `height`), `isVisible`, `isMinimized`, and native focus state (`isActive: win.isFocused()`).
   - Identifiers formatted as `win_helioxen_${id}`.
2. **External Desktop Windows**:
   - Enumerated via Electron's `desktopCapturer.getSources({ types: ['window'], fetchWindowIcons: false, thumbnailSize: { width: 1, height: 1 } })`.
   - Never captures screenshots, thumbnails, or rendered content (thumbnails set to 1x1 dummy size and omitted from result).
   - Generates safe opaque identifier `win_ext_${hash}`. No native Win32 window handles (`HWND`) are leaked across IPC.
   - External active focus is not determinable without native Win32 `GetForegroundWindow` APIs; external windows report `isActive: false` with clear limitation documentation.

### 4.2 Privacy & Sensitive Title Redaction
Window titles often contain sensitive information (emails, file paths, URLs). When `redactSensitiveTitles: true` is requested:
- Emails matching `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` $\to$ `[REDACTED_EMAIL]`
- URLs matching `/https?:\/\/[^\s/$.?#].[^\s]*/gi` $\to$ `[REDACTED_URL]`
- Windows absolute file paths matching `/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]+/g` $\to$ `[REDACTED_PATH]`

---

## 5. Tool Registry & Agent Orchestration Integration

Step 28 registers 3 new read-only tools in the Step 25 Tool Registry and connects them to Step 26/27 Orchestration:

| Tool Identifier | Category | Risk Tier | Required Capability | Execution Mode | Retry Policy |
|---|---|---|---|---|---|
| `telemetry:get_system_health` | `system` | `low` | `telemetry:readSystemHealth` | `asynchronous` | Bounded retry (idempotent, no side effects) |
| `system:list_installed_apps` | `system` | `moderate` | `telemetry:readInstalledApps` | `asynchronous` | Bounded retry (idempotent, no side effects) |
| `system:list_windows` | `system` | `moderate` | `telemetry:readDesktopWindows` | `asynchronous` | Bounded retry (idempotent, no side effects) |

---

## 6. IPC and Preload Bridge Contracts

### 6.1 IPC Channels
- `telemetry:getSystemHealth`: Invokes `systemTelemetryManager.getSystemHealth`.
- `telemetry:getInstalledApps`: Invokes `installedAppDiscoveryManager.getInstalledApps`.
- `telemetry:searchInstalledApps`: Invokes `installedAppDiscoveryManager.searchInstalledApps`.
- `telemetry:getDesktopWindows`: Invokes `windowDiscoveryManager.getDesktopWindows`.

### 6.2 Preload Exposure
Exposed via `window.helioxen.telemetry`:
```typescript
interface HelioxenTelemetryApi {
  getSystemHealth: (request?: SystemHealthRequest) => Promise<SystemHealthTelemetry>
  getInstalledApps: (request?: InstalledAppsRequest) => Promise<InstalledAppsResult>
  searchInstalledApps: (query: string, limit?: number) => Promise<InstalledApplicationEntry[]>
  getDesktopWindows: (request?: WindowDiscoveryRequest) => Promise<WindowDiscoveryResult>
}
```

---

## 7. Verification and Testing Summary

- **Unit & Integration Tests**: 5 dedicated test suites in `tests/telemetry/` containing 32 tests.
- **Overall Test Baseline**: 56 test files, 340 tests passing (100% green).
- **Typecheck**: `node` and `web` compilation targets pass with 0 errors.
- **Production Build**: `electron-vite build` completes cleanly.

