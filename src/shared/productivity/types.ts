/**
 * HELIOXEN AI — Step 35: Integrated Productivity System
 * Notes, Task Management, Reminders, Calendar Integration, and Daily Briefings
 * Shared domain models, lifecycle enums, and IPC request/response contracts.
 */

export const PRODUCTIVITY_SCHEMA_VERSION = 1
export const DEFAULT_PRODUCTIVITY_PROFILE_ID = 'default-profile'

export type ProductivitySourceAttribution =
  | 'user_direct'
  | 'assistant_command'
  | 'imported'
  | 'external_sync'

// ============================================================================
// 1. NOTES SUBSYSTEM
// ============================================================================

export interface NoteRecord {
  readonly id: string
  readonly profileId: string
  readonly title: string
  readonly body: string
  readonly tags: readonly string[]
  readonly pinned: boolean
  readonly archived: boolean
  readonly sourceAttribution: ProductivitySourceAttribution
  readonly createdAt: number
  readonly updatedAt: number
  readonly schemaVersion: number
}

export interface CreateNoteRequest {
  readonly profileId?: string
  readonly title: string
  readonly body: string
  readonly tags?: readonly string[]
  readonly pinned?: boolean
  readonly archived?: boolean
  readonly sourceAttribution?: ProductivitySourceAttribution
}

export interface UpdateNoteRequest {
  readonly profileId?: string
  readonly id: string
  readonly title?: string
  readonly body?: string
  readonly tags?: readonly string[]
  readonly pinned?: boolean
  readonly archived?: boolean
}

export interface ListNotesRequest {
  readonly profileId?: string
  readonly query?: string
  readonly tag?: string
  readonly pinnedOnly?: boolean
  readonly includeArchived?: boolean
  readonly limit?: number
}

export interface DeleteNoteRequest {
  readonly profileId?: string
  readonly id: string
}

// ============================================================================
// 2. TASK MANAGEMENT SUBSYSTEM
// ============================================================================

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskSortField = 'dueAt' | 'priority' | 'updatedAt' | 'createdAt'

export interface TaskItemRecord {
  readonly id: string
  readonly profileId: string
  readonly title: string
  readonly description: string
  readonly status: TaskStatus
  readonly priority: TaskPriority
  readonly dueAt: number | null
  readonly timeZone: string
  readonly tags: readonly string[]
  readonly linkedNoteId: string | null
  readonly sourceAttribution: ProductivitySourceAttribution
  readonly createdAt: number
  readonly updatedAt: number
  readonly completedAt: number | null
  readonly schemaVersion: number
}

export interface TaskItemWithComputedState extends TaskItemRecord {
  readonly isOverdue: boolean
  readonly isDueToday: boolean
}

export interface CreateTaskRequest {
  readonly profileId?: string
  readonly title: string
  readonly description?: string
  readonly status?: TaskStatus
  readonly priority?: TaskPriority
  readonly dueAt?: number | null
  readonly timeZone?: string
  readonly tags?: readonly string[]
  readonly linkedNoteId?: string | null
  readonly sourceAttribution?: ProductivitySourceAttribution
}

export interface UpdateTaskRequest {
  readonly profileId?: string
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly status?: TaskStatus
  readonly priority?: TaskPriority
  readonly dueAt?: number | null
  readonly timeZone?: string
  readonly tags?: readonly string[]
  readonly linkedNoteId?: string | null
}

export interface ListTasksRequest {
  readonly profileId?: string
  readonly query?: string
  readonly status?: TaskStatus | 'active_only'
  readonly priority?: TaskPriority
  readonly tag?: string
  readonly overdueOnly?: boolean
  readonly dueTodayOnly?: boolean
  readonly sortBy?: TaskSortField
  readonly limit?: number
}

export interface CompleteTaskByTitleRequest {
  readonly profileId?: string
  readonly titleQuery: string
  readonly targetTaskId?: string
}

