# HELIOXEN Architecture: Optional Android & Smart-Home Integrations

## Executive Summary

Phase 15, Step 45 extends the HELIOXEN desktop application with an optional, secure, and modular integration layer for approved Android devices and compatible smart-home gateways (Home Assistant and Matter REST).

The design strictly upholds the **Local-First, Security-First** principles of HELIOXEN:
1. **Device Isolation & Zero Shell Access:** Android communication is constrained to discrete argument vectors (`execFile`), eliminating shell string concatenation. Private personal data (SMS, contacts, photos, browsing history) is never read or stored.
2. **Three-Tier Risk Classification:** Smart-home actions are categorized into `read_only`, `reversible_action`, and `physical_security_consequential`.
3. **Mandatory Human Confirmation for Physical Access:** High-impact physical security operations (door unlock, garage door open, alarm disarm) strictly require an explicit human confirmation token with a 60-second Time-To-Live (TTL).
4. **Untrusted Entity Ingestion:** External entity names, states, and metadata are sanitized and treated as untrusted strings, preventing indirect prompt injection into LLM context.
5. **DPAPI Credential Protection:** All gateway access tokens and bearer secrets are encrypted on disk using HELIOXEN's DPAPI-backed `CredentialStorageService`.

---

## 1. Threat Model & Security Boundaries

```
+-------------------------------------------------------------------------------+
|                             HELIOXEN UI / RENDERER                           |
|  Integrations Hub -> Devices Tab (Android) | Smart-Home Tab (HA / Matter)     |
+---------------------------------------+---------------------------------------+
                                        | Context Bridge (helioxenApi)
                                        v
+-------------------------------------------------------------------------------+
|                       ELECTRON PRELOAD (Context Isolation)                    |
|       devicesApi.*                            smartHomeApi.*                  |
+---------------------------------------+---------------------------------------+
                                        | IPC Channels (Capability Checked)
                                        v
+-------------------------------------------------------------------------------+
|                           MAIN PROCESS CORE SERVICES                          |
|                                                                               |
|  [AndroidDeviceService]                      [SmartHomeService]              |
|  * ID Sanitization: Safe Regex               * DPAPI Encrypted Gateway Tokens |
|  * Allowlist: ping, battery, props,          * Entity Domain & State Registry |
|    screen_state, send_test_intent            * 60s Human Confirmation Token   |
|  * Discrete execFile (No Shell)              * Fail-Safe Uncertain Reporting  |
+-------------------+-----------------------------------+-----------------------+
                    |                                   |
                    v                                   v
+-----------------------------+       +-----------------------------------------+
|     ADB Bridge (Local)      |       |       Local Smart-Home Gateway          |
|  - Discrete argv tokens     |       |  - Home Assistant (REST API /api/states)|
|  - Bounded 5s timeout       |       |  - Matter Controller (REST /api)        |
+-----------------------------+       +-----------------------------------------+
```

### Risk Tiering Matrix

| Domain / Action Type | Classification | Human Confirmation | Reversibility | Failure Mode |
|---|---|---|---|---|
| Sensors (`temperature`, `humidity`, `power`) | `read_only` | None | N/A | Return cached state or report offline |
| Lighting (`turn_on`, `turn_off`, `set_brightness`) | `reversible_action` | Optional (Direct) | Fully Reversible | Mark state unchanged on timeout |
| Climate (`set_temperature`, `set_hvac_mode`) | `reversible_action` | Optional (Direct) | Fully Reversible | Keep existing setpoint |
| Securing Physical Controls (`lock`, `close`, `arm`) | `reversible_action` | Direct (Permitted) | Increases Security | Fail closed |
| Physical Access Controls (`unlock`, `open`, `disarm`)| `physical_security_consequential` | **Mandatory** (60s TTL Token) | Non-Reversible Access | Strictly block; report `uncertain` on timeout |

---

## 2. Android Device Integration

### 2.1 Allowlisted Diagnostic Actions

