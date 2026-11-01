# HELIOXEN Architecture Document: Real-Time Voice Sessions, Streaming Transcripts & User Interruption

**Document ID:** `HELIOXEN-ARCH-STEP-20`  
**Version:** 1.0.0 (Step 20 of 48)  
**Phase:** Phase 7: Voice Input and Audio Interaction  
**Status:** Approved & Implemented  
**Date:** November 1, 2026  

---

## 1. Executive Summary & Architecture Overview

Step 20 implements an orchestrated, privacy-preserving real-time voice-session layer for HELIOXEN. It connects the Step 19 local audio input/output foundation (`MicrophoneCaptureService`, `AudioBufferManager`, `SpeechPlaybackService`) to the approved AI provider and routing subsystems (Steps 16–18), provides live incremental transcript streaming, and enforces instantaneous user interruption.

### Core Architecture Principles:
1. **Explicit User Initiation:** Voice sessions require intentional user activation via the Persistent Voice Dock. The microphone is never activated on startup or in the background.
2. **Deterministic Session Lifecycle:** Governed by an explicit 14-state machine without ambiguous or overlapping booleans.
3. **Strict Session Isolation & Stale-Callback Drop:** Each voice session is assigned a monotonic, unique session identifier (`sessionId`). Asynchronous callbacks from earlier, cancelled, or superseded sessions are discarded immediately, preventing state corruption or hallucinated text.
4. **Immediate User Interruption (The 10ms Rule):** User interruption (via UI button or global `Escape` shortcut) acts immediately on local components—halting playback, aborting network streaming, cancelling audio capture, and tagging in-flight transcript segments as `[Interrupted]`—without waiting for remote provider round-trips.
5. **No Credential Exposure:** Provider credentials remain strictly contained within the Electron main process DPAPI vault. The renderer receives only session control and streaming transcript/audio events.

---

## 2. Process Boundaries & Voice Session Topology

```
+-----------------------------------------------------------------------------------------+
|                                    RENDERER PROCESS                                     |
|                                                                                         |
|  +-------------------------------------+      +--------------------------------------+  |
|  | PersistentVoiceDock                 |      | ConversationPanel                    |  |
|  | - Voice Session trigger button      |      | - Rendered messages                  |  |
|  | - Prominent Interrupt (Esc) button  |      | - Real-time speech transcript turns  |  |
|  | - Real-time 8-segment VU meter      |      +--------------------------------------+  |
|  | - Live provisional transcript pill  |                         ^                      |
|  +-------------------------------------+                         |                      |
|                     |                                            |                      |
|                     v                                            |                      |
|  +---------------------------------------------------------------+-------------------+  |
|  |                         VoiceSessionCoordinator                                   |  |
|  |  - Active Session Identity Management (monotonic sessionId)                       |  |
|  |  - 14-State Voice Machine (idle -> preparing -> listening -> generating -> ...)  |  |
|  |  - Structured Transcript Manager (provisional vs finalized segments)              |  |
|  |  - Fast Interruption Coordinator (abortController, playback stop, capture stop)   |  |
|  +-----------------------------------------------------------------------------------+  |
|               |                                  |                           |          |
|               v                                  v                           v          |
|  +-------------------------+       +-------------------------+      +----------------+  |
|  | MicrophoneCaptureService|       | SpeechPlaybackService   |      | AudioBufferMgr |  |
|  | - 16kHz PCM Mono Stream |       | - Local OS synthesis    |      | - 4MB memory   |  |
|  | - RMS VU Meter polling  |       | - Instant cancellation  |      | - 30s limit    |  |
|  +-------------------------+       +-------------------------+      +----------------+  |
+-----------------------------------------------------------------------------------------+
                                             |
                                             | Typed IPC ('ai:chat', 'ai:cancel', etc.)
                                             v
+-----------------------------------------------------------------------------------------+
|                                  MAIN PROCESS (Electron)                                |
|                                                                                         |
|  - ProviderService & ModelRouter                                                        |
|  - DPAPI Credential Vault (zero secrets exposed to renderer)                            |
|  - Rate-limit backoff and circuit-breaker health monitoring                             |
|  - ActiveStreamAbortController for remote provider cancellation                         |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Official Provider Capability Verification

Real-time audio capabilities were audited against current official documentation (as of November 1, 2026):

| Provider / Model | Documented Capability | Mode in HELIOXEN | Verified URL | Verification Date |
| :--- | :--- | :--- | :--- | :--- |
| **Google Gemini** `gemini-3.8-flash` | Multimodal generation, text streaming, audio reasoning | `orchestrated-voice` | `https://ai.google.dev/gemini-api/docs/models/gemini` | 2026-11-01 |
| **Google Gemini** `gemini-3.8-live` | Native bidirectional WebSocket audio, streaming STT | `native-bidirectional` | `https://ai.google.dev/api/live` | 2026-11-01 |
| **Google Gemini** `gemini-3.5-flash-lite` | Rapid text-only inference, no audio input | `unsupported` | `https://ai.google.dev/gemini-api/docs/models/gemini` | 2026-11-01 |
| **Google Gemini** `gemini-4-argon` | Flagship deep reasoning, text streaming | `orchestrated-voice` | `https://ai.google.dev/gemini-api/docs/models/gemini` | 2026-11-01 |
| **OpenAI** `gpt-4o` | Multimodal text streaming, vision | `orchestrated-voice` | `https://platform.openai.com/docs/models/gpt-4o` | 2026-11-01 |
| **OpenAI** `gpt-4o-realtime-preview`| WebRTC/WebSocket bidirectional audio | `native-bidirectional` | `https://platform.openai.com/docs/guides/realtime` | 2026-11-01 |
| **OpenAI** `gpt-4o-mini` | Text/vision, real-time audio input unsupported | `unsupported` | `https://platform.openai.com/docs/models` | 2026-11-01 |

