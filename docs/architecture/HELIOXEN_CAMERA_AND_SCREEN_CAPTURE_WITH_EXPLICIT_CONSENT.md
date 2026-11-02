# HELIOXEN Architecture Specification: Camera and Screen Capture with Explicit Consent

**Project:** HELIOXEN AI  
**Roadmap Phase:** Phase 8 — Multimodal Input and Context  
**Step:** 22 of 48  
**Architecture Document:** `docs/architecture/HELIOXEN_CAMERA_AND_SCREEN_CAPTURE_WITH_EXPLICIT_CONSENT.md`  
**Security Level:** High (Explicit User Consent, Ephemeral Volatile Memory, Zero Passive Surveillance)

---

## 1. Capture Architecture Overview

HELIOXEN's visual capture subsystem provides strictly user-initiated, on-demand acquisition of still images from connected camera devices and desktop display sources (screens and application windows).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HELIOXEN Renderer Process                             │
│                                                                                 │
│   ┌──────────────────────────┐             ┌────────────────────────────────┐   │
│   │   ConversationComposer   │ ──Triggers──▶│       MediaCaptureModal        │   │
│   │ [Camera] [Screen] Buttons│             │ Live Preview / Source Selector │   │
│   └─────────────▲────────────┘             └────────────────┬───────────────┘   │
│                 │ Staged Attachment                         │ Capture Frame     │
│   ┌─────────────┴────────────┐             ┌────────────────▼───────────────┐   │
│   │  ConversationMessageItem │             │    MediaCaptureCoordinator     │   │
│   │ Visual Attachment Preview│             │  State Machine & Discard Mgr   │   │
│   └──────────────────────────┘             └───────┬──────────────┬─────────┘   │
│                                                    │              │             │
│                    ┌───────────────────────────────┘              │             │
│                    ▼                                              ▼             │
│     ┌─────────────────────────────┐              ┌────────────────────────────┐ │
│     │    CameraCaptureService     │              │    ScreenCaptureService    │ │
│     │ navigator.mediaDevices.     │              │ navigator.mediaDevices.    │ │
│     │ getUserMedia({ video })     │              │ getUserMedia(desktop)      │ │
│     └─────────────────────────────┘              └─────────────┬──────────────┘ │
└────────────────────────────────────────────────────────────────┼────────────────┘
                                                                 │ IPC Request
┌────────────────────────────────────────────────────────────────▼────────────────┐
│                         Electron Context Isolation Bridge                       │
│    window.helioxen.capture.getDesktopSources(types)                            │
│    window.helioxen.capture.checkPermission(mediaType)                           │
└────────────────────────────────┬────────────────────────────────────────────────┘
                                 │ Typed IPC: CAPTURE_GET_DESKTOP_SOURCES
┌────────────────────────────────▼────────────────────────────────────────────────┐
│                           Electron Main Process                                 │
│   - desktopCapturer.getSources({ types, thumbnailSize: { 320, 180 } })         │
│   - session.setPermissionRequestHandler: Verifies origins and permits media     │
│   - session.setPermissionCheckHandler: Verifies local file origin              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Camera Permission and Activation Flow

Camera access adheres to strict zero-passive surveillance principles:

1. **No Startup Activation:** Camera devices are never enumerated or opened at startup or during background operation.
2. **User Explicit Intent:** Access is only triggered when the user explicitly clicks the camera button in the conversation dock.
3. **Permission Interception:** Electron main process verifies that only the secure local application window origin can request video devices.
4. **Device Enumeration:** `navigator.mediaDevices.enumerateDevices()` queries only videoinput devices.
5. **Live Preview Surface:** The media stream is mounted into a local `<video>` element for real-time visual alignment. An explicit warning badge (`CAMERA ACTIVE`) is displayed.
6. **Snapshot Freeze:** When the user clicks `Capture Snapshot`, the current frame is drawn to an offscreen `<canvas>`, scaled down if exceeding 1920x1080, and encoded as a JPEG data URL.
7. **Immediate Track Release:** All `MediaStreamTrack` instances are immediately stopped via `track.stop()`, releasing the camera hardware and extinguishing the webcam hardware indicator LED.

---

## 3. Screen and Window Source-Selection Flow

Screen and display capture leverages Electron's `desktopCapturer` API paired with Chromium's `chromeMediaSource` constraint:

1. **Preload IPC Request:** The renderer invokes `window.helioxen.capture.getDesktopSources(['screen', 'window'])`.
2. **Main Process Execution:** The main process queries `desktopCapturer.getSources({ types, thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true })`.
3. **Visual Source Picker:** Sources are rendered in a clean, accessible grid with live thumbnail previews and titles, distinguishing whole screens from individual application windows.
4. **Source Selection:** The user selects the intended display source.
5. **Stream Acquisition:** The renderer requests `getUserMedia` with `chromeMediaSource: 'desktop'` and `chromeMediaSourceId: source.id`.
6. **Snapshot Capture:** The selected frame is captured to canvas, checked against memory ceilings (4 MB), and staged.
7. **Immediate Stream Cleanup:** All screen tracks are terminated as soon as the snapshot is captured or if the modal is dismissed.

---

## 4. Official Platform & Electron Documentation Consulted