Only five explicitly allowlisted diagnostic actions are permitted:
1. `ping`: Verifies device connectivity, connection type (`usb` vs `wifi_pairing`), and returns round-trip latency.
2. `get_battery_status`: Queries non-sensitive battery level, charging status, temperature, and voltage.
3. `get_device_properties`: Reads manufacturer, model, Android OS version, SDK level, and security patch level.
4. `get_screen_state`: Inspects screen power state, interactive status, and keyguard lock status.
5. `send_test_intent`: Dispatches a bounded, safe test notification intent to HELIOXEN companion receiver (`org.helioxen.companion`).

### 2.2 Command Injection Defense

Device identifiers and serials are verified against `SAFE_DEVICE_ID_REGEX`:
```typescript
export const SAFE_DEVICE_ID_REGEX = /^[a-zA-Z0-9.:_-]{1,128}$/
```
All external ADB executions are invoked via discrete argument vectors:
```typescript
await adbExecutor(['-s', device.serialNumber, 'shell', 'dumpsys', 'battery'])
```
Shell concatenation (`adb shell "..."`) is strictly prohibited.

---

## 3. Smart-Home Controller & Security Confirmation

### 3.1 60-Second TTL Human Confirmation Workflow

1. Agent or user requests an action on a physical access device (e.g., `lock.front_door_deadbolt` with `unlock`).
2. `SmartHomeService.executeAction` identifies the action as `physical_security_consequential`.
3. If no confirmation token is present, execution is rejected with `CONFIRMATION_REQUIRED` and outcome `awaiting_confirmation`.
4. The system requests a confirmation token via `requestSecurityConfirmation`:
   - An ephemeral, single-use token is generated using `crypto.randomBytes(16)`.
   - The token has an expiration timestamp set to `now + 60000` (60 seconds).
5. The UI displays an explicit confirmation dialog showing:
   - Target device friendly name and entity ID
   - Requested command (`UNLOCK`, `OPEN`, `DISARM`)
   - 60-second real-time countdown
6. When the user clicks **Confirm**, `executeAction` is re-called with `confirmationToken`.
7. `SmartHomeService` validates the token, confirms it has not expired, executes the actuation, and immediately consumes/purges the token.

---

## 4. Capability Model and IPC Routing

| Channel | Capability Required | Risk Level |
|---|---|---|
| `devices:list-android` | `device:read` | Low |
| `devices:get-android-status` | `device:read` | Low |
| `devices:pair-android` | `device:pair` | Medium |
| `devices:disconnect-android` | `device:pair` | Medium |
| `devices:execute-android-action` | `device:action` | Medium |
| `smarthome:get-hub-status` | `smart_home:read` | Low |
| `smarthome:connect-hub` | `smart_home:control` | High |
| `smarthome:disconnect-hub` | `smart_home:control` | High |
| `smarthome:list-entities` | `smart_home:read` | Low |
| `smarthome:get-entity-state` | `smart_home:read` | Low |
| `smarthome:request-security-confirmation` | `smart_home:security_control` | Critical |
| `smarthome:execute-action` | `smart_home:control` / `smart_home:security_control` | Critical |

All IPC channels are registered with `assertValidSender(event)` to prevent unauthorized frame dispatch.

---

## 5. Built-in Tools Exposure

Five tools are registered into HELIOXEN's agent orchestration engine:
1. `device_get_android_status`: Read device battery, OS version, and connectivity.
2. `device_execute_android_action`: Execute bounded allowlisted actions.
3. `smarthome_list_entities`: Discover connected smart-home entities.
4. `smarthome_get_state`: Query entity state and attributes.
5. `smarthome_execute_action`: Execute smart-home commands with human confirmation guardrails.

---

## 6. Verification and Regression Testing

- `tests/devices/androidDeviceService.test.ts`: 18 tests covering ID validation, USB/wireless pairing, allowlisted actions, and injection prevention.
- `tests/smart-home/smartHomeService.test.ts`: 21 tests covering hub management, DPAPI credential storage, domain filtering, reversible environmental actuation, and 60-second TTL confirmation token lifecycle.

