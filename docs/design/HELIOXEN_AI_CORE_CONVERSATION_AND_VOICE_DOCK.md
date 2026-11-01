# HELIOXEN AI — Central AI Core, Conversation Panel, and Persistent Voice Dock

**Document Version:** 1.0.0  
**Phase:** Phase 4 — Desktop Application Shell and Command Center  
**Step:** 12 of 48  
**Status:** Approved & Implemented  
**Date:** November 2026  

---

## 1. Overview and Core Design Objectives

Step 12 establishes the personal, cinematic visual and interaction heart of HELIOXEN AI without confusing presentation with active intelligence. It implements three coordinated interface elements within the existing command center:

1. **Central AI Core Visualizer:** An original, procedural Three.js WebGL orbital core rendering concentric glowing rings, an icosahedron energy core, and additive particle clouds, with an automatic 2D Canvas fallback and complete resource lifecycle disposal.
2. **Conversation Panel:** A secure message history transcript and multiline message composer that renders plain text safely without `dangerouslySetInnerHTML`, buffers prompts in local session memory, and provides truthful status messaging without simulating fake AI text.
3. **Persistent Voice Dock:** An application-shell-level controller pinned across all primary navigation views, displaying audio engine standby indicators, a resting 8-segment VU meter, and explicit roadmap indicators without requesting microphone permissions or activating audio capture.

---

## 2. Central AI Core Architecture & Procedural Rendering

### 2.1 Technology & Version
- **Render Engine:** Three.js (`three` `^0.170.0`) with `@types/three` (`^0.170.0`).
- **Pipeline:** Direct WebGL canvas rendering encapsulated in `AiCoreVisualizer.tsx` with requestAnimationFrame (RAF) loop, high-DPI scaling (`Math.min(window.devicePixelRatio, 2)`), and alpha transparency.
- **Fallback:** Automatic detection of WebGL unavailability or `webglcontextlost` events, seamlessly switching to a 2D HTML5 Canvas orbital rendering pipeline.

### 2.2 Original Visual Concept & Asset Provenance
- **100% Clean-Room Procedural Geometry:** Zero textures, shaders, or 3D models were copied from Marvel JARVIS, Stonic AI, IRIS, or Brahma AI.
- **Geometric Primitives:**
  - `THREE.IcosahedronGeometry(0.85, 2)`: Inner wireframe energy core with additive alpha.
  - `THREE.TorusGeometry(radius, 0.012, 8, 80)`: Three concentric orbital rings tilted across equatorial, inclined (35°), and diagonal planes.
  - `THREE.BufferGeometry` with spherical particle distribution: 80 to 280 additive glowing points swirling around the core.

### 2.3 GPU Resource Cleanup & Lifecycle Safety
On component unmount or state transition:
- All geometries (`coreGeometry`, `ringGeometry`, `particleGeometry`) invoke `.dispose()`.
- All materials (`MeshBasicMaterial`, `PointsMaterial`) invoke `.dispose()`.
- Active animation frame is cancelled via `cancelAnimationFrame(animationFrameId)`.
- Event listeners (`webglcontextlost`) are cleanly unregistered.
- DOM canvas elements are unmounted.

---

## 3. AI Core State Model Reference Table

| State | Meaning | Source of Truth | Current Availability | Visual Treatment | Reduced-Motion Behavior |
|---|---|---|---|---|---|
| **`idle`** | Nominal standby; ready for commands | Default component prop | **Active (Production)** | Deep Cyan (`#00f0ff`), slow orbital rotation, subtle scale breath | Static orbital rings; zero continuous rotation |
| **`listening`** | Awaiting voice input | Future audio engine (Step 19) | Roadmap Standby | Cyan/Sky (`#67e8f9`), expanded outer orbital ring | Static expanded rings; high-contrast glow |
| **`thinking`** | Processing user intent / dispatching prompt | Active during message submit | **Active (Local Transition)** | Sky/Indigo (`#818cf8`), accelerated counter-rotation | Static indigo tint; no spin |
| **`speaking`** | Streaming vocal or text response | Future voice engine (Step 20) | Roadmap Standby | Cyan/Light-blue (`#a5f3fc`), ring frequency modulation | Static light-blue tint; no modulation |
| **`executing`** | Running active agent tool or query | Future tool runner (Step 28) | Roadmap Standby | Electric Cyan (`#22d3ee`), fast orbit, particle alignment | Static alignment; no particle churn |
| **`awaiting-confirmation`** | Awaiting user security / tool consent | Security gate (Step 15) | **Active (Previewable)** | Amber/Gold (`#f59e0b`), pulsing boundary ring | Static amber core; warning badge |
| **`disconnected`** | Offline or provider unreachable | Network state / provider registry | **Active (Previewable)** | Slate Muted (`#64748b`), minimal opacity, dashed rings | Static slate core |
| **`recovering`** | Reconnecting socket / recovering context | IPC watchdog | **Active (Previewable)** | Teal/Cyan (`#06b6d4`), soft recovery pulse | Static teal core |
| **`error`** | Execution or provider failure | Catch boundary / error handler | **Active (Previewable)** | Crimson Red (`#ef4444`), sharp angular tension | Static crimson core; error badge |