The implementation aligns with official Electron and Web Media Capture specifications:
- **Electron `desktopCapturer` Documentation:** `desktopCapturer.getSources(options)` API guidelines for Electron 33+.
- **Electron Security Recommendations:** Enforcing `contextIsolation: true`, `nodeIntegration: false`, and preventing renderer access to raw system APIs.
- **W3C Media Capture and Streams:** `navigator.mediaDevices.getUserMedia()` track lifecycle and idempotent track termination via `MediaStreamTrack.stop()`.
- **W3C HTML Canvas 2D Context:** `CanvasRenderingContext2D.drawImage()` and `HTMLCanvasElement.toDataURL()` format and quality compression standards.

---

## 5. Supported Operating Systems & Platform Differences

- **Windows 10/11:** Fully supported. Displays screens and windows with thumbnail previews. Camera enumeration and video acquisition standard via Media Foundation.
- **macOS (Sonoma, Sequoia):** Supported. Screen capture requires system Screen Recording permission in System Settings -> Privacy & Security. Camera capture requires Camera permission.
- **Linux (X11 / Wayland):** X11 fully supports window and screen capture. On Wayland sessions, `desktopCapturer` utilizes PipeWire portal source picker as supported by Chromium/Electron.

---

## 6. Capture Lifecycle & State Machine

The capture lifecycle is strictly managed by `MediaCaptureCoordinator`:

```
               ┌────────────────────────┐
               │          IDLE          │
               └───────────┬────────────┘
                           │ User selects Camera / Screen
               ┌───────────▼────────────┐
               │  AWAITING-PERMISSION / │
               │    SELECTING-SOURCE    │
               └───────────┬────────────┘
                           │ Stream acquired
               ┌───────────▼────────────┐
         ┌────▶│       PREVIEWING       │◀────┐
         │     └───────────┬────────────┘     │
         │                 │ User confirms snapshot
         │     ┌───────────▼────────────┐     │ Retake
         │     │       CAPTURING        │     │
         │     └───────────┬────────────┘     │
         │                 │ Offscreen canvas drawn & tracks stopped
         │     ┌───────────▼────────────┐     │
         └─────┤         STAGED         ├─────┘
               └───────────┬────────────┘
                           │ Confirm / Attach or Discard
               ┌───────────▼────────────┐
               │     STOPPING / IDLE    │
               └────────────────────────┘
```

---

## 7. Image Representation & Validation

The unified captured image contract is defined in `src/shared/capture/types.ts`:

```typescript
export interface CapturedStillImage {
  readonly id: string
  readonly sourceType: 'camera' | 'screen' | 'window'
  readonly sourceLabel?: string
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  readonly width: number
  readonly height: number
  readonly byteSize: number
  readonly timestamp: number
  readonly dataUrl: string
}
```

Validation rules enforced by `CapturedStillImageSchema`:
- Positive integer dimensions bounded by `maxWidth` (1920) and `maxHeight` (1080).
- Payloads bounded by `maxSizeBytes` (4,194,304 bytes / 4 MB).
- Mandatory `dataUrl` prefixed by `data:image/`.

---

## 8. Memory Limits & Temporary Data Handling

1. **Volatile Memory Only:** Still frames exist exclusively in renderer component state. No image files are written to disk, `%TEMP%`, or cache directories.
2. **Proportional Rescaling:** Oversized screens (e.g. 4K 3840x2160) are automatically rescaled to fit within 1920x1080 while strictly preserving the aspect ratio.
3. **JPEG Encoding at 0.88 Quality:** Balances crisp visual detail for text/code legibility with compact byte size (typically 120 KB – 400 KB).
4. **Immediate Stream Disposal:** Hardware video tracks are stopped immediately upon taking a snapshot.

---

## 9. Cancellation & Resource Cleanup

- **Modal Dismissal / Escape Key:** `MediaCaptureCoordinator.cancelCapture()` stops all camera and screen tracks, sets `srcObject = null`, and resets internal state to `idle`.
- **Image Discard:** `discardStagedImage()` removes all references to the image data URL, enabling immediate garbage collection.
- **Application Teardown:** Main process IPC handlers are removed in `app.on('will-quit')`.

---

## 10. AI-Provider Handoff & Consent Boundaries

- **Separation of Capture and Transmission:** Capturing an image or previewing a screen does NOT transmit data to any AI service.
- **Vision Capability Verification:** When a message with an attached image is submitted, `CommandCenter` inspects the active model's capability profile (`CURATED_MODELS[modelId].capabilities.modelLevel.imageInput`).
- **Text-Only Safeguard:** If the active model does not support image inputs, HELIOXEN presents an explicit capability notice and retains the image safely in local session memory without sending it over the wire.

---

## 11. Automated Test Coverage

The Step 22 implementation is verified across 4 dedicated test suites and the full project regression suite:

1. `tests/capture/captureContracts.test.ts` (9 tests):
   - Zod schemas for source types, session statuses, display sources, and error codes.
   - Enforcing dimension (1920x1080) and memory limit (4 MB) validation.
2. `tests/capture/cameraCaptureService.test.ts` (6 tests):
   - Inactive startup verification.
   - Device enumeration and explicit preview activation.
   - Track termination and canvas frame snapshotting with resolution bounding.
3. `tests/capture/screenCaptureService.test.ts` (4 tests):
   - Electron `chromeMediaSource` constraint construction.
   - Track termination on stop and source querying.
4. `tests/capture/mediaCaptureCoordinator.test.ts` (5 tests):
   - State machine transitions, retake, discard, and cancellation.

**Total Project Tests Passing:** 186/186 tests across 32 test files.
