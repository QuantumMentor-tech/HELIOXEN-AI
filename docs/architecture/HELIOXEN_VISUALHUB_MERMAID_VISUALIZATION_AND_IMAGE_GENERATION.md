# HELIOXEN ARCHITECTURE: VISUALHUB, MERMAID VISUALIZATION, AND AI IMAGE GENERATION (STEP 37)

**Project:** HELIOXEN AI Assistant  
**Roadmap Phase:** Phase 13 — Visual Intelligence and Information Interfaces  
**Step:** 37 of 48  
**Status:** Implemented & Verified  

---

## 1. Architectural Overview

**VisualHub** (`src/shared/visual/`, `src/main/visual/`, `src/renderer/src/components/visual/`) is HELIOXEN's dedicated visual authoring and generation workspace. It integrates three tightly governed capabilities inside a unified desktop experience:

1. **Diagram Studio (Mermaid Authoring, Validation & Safe Export):**
   - Supports 7 core Mermaid diagram types (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`, `gantt`, `mindmap`) with starter templates (`BUILTIN_MERMAID_TEMPLATES`).
   - Enforces a strict security and complexity validation pipeline (`validateAndRenderMermaidDiagram`) before producing sanitized, script-free `<svg>` markup.
   - Persists diagram documents locally per user profile (`saveDiagramDocument`, `listDiagramDocuments`, `deleteDiagramDocument`) and exports `.mmd`, `.svg`, and `.png` files safely (`exportDiagram`) or directly into the Step 36 Media Gallery (`saveDiagramPngToGallery`).

2. **Image Studio (Capability-Aware AI Image Generation):**
   - Queries verified image model capability descriptors (`VERIFIED_IMAGE_MODEL_CAPABILITIES`) across approved AI provider adapters (`GeminiAdapter.generateImage`, `OpenAiAdapter.generateImage`) via `ProviderService.generateImage`.
   - Dynamically adapts UI and schema validation to model-supported aspect ratios, resolutions, rendering qualities, output formats (`image/png`, `image/jpeg`, `image/webp`), transparent backgrounds, and reference-image inputs.
   - Requires explicit user acknowledgment (`externalTransmissionConfirmed: true`) before transmitting prompts or reference images externally, screens prompts against secret/credential leakage (`inspectMemorySafetyPolicy`), and tracks deterministic job states (`preparing_request`, `waiting_for_provider`, `generating`, `receiving_result`, `preparing_preview`, `completed`, `failed`, `cancelled`, `outcome_unknown`).

3. **Explicit Media Gallery Integration:**
   - Generated images are held as bounded session candidates (`TemporaryGeneratedImageCandidate`) after passing binary magic-byte header verification (`inspectMediaFileBuffer`).
   - Images are persisted into the Step 36 `MediaLibraryService` **only** when the user explicitly triggers `saveGeneratedImageToGallery` (or `saveDiagramPngToGallery`), recording `sourceType: 'ai_generated_image'` or `'exported_diagram'` and full provider/model provenance.

---

## 2. Mermaid Security & Complexity Enforcement

Mermaid definitions are treated as untrusted input. `DEFAULT_MERMAID_SECURITY_CONFIG` enforces:

- `securityLevel: 'strict'`
- `startOnLoad: false`
- `allowInitDirectiveOverrides: false` — Any `%%{init: ...}%%` or `securityLevel:` directive in user or AI-generated diagram source is rejected with `PROHIBITED_DIRECTIVE_OVERRIDE`.
- `allowClickEvents: false` & `allowExternalLinks: false` — Interactive `click` callbacks, `call` bindings, `href` links, and external URLs are rejected with `PROHIBITED_CLICK_OR_LINK`.
- **HTML & Script Blocking:** `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<img>`, inline event handlers (`onload=`, `onerror=`, `onclick=`), and `javascript:` / `data:text/html` URIs are rejected with `PROHIBITED_SCRIPT_OR_HTML`.
- **Complexity Bounds:** Enforces `maxTextSize: 50000`, `maxNodes: 150`, and `maxEdges: 250` so oversized diagrams cannot freeze the Electron renderer.
- **Sandboxed Preview Rendering:** Rendered SVG output is XML-escaped and displayed inside an isolated `data:image/svg+xml;utf8,...` `<img>` element in `VisualHubPanel.tsx` so embedded scripts can never execute in the renderer DOM.

---

## 3. Verified AI Image Model Capability Profiles

| Model ID | Provider | SDK / Endpoint | Resolutions | Aspect Ratios | Transparent BG | Max Ref Images |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `gemini-nano-banana-2.1` | `google-gemini` | `@google/genai` `interactions.create` | `1K`, `2K`, `4K` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` | No | 14 |
| `gemini-3-pro-image` | `google-gemini` | `@google/genai` `interactions.create` | `1K`, `2K`, `4K` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` | No | 8 |
| `gemini-3.1-flash-lite-image` | `google-gemini` | `@google/genai` `interactions.create` | `1K`, `2K` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4` | No | 0 |
| `gpt-image-2.5-sunburst` | `openai` | `openai` `images.generate` | `1024x1024`, `1536x1024`, `1024x1536` | `1:1`, `3:2`, `2:3` | Yes | 4 |
| `gpt-image-2.5-flare` | `openai` | `openai` `images.generate` | `1024x1024`, `1536x1024`, `1024x1536` | `1:1`, `3:2`, `2:3` | Yes | 0 |

---

## 4. IPC & Security Capabilities

All VisualHub operations are mediated by `assertValidSender`, Zod payload schemas, and `authorizer.authorize` in `src/main/index.ts`:

- `visual:mermaid` (`low` risk): `VISUAL_GET_OVERVIEW`, `VISUAL_RENDER_MERMAID`, `VISUAL_SAVE_DIAGRAM`, `VISUAL_LIST_DIAGRAMS`, `VISUAL_DELETE_DIAGRAM`, `VISUAL_GET_IMAGE_MODELS`, `VISUAL_UPDATE_PREFERENCES`
- `visual:exportDiagram` (`moderate` risk): `VISUAL_EXPORT_DIAGRAM`
- `visual:generateImage` (`moderate` risk): `VISUAL_GENERATE_IMAGE`, `VISUAL_CANCEL_IMAGE_GENERATION`, `VISUAL_DISCARD_IMAGE_CANDIDATE`
- `visual:saveToGallery` (`moderate` risk): `VISUAL_SAVE_IMAGE_TO_GALLERY`, `VISUAL_SAVE_DIAGRAM_TO_GALLERY`

