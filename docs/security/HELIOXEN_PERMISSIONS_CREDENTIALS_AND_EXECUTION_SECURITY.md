# HELIOXEN AI — Permissions, Credential Storage and Execution Security Boundaries
**Document Version:** 1.0.0  
**Phase:** Phase 5, Secure Desktop Runtime and Process Architecture  
**Step:** Step 15 of 48  
**Classification:** Foundational Desktop Application Security Architecture  
**Official Research Date:** November 1, 2026  

---

## 1. Executive Summary & Purpose

This document establishes the security architecture, capability authorization model, credential vault design, session permission baseline, and execution boundaries for **HELIOXEN AI**.

HELIOXEN AI operates across distinct trust domains. To prevent untrusted inputs, renderer compromises, or future AI model hallucinations from gaining unrestricted operating system privileges, Step 15 implements three foundational security controls:
1. **Secure Credential Storage:** Long-lived sensitive secrets (such as API keys) remain exclusively in the trusted Electron main process and are persisted via native OS encryption (Windows DPAPI via `safeStorage`). Stored secrets are never sent to the renderer process in plaintext.
2. **Least-Privilege Capability Authorization:** The main process independently validates and authorizes all privileged operations against an explicit capability matrix. Unknown or prohibited capabilities are denied by default.
3. **Execution & Two-Tier Human Approval Gate:** Sensitive operations enforce explicit, single-use, action-bound user confirmation before execution. Arbitrary shell or script execution is permanently prohibited.

---

## 2. Threat Model & Trust Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED EXTERNAL DOMAIN                       │
│  - External AI Providers (Google Gemini, OpenAI)                       │
│  - Untrusted Web/Document Content, Dynamic Prompts, Injected Code      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION BOUNDARY (Renderer)                  │
│  - React 18 UI / Lucide Icons / Three.js AI Core Visualizer            │
│  - Sandbox: true, NodeIntegration: false, ContextIsolation: true       │
│  - NO access to filesystem, child_process, or safeStorage              │
│  - ZERO access to stored plaintext secrets                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ [ContextBridge / Typed IPC Channels]
                                    │ [assertValidSender & validateIpcPayload]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TRUSTED EXECUTION BOUNDARY (Main Process)            │
│  - Authorizer: Evaluates request against CAPABILITIES registry         │
│  - ConsentGate: Two-Tier Human Approval Gate (TTL + Nonce Binding)     │
│  - CredentialStorageService: Native DPAPI Encryption (safeStorage)     │
│  - SecurityLogger: Redacted event audit logging                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        HOST OPERATING SYSTEM                           │
│  - Windows DPAPI Key Management / Local AppData Storage                │
│  - Strictly NO Arbitrary Shell / Command Execution                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Trusted Execution Boundary (Main Process)
The Electron main process coordinates local privileged actions. Being in the main process does not confer automatic safety: all operations must still be authorized, validated against Zod schemas, sender-checked, and logged without secret leakage.

### 2.2 Presentation Boundary (Renderer Process)
The renderer is treated as an untrusted presentation layer. Context isolation and process sandboxing are strictly enforced. The renderer cannot read secrets, query raw credential files, or execute system binaries.

### 2.3 Untrusted Content & AI Model Boundary
Future LLM outputs, generated plans, tool call requests, or injected prompt content are completely untrusted. Models cannot grant themselves capabilities or authorize execution.

---

## 3. Capability Authorization Model (Least Privilege)

All operations are governed by an explicit capability catalog defined in [`src/shared/security/capabilities.ts`](../../src/shared/security/capabilities.ts) and evaluated by [`src/main/security/authorizer.ts`](../../src/main/security/authorizer.ts).

### 3.1 Core Principles
- **Deny by Default:** Any capability identifier not explicitly registered in `CAPABILITIES` is immediately rejected with `UNAUTHORIZED_SENDER`.
- **Requester Enforcement:** Operations declared `main-only` cannot be invoked from the renderer context.
- **Fail Closed:** If authorization state cannot be verified, execution is aborted.
- **No Self-Privileging:** A caller cannot pass `{ authorized: true }` to bypass the `Authorizer`.

### 3.2 Capability Policy Matrix

