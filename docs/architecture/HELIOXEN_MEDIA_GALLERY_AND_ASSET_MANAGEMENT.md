# HELIOXEN — Step 36 Architecture: Media Gallery and Media Asset Management

**Project:** HELIOXEN  
**Roadmap:** Phase 12, Personal Context and Productivity Foundation  
**Step:** 36 of 48  
**Status:** Implemented & Verified

---

## 1. Scope & Non-Goals

Step 36 implements HELIOXEN's local-first Media Gallery and Media Asset Management subsystem (`src/shared/media/`, `src/main/media/`, and `src/renderer/src/components/media/MediaGalleryPanel.tsx`), enabling users to explicitly import, organize, search, preview, and manage image, video, and audio assets.

**Explicit Non-Goals (Deferred to Step 37+):**
- No AI image generation, text-to-image, or image-to-image synthesis.
- No VisualHub canvas or Mermaid diagram generation.
- No automatic background crawling of user folders (`Downloads`, `Pictures`, `Videos`, `Desktop`).
- No automatic upload, OCR, or vision classification of imported gallery media.

---

## 2. Pre-Implementation Repository Audit Findings

- **Runtime & Stack:** Electron `33.2.0`, React `18.3.1`, TypeScript `5.6.3`, Zod `4.6.7`, Vitest `2.1.0`.
- **Existing Media Sources:**
  - Step 22 (`src/shared/capture/`) produces `CapturedStillImage` data URLs (`image/png`, `image/jpeg`, `image/webp`).
  - Step 23 (`src/shared/documents/`) handles user-selected document/image attachments.
  - Step 32 (`src/main/research/`) captures browser tab screenshots.
- **Persistence Pattern:** Atomic JSON persistence (`mutateAndPersist`) with temp-file write + rename and in-memory rollback on disk write failure, established in Steps 34 and 35.

---

## 3. Asset Data Model & Storage Separation

Metadata and binary payloads are strictly separated under `userData/media_library/`:

- **Metadata Store (`userData/media_library/media_store.json`):** Stores profile-scoped `MediaAssetRecord`s and `MediaCollectionRecord`s (`helioxen.media.v1`).
- **Managed Binary Storage (`userData/media_library/assets/`):** Stores `managed_copy` assets under generated internal names (`<assetId><normalizedExtension>`), never using untrusted original filenames as disk paths.
- **Derived Thumbnail Cache (`userData/media_library/thumbnails/`):** Stores bounded image thumbnail derivatives (`<assetId>.thumb`) keyed in memory by `${assetId}_${contentHashSha256}` with concurrent request deduplication (`inFlightThumbnails`).

### Storage Modes (`MediaStorageMode`)
1. `managed_copy` (default): Copies the validated source file into `userData/media_library/assets/<assetId><ext>`, leaving the user's original file untouched.
2. `external_reference`: Retains an internal main-process reference to the user's original file without copying, verifying file availability on access and transitioning `status` to `'unavailable'` (`MISSING_EXTERNAL_SOURCE_FILE`) if moved or deleted, with support for authorized relinking (`relinkExternalAsset`).

---

## 4. Supported Media Formats & Layered Magic-Byte Validation

`inspectMediaFileBuffer` (`src/shared/media/contracts.ts`) enforces extension allowlisting, binary magic-byte verification, structural header parsing, and active-content rejection:

| Category | Extensions | MIME Types | Magic-Byte & Structural Header Verification |
|---|---|---|---|
| **Image** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp` | `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/bmp` | PNG signature + `IHDR` dimensions; JPEG `FF D8 FF` + `SOF0`/`SOF1`/`SOF2` dimensions; GIF `GIF87a`/`GIF89a` dimensions; WebP `RIFF/WEBP` + `VP8`/`VP8L`/`VP8X` dimensions; BMP `BM` + DIB dimensions |
| **Video** | `.mp4`, `.webm` | `video/mp4`, `video/webm` | ISO BMFF `ftyp` box + `mvhd` duration; WebM EBML `1A 45 DF A3` |
| **Audio** | `.mp3`, `.wav`, `.ogg` | `audio/mpeg`, `audio/wav`, `audio/ogg` | `ID3` or MPEG sync word; `RIFF/WAVE` + `fmt`/`data` duration; `OggS` capture pattern |
| **Prohibited** | `.svg`, `.html`, `.js`, `.exe`, `.bat`, `.ps1`, etc. | N/A | Rejected by extension and leading-byte inspection (`<svg`, `<!DOCTYPE`, `<script`, `MZ`) |

---

## 5. Resource Limits & Privacy Protections

- `maxSingleFileSizeBytes`: `50 MB`
- `maxBatchFileCount`: `25 files`
- `maxBatchTotalBytes`: `200 MB`
- `maxImageDimensionPx`: `8192 px`
- `maxImagePixelCount`: `33,554,432 px` (~33.5 MP)
- `maxThumbnailEdgePx`: `320 px`
- **EXIF & Location Privacy:** Embedded EXIF GPS coordinates and camera serial numbers are never extracted, displayed, or stored in metadata records (`exifStrippedForPrivacy: true`).

---

## 6. Distinct Rename, Remove, and Permanent Deletion Semantics

- **Rename (`updateAssetMetadata`):** Updates `displayName`, `description`, `tags`, `favorite`, and `collectionIds` in `media_store.json` while preserving `id`, `storageReference`, and the underlying file.
- **Remove from Library (`removeAssetFromLibrary`):** Unlinks the asset record and removes its thumbnail derivative. For `external_reference` assets, the user's original external file is **never** deleted (`originalExternalFilePreserved: true`).
- **Permanent Managed Deletion (`deleteManagedAssetPermanently`):** Requires `confirmPermanentDelete: true` (`media:deletePermanent` capability with `requiresHumanConsent: true`), verifies path containment inside `userData/media_library/assets/`, and strictly refuses to delete `external_reference` source files (`EXTERNAL_SOURCE_DELETION_PROHIBITED`).