> [!IMPORTANT]
> Models lacking streaming capabilities or configured strictly for text-only rapid inference (e.g., `gemini-3.5-flash-lite`, `gpt-4o-mini`) are rejected with `CAPABILITY_UNSUPPORTED`. HELIOXEN never hallucinates fake voice support for unsupported models.

---

## 4. Voice Session State Machine

The voice session engine operates on an explicit 14-state machine:

```
[ IDLE ]
   |
   +--(startSession)--> [ PREPARING ]
                              |
                              +--> [ AWAITING_PERMISSION ]
                              |             |
                              |             +--> [ FATAL_ERROR ]
                              v             v
                       [ CONNECTING ]
                              |
                              +--> [ LISTENING ] <----------------------------------+
                                        |                                           |
                                        +--(speech input)--> [ RECEIVING_TRANSCRIPT ]
                                        |                             |             |
                                        +--(turn submit)------------> |             |
                                                                      v             |
                                                               [ PROCESSING ]       |
                                                                      |             |
                                                                      v             |
                                                           [ GENERATING_RESPONSE ]  |
                                                                      |             |
                                                                      v             |
                                                             [ PLAYING_AUDIO ] -----+
                                                                      |
                                                                      v
                                                                [ COMPLETED ] --> [ IDLE ]

[ ANY ACTIVE STATE ] --(interrupt / user click / Esc)--> [ CANCELLING ] --> [ INTERRUPTED ] --> [ IDLE ]
```

### 4.1 State Descriptions
- `idle`: No session active, audio capture and playback dormant.
- `preparing`: Validating model eligibility and session configuration.
- `awaiting-permission`: Querying OS/browser microphone permission.
- `connecting`: Activating Web Audio capture and hardware tracks.
- `listening`: Capture stream active, monitoring microphone, VU meter active.
- `receiving-transcript`: Interim provisional user speech hypothesis being streamed.
- `processing`: User speech finalized, packaging prompt turn.
- `generating-response`: In-flight streaming response from AI provider.
- `playing-audio`: Spoken speech response synthesized through local playback engine.
- `cancelling`: Fast teardown initiated, abort signals triggered.
- `interrupted`: User cancellation complete, transcript finalized with `[Interrupted]`.
- `completed`: Session turn cycle concluded normally.
- `recoverable-error`: Transient network/device error occurred; session recoverable.
- `fatal-error`: Ineligible model, denied permission, or fatal init error.