| Capability ID | Risk Tier | Allowed Requester | Human Consent Required? | Status | Owning Subsystem |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `window:minimize` | Low | `renderer-main-window` | No | Active | Desktop Shell |
| `window:maximize` | Low | `renderer-main-window` | No | Active | Desktop Shell |
| `window:close` | Low | `renderer-main-window` | No | Active | Desktop Shell |
| `window:isMaximized` | Low | `renderer-main-window` | No | Active | Desktop Shell |
| `credential:store` / `credentials:storeSecret` | Moderate | `main-only` | No | Active | Credential Vault |
| `credential:retrieve` / `credentials:retrieveSecret` | High | `main-only` | No | Active | Credential Vault |
| `credential:delete` / `credentials:deleteSecret` | Moderate | `main-only` | No | Active | Credential Vault |
| `credential:list` / `credentials:listMetadata` | Low | `main-only` | No | Active | Credential Vault |
| `credentials:deleteAllSecrets` | High | `main-only` | Yes (Two-Tier Gate) | Active | Credential Vault |
| `tool:execute` | High | `main-only` | Yes (Two-Tier Gate) | Deferred | Desktop Automation |
| `ai:providerInvoke` | High | `main-only` | No | Deferred | AI Core |
| `audio:microphoneCapture` | High | `renderer-main-window` | Yes (Explicit UI Gate) | Deferred | Voice Subsystem |
| `shell:execute` / `shell:executeCommand` | Prohibited | `none` | N/A | Prohibited | System |
| `os:runScript` | Prohibited | `none` | N/A | Prohibited | System |

---

## 4. Two-Tier Human Approval Gate (`ADR-013`)

For high-risk or irreversible capabilities (such as deleting all credentials or future agent tool execution), HELIOXEN enforces a Two-Tier Human Confirmation Gate:

1. **Short-Lived Consent Tokens:** The main process generates a cryptographically unique `requestId` with a 60-second TTL bound strictly to the `capabilityId` and `targetSummary`.
2. **Single-Use Consumption:** Once a consent token is validated and consumed, it is immediately discarded. It cannot be replayed for subsequent requests or reused for a different capability.
3. **Cancellation & Expiry Handling:** If the user cancels the confirmation, or if the token expires, the gate marks the request resolved with `isApproved = false`. Subsequent execution attempts throw `OPERATION_UNAVAILABLE`.

---

## 5. Secure Credential Storage Foundation

The secure credential vault is implemented in [`src/main/security/credentialStorage.ts`](../../src/main/security/credentialStorage.ts).

### 5.1 Platform Encryption Mechanism
- **Engine:** Electron native `safeStorage` API.
- **Operating System Protection:** Windows DPAPI (Data Protection API) using credentials tied to the current Windows user login.
- **Fail-Closed Availability Check:** Prior to any cryptographic operation, `safeStorage.isEncryptionAvailable()` is queried. If DPAPI is unavailable, the service throws `IpcException('OPERATION_UNAVAILABLE')`. **Under no circumstances does HELIOXEN AI fall back to plaintext persistence.**

### 5.2 Storage Envelope & Format
Stored records follow the versioned schema `helioxen.credentials.v1`:
```json
{
  "version": 1,
  "schema": "helioxen.credentials.v1",
  "records": {
    "provider-gemini": {
      "id": "provider-gemini",
      "provider": "google-gemini",
      "label": "Primary Gemini API Key",
      "ciphertext": "AQAACMzFU8b...[BASE64_ENCRYPTED_DPAPI_BLOB]",
      "createdAt": 1730462400000,
      "updatedAt": 1730462400000
    }
  }
}
```

### 5.3 Atomic Persistence & Corruption Protection
- **Atomic Writes:** Data is written to a temporary sibling file (`.tmp`) and atomically renamed via `fs.rename` to prevent corrupted partial writes on sudden power loss or process termination.
- **Non-Destructive Error Handling:** If the credential file contains invalid JSON or an unparseable schema, the service refuses to overwrite or delete it. Destructive resets are explicitly prohibited to protect user data recovery.
- **Metadata Protection:** Metadata inspection methods (`listMetadata`, `hasCredential`) return only identifiers, providers, labels, and timestamps. Plaintext secrets and raw ciphertexts are omitted.

### 5.4 Credential Lifecycle Table

| Operation | Trusted Owner | Secret Exposed to Renderer? | Storage Behavior | Failure Behavior | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Store Secret | `main-process` | No | DPAPI encryption -> Atomic write | Throws `OPERATION_UNAVAILABLE`; fails closed | `tests/security/credentialStorage.test.ts` |
| Retrieve Secret | `main-process` | No | In-memory decryption for dispatch | Throws `INTERNAL_ERROR` on bad ciphertext | `tests/security/credentialStorage.test.ts` |
| Has Credential | `main-process` | No | Reads JSON index without decrypting | Returns `false` | `tests/security/credentialStorage.test.ts` |
| List Metadata | `main-process` | No | Strips ciphertexts; returns non-sensitive metadata | Returns `[]` | `tests/security/credentialStorage.test.ts` |
| Delete Secret | `main-process` | No | Removes key from index -> Atomic write | Returns `false` if not found | `tests/security/credentialStorage.test.ts` |

---

## 6. Web Content & Session Permission Baseline

In [`src/main/index.ts`](../../src/main/index.ts), Electron's default session enforces strict hardware and permission denials:

