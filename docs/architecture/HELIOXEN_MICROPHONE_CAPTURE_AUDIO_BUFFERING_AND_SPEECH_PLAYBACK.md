# HELIOXEN Architecture Document: Microphone Capture, Audio Buffering & Speech Playback

**Document ID:** `HELIOXEN-ARCH-STEP-19`  
**Version:** 1.0.0 (Step 19 of 48)  
**Phase:** Phase 7: Voice Input and Audio Interaction  
**Status:** Approved & Implemented  
**Date:** November 1, 2026  

---

## 1. Executive Summary & Architectural Scope

Step 19 establishes the local audio I/O foundation for HELIOXEN's desktop assistant, integrating with the persistent voice dock in the three-panel workspace. It implements explicit, user-initiated microphone capture, bounded in-memory PCM audio buffering, and local speech playback with immediate cancellation support.

To maintain strict security and clean architectural phase separation:
1. **Explicit User Activation:** The microphone remains strictly inactive at application startup and requires unambiguous user interaction (e.g. clicking the microphone trigger or selecting a device).
2. **Strict Phase Boundaries:** Real-time AI streaming voice sessions (Step 20) and wake-word / background listening (Step 21) are strictly prohibited and excluded.
3. **Zero Audio Persistence & Zero External Transmission:** Microphone audio is retained exclusively in volatile memory within a hard-bounded circular buffer for transient processing. Captured audio is never written to disk, database, telemetry logs, or external cloud networks.
4. **Decoupled Capture & Playback:** Capture and playback lifecycles are independent. A microphone failure does not corrupt playback state, and stopping playback does not alter microphone capture.

---

## 2. Process Boundaries & Security Architecture

HELIOXEN maintains strict Electron process isolation and security controls across all audio operations.

```
+-----------------------------------------------------------------------------------+
|                        RENDERER PROCESS (Command Center / UI)                     |
|                                                                                   |
|  +------------------------+  +--------------------------+  +-------------------+  |
|  | PersistentVoiceDock    |  | MicrophoneCaptureService |  | AudioBufferMgr    |  |
|  | - Mic trigger button   |  | - Web Audio API (16kHz)  |  | - Bounded FIFO    |  |
|  | - Real-time VU meter   |  | - AnalyserNode (RMS/VU)  |  | - 4MB memory cap  |  |
|  | - Device dropdown      |  | - ScriptProcessorNode    |  | - 30s max audio   |  |
|  | - Local speech test    |  +--------------------------+  +-------------------+  |
|  +------------------------+               |                          |            |
|               |                           v                          v            |
|               |              +--------------------------+                         |
|               |              | SpeechPlaybackService    |                         |
|               |              | - Local speechSynthesis  |                         |
|               |              | - Rate/pitch/voice ctrl  |                         |
|               |              | - Immediate cancellation |                         |
|               |              +--------------------------+                         |
+---------------+-------------------------------------------------------------------+
                |
                | contextBridge: window.helioxen.audio
                v
+-----------------------------------------------------------------------------------+
|                        PRELOAD BRIDGE (src/preload/index.ts)                      |
|  - Narrowly scoped typed audio APIs:                                              |
|    - getPermissionStatus(): Promise<AudioPermissionStatus>                        |
|    - getDevices(): Promise<AudioDeviceInfo[]>                                     |
|  - Validates all request shapes and IPC channels                                  |
+-----------------------------------------------------------------------------------+
                |
                | Typed IPC Channels: AUDIO_GET_PERMISSION_STATUS, AUDIO_GET_DEVICES
                v
+-----------------------------------------------------------------------------------+
|                        MAIN PROCESS (Privileged Host Runtime)                     |
|                                                                                   |
|  - Capabilities: audio:getPermissionStatus, audio:getDevices,                     |
|    audio:microphoneCapture (Authorizer verified)                                  |
|  - Electron session.setPermissionRequestHandler:                                 |
|    - Strictly allows audio-only media requests for mainWindow                     |
|    - Denies video and all unauthorized frames                                     |
|  - CSP Hardening: media-src 'self' data: blob:;                                   |
|  - System Preferences: Queries Windows microphone permission state               |
+-----------------------------------------------------------------------------------+
```

### 2.1 Content Security Policy & Permission Handlers
- **CSP Directive:** `media-src 'self' data: blob:;` allows local media streams and synthesizers without opening arbitrary network audio loading.
- **Permission Check & Request Handlers:** Electron's `session.defaultSession.setPermissionRequestHandler` validates that incoming requests originate strictly from `mainWindow` and request audio media (`details.mediaTypes.includes('audio')` without video).
- **Capability Policy:** `CapabilityAuthorizer` checks `audio:getPermissionStatus` and `audio:getDevices` before executing IPC calls.

---

## 3. Microphone Capture Lifecycle & State Machine

Microphone capture operates on a deterministic, non-overlapping state machine.

```
       +-------------------------------------------------------+
       |                                                       |
       v                                                       |
   [ IDLE ] --(startCapture)--> [ ACTIVATING ]                 |
       ^                             |                         |
       |                   +---------+---------+               |
       |                   |                   |               |
       |               (Success)            (Error)            |
       |                   |                   |               |
       |                   v                   v               |
       |             [ CAPTURING ]         [ ERROR ] ----------+
       |                   |                   ^
       |              (stopCapture)            |
       |                   |             (Device loss /
       |                   v              buffer limit)
       +-------------- [ STOPPING ] -----------+
```