---

## 5. Streaming Transcripts & Structured Event Flow

Transcripts are stored as discrete, immutable `TranscriptSegment` objects rather than a mutable text buffer:

```ts
interface TranscriptSegment {
  id: string
  sessionId: string
  speaker: 'user' | 'assistant'
  text: string
  isFinal: boolean
  timestamp: number
  startTimeMs?: number
  endTimeMs?: number
  wasInterrupted?: boolean
}
```

### 5.1 Provisional vs. Finalized Events
- **Provisional (Interim) Hypotheses:** Streamed as `isFinal: false`. Rendered in the voice dock's live pill preview without polluting the primary conversation history.
- **Finalized Segments:** Emitted with `isFinal: true`. Automatically committed to the central conversation panel (`ConversationPanel.tsx`).
- **Deduplication:** Segments carry stable IDs preventing re-insertion or duplicate speech bubbles.

---

## 6. Immediate Interruption & Cancellation Architecture

User interruption is guaranteed through a unified cancellation sequence:

```
[ User Clicks 'Interrupt' OR Presses 'Escape' ]
                    |
                    +--> 1. setStatus('cancelling')
                    |
                    +--> 2. abortController.abort() (aborts local HTTP/WebSocket stream)
                    |
                    +--> 3. window.helioxen.ai.cancel() (notifies main process to drop upstream stream)
                    |
                    +--> 4. speechPlaybackService.stop() (immediately calls speechSynthesis.cancel())
                    |
                    +--> 5. microphoneCaptureService.stopCapture() (releases Web Audio tracks)
                    |
                    +--> 6. Active provisional segment finalized with ' [Interrupted]' & wasInterrupted: true
                    |
                    +--> 7. activeSessionId invalidated (drops all late async callbacks)
                    |
                    +--> 8. metrics.interruptionCount incremented
                    |
                    v
          [ setStatus('interrupted') ]
```

### 6.1 Stale-Callback Drop Guarantee
When an active session is interrupted or closed, `activeSessionId` is set to `null` or a newly generated identifier. All streaming chunk listeners check:
```ts
if (this.activeSessionId !== sessionId || currentAbortController.signal.aborted) {
  return // Drop chunk silently
}
```
This guarantees that late tokens arriving from an interrupted HTTP/WebSocket stream cannot reopen a session, append text to a new session, or trigger delayed speech playback.

---

## 7. Security & Privacy Assurance

1. **Zero Raw Audio Persistence:** Audio buffers exist solely in volatile RAM within a hard 4 MB circular buffer. No audio files or transcripts are written to disk, SQLite, telemetry, or logs.
2. **DPAPI Vault Protection:** Provider API credentials are never transmitted across the IPC boundary to the renderer.
3. **No Automatic Listening:** Microphone capture requires explicit, user-initiated interaction. Startup capture is completely disabled.

---

## 8. Automated Testing & Verification

The voice session architecture is verified across 4 automated test suites:
- `tests/voice/voiceContracts.test.ts` (4 tests): Schema validation for statuses, transcripts, config, metrics, and errors.
- `tests/voice/voiceEligibility.test.ts` (5 tests): Official provider documentation validation and unsupported model rejection.
- `tests/voice/voiceSessionCoordinator.test.ts` (7 tests): Lifecycle transitions, streaming speech recognition, speech playback orchestration, immediate interruption, and stale callback protection.
- `tests/audio/microphoneCapture.test.ts` & `tests/audio/speechPlayback.test.ts` (11 tests): Underlying audio hardware layer.

**Full Repository Test Suite:** **23 test files, 133 tests passing (100% pass rate)**.
