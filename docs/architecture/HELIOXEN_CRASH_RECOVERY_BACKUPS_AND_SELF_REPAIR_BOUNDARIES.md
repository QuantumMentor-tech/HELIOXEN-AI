# HELIOXEN Architecture: Crash Recovery, Verified Backups, Data Integrity, and Controlled Self-Repair Boundaries

## Executive Summary

Phase 16, Step 46 establishes a comprehensive, local-first reliability layer for the HELIOXEN desktop application. The system provides crash detection, safe interrupted-session reconciliation, atomic SHA-256 verified backup snapshots, pre-restore safety checkpoints with automatic rollback, and strictly bounded self-repair.

### The Cardinal Principle:
> **HELIOXEN may diagnose issues, propose safe deterministic repairs, and restore verified backups, but it is strictly prohibited from rewriting its source code, relaxing Electron security controls, executing arbitrary shell commands, or auto-replaying uncertain external actions.**

---

## 1. Threat Model & Recovery Boundaries

```
+-----------------------------------------------------------------------------------------+
|                                  HELIOXEN UI / RENDERER                                 |
|   Recovery Center Panel | Settings Tab | Diagnostics Viewer | Restore Preview Modal     |
+--------------------------------------------+--------------------------------------------+
                                             | Context Bridge (window.helioxen.recovery)
                                             v
+-----------------------------------------------------------------------------------------+
|                            ELECTRON PRELOAD (Context Isolation)                         |
|     helioxenApi.recovery.getStatus / createBackup / verifyBackup / executeRestore / ... |
+--------------------------------------------+--------------------------------------------+
                                             | IPC Channels (Capability Checked)
                                             v
+-----------------------------------------------------------------------------------------+
|                               MAIN PROCESS RECOVERY SYSTEM                              |
|                                                                                         |
|  [CrashRecoveryManager]                     [BackupManager]                             |
|  * Heartbeat (30s) & Session State File     * Staged Atomic Directory Renaming          |
|  * Blocked Auto-Replay of External Actions  * SHA-256 Cryptographic Checksums           |
|  * Recovery State Lifecycle Engine          * Retention Policy (Keep >= 1 Verified)     |
|                                                                                         |
|  [RestoreManager]                           [SelfRepairManager]                         |
|  * Mandatory Human Confirmation Modal       * Read-Only Diagnostic Scanner              |
|  * Pre-Restore Safety Checkpoint            * Approved Deterministic Repair Catalog     |
|  * Post-Restore Validation & Auto-Rollback  * Permanent Banning of Code/Shell Mutators  |
+--------------------------------------------+--------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                    PERSISTENT DATA ROOT                                 |
|   ai_preferences.json | productivity_store.json | memory_store.json | office/ | ...     |
|   backups/backup_<id>/ (Manifest + Artifacts) | backups/checkpoint_pre_restore_<id>/    |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Recovery State Model & Interrupted Operation Handling

### 2.1 State Transitions

```
[Normal Startup] ----> [Heartbeat Active] ----> [Clean Shutdown]
        |
        + (Missing Clean Exit Marker / Heartbeat Expired)
        v
[Previous Session Interrupted]
        |
        +-- (Unresolved External Operations Detected?)
        |      |
        |      +-- YES --> [Recovery Requires User Review] ---> [Recovery Completed]
        |      |
        |      +-- NO  --> [Recovery Completed]
