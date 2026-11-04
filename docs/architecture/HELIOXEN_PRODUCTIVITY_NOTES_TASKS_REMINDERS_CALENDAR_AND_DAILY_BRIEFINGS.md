# HELIOXEN — Step 35 Architecture: Integrated Productivity System (Notes, Tasks, Reminders, Calendar, and Daily Briefings)

**Project:** HELIOXEN  
**Roadmap:** Phase 12, Personal Context and Productivity Foundation  
**Step:** 35 of 48  
**Status:** Implemented & Verified

---

## 1. Architectural Overview & Separation of Concerns

Step 35 implements HELIOXEN's integrated productivity system, providing five tightly coordinated, locally persisted subsystems:

1. **Notes Management (`NoteRecord`)** — Structured notes with title, markdown body, tags, pin/unpin, archive state, source attribution, and keyword/tag filtering.
2. **Task Management (`TaskItemRecord`)** — Actionable tasks with `todo`, `in_progress`, `completed`, and `cancelled` statuses, `low`/`medium`/`high`/`urgent` priorities, time-zone-aware due dates, overdue/due-today computation, completion timestamp tracking, and ambiguity-safe natural-language completion (`completeTaskByTitle`).
3. **Reminder Scheduling & Delivery (`ReminderRecord`)** — One-time and recurring (`daily`, `weekly`) reminders with DST-safe local wall-clock time calculation (`resolveLocalWallClockToTimestamp`), snooze/dismiss/cancel lifecycle, startup/resume overdue reconciliation, and truthful OS notification delivery tracking (`delivered` vs `failed_or_unknown`).
4. **Calendar Event Management & External Provider Adapter Boundary (`CalendarEventRecord`, `CalendarProviderAdapter`)** — Local timed and all-day event CRUD (`YYYY-MM-DD` date preservation across time zones) plus a provider-neutral `CalendarProviderAdapter` boundary supporting encrypted token vault storage, paginated sync deduplication, ETag conflict detection, timeout classification (`unknown_timeout`), recurrence scope protection (`single_occurrence` vs `entire_series`), and mandatory human confirmation for external writes.
5. **Daily Briefing System (`DailyBriefingReport`)** — Deterministic daily briefing assembly grounded strictly in actual local notes, tasks, reminders, and synced calendar events, with explicit staleness/disconnection warnings, optional AI narrative summarization with deterministic fallback, and duplicate-safe scheduled daily generation.

### Separation from Step 34 Conversational Memory

| Dimension | Step 34 Long-Term Memory (`memory_store.json`) | Step 35 Productivity System (`productivity_store.json`) |
|---|---|---|
| **Purpose** | Durable user preferences, profile conventions, and recurring reference facts | Operational notes, actionable tasks, scheduled reminders, calendar events, and daily briefings |
| **Lifecycle** | Active, superseded, expired, pending deletion | Item-specific lifecycles (`todo`/`completed`, `scheduled`/`snoozed`/`delivered`, `synced`/`conflict`) |
| **Storage File** | `userData/memory_store.json` (`helioxen.memory.v1`) | `userData/productivity_store.json` (`helioxen.productivity.v1`) |
| **Profile Scope** | Scoped by `profileId` (`default-profile`) | Scoped by `profileId` (`default-profile`) |

---

## 2. Persistence & Transactional Rollback Design

- All productivity records are stored in `userData/productivity_store.json` using atomic write-to-temp-plus-rename (`mutateAndPersist` in `src/main/productivity/ProductivityService.ts`).
- Before mutating any collection, `ProductivityService` snapshots the in-memory store. If disk serialization or rename fails, in-memory state is immediately rolled back to the pre-mutation snapshot so UI and tool callers never observe uncommitted state.
- If `productivity_store.json` is corrupted on startup, the corrupted file is quarantined as `productivity_store.json.corrupt.<timestamp>.json` and a clean store is initialized without crashing the application.

---

## 3. Time-Zone, DST, and Recurrence Semantics

- **IANA Time-Zone Validation:** Every task, reminder, calendar event, and briefing preference validates its time zone via `Intl.DateTimeFormat` (`resolveSafeTimeZone`).
- **All-Day Event Integrity:** All-day events store explicit `allDayStartDate` and `allDayEndDate` in `YYYY-MM-DD` format so viewing or querying across time zones never shifts an all-day event to the previous or next day.
- **DST-Safe Recurrence (`computeNextRecurrenceDueAt`):** Daily and weekly reminders preserve their local wall-clock time (`HH:mm`, e.g., `09:00` in `America/New_York`) across Daylight Saving Time transitions and advance directly to the next future occurrence (`> now`) so missed intervals while the app was closed never trigger a storm of past notifications.

---

## 4. Security, Privacy & Capability Enforcement

- **Secret & Credential Guard (`inspectProductivityTextSafety`):** Reuses Step 34's secret and sensitive-data scanner to reject API keys, OAuth tokens, private keys, and sensitive personal identifiers from being stored in plain-text notes, tasks, reminders, or calendar descriptions.
- **External Calendar Token Isolation:** External provider tokens (`ConnectExternalCalendarRequest.accessToken`) are stored exclusively in the main-process `CalendarTokenVault` (`CredentialStorageService`), never in `productivity_store.json` or renderer state.
- **Capabilities & Confirmation Gates:**
  - `productivity:notes` (`low`)
  - `productivity:tasks` (`low`)
  - `productivity:reminders` (`moderate`)
  - `productivity:calendarLocal` (`moderate`)
  - `productivity:calendarExternalWrite` (`high`, `requiresHumanConsent: true`)
  - `productivity:briefing` (`low`)
- **Prompt-Injection Neutralization (`sanitizeProductivityItemForGrounding`):** Strips `[SYSTEM]`, `[DEVELOPER]`, and XML instruction/tool tags from note, task, and calendar titles before any optional AI narrative briefing summarization.