export interface CompleteTaskByTitleResponse {
  readonly status: 'completed' | 'ambiguous' | 'not_found'
  readonly completedTask?: TaskItemWithComputedState
  readonly candidates?: readonly TaskItemWithComputedState[]
  readonly message: string
}

export interface DeleteTaskRequest {
  readonly profileId?: string
  readonly id: string
}

// ============================================================================
// 3. REMINDER SCHEDULING & DELIVERY SUBSYSTEM
// ============================================================================

export type ReminderDeliveryLifecycleState =
  | 'scheduled'
  | 'due'
  | 'notification_requested'
  | 'delivered'
  | 'acknowledged'
  | 'snoozed'
  | 'cancelled'
  | 'failed_or_unknown'

export type ReminderRecurrenceFrequency = 'none' | 'daily' | 'weekly'

export interface ReminderRecurrenceRule {
  readonly frequency: ReminderRecurrenceFrequency
  readonly interval: number
  /** Local wall-clock time in HH:mm (24h) format for DST-safe recurrence */
  readonly localTime?: string
  /** Optional days of week (0 = Sunday ... 6 = Saturday) for weekly recurrence */
  readonly daysOfWeek?: readonly number[]
  readonly endsAt?: number | null
}

export interface ReminderRecord {
  readonly id: string
  readonly profileId: string
  readonly title: string
  readonly description: string
  readonly dueAt: number
  readonly timeZone: string
  readonly status: ReminderDeliveryLifecycleState
  readonly recurrence: ReminderRecurrenceRule
  readonly linkedTaskId: string | null
  readonly linkedEventId: string | null
  readonly snoozedUntil: number | null
  readonly lastAttemptAt: number | null
  readonly lastDeliveredAt: number | null
  readonly lastAcknowledgedAt: number | null
  readonly failureReason: string | null
  readonly occurrenceCount: number
  readonly sourceAttribution: ProductivitySourceAttribution
  readonly createdAt: number
  readonly updatedAt: number
  readonly schemaVersion: number
}

export interface CreateReminderRequest {
  readonly profileId?: string
  readonly title: string
  readonly description?: string
  readonly dueAt: number
  readonly timeZone?: string
  readonly recurrence?: Partial<ReminderRecurrenceRule>
  readonly linkedTaskId?: string | null
  readonly linkedEventId?: string | null
  readonly sourceAttribution?: ProductivitySourceAttribution
}

export interface UpdateReminderRequest {
  readonly profileId?: string
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly dueAt?: number
  readonly timeZone?: string
  readonly recurrence?: Partial<ReminderRecurrenceRule>
}

export interface SnoozeReminderRequest {
  readonly profileId?: string
  readonly id: string
  readonly durationMinutes?: number
  readonly snoozedUntil?: number
}

export interface DismissReminderRequest {
  readonly profileId?: string
  readonly id: string
}

export interface CancelReminderRequest {
  readonly profileId?: string
  readonly id: string
}

export interface DeleteReminderRequest {
  readonly profileId?: string
  readonly id: string
}

export interface ListRemindersRequest {
  readonly profileId?: string
  readonly status?: ReminderDeliveryLifecycleState | 'active_or_due'
  readonly includeCancelled?: boolean
  readonly limit?: number
}

// ============================================================================
// 4. CALENDAR & EXTERNAL CALENDAR ADAPTER SUBSYSTEM
// ============================================================================

export type CalendarProviderId =
  | 'local'
  | 'google_calendar'
  | 'microsoft_outlook'
  | 'caldav_generic'

export type CalendarEventSyncState =
  | 'local_only'
  | 'synced'
  | 'pending_push'
  | 'conflict'
  | 'stale'
  | 'error'
  | 'unknown_timeout'

export type ExternalCalendarConnectionStatus =
  | 'disconnected'
  | 'connected'
  | 'syncing'
  | 'sync_succeeded'
  | 'sync_failed'
  | 'reauth_required'
  | 'stale'