```

### 2.2 Strict Invariant: No External Action Auto-Replay
External operations (such as sending messages, making network transactions, controlling physical Android devices, or actuating smart-home deadbolts/alarms) that were in-flight during a crash are explicitly set to:
```typescript
{
  state: 'interrupted_unknown_outcome',
  requiresUserReview: true,
  replayed: false // GUARANTEED: never auto-executed on reboot
}
```
The user must review the interrupted operation in the Recovery Center. This eliminates double-charging, duplicated emails, and unintentional physical actuator triggers.

---

## 3. Verified, Versioned Backup Architecture

### 3.1 Eligible Data Stores
1. `ai_preferences`: AI model routing preferences and parameters (`ai_preferences.json`).
2. `voice_preferences`: Voice synthesizer, STT, and wake-word configuration (`voice_preferences.json`).
3. `productivity`: Notes, tasks, calendar items, reminders, and daily briefings (`productivity_store.json`).
4. `memory`: Long-term user memory records and consent status (`memory_store.json`).
5. `office`: Documents, spreadsheets, and presentation projects (`office/office_documents_store.json`).
6. `agents`: Agent town configurations and agent state (`agents/agents_store.json`).
7. `plugins`: Connector definitions and settings (`plugins/plugins_store.json`).
8. `skills`: Dynamic skill definitions, versions, and test scenarios (`skills/skills_store.json`).
9. `media_metadata`: Media gallery catalog records (`media_library/media_store.json`).
10. `communication_drafts`: Outbox drafts and message templates (`communication/communication_store.json`).
11. `devices`: Paired Android device authorizations (`devices/android_devices.json`).
12. `smart_home`: Smart-home hub configurations and entity state registry (`smart-home/smart_home_store.json`).

### 3.2 Data Excluded by Default
- Operating-system level secrets, raw API keys, and decrypted tokens.
- Transient runtime binaries, Node.js processes, and cache directories.
- Browser cookies and ephemeral session caches.
- Temporary microphone and camera recordings.

### 3.3 Atomic Staged Creation
1. Staging folder `.staging_backup_<id>` is created inside `backups/`.
2. Target stores are copied into the staging folder.
3. Cryptographic SHA-256 hashes are computed for each artifact.
4. `manifest.json` (version 1) is written with all artifact metadata.
5. All hashes are re-verified within staging before commit.
6. The staging folder is atomically renamed to `backup_<id>`.
7. If any step fails, the staging folder is wiped without modifying existing backups.

### 3.4 Retention Policy
- Configurable maximum retained backups (default: 5).
- Prunes oldest backups beyond the retention limit.
- **Safety Guarantee:** The retention manager will never delete the single remaining verified backup.

---

## 4. Verified Restore Workflow & Automatic Rollback

### 4.1 Restore Lifecycle
1. **Preview:** Inspects backup manifest, checks version compatibility, and generates a list of live active stores that will be overwritten.
2. **Mandatory Human Confirmation:** The UI requires the user to explicitly confirm that active data will be replaced.
3. **Pre-Restore Checkpoint:** Before touching live files, the system copies current versions of target stores into `backups/checkpoint_pre_restore_<timestamp>/`.
4. **Staged Replacement:** Files are copied to live locations via temporary files (`.tmp.<timestamp>`) and atomically renamed.
5. **Post-Restore Integrity Check:** The restored JSON files are parsed and validated.
6. **Automatic Rollback:** If post-restore validation throws an exception, the system immediately restores from the pre-restore checkpoint.

---

## 5. Controlled Self-Repair Boundaries

### 5.1 Permitted Deterministic Repairs
| Repair Identifier | Target Paths | Risk Tier | Human Confirmation | Description |
|---|---|---|---|---|
| `REPAIR_CLEAN_STALE_TEMP_FILES` | `backups/.staging_*`, `temp` | Low | Automatic / Safe | Deletes orphaned backup staging folders. |
| `REPAIR_RECREATE_CACHE_DIRS` | `media_library/thumbnails`, `cache` | Low | Automatic / Safe | Ensures required disposable cache directories exist. |
| `REPAIR_CLEAR_CORRUPTED_CACHE` | `*.corrupt.*.json` | Moderate | Required | Moves corrupt temporary files to quarantine folder. |
| `REPAIR_RESET_DEFAULT_PREFERENCES` | `ai_preferences.json` | High | Required | Resets preferences to factory defaults; archives previous file. |
| `REPAIR_RECONCILE_STUCK_OPERATIONS` | `session_state.json` | Low | Automatic / Safe | Clears stuck operation review flags. |
| `REPAIR_RESTORE_FROM_CHECKPOINT` | `checkpoint_pre_restore_*` | High | Required | Reverts to last known-good pre-restore checkpoint. |

### 5.2 Permanently Forbidden Operations
The self-repair engine enforces strict negative checks preventing:
- Modifying TypeScript/JavaScript application code (`.ts`, `.tsx`, `.js`, `.jsx`).
- Editing `package.json`, `tsconfig.json`, or `.git`.
- Executing OS shell commands (`bash`, `powershell`, `cmd`, `eval`, `exec`).
- Decrypting or exporting raw credentials from `credentials.json`.
- Disabling Electron security settings (`contextIsolation`, `sandbox`, `webSecurity`).

---

## 6. Audit Trail & IPC Channels

### 6.1 Security Event Logging
- `RECOVERY_CRASH_DETECTED`: Logged when an interrupted prior session is discovered.
- `RECOVERY_STARTUP_CHECK`: Logged during startup integrity scanning.
- `BACKUP_CREATE`: Logged on backup creation attempt and verification.
- `BACKUP_RESTORE`: Logged on restore attempt, completion, or rollback.
- `BACKUP_RETENTION`: Logged when older backups are pruned.
- `SELF_REPAIR_DIAGNOSTIC`: Logged when diagnostic scans are executed.
- `SELF_REPAIR_ACTION`: Logged when an approved repair is performed.

### 6.2 IPC Endpoints & Capabilities
| Channel | Capability Required | Risk Tier | Human Consent |
|---|---|---|---|
| `recovery:getStatus` | `recovery:read` | Low | No |
| `recovery:listBackups` | `recovery:read` | Low | No |
| `recovery:createBackup` | `recovery:backup` | Moderate | No |
| `recovery:verifyBackup` | `recovery:read` | Low | No |
| `recovery:restorePreview` | `recovery:read` | Low | No |
| `recovery:executeRestore` | `recovery:restore` | High | Yes |
| `recovery:runDiagnostics` | `recovery:read` | Low | No |
| `recovery:executeRepair` | `recovery:repair` | High | Yes |