### 3.1 State Definitions
| State | Description | UI Representation |
| :--- | :--- | :--- |
| `idle` | Microphone is inactive, hardware streams released. | Gray microphone icon, VU meter idle. |
| `activating` | Requesting permissions, enumerating device, starting AudioContext. | Amber pulsing icon, "Activating..." indicator. |
| `capturing` | Stream active, chunks streaming into circular buffer, VU active. | Emerald glowing icon, animated dynamic VU meter. |
| `stopping` | Media tracks ending, AudioContext nodes disconnecting. | Muted icon, "Stopping..." indicator. |
| `error` | Permission denied, device disconnected, or initialization failed. | Rose icon with accessible descriptive error badge. |

### 3.2 Device Selection & Disconnection Recovery
- **Device Enumeration:** Enumerates audio input hardware via `navigator.mediaDevices.enumerateDevices()`, filtering strictly by `kind === 'audioinput'`.
- **Selected Device Persistence:** The user may select a specific device ID from the UI.
- **Device Disconnection Event:** An `onended` handler attached to `MediaStreamAudioTrack` detects hardware unplugging or OS device revocation, cleanly stopping the session, zeroing buffers, and transitioning to an informative recoverable error state.

---

## 4. Audio Buffering Architecture & Resource Limits

Audio capture uses a bounded circular PCM buffer (`AudioBufferManager`) designed to protect desktop system memory.

### 4.1 Audio Stream Format Specifications
- **Audio Format:** 32-bit floating point PCM (`Float32Array`).
- **Sample Rate:** 16,000 Hz (16 kHz) — standard for high-fidelity speech recognition and acoustic analysis.
- **Channel Count:** 1 (Mono).
- **Process Chunk Size:** 2048 samples (~128ms per chunk) delivered by `ScriptProcessorNode`.
- **Acoustic Preprocessing:** `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true` requested on `getUserMedia`.

### 4.2 Resource Limits & Bounded Circular Retention
| Parameter | Limit | Behavioral Policy |
| :--- | :--- | :--- |
| **Max Retained Duration** | 30.0 seconds | FIFO eviction: oldest samples discarded as newer arrive. |
| **Max Memory Allocation** | 4.0 MB (1,048,576 samples) | Hard ceiling. Prevents unbounded memory growth. |
| **Chunk Retention Cap** | 1,000 chunks | Prevents fragmentation and excessive array allocations. |

### 4.3 Zero-Persistence & Memory Sanitization
- Microphone audio is retained **only in RAM**.
- No audio chunks are written to disk, SQLite, logs, or external networks.
- When `clear()` or `dispose()` is invoked, every allocated `Float32Array` in the buffer pool is explicitly overwritten with `0.0` before references are cleared, preventing sensitive voice residue in memory.

---

## 5. Speech Playback & Local Speech Synthesis

Local speech playback (`SpeechPlaybackService`) provides speech output without external cloud dependencies.

### 5.1 Local Speech Synthesis Pipeline
- **Engine:** Operating system speech synthesis via the Web Speech API (`window.speechSynthesis`).
- **Zero Cloud Network Call:** Voices are queried from the local operating system (e.g. Windows Speech API / SAPI5 / Windows Media voices). No external TTS APIs are invoked.
- **Parameters:**
  - `rate`: Clamped between 0.5x and 2.0x (default: 1.0x).
  - `pitch`: Clamped between 0.5x and 2.0x (default: 1.0x).
  - `volume`: Clamped between 0.0 and 1.0 (default: 1.0).
- **Concurrency & Cancellation:**
  - Invoking `speakText()` immediately cancels any active utterance before starting the new one.
  - Invoking `stop()` immediately calls `speechSynthesis.cancel()`, clears references, and transitions status to `stopped` without race conditions.

---

## 6. Persistent Voice Dock UI Integration

The persistent voice dock in the center workspace panel was extended with interactive audio controls:
1. **Interactive Microphone Trigger:** One-click activation with visual feedback for Idle, Activating, Capturing, Stopping, and Error.
2. **Dynamic 8-Segment Audio VU Meter:** Renders real-time audio energy level calculated from `RMS` values and `AnalyserNode` frequency data during capture.
3. **Audio Input Device Selector:** Custom dropdown allowing the user to view all available microphones and hot-switch active devices.
4. **Speech Playback Test Trigger:** Playback demo button to test local speech synthesis with instant cancellation.
5. **Accessible Guidance & Error Banners:** Shows clear, non-intrusive guidance when microphone permission is denied or devices are unavailable.

---

## 7. Automated Test Coverage & Verification

Automated testing is implemented in Vitest across four dedicated test suites:
- `tests/audio/audioBufferManager.test.ts` (6 tests):
  - Initialization, chunk append, duration and sample calculations.
  - Bounded duration and memory cap enforcement with FIFO eviction.
  - Audio metrics calculation (RMS, peak amplitude, decibels).
  - Memory sanitization (zeroing Float32Arrays on clear).
- `tests/audio/contracts.test.ts` (4 tests):
  - Validation of `AudioDeviceInfo`, `AudioBufferConfig`, `AudioMetrics`, and `AudioErrorDetails`.
- `tests/audio/microphoneCapture.test.ts` (6 tests):
  - State lifecycle transitions (`idle` -> `activating` -> `capturing` -> `stopping` -> `idle`).
  - Device enumeration and device selection.
  - Permission query and denied permission handling.
  - Device disconnection recovery.
  - Double activation idempotency.
- `tests/audio/speechPlayback.test.ts` (5 tests):
  - Local voice enumeration and utterance playback.
  - Rate, pitch, and volume boundary enforcement.
  - Mid-speech cancellation and resource cleanup.
  - Handling of empty strings and unsupported environments.

**Full Test Suite Result:** All 20 test files and 117 tests passing cleanly.