export type RecurrenceModificationScope = 'single_occurrence' | 'entire_series'

export interface CalendarEventRecord {
  readonly id: string
  readonly profileId: string
  readonly externalEventId: string | null
  readonly recurringMasterId: string | null
  readonly isRecurringInstance: boolean
  readonly providerId: CalendarProviderId
  readonly calendarId: string
  readonly title: string
  readonly description: string
  readonly startAt: number
  readonly endAt: number
  readonly allDay: boolean
  /** YYYY-MM-DD local date for all-day events so time-zone shifts never shift the day */
  readonly allDayStartDate: string | null
  /** YYYY-MM-DD inclusive end date for all-day events */
  readonly allDayEndDate: string | null
  readonly timeZone: string
  readonly location: string
  readonly attendees: readonly string[]
  readonly source: 'local' | 'external_provider'
  readonly syncState: CalendarEventSyncState
  readonly remoteEtag: string | null
  readonly lastSyncedAt: number | null
  readonly conflictDetails: string | null
  readonly createdAt: number
  readonly updatedAt: number
  readonly schemaVersion: number
}

export interface ExternalCalendarAccountState {
  readonly providerId: Exclude<CalendarProviderId, 'local'>
  readonly accountLabel: string
  readonly calendarId: string
  readonly status: ExternalCalendarConnectionStatus
  readonly credentialRef: string | null
  readonly lastSyncAttemptAt: number | null
  readonly lastSyncSuccessAt: number | null
  readonly lastSyncError: string | null
  readonly syncCursor: string | null
}

export interface CreateCalendarEventRequest {
  readonly profileId?: string
  readonly providerId?: CalendarProviderId
  readonly calendarId?: string
  readonly title: string
  readonly description?: string
  readonly startAt?: number
  readonly endAt?: number
  readonly allDay?: boolean
  readonly allDayStartDate?: string | null
  readonly allDayEndDate?: string | null
  readonly timeZone?: string
  readonly location?: string
  readonly attendees?: readonly string[]
  readonly recurringMasterId?: string | null
  readonly isRecurringInstance?: boolean
  /** Required when creating an event on a connected external calendar provider */
  readonly humanConfirmed?: boolean
}

export interface UpdateCalendarEventRequest {
  readonly profileId?: string
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly startAt?: number
  readonly endAt?: number
  readonly allDay?: boolean
  readonly allDayStartDate?: string | null
  readonly allDayEndDate?: string | null
  readonly timeZone?: string
  readonly location?: string
  readonly attendees?: readonly string[]
  readonly recurrenceScope?: RecurrenceModificationScope
  readonly humanConfirmed?: boolean
}

export interface DeleteCalendarEventRequest {
  readonly profileId?: string
  readonly id: string
  readonly recurrenceScope?: RecurrenceModificationScope
  readonly humanConfirmed?: boolean
}

export interface ListCalendarEventsRequest {
  readonly profileId?: string
  readonly rangeStartAt?: number
  readonly rangeEndAt?: number
  readonly dateKey?: string
  readonly providerId?: CalendarProviderId
  readonly query?: string
  readonly limit?: number
}

export interface ConnectExternalCalendarRequest {
  readonly profileId?: string
  readonly providerId: Exclude<CalendarProviderId, 'local'>
  readonly accountLabel: string
  readonly calendarId?: string
  /** OAuth/API token stored exclusively in the encrypted CredentialStorageService */
  readonly accessToken: string
}

export interface DisconnectExternalCalendarRequest {
  readonly profileId?: string
  readonly providerId: Exclude<CalendarProviderId, 'local'>
  readonly removeCachedEvents?: boolean
}

export interface SyncExternalCalendarRequest {
  readonly profileId?: string
  readonly providerId: Exclude<CalendarProviderId, 'local'>
}

