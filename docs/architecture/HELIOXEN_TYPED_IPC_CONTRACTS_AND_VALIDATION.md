# HELIOXEN AI — Typed IPC Contracts, Runtime Request Validation, and Error Handling

**Document Version:** 1.0.0  
**Phase:** Phase 5 — Secure Desktop Runtime and Process Architecture  
**Step:** 14 of 48  
**Status:** Approved & Enforced  
**Date:** November 2026  

---

## 1. Architectural Overview & Single Source of Truth

Step 14 establishes an explicit, typed, and runtime-validated IPC communication layer between HELIOXEN's Electron main process, preload bridge, and renderer.

In strict alignment with `ADR-013`, runtime validation is mandatory. All messages crossing process boundaries are treated as untrusted:
- **Compile-Time Types:** Inferred directly from Zod schemas (`z.infer<typeof ...>`) in `src/shared/ipc/contracts.ts` to ensure zero drift between TypeScript definitions and runtime validators.
- **Authoritative Channels:** Defined as frozen constants in `src/shared/ipc/channels.ts`. Literal channel strings are eliminated from main and preload implementations.
- **Sender & Frame Gating:** Executed before input parsing. Rejects unauthorized WebContents IDs and child frames (iframes).
- **Error Normalization:** Standardized error codes and safe serialization via `IpcException` in `src/shared/ipc/errors.ts`. Internal stack traces and file paths are never transmitted across the IPC bridge.