1. **`setPermissionRequestHandler`:** All browser-origin permission requests (including `media`, `camera`, `microphone`, `geolocation`, `notifications`, `midi`, `pointerLock`) are intercepted and unconditionally rejected (`callback(false)`).
2. **`setPermissionCheckHandler`:** Synchronous permission checks from web contents are intercepted and unconditionally return `false`.
3. **Security Audit Logging:** Rejected permission attempts are recorded in the security audit buffer with the requesting origin and permission type.
4. **Content Security Policy (CSP):** Enforced on all HTTP/HTTPS response headers and verified by renderer HTML meta tags:
   ```
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*;
   ```

---

## 7. Security Event Logging & Secret Redaction

Audit logging is implemented in [`src/main/security/securityLogger.ts`](../../src/main/security/securityLogger.ts).

- **Redaction Filter:** All log details are processed by `redactSensitiveData()`, which recursively inspects objects and redacts any key matching `/key|secret|token|password|auth|credential|api_key|bearer/i` to `'[REDACTED]'`.
- **Ring Buffer:** Stores the latest 200 security events in an in-memory buffer to prevent unbounded memory leaks.
- **No Secret Persistence:** Neither plaintext secrets nor synthetic canary secrets are ever written to stdout, stderr, or diagnostic logs.

---

## 8. Threat-to-Control Traceability Matrix

Links controls implemented in Step 15 to the primary threat model ([`docs/HELIOXEN_THREAT_MODEL.md`](../HELIOXEN_THREAT_MODEL.md)):

| Threat ID | Threat Description | Step 15 Mitigation Control | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **TM-001** | Accidental plaintext credential storage | Native DPAPI encryption via `safeStorage`; fail-closed on unavailability | `credentialStorage.test.ts` (Plaintext-at-Rest Check) |
| **TM-002** | Credential exfiltration via renderer compromise | Stored secrets are restricted to trusted main-process consumers; no renderer IPC endpoint returns secrets | Architecture check; zero IPC channels for secret read |
| **TM-003** | Secret leakage in application logs or diagnostics | Recursive regex redaction (`redactSensitiveData`) in `SecurityLogger` | `securityLogger.test.ts` |
| **TM-004** | Arbitrary shell command execution | `shell:execute` and `os:runScript` permanently prohibited in `CAPABILITIES` | `authorizer.test.ts` (permanently rejected) |
| **TM-005** | Unauthorized execution of future AI capabilities | Roadmap capabilities flagged `deferred`; denied by default by `Authorizer` | `authorizer.test.ts` |
| **TM-006** | Confused deputy / authorization replay | Two-Tier Human Approval Gate with single-use nonce consumption and 60s TTL | `consentGate.test.ts` |
| **TM-007** | Unauthorized browser device permissions | `setPermissionRequestHandler` & `setPermissionCheckHandler` return `false` | `src/main/index.ts` session configuration |
| **TM-008** | Credential store corruption on sudden power loss | Atomic write pattern via `.tmp` file and rename | `credentialStorage.test.ts` |

---

## 9. Verification & Automated Test Evidence

Automated security verification is integrated into the test suite under [`tests/security/`](../../tests/security/):

1. **`tests/security/credentialStorage.test.ts` (8 tests):**
   - Stores and retrieves synthetic credentials.
   - **Plaintext-at-rest verification:** Inspects physical disk contents to prove canary secret is absent in plaintext.
   - Replaces secret values atomically.
   - Deletes stored credentials cleanly.
   - Lists non-sensitive metadata without secret leakage.
   - Fails closed when encryption is unavailable.
   - Refuses destructive reset on corrupted JSON files.
   - Rejects empty or whitespace-only credential IDs.
2. **`tests/security/authorizer.test.ts` (7 tests):**
   - Authorizes low-risk window controls for renderer.
   - Denies unknown capabilities by default.
   - Permanently rejects prohibited capabilities (`shell:execute`, `os:runScript`).
   - Rejects deferred roadmap capabilities (`ai:providerInvoke`, `audio:microphoneCapture`).
   - Denies main-only capabilities when called from renderer.
   - Permits main-only capabilities for trusted main process.
   - Enforces Two-Tier Human Approval Gate for high-risk capabilities.
3. **`tests/security/consentGate.test.ts` (5 tests):**
   - Creates short-lived requests bound to capability and target.
   - Approves request and enforces single-use consumption.
   - Rejects replayed tokens.
   - Rejects unapproved or denied requests.
   - Rejects tokens attempted on different capabilities (action-binding).
4. **`tests/security/securityLogger.test.ts` (3 tests):**
   - Redacts sensitive keys across nested objects.
   - Records events with timestamps and redacted payloads.
   - Enforces buffer limits to avoid memory leaks.

**Total Project Tests:** 33 tests passing across 7 test suites (100% passing).
