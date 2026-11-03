# HELIOXEN: File Operations, Clipboard Processing and Reversible File Organization
**Architecture Documentation — Step 29 of 48 (Phase 10: Desktop Awareness and System Interaction)**

---

## 1. Executive Summary and Architectural Principles

Step 29 implements secure, permission-aware file operations, explicit clipboard interaction, and non-destructive, reversible file organization workflows within HELIOXEN:
1. **Explicit Root Containment & Canonical Validation**: All file operations require an authorized root directory and target path. Paths undergo canonical normalization (`path.resolve`), rejection of directory traversal (`..`), sibling-prefix collision guards, symlink escape checks (`fs.realpathSync`), Windows protected system directory rejection (`C:\Windows`, `Program Files`, `System32`), and Windows reserved device name validation (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
2. **Default Overwrite Rejection**: Filesystem creation, copy, and move operations default to collision rejection (`overwrite: false`), requiring explicit user override to prevent accidental data loss.
3. **Atomic File Creation**: Text and data files are written to unique temporary sibling files and atomically renamed into place.
4. **Reversible File Organization**: Organization plans (`by_extension`, `by_date`, `by_category`) are generated purely as in-memory previews without modifying files on disk. Execution creates an immutable, persisted `TransactionManifest` recording source, destination, size, mtime, and checksum. A verified `undo` operation restores files to their original locations and cleans up empty organizational directories only after confirming destination file integrity.
5. **Explicit Clipboard Processing**: Clipboard text and image reads, and text writes, occur strictly on explicit user or task invocation via Electron's `clipboard` API. Background polling, clipboard listeners, and silent monitoring are prohibited.
6. **Strict Security Boundaries**: All operations run in the trusted Node.js main process. High-risk operations (such as `filesystem:organize`) enforce two-tier human confirmation via `ConsentGate`. The renderer accesses functionality solely through typed IPC channels and a strictly isolated context bridge.

---

## 2. Filesystem Security & Path Traversal Architecture

### 2.1 The PathValidator Engine
The `PathValidator` enforces strict defense-in-depth validation before any file operation executes:

```mermaid
flowchart TD
    A[Input: rootPath, targetPath] --> B[Check for Null Bytes & Control Characters]
    B --> C[Check Windows Reserved Device Names (CON, PRN, AUX, etc.)]
    C --> D[Normalize & Resolve Absolute Paths]
    D --> E[Reject Windows System Protected Folders (System32, Program Files)]
    E --> F[Check Sibling Prefix Collision (e.g., /root2 matching /root)]
    F --> G[Verify Realpath & Symlink Containment]
    G --> H[Return Safe Canonical Path]
```

### 2.2 Sibling-Prefix and Symlink Escape Protection
Standard `.startsWith(rootPath)` checks are vulnerable to sibling directory collision:
```typescript
// Vulnerable:
target.startsWith(root) // e.g., '/home/user/vault-secret'.startsWith('/home/user/vault') -> true

// PathValidator Implementation:
const relative = path.relative(normalizedRoot, normalizedTarget)
const isContained = !relative.startsWith('..') && !path.isAbsolute(relative)
```
In addition, `PathValidator.validateSafePath()` verifies that if the target file or directory already exists on disk, `fs.realpathSync.native` resolves within `fs.realpathSync.native(rootPath)`, preventing symlink escapes pointing outside the authorized root.

### 2.3 Windows System Directory Protection
The following paths are permanently blocked from being authorized or manipulated:
- `C:\Windows` (and all subdirectories)
- `C:\Program Files` and `C:\Program Files (x86)`
- `C:\ProgramData\Microsoft`
- `C:\System Volume Information`
- `C:\$Recycle.Bin`
- Windows kernel device namespaces (`\\.\`, `\\?\`)

---

## 3. File Operations Architecture

### 3.1 Supported Operations

| Operation | Method | Default Overwrite | Integrity Guardrail |
|---|---|---|---|
| **List Directory** | `listDirectory(req)` | N/A | Bounded pagination (max 1000 items), directory recursion limits. |
| **Get Metadata** | `getFileMetadata(req)` | N/A | Returns size, mtime, birthtime, permissions, symlink flag. |
| **Search Files** | `searchFiles(req)` | N/A | Substring or extension match, bounded results (max 200). |
| **Read Text File** | `readTextFile(req)` | N/A | Strict size limit (default 5MB), binary/null-byte heuristic check. |
| **Create File** | `createFile(req)` | False (Throws if exists) | Atomic write via `.tmp_<filename>_<rand>` + atomic rename. |
| **Copy File** | `copyFile(req)` | False (`COPYFILE_EXCL`) | Preserves source, validates destination root containment. |
| **Move File** | `moveFile(req)` | False (Throws if exists) | Atomic rename with cross-device (`EXDEV`) copy+unlink fallback. |

### 3.2 Atomic Write Pattern
```typescript
const tempPath = path.join(dir, `.tmp_${path.basename(safePath)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
try {
  fs.writeFileSync(tempPath, content, { encoding: 'utf8', flag: 'wx' })
  fs.renameSync(tempPath, safePath)
} catch (err) {
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  throw err
}
```

---

## 4. Reversible File Organization Architecture

### 4.1 Non-Destructive Preview Planning
When an organization plan is requested (`by_extension`, `by_date`, or `by_category`), `FileOrganizationManager` scans the directory without modifying any files on disk:
- Grouping strategies:
  - `by_extension`: Groups files by lowercase extension (e.g., `Documents/`, `Images/`, `Code/`).
  - `by_date`: Groups files by creation or modification year/month (e.g., `2026-11/`).
  - `by_category`: Categorizes into preset buckets (Documents, Images, Audio, Video, Archives, Code).
- Evaluates destination conflicts ahead of time:
  - If a destination filename already exists, appends conflict metadata to the plan item rather than silently failing during execution.

### 4.2 Transaction Manifest and Atomicity
Before moving any file, the manager creates an in-memory and persisted `TransactionManifest`:
```typescript
export interface FileMoveOperation {
  id: string
  sourcePath: string
  destinationPath: string
  originalSize: number
  originalMtimeMs: number
  appliedAt?: string
  status: 'pending' | 'completed' | 'failed' | 'reverted'
  error?: string
}

export interface TransactionManifest {
  manifestId: string
  rootPath: string
  strategy: OrganizationStrategy
  createdAt: string
  state: 'pending' | 'applied' | 'partially_applied' | 'reverted' | 'failed' | 'undo_failed'
  operations: FileMoveOperation[]
  createdDirectories: string[]
}
```

### 4.3 Verified Undo Execution
Reversing an organization transaction strictly guarantees file preservation:
1. Validates that the manifest is in `'applied'` or `'partially_applied'` state.
2. For each completed operation in reverse order:
   - Verifies the file at `destinationPath` still exists.
   - Verifies file size matches `originalSize` (preventing reverting a file that was subsequently modified).
   - Verifies the `sourcePath` is not currently occupied by a newly created file.
   - Moves the file back to `sourcePath`.
3. Prunes created organizational folders (`createdDirectories`) in deepest-first order if and only if they are completely empty.
4. Updates manifest state to `'reverted'`.

---

## 5. Explicit Clipboard Interaction Architecture

### 5.1 No Silent Monitoring
Clipboard interaction occurs solely on explicit invocations:
- `clipboard:read_text`: Reads text/plain from OS clipboard; bounds text to maximum length (default 100,000 characters).
- `clipboard:write_text`: Writes sanitized text to OS clipboard.
- `clipboard:read_image`: Reads image data as PNG base64 data URL (`data:image/png;base64,...`) and reports dimensions ($W \times H$).
- Prohibits continuous background polling, event hooking, or logging of clipboard modifications.

---

## 6. Security Capabilities and Tool Registry

### 6.1 Capability Matrix
| Capability | Risk Tier | Consent Gate | Allowed Requester | Description |
|---|---|---|---|---|
| `filesystem:read` | Low | No | `renderer-main-window` | Read metadata, list directory, search files, read text. |
| `filesystem:write` | Moderate | No | `renderer-main-window` | Create file, copy file, move file. |
| `filesystem:organize` | High | **Yes (Human Consent)** | `renderer-main-window` | Reversible batch file organization workflows. |
| `clipboard:read` | Moderate | No | `renderer-main-window` | Explicit clipboard inspection. |
| `clipboard:write` | Moderate | No | `renderer-main-window` | Explicit clipboard replacement. |

### 6.2 Tool Catalog Additions
12 canonical tools registered in `src/shared/tools/catalog.ts`:
1. `filesystem:list_directory`
2. `filesystem:get_file_metadata`
3. `filesystem:search_files`
4. `filesystem:read_text_file`
5. `filesystem:create_file`
6. `filesystem:copy_file`
7. `filesystem:move_file`
8. `filesystem:plan_organization`
9. `filesystem:apply_organization`
10. `filesystem:undo_organization`
11. `clipboard:read_text`
12. `clipboard:write_text`

---

## 7. Verification and Testing Summary

The Step 29 test suite comprises 6 dedicated test files (39 tests):
1. `tests/filesystem/pathValidator.test.ts`: 7 tests verifying traversal rejection, canonical paths, system paths, and reserved names.
2. `tests/filesystem/fileOperations.test.ts`: 11 tests verifying listing, metadata, search, text reading, atomic creation, copying, and moving.
3. `tests/filesystem/clipboard.test.ts`: 5 tests verifying reading text/images, writing text, and bounds enforcement.
4. `tests/filesystem/reversibleOrganization.test.ts`: 5 tests verifying preview planning, transaction manifest generation, conflict detection, execution, and verified undo.
5. `tests/filesystem/filesystemContracts.test.ts`: 6 tests validating all Zod schemas and invalid parameter rejection.
6. `tests/filesystem/filesystemToolsIntegration.test.ts`: 5 tests verifying tool registration, dispatcher execution, orchestrator task planning, and human consent enforcement.

**Full Project Test Suite Result**: 62 test files, 379 tests passing (100% green). TypeScript typecheck and `electron-vite build` pass with 0 errors.

