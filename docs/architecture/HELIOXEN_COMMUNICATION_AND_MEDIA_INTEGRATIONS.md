# HELIOXEN AI — Architecture Guide: Communication & Media Integrations

## Phase 15, Step 44: Secure Communication Adapters, Messaging Workflows, Media Services, and Controlled External Actions

---

## 1. Executive Summary & Purpose

The **Communication and Media Integrations** subsystem provides HELIOXEN with a modular, secure, and user-governed foundation for interacting with external communication channels (Email via SMTP/IMAP, Team Chat webhooks) and authorized media streaming services (Spotify, Local Media controller).

External communication channels present critical security and trust boundaries. To eliminate prompt injection, unconfirmed spam/phishing, credential theft, and autonomous execution hazards, this subsystem adheres to non-negotiable security principles:
1. **Mandatory Human Send Confirmation:** The AI or automated workflows cannot unilaterally dispatch external messages. Every outbound message strictly requires human confirmation bound to a tamper-evident content hash with an ephemeral 60-second Time-To-Live (TTL).
2. **Post-Confirmation Tamper Defense:** Any modification to recipients, subject, body, or attachments after approval immediately invalidates the confirmation token.
3. **Prompt Injection Containment:** All inbound communication payloads are explicitly marked with `isUntrusted: true` and are structurally isolated from system prompts, preventing untrusted external content from commandeering agent execution.
4. **Hardware-Backed Credential Vault:** All API keys, client secrets, webhooks, and account tokens are encrypted at rest using Electron's native `safeStorage` (Windows DPAPI) and never logged in plaintext.
5. **Duplicate-Send Prevention:** Outbound sends track idempotency keys to protect users against accidental duplicate messages caused by UI re-submissions or network retries.

---

## 2. Core Architecture & Layering

```
+-----------------------------------------------------------------------------------+
|                            HELIOXEN RENDERER UI                                   |
|   +-----------------------+  +-------------------------+  +-------------------+   |
|   | Connectors Dashboard  |  | Communication Workspace |  | Media Controller  |   |
|   | (Auth Status, Health) |  | (Drafts, Two-Tier Send) |  | (Spotify / Local) |   |
|   +-----------------------+  +-------------------------+  +-------------------+   |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ [Preload Bridge with Context Isolation]
+-----------------------------------------------------------------------------------+
|                        ELECTRON MAIN PROCESS IPC LAYER                            |
|     assertValidSender() + Authorizer + Capability Checks ('communication:send')   |
+-----------------------------------------------------------------------------------+
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
+───────────────────────+  +───────────────────────────+  +─────────────────────────+
| IntegrationsManager   |  | CommunicationService      |  | MediaIntegrationService |
| - Adapter Catalog     |  | - Draft Management        |  | - Playback Controller   |
| - Credential Storage  |  | - Recipient Validation    |  | - Device Routing        |
| - Health Checks       |  | - Mandatory Send Confirm  |  | - Playlist Enumeration  |
| - Status Tracking     |  | - Hash Tamper Detection   |  | - Catalog Search        |
|                       |  | - Idempotency Prevention  |  |                         |
+───────────────────────+  +───────────────────────────+  +─────────────────────────+
        │                                │                                │
        ▼                                ▼                                ▼
+───────────────────────+  +───────────────────────────+  +─────────────────────────+
| DPAPI Vault           |  | Quarantined AI Draft      |  | Native System Audio &   |
| (safeStorage Encrypt) |  | (Human Review Proposals)  |  | Spotify Web API Layer   |
+───────────────────────+  +───────────────────────────+  +─────────────────────────+
```

---

## 3. Communication Security: The Two-Tier Confirmation Protocol

To safeguard external communications against malicious automation, prompt injection, and accidental dispatch, sending a message follows a mandatory two-tier state machine:

### Stage 1: Draft Creation & Content Hashing
1. User or AI drafts message content.
2. `CommunicationService.validateDraft` enforces valid recipient formats (`validateRecipientAddress`) and rejects unresolved placeholders (`detectUnresolvedPlaceholders`, e.g., `[name]`, `TODO`, `{{variable}}`).
3. `computeDraftHash` computes a SHA-256 digest over normalized recipients, subject, body, and attachment metadata.

### Stage 2: Ephemeral Authorization Request
1. User reviews the draft and initiates the send action.
2. `requestSendConfirmation(draftId)` checks that the draft is valid and connected.
3. Generates an ephemeral `SendConfirmationRequest` record with an authorization token, the exact `draftHash`, and a strict 60-second TTL.
4. Returns the confirmation request to the renderer modal for explicit human visual inspection.

### Stage 3: Two-Tier Confirmation & Dispatch
1. The UI displays the target account, recipient list, subject, draft hash, and full body with a real-time countdown.
2. When the user clicks "Authorize & Send", `confirmAndSend(request)` verifies:
   - Authorization token exists and is in `pending` status.
   - Token timestamp is not expired (`Date.now() <= expiresAt`).
   - Draft still exists and its current `contentHash` exactly matches `approvedDraftHash`. If the draft was edited in the background (Bait-and-Switch attack), the send is rejected with an auditable security alert.
   - Idempotency key hasn't already been processed.
3. Upon validation, the message is marked submitted, promoted to sent messages, the draft is removed, the confirmation token is consumed, and an audit event (`MESSAGE_SEND: PERMITTED`) is logged.

---

## 4. Media Integration & Playback Architecture

The `MediaIntegrationService` provides safe, non-DRM-circumventing control over media playback:
1. **Catalog Search:** Fast search over tracks, artists, and albums.
2. **Device Discovery:** Identifies authorized playback targets (`computer`, `smartphone`, `speaker`, `local_system`) with volume profiles.
3. **Playback State Inspection:** Real-time track progress, duration, volume percentage, shuffle, and repeat state.
4. **Granular Control Commands:** Supports `play`, `pause`, `skip_next`, `skip_previous`, `seek`, `set_volume`, and `select_device`.

---

## 5. Security Capabilities & Tool Catalog

The following fine-grained capabilities govern access:
- `integrations:read`: Inspect adapter catalog, health, and status.
- `integrations:manage`: Connect, disconnect, and configure integration credentials.
- `communication:read`: Query and read stored communication messages.
- `communication:draft`: Author, validate, and update message drafts.
- `communication:send`: High-risk capability requiring explicit human confirmation.
- `media_integration:read`: Search catalog, list devices, and inspect playback.
- `media_integration:control`: Dispatch playback control commands.

All capabilities are bound to the `Authorizer` in Electron's main process, rejecting unauthorized send calls from untrusted sources.