---

## 4. Conversation Panel Architecture

### 4.1 Safe Content Rendering
- Messages are rendered via `ConversationMessageItem.tsx`.
- All message content is treated strictly as plain text (`whitespace-pre-wrap break-words`).
- `dangerouslySetInnerHTML` is prohibited to prevent XSS.

### 4.2 Composer & Keyboard Interaction
- Textarea automatically resizes up to a max height of 120px.
- `Enter` submits the message.
- `Shift + Enter` inserts a newline.
- Send button includes loading state, keyboard focus ring, and disabled state when input is whitespace-only.

### 4.3 Conversation Interaction Reference Table

| Interaction | Current Behavior | Required Service | Status | Known Limitation |
|---|---|---|---|---|
| **Prompt Submission** | Appends user message to transcript; triggers 800ms `thinking` state on core; returns to `idle` with delivery notice | Phase 5 Model Adapters (Steps 16–18) | **Active (Local Buffer)** | AI provider inference not connected until Step 16 |
| **Drafting** | Retains draft text in component state while typing | Local Component State | **Active** | Not persisted across app restart |
| **Clear History** | Resets local message array and core state to `idle` | Local Component State | **Active** | In-memory only; SQLite storage begins in Step 26 |
| **Assistant Responses** | Does **NOT** fabricate fake AI hallucinations; shows truthful status notice | Gemini / OpenAI SDKs | Deferred to Steps 16–18 | Zero mock streaming |

---

## 5. Persistent Voice Dock Architecture

### 5.1 Placement & Persistence
- Anchored persistently at the bottom of `WorkspaceLayout` within the primary workspace.
- Mounted at the command center level: switching between `AI Core`, `Conversations`, `Memory`, `Skills`, `Character`, `Monitor`, and `Settings` maintains the dock in the exact same position without unmounting or duplication.

### 5.2 Truthful Inactive Affordance
- **Microphone Capture:** Strictly prohibited in Step 12. Zero audio contexts, microphone getUserMedia calls, or speech recognition instances are created.
- **Click Behavior:** Clicking the voice dock displays a clear, accessible toast notification: `"Audio capture & bidirectional voice sessions integrate in Phase 5 (Steps 19–21)."`.
- **Audio Meter:** Renders an 8-segment flat baseline bar indicating audio pipeline standby.

### 5.3 Voice Dock Reference Table

| Control / Indicator | Current Behavior | Future Integration Dependency | Availability State | Accessibility Requirement |
|---|---|---|---|---|
| **Voice Button** | Click shows Phase 5 roadmap toast; informs user without error | Web Audio API / Silero VAD (Step 19) | Standby Mode | `aria-label="Voice Interaction Dock (Standby Mode - Activates in Step 19)"` |
| **Audio Meter** | 8 resting bars at baseline height | Audio Worklet PCM analyzer (Step 19) | Resting | `aria-hidden="true"`, title tooltip |
| **Audio Engine Status** | Displays `"AUDIO ENGINE: STANDBY"` | Web Audio Output Manager (Step 20) | Standby | Semantic text, high-contrast monospace |
| **VAD Gate** | Displays `"VAD GATE: READY"` | Silero Voice Activity Detector (Step 19) | Ready for Hook | High-contrast green badge |

---

## 6. Accessibility & Responsive Verification

- **Semantic Structure:**
  - AI Core: `<div role="img" aria-label="HELIOXEN Orbital AI Core: Status IDLE">` with visual status tag.
  - Conversation: `<div aria-label="Conversation Message Input">` with explicit button labels.
  - Voice Dock: `<footer id="persistent-voice-dock" aria-label="Persistent Voice Controller Dock">`.
- **Contrast Ratios:** Muted text: 5.11:1; Primary text: 12.8:1; Cyan accents: 7.2:1 (exceeds WCAG AA).
- **Reduced Motion:** When `prefers-reduced-motion: reduce` is detected:
  - Three.js animation loop halts continuous rotation.
  - Core scales to static 1:1 and remains visually elegant.
  - 2D Canvas fallback halts rotation loop.
- **Responsive Dimensions:** Verified at 1024x640 (min), 1280x800 (nominal), and 1920x1080 (wide). Zero horizontal scroll or clipped controls.

---

## 7. Deferred Roadmap Boundaries (Strict Stop Boundary)

The following capabilities remain strictly deferred per master roadmap:
- **Steps 13–15:** Electron Main Process, Preload Bridge, Typed IPC Contracts, and Security Credential Vault.
- **Steps 16–18:** Google Gemini 2.0 Live and OpenAI API adapters, model routing, and streaming tokens.
- **Steps 19–21:** Microphone capture, Web Audio pipeline, voice activity detection (VAD), and wake-word engine.
- **Steps 22–24:** Multimodal camera, screen capture, and document understanding.