```
┌──────────────────────────────────────────────────────────────┐
│ UNPRIVILEGED RENDERER PROCESS                                │
│ window.helioxen.window.minimize()                            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                Frozen Preload Bridge Function
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ PRELOAD CONTEXT BRIDGE (src/preload/index.ts)                │
│ ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE)             │
└──────────────────────────────┬───────────────────────────────┘
                               │ IPC Message Crossing Boundary
┌──────────────────────────────▼───────────────────────────────┐
│ PRIVILEGED MAIN PROCESS (src/main/index.ts)                  │
│ 1. assertValidSender(event)  -> Sender ID + Top-Frame Check  │
│ 2. validateIpcPayload(Schema, payload) -> Strict Zod Parse   │
│ 3. Execute Native mainWindow.minimize()                      │
│ 4. Return Normalized Success or Throw IpcException           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Authoritative Contract Inventory Table

| Operation | Direction | Request Shape | Success Result / Payload | Runtime Validator | Sender Checks | Error Behavior | Status |
|---|---|---|---|---|---|---|---|
| **`window:minimize`** | Renderer ➔ Main | `VoidRequestSchema` (`undefined \| null \| {}`) | `void` | `validateIpcPayload(WindowMinimizeRequestSchema, payload)` | `assertValidSender`: webContents ID + `!event.senderFrame.parent` | Throws `VALIDATION_ERROR` or `UNAUTHORIZED_SENDER` | **ACTIVE** |
| **`window:maximize`** | Renderer ➔ Main | `VoidRequestSchema` (`undefined \| null \| {}`) | `void` | `validateIpcPayload(WindowMaximizeRequestSchema, payload)` | `assertValidSender` | Throws `VALIDATION_ERROR` or `UNAUTHORIZED_SENDER` | **ACTIVE** |
| **`window:close`** | Renderer ➔ Main | `VoidRequestSchema` (`undefined \| null \| {}`) | `void` | `validateIpcPayload(WindowCloseRequestSchema, payload)` | `assertValidSender` | Throws `VALIDATION_ERROR` or `UNAUTHORIZED_SENDER` | **ACTIVE** |
| **`window:isMaximized`** | Renderer ➔ Main | `VoidRequestSchema` (`undefined \| null \| {}`) | `boolean` | `validateIpcPayload(WindowIsMaximizedRequestSchema, payload)` | `assertValidSender` | Returns `false` or throws `UNAUTHORIZED_SENDER` | **ACTIVE** |
| **`window:maximized-change`** | Main ➔ Renderer | Main-initiated event push | `boolean` | `validateIpcPayload(WindowMaximizedChangeEventSchema, isMaximized)` | Native event push to `mainWindow.webContents` | Event ignored if payload malformed | **ACTIVE** |

---

## 3. Normalized Error Model

### 3.1 Error Code Reference Table

| Error Code | Safe Message | Meaning | Circumstances |
|---|---|---|---|
| **`VALIDATION_ERROR`** | `"Malformed IPC request payload: ..."` | The renderer provided payload that violates the Zod schema constraint | Non-empty arguments passed to void handlers, invalid types, injected extra keys |
| **`UNAUTHORIZED_SENDER`** | `"IPC invocation rejected: Unauthorized sender WebContents ID"` | The request originated from an unrecognized or unapproved WebContents | Spoofed sender context or secondary windows |
| **`UNAUTHORIZED_FRAME`** | `"IPC invocation rejected: Requests from child frames or iframes are prohibited"` | Request originated from an embedded iframe or subframe | Compromised third-party embedded content |
| **`OPERATION_UNAVAILABLE`** | `"Primary application window is unavailable or destroyed"` | The native window instance is disposed | Request arrived during application teardown |
| **`INTERNAL_ERROR`** | `"An internal runtime error occurred during operation execution"` | Unhandled runtime exception in native execution | Native OS failure (sanitized before boundary transmission) |

### 3.2 Error Normalization & Redaction Policy
When an `IpcException` is serialized across the boundary:
1. `stack` trace is stripped.
2. Local filesystem paths (e.g. `d:\App Winrar Files\...`) are redacted.
3. API credentials and environment secrets are omitted.
4. Only `code`, `message`, and sanitized `details` dictionary are exposed to client code.

---

## 4. Preload Contract Alignment & Event Subscriptions

- **Zero Arbitrary IPC:** The preload bridge exposes explicitly named functions on `window.helioxen.window`. No generic `invokeChannel(name, data)` or `onChannel(name, callback)` exists.
- **Authoritative Constants:** Preload imports `IPC_CHANNELS` directly from `src/shared/ipc/channels.ts`.
- **Subscription Lifecycle & Memory Cleanup:**
  ```typescript
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }
    ipcRenderer.on(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE, listener)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE, listener)
    }
  }
  ```
  Returns a deterministic cleanup closure that deregisters the exact listener reference, preventing memory leaks and duplicate callbacks during React component remounting.

---

## 5. Automated Test Coverage & Verification

Automated unit tests are implemented using **Vitest 2.1.0** under `tests/ipc/`:

1. **`tests/ipc/contracts.test.ts` (3 tests):**
   - Validates authoritative channel naming conventions.
   - Verifies that request schemas accept legitimate void/empty payloads.
   - Verifies that event schemas strictly enforce primitive types.
2. **`tests/ipc/validation.test.ts` (4 tests):**
   - Asserts legitimate requests pass validation.
   - Asserts unexpected primitive types (numbers, strings) throw `IpcException` with `VALIDATION_ERROR`.
   - Asserts extra injected keys (e.g. `{ unauthorizedField: 'exploit' }`) are rejected.
   - Asserts event payloads reject malformed types.
3. **`tests/ipc/errors.test.ts` (3 tests):**
   - Verifies `IpcException` construction and property assignments.
   - Verifies serialization to `IpcErrorPayload` omits internal stack traces.
   - Verifies round-trip reconstruction via `IpcException.fromPayload`.

**Test Execution Outcome:** 10 passed across 3 test files in 2.93s.

---

## 6. Official Electron Documentation Research References

- **Electron Version:** 33.2.0 (Chromium 130, Node 20.18.0)
- **Validation Framework:** Zod 3.23.8
- **Official Documentation Sources Consulted (November 2026):**
  - IPC Tutorial: [https://www.electronjs.org/docs/latest/tutorial/ipc](https://www.electronjs.org/docs/latest/tutorial/ipc)
  - Security Recommendations: [https://www.electronjs.org/docs/latest/tutorial/security](https://www.electronjs.org/docs/latest/tutorial/security)
  - Context Isolation: [https://www.electronjs.org/docs/latest/tutorial/context-isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
  - Preload Scripts: [https://www.electronjs.org/docs/latest/tutorial/tutorial-preload](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload)

---

## 7. Deferred Roadmap Boundaries (Step 15+)

The following capabilities are strictly reserved for subsequent steps:
- **Step 15:** Two-Tier Human Approval Gate, per-capability authorization rules, and DPAPI-encrypted credential vault (`safeStorage`).
- **Steps 16–18:** AI model adapter contracts, streaming chunk events, and model routing.
- **Steps 19–21:** Audio PCM streaming buffers, VAD thresholds, and voice session lifecycles.
- **Steps 25+:** Dynamic skill tool execution schemas and desktop action dispatchers.