export interface SyncExternalCalendarResult {
  readonly providerId: Exclude<CalendarProviderId, 'local'>
  readonly status: ExternalCalendarConnectionStatus
  readonly upsertedCount: number
  readonly deletedCount: number
  readonly conflictCount: number
  readonly syncedAt: number
  readonly errorMessage?: string
}

// ============================================================================
// 5. DAILY BRIEFINGS & NOTIFICATION PREFERENCES
// ============================================================================

export interface ProductivityNotificationPreferences {
  readonly desktopNotificationsEnabled: boolean
  readonly reminderNotificationsEnabled: boolean
  readonly dailyBriefingNotificationsEnabled: boolean
  readonly soundEnabled: boolean
}

export interface DailyBriefingPreferences {
  readonly enabled: boolean
  /** Local wall-clock time in HH:mm format (e.g., "08:30") */
  readonly deliveryTimeLocal: string
  readonly timeZone: string
  readonly includeCalendar: boolean
  readonly includeTasks: boolean
  readonly includeReminders: boolean
  readonly includeNotes: boolean
  readonly useAiNarrativeSummary: boolean
  readonly lastPreparedDateKey: string | null
  readonly lastPreparedAt: number | null
  readonly lastDeliveryState: 'delivered' | 'viewed_in_app' | 'pending' | 'failed_or_unknown' | null
}

export interface DailyBriefingWarning {
  readonly code:
    | 'EXTERNAL_CALENDAR_DISCONNECTED'
    | 'EXTERNAL_CALENDAR_STALE'
    | 'EXTERNAL_CALENDAR_SYNC_FAILED'
    | 'EXTERNAL_CALENDAR_REAUTH_REQUIRED'
    | 'NOTIFICATION_PERMISSION_DENIED'
    | 'AI_SUMMARY_FALLBACK'
  readonly message: string
}

export interface DailyBriefingReport {
  readonly id: string
  readonly profileId: string
  /** Local calendar date YYYY-MM-DD */
  readonly dateKey: string
  readonly generatedAt: number
  readonly timeZone: string
  readonly generationMode: 'manual' | 'scheduled' | 'startup_recovery'
  readonly summaryText: string
  readonly aiEnhanced: boolean
  readonly aiFallbackReason: string | null
  readonly todaysEvents: readonly CalendarEventRecord[]
  readonly upcomingEvents: readonly CalendarEventRecord[]
  readonly tasksDueToday: readonly TaskItemWithComputedState[]
  readonly overdueTasks: readonly TaskItemWithComputedState[]
  readonly highPriorityTasks: readonly TaskItemWithComputedState[]
  readonly dueAndOverdueReminders: readonly ReminderRecord[]
  readonly upcomingReminders: readonly ReminderRecord[]
  readonly pinnedAndRecentNotes: readonly NoteRecord[]
  readonly warnings: readonly DailyBriefingWarning[]
  readonly isEmpty: boolean
  readonly deliveryState: 'delivered' | 'viewed_in_app' | 'pending' | 'failed_or_unknown'
}

export interface GenerateDailyBriefingRequest {
  readonly profileId?: string
  readonly mode?: 'manual' | 'scheduled' | 'startup_recovery'
  readonly dateKey?: string
  readonly forceRegenerate?: boolean
}

export interface UpdateProductivitySettingsRequest {
  readonly profileId?: string
  readonly notifications?: Partial<ProductivityNotificationPreferences>
  readonly dailyBriefing?: Partial<DailyBriefingPreferences>
}

export interface ProductivityOverviewSnapshot {
  readonly profileId: string
  readonly notes: readonly NoteRecord[]
  readonly tasks: readonly TaskItemWithComputedState[]
  readonly reminders: readonly ReminderRecord[]
  readonly events: readonly CalendarEventRecord[]
  readonly externalAccounts: readonly ExternalCalendarAccountState[]
  readonly notifications: ProductivityNotificationPreferences
  readonly dailyBriefingPreferences: DailyBriefingPreferences
  readonly latestBriefing: DailyBriefingReport | null
}

