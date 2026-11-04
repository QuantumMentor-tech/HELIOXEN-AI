/**
 * HELIOXEN AI — Step 35: Integrated Productivity Service
 * Main-process orchestration and persistence for Notes, Tasks, Reminders,
 * Calendar Events, External Calendar Synchronization, and Daily Briefings.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  CalendarEventRecord,
  CalendarProviderId,
  CancelReminderRequest,
  CancelReminderRequestSchema,
  CompleteTaskByTitleRequest,
  CompleteTaskByTitleRequestSchema,
  CompleteTaskByTitleResponse,
  ConnectExternalCalendarRequest,
  ConnectExternalCalendarRequestSchema,
  CreateCalendarEventRequest,
  CreateCalendarEventRequestSchema,
  CreateNoteRequest,
  CreateNoteRequestSchema,
  CreateReminderRequest,
  CreateReminderRequestSchema,
  CreateTaskRequest,
  CreateTaskRequestSchema,
  DailyBriefingPreferences,
  DailyBriefingReport,
  DailyBriefingWarning,
   DEFAULT_PRODUCTIVITY_PROFILE_ID,
  DeleteCalendarEventRequest,
  DeleteCalendarEventRequestSchema,
  DeleteNoteRequest,
  DeleteNoteRequestSchema,
  DeleteReminderRequest,
  DeleteReminderRequestSchema,
  DeleteTaskRequest,
  DeleteTaskRequestSchema,
  DisconnectExternalCalendarRequest,
  DisconnectExternalCalendarRequestSchema,
  DismissReminderRequest,
  DismissReminderRequestSchema,
  ExternalCalendarAccountState,
  GenerateDailyBriefingRequest,
  GenerateDailyBriefingRequestSchema,
  inspectProductivityTextSafety,
  ListCalendarEventsRequest,
  ListCalendarEventsRequestSchema,
  ListNotesRequest,
  ListNotesRequestSchema,
  ListRemindersRequest,
  ListRemindersRequestSchema,
  ListTasksRequest,
  ListTasksRequestSchema,
  NoteRecord,
  PRODUCTIVITY_SCHEMA_VERSION,
  ProductivityNotificationPreferences,
  ProductivityOverviewSnapshot,
  ProductivityProfileIdSchema,
  ReminderRecord,
  ReminderRecurrenceRule,
  resolveSafeTimeZone,
  sanitizeProductivityItemForGrounding,
  SnoozeReminderRequest,
  SnoozeReminderRequestSchema,
  SyncExternalCalendarRequest,
  SyncExternalCalendarRequestSchema,
  SyncExternalCalendarResult,
  TaskItemRecord,
  TaskItemWithComputedState,
  TaskPriority,
  UpdateCalendarEventRequest,
  UpdateCalendarEventRequestSchema,
  UpdateNoteRequest,
  UpdateNoteRequestSchema,
  UpdateProductivitySettingsRequest,
  UpdateProductivitySettingsRequestSchema,
  UpdateReminderRequest,
  UpdateReminderRequestSchema,
  UpdateTaskRequest,
  UpdateTaskRequestSchema
} from '../../shared/productivity'
import {
  CalendarAdapterAuthError,
  CalendarAdapterConflictError,
  CalendarAdapterTimeoutError,
  CalendarProviderAdapter,
  ExternalProviderType,
  InMemoryExternalCalendarAdapter
} from './CalendarProviderAdapter'

export interface NotificationDispatchRequest {
  readonly title: string
  readonly body: string
  readonly category: 'reminder' | 'daily_briefing'
  readonly referenceId: string
}

export interface NotificationDispatchResult {
  readonly delivered: boolean
  readonly failureReason?: string
}

export interface NotificationDispatcher {
  isSupportedAndPermitted(): boolean
  dispatch(request: NotificationDispatchRequest): Promise<NotificationDispatchResult> | NotificationDispatchResult
}

export interface CalendarTokenVault {
  storeToken(key: string, token: string): void
  retrieveToken(key: string): string | null
  deleteToken(key: string): void
}

export interface BriefingAiSummarizer {
  summarizeBriefing(groundingText: string): Promise<string>
}

interface ProfileProductivityData {
  notes: NoteRecord[]
  tasks: TaskItemRecord[]
  reminders: ReminderRecord[]
  events: CalendarEventRecord[]
  externalAccounts: ExternalCalendarAccountState[]
  notifications: ProductivityNotificationPreferences
  dailyBriefing: DailyBriefingPreferences
  latestBriefing: DailyBriefingReport | null
}

interface PersistedProductivityStore {
  schemaVersion: number
  updatedAt: number
  profiles: Record<string, ProfileProductivityData>
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
}

const STALE_SYNC_THRESHOLD_MS = 6 * 60 * 60 * 1000 // 6 hours

// ============================================================================
// TIME-ZONE & DST-AWARE DATE UTILITIES
// ============================================================================

export function formatLocalDateKey(timestampMs: number, timeZone: string): string {
  const safeTz = resolveSafeTimeZone(timeZone)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(timestampMs))

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function formatLocalTime24h(timestampMs: number, timeZone: string): string {
  const safeTz = resolveSafeTimeZone(timeZone)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(timestampMs))

  let hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  if (hour === '24') hour = '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

export function getLocalDayOfWeek(timestampMs: number, timeZone: string): number {
  const dateKey = formatLocalDateKey(timestampMs, timeZone)
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function addDaysToDateKey(dateKey: string, daysToAdd: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + daysToAdd))
  const year = dt.getUTCFullYear()
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Resolves a local calendar date (YYYY-MM-DD) and local 24h wall-clock time (HH:mm)
 * in a specific IANA time zone into an exact UTC timestamp (ms), preserving wall-clock
 * hours and minutes across Daylight Saving Time transitions.
 */
export function resolveLocalWallClockToTimestamp(
  dateKey: string,
  localTime24h: string,
  timeZone: string
): number {
  const safeTz = resolveSafeTimeZone(timeZone)
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = localTime24h.split(':').map(Number)

  const approxUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  const getOffsetMsAt = (utcMs: number): number => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    const parts = dtf.formatToParts(new Date(utcMs))
    const pYear = Number(parts.find((p) => p.type === 'year')?.value ?? year)
    const pMonth = Number(parts.find((p) => p.type === 'month')?.value ?? month)
    const pDay = Number(parts.find((p) => p.type === 'day')?.value ?? day)
    let pHour = Number(parts.find((p) => p.type === 'hour')?.value ?? hour)
    if (pHour === 24) pHour = 0
    const pMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? minute)
    const pSecond = Number(parts.find((p) => p.type === 'second')?.value ?? 0)

    const asUtc = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, pSecond, 0)
    return asUtc - utcMs
  }

  const firstOffset = getOffsetMsAt(approxUtc)
  const candidate = approxUtc - firstOffset
  const secondOffset = getOffsetMsAt(candidate)
  return approxUtc - secondOffset
}

/**
 * Computes the next future occurrence timestamp (> nowMs) for a recurring reminder,
 * preserving local wall-clock time across DST boundaries and skipping past missed intervals
 * without generating duplicate past occurrences.
 */
export function computeNextRecurrenceDueAt(
  currentDueAt: number,
  rule: ReminderRecurrenceRule,
  timeZone: string,
  nowMs: number
): number | null {
  if (rule.frequency === 'none') {
    return null
  }

  const safeTz = resolveSafeTimeZone(timeZone)
  const wallClockTime = rule.localTime || formatLocalTime24h(currentDueAt, safeTz)
  let baseDateKey = formatLocalDateKey(currentDueAt, safeTz)
  const stepDays = rule.frequency === 'daily' ? Math.max(1, rule.interval) : Math.max(1, rule.interval) * 7

  let safetyIterations = 0
  while (safetyIterations < 1000) {
    safetyIterations++
    if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      baseDateKey = addDaysToDateKey(baseDateKey, 1)
      const [y, m, d] = baseDateKey.split('-').map(Number)
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      if (!rule.daysOfWeek.includes(dow)) {
        continue
      }
    } else {
      baseDateKey = addDaysToDateKey(baseDateKey, stepDays)
    }

    const nextTimestamp = resolveLocalWallClockToTimestamp(baseDateKey, wallClockTime, safeTz)
    if (rule.endsAt && nextTimestamp > rule.endsAt) {
      return null
    }
    if (nextTimestamp > nowMs) {
      return nextTimestamp
    }
  }

  return null
}

// ============================================================================
// PRODUCTIVITY SERVICE IMPLEMENTATION
// ============================================================================

export interface ProductivityServiceOptions {
  readonly storageDir: string
  readonly nowFn?: () => number
  readonly notificationDispatcher?: NotificationDispatcher
  readonly tokenVault?: CalendarTokenVault
  readonly calendarAdapters?: Partial<Record<ExternalProviderType, CalendarProviderAdapter>>
  readonly briefingAiSummarizer?: BriefingAiSummarizer
  readonly enableBackgroundTimer?: boolean
}

export class ProductivityService {
  private readonly storageDir: string
  private readonly storePath: string
  private readonly nowFn: () => number
  private readonly notificationDispatcher: NotificationDispatcher
  private readonly tokenVault: CalendarTokenVault
  private readonly calendarAdapters: Record<ExternalProviderType, CalendarProviderAdapter>
  private briefingAiSummarizer?: BriefingAiSummarizer
  private readonly enableBackgroundTimer: boolean

  private store: PersistedProductivityStore
  private nextTimer: NodeJS.Timeout | null = null
  private simulateDiskWriteFailure = false
  private disposed = false

  constructor(options: ProductivityServiceOptions) {
    this.storageDir = options.storageDir
    this.storePath = path.join(this.storageDir, 'productivity_store.json')
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.enableBackgroundTimer = options.enableBackgroundTimer ?? false
    this.briefingAiSummarizer = options.briefingAiSummarizer

    const inMemoryVault = new Map<string, string>()
    this.tokenVault = options.tokenVault ?? {
      storeToken: (k, v) => inMemoryVault.set(k, v),
      retrieveToken: (k) => inMemoryVault.get(k) ?? null,
      deleteToken: (k) => {
        inMemoryVault.delete(k)
      }
    }

    this.notificationDispatcher = options.notificationDispatcher ?? {
      isSupportedAndPermitted: () => true,
      dispatch: () => ({ delivered: true })
    }

    this.calendarAdapters = {
      google_calendar:
        options.calendarAdapters?.google_calendar ??
        new InMemoryExternalCalendarAdapter('google_calendar'),
      microsoft_outlook:
        options.calendarAdapters?.microsoft_outlook ??
        new InMemoryExternalCalendarAdapter('microsoft_outlook'),
      caldav_generic:
        options.calendarAdapters?.caldav_generic ??
        new InMemoryExternalCalendarAdapter('caldav_generic')
    }

    this.store = this.loadStoreFromDisk()
    this.reconcileStartupAndResume()
  }

  public setSimulateDiskWriteFailure(enabled: boolean): void {
    this.simulateDiskWriteFailure = enabled
  }

  public setBriefingAiSummarizer(summarizer: BriefingAiSummarizer | undefined): void {
    this.briefingAiSummarizer = summarizer
  }

  public getCalendarAdapter(providerId: ExternalProviderType): CalendarProviderAdapter {
    return this.calendarAdapters[providerId]
  }

  public dispose(): void {
    this.disposed = true
    if (this.nextTimer) {
      clearTimeout(this.nextTimer)
      this.nextTimer = null
    }
  }

  // --------------------------------------------------------------------------
  // Persistence & Transactional Integrity
  // --------------------------------------------------------------------------

  private createDefaultProfileData(): ProfileProductivityData {
    return {
      notes: [],
      tasks: [],
      reminders: [],
      events: [],
      externalAccounts: [],
      notifications: {
        desktopNotificationsEnabled: true,
        reminderNotificationsEnabled: true,
        dailyBriefingNotificationsEnabled: true,
        soundEnabled: true
      },
      dailyBriefing: {
        enabled: false,
        deliveryTimeLocal: '08:30',
        timeZone: resolveSafeTimeZone(),
        includeCalendar: true,
        includeTasks: true,
        includeReminders: true,
        includeNotes: true,
        useAiNarrativeSummary: false,
        lastPreparedDateKey: null,
        lastPreparedAt: null,
        lastDeliveryState: null
      },
      latestBriefing: null
    }
  }

  private loadStoreFromDisk(): PersistedProductivityStore {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true })
      }
      if (!fs.existsSync(this.storePath)) {
        return {
          schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
          updatedAt: this.nowFn(),
          profiles: {
            [DEFAULT_PRODUCTIVITY_PROFILE_ID]: this.createDefaultProfileData()
          }
        }
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedProductivityStore>
      if (!parsed || typeof parsed !== 'object' || !parsed.profiles) {
        throw new Error('Invalid productivity store structure')
      }

      const profiles: Record<string, ProfileProductivityData> = {}
      for (const [profileId, data] of Object.entries(parsed.profiles)) {
        const defaults = this.createDefaultProfileData()
        profiles[profileId] = {
          notes: Array.isArray(data?.notes) ? data.notes : [],
          tasks: Array.isArray(data?.tasks) ? data.tasks : [],
          reminders: Array.isArray(data?.reminders) ? data.reminders : [],
          events: Array.isArray(data?.events) ? data.events : [],
          externalAccounts: Array.isArray(data?.externalAccounts) ? data.externalAccounts : [],
          notifications: { ...defaults.notifications, ...(data?.notifications ?? {}) },
          dailyBriefing: { ...defaults.dailyBriefing, ...(data?.dailyBriefing ?? {}) },
          latestBriefing: data?.latestBriefing ?? null
        }
      }

      if (!profiles[DEFAULT_PRODUCTIVITY_PROFILE_ID]) {
        profiles[DEFAULT_PRODUCTIVITY_PROFILE_ID] = this.createDefaultProfileData()
      }

      return {
        schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
        updatedAt: parsed.updatedAt ?? this.nowFn(),
        profiles
      }
    } catch {
      try {
        if (fs.existsSync(this.storePath)) {
          const corruptBackup = `${this.storePath}.corrupt.${this.nowFn()}.json`
          fs.renameSync(this.storePath, corruptBackup)
        }
      } catch {
        // Ignore backup rename failure
      }
      return {
        schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
        updatedAt: this.nowFn(),
        profiles: {
          [DEFAULT_PRODUCTIVITY_PROFILE_ID]: this.createDefaultProfileData()
        }
      }
    }
  }

  private getProfileData(rawProfileId?: string): { profileId: string; data: ProfileProductivityData } {
    const profileId = ProductivityProfileIdSchema.parse(
      rawProfileId ?? DEFAULT_PRODUCTIVITY_PROFILE_ID
    )
    if (!this.store.profiles[profileId]) {
      this.store.profiles[profileId] = this.createDefaultProfileData()
    }
    return { profileId, data: this.store.profiles[profileId] }
  }

  /**
   * Executes a state mutation transactionally: snapshots the store prior to mutation,
   * writes atomically to disk via temp file + rename, and rolls back in-memory state
   * if persistence fails so the UI or tools never observe uncommitted state.
   */
  private mutateAndPersist<T>(mutator: () => T): T {
    const snapshot = JSON.stringify(this.store)
    try {
      const result = mutator()
      if (this.simulateDiskWriteFailure) {
        throw new Error('DISK_WRITE_FAILED: Simulated storage write failure')
      }

      this.store.updatedAt = this.nowFn()
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true })
      }
      const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf-8')
      fs.renameSync(tmpPath, this.storePath)
      this.scheduleNextTimerWakeup()
      return result
    } catch (err) {
      this.store = JSON.parse(snapshot) as PersistedProductivityStore
      throw err
    }
  }

  // --------------------------------------------------------------------------
  // 1. NOTES MANAGEMENT
  // --------------------------------------------------------------------------

  public createNote(request: CreateNoteRequest): NoteRecord {
    const parsed = CreateNoteRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety('Note', parsed.title, parsed.body)
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { profileId, data } = this.getProfileData(parsed.profileId)
    const now = this.nowFn()
    const note: NoteRecord = {
      id: `note_${crypto.randomUUID()}`,
      profileId,
      title: parsed.title,
      body: parsed.body,
      tags: Array.from(new Set(parsed.tags ?? [])),
      pinned: parsed.pinned ?? false,
      archived: parsed.archived ?? false,
      sourceAttribution: parsed.sourceAttribution ?? 'user_direct',
      createdAt: now,
      updatedAt: now,
      schemaVersion: PRODUCTIVITY_SCHEMA_VERSION
    }

    return this.mutateAndPersist(() => {
      data.notes.unshift(note)
      return note
    })
  }

  public getNote(id: string, rawProfileId?: string): NoteRecord | null {
    const { data } = this.getProfileData(rawProfileId)
    return data.notes.find((n) => n.id === id) ?? null
  }

  public listNotes(request: ListNotesRequest = {}): NoteRecord[] {
    const parsed = ListNotesRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const q = parsed.query?.toLowerCase().trim()

    return data.notes
      .filter((note) => {
        if (!parsed.includeArchived && note.archived) return false
        if (parsed.pinnedOnly && !note.pinned) return false
        if (parsed.tag && !note.tags.some((t) => t.toLowerCase() === parsed.tag!.toLowerCase())) {
          return false
        }
        if (q) {
          const inTitle = note.title.toLowerCase().includes(q)
          const inBody = note.body.toLowerCase().includes(q)
          const inTags = note.tags.some((t) => t.toLowerCase().includes(q))
          if (!inTitle && !inBody && !inTags) return false
        }
        return true
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
      .slice(0, parsed.limit)
  }

  public updateNote(request: UpdateNoteRequest): NoteRecord {
    const parsed = UpdateNoteRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety('Note', parsed.title, parsed.body)
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.notes.findIndex((n) => n.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Note '${parsed.id}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const current = data.notes[idx]
      const updated: NoteRecord = {
        ...current,
        title: parsed.title ?? current.title,
        body: parsed.body ?? current.body,
        tags: parsed.tags !== undefined ? Array.from(new Set(parsed.tags)) : current.tags,
        pinned: parsed.pinned ?? current.pinned,
        archived: parsed.archived ?? current.archived,
        updatedAt: this.nowFn()
      }
      data.notes[idx] = updated
      return updated
    })
  }

  public deleteNote(request: DeleteNoteRequest): { deleted: boolean; id: string } {
    const parsed = DeleteNoteRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.notes.findIndex((n) => n.id === parsed.id)
    if (idx === -1) {
      return { deleted: false, id: parsed.id }
    }

    return this.mutateAndPersist(() => {
      data.notes.splice(idx, 1)
      // Unlink any tasks referencing this note without deleting those tasks
      data.tasks = data.tasks.map((task) =>
        task.linkedNoteId === parsed.id ? { ...task, linkedNoteId: null } : task
      )
      return { deleted: true, id: parsed.id }
    })
  }

  // --------------------------------------------------------------------------
  // 2. TASK MANAGEMENT
  // --------------------------------------------------------------------------

  private computeTaskState(task: TaskItemRecord): TaskItemWithComputedState {
    const now = this.nowFn()
    const isTerminal = task.status === 'completed' || task.status === 'cancelled'
    const isOverdue = !isTerminal && task.dueAt !== null && task.dueAt < now
    const isDueToday =
      !isTerminal &&
      task.dueAt !== null &&
      formatLocalDateKey(task.dueAt, task.timeZone) === formatLocalDateKey(now, task.timeZone)

    return {
      ...task,
      isOverdue,
      isDueToday
    }
  }

  public createTask(request: CreateTaskRequest): TaskItemWithComputedState {
    const parsed = CreateTaskRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety('Task', parsed.title, parsed.description)
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { profileId, data } = this.getProfileData(parsed.profileId)
    const now = this.nowFn()
    const status = parsed.status ?? 'todo'
    const task: TaskItemRecord = {
      id: `task_${crypto.randomUUID()}`,
      profileId,
      title: parsed.title,
      description: parsed.description ?? '',
      status,
      priority: parsed.priority ?? 'medium',
      dueAt: parsed.dueAt ?? null,
      timeZone: resolveSafeTimeZone(parsed.timeZone),
      tags: Array.from(new Set(parsed.tags ?? [])),
      linkedNoteId: parsed.linkedNoteId ?? null,
      sourceAttribution: parsed.sourceAttribution ?? 'user_direct',
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'completed' ? now : null,
      schemaVersion: PRODUCTIVITY_SCHEMA_VERSION
    }

    const saved = this.mutateAndPersist(() => {
      data.tasks.unshift(task)
      return task
    })
    return this.computeTaskState(saved)
  }

  public getTask(id: string, rawProfileId?: string): TaskItemWithComputedState | null {
    const { data } = this.getProfileData(rawProfileId)
    const task = data.tasks.find((t) => t.id === id)
    return task ? this.computeTaskState(task) : null
  }

  public listTasks(request: ListTasksRequest = {}): TaskItemWithComputedState[] {
    const parsed = ListTasksRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const q = parsed.query?.toLowerCase().trim()

    return data.tasks
      .map((t) => this.computeTaskState(t))
      .filter((task) => {
        if (parsed.status === 'active_only') {
          if (task.status !== 'todo' && task.status !== 'in_progress') return false
        } else if (parsed.status && task.status !== parsed.status) {
          return false
        }
        if (parsed.priority && task.priority !== parsed.priority) return false
        if (parsed.tag && !task.tags.some((t) => t.toLowerCase() === parsed.tag!.toLowerCase())) {
          return false
        }
        if (parsed.overdueOnly && !task.isOverdue) return false
        if (parsed.dueTodayOnly && !task.isDueToday) return false
        if (q) {
          const inTitle = task.title.toLowerCase().includes(q)
          const inDesc = task.description.toLowerCase().includes(q)
          const inTags = task.tags.some((t) => t.toLowerCase().includes(q))
          if (!inTitle && !inDesc && !inTags) return false
        }
        return true
      })
      .sort((a, b) => {
        if (parsed.sortBy === 'priority') {
          const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
          if (diff !== 0) return diff
        } else if (parsed.sortBy === 'dueAt') {
          if (a.dueAt !== null && b.dueAt !== null && a.dueAt !== b.dueAt) {
            return a.dueAt - b.dueAt
          }
          if (a.dueAt !== null && b.dueAt === null) return -1
          if (a.dueAt === null && b.dueAt !== null) return 1
        } else if (parsed.sortBy === 'createdAt') {
          return b.createdAt - a.createdAt
        }
        return b.updatedAt - a.updatedAt
      })
      .slice(0, parsed.limit)
  }

  public updateTask(request: UpdateTaskRequest): TaskItemWithComputedState {
    const parsed = UpdateTaskRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety('Task', parsed.title, parsed.description)
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.tasks.findIndex((t) => t.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Task '${parsed.id}' not found.`)
    }

    const saved = this.mutateAndPersist(() => {
      const current = data.tasks[idx]
      const now = this.nowFn()
      const nextStatus = parsed.status ?? current.status

      let nextCompletedAt = current.completedAt
      if (nextStatus === 'completed' && current.status !== 'completed') {
        nextCompletedAt = now
      } else if (nextStatus !== 'completed') {
        // Reopening or cancelling a task clears stale completion timestamps
        nextCompletedAt = null
      }

      const updated: TaskItemRecord = {
        ...current,
        title: parsed.title ?? current.title,
        description: parsed.description ?? current.description,
        status: nextStatus,
        priority: parsed.priority ?? current.priority,
        dueAt: parsed.dueAt !== undefined ? parsed.dueAt : current.dueAt,
        timeZone: parsed.timeZone ? resolveSafeTimeZone(parsed.timeZone) : current.timeZone,
        tags: parsed.tags !== undefined ? Array.from(new Set(parsed.tags)) : current.tags,
        linkedNoteId:
          parsed.linkedNoteId !== undefined ? parsed.linkedNoteId : current.linkedNoteId,
        updatedAt: now,
        completedAt: nextCompletedAt
      }
      data.tasks[idx] = updated
      return updated
    })

    return this.computeTaskState(saved)
  }

  /**
   * Resolves a natural-language task completion request safely.
   * When multiple active tasks match the query, returns status 'ambiguous' with the
   * candidate list and NEVER mutates any task without user disambiguation.
   */
  public completeTaskByTitle(request: CompleteTaskByTitleRequest): CompleteTaskByTitleResponse {
    const parsed = CompleteTaskByTitleRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)

    if (parsed.targetTaskId) {
      const completed = this.updateTask({
        profileId,
        id: parsed.targetTaskId,
        status: 'completed'
      })
      return {
        status: 'completed',
        completedTask: completed,
        message: `Task "${completed.title}" marked as completed.`
      }
    }

    const q = parsed.titleQuery.toLowerCase().trim()
    const activeTasks = data.tasks.filter(
      (t) => t.status === 'todo' || t.status === 'in_progress'
    )

    const exactMatches = activeTasks.filter((t) => t.title.toLowerCase().trim() === q)
    const substringMatches =
      exactMatches.length > 0
        ? exactMatches
        : activeTasks.filter((t) => t.title.toLowerCase().includes(q))

    if (substringMatches.length === 0) {
      return {
        status: 'not_found',
        message: `No active task matching "${parsed.titleQuery}" was found.`
      }
    }

    if (substringMatches.length > 1) {
      return {
        status: 'ambiguous',
        candidates: substringMatches.map((t) => this.computeTaskState(t)),
        message: `Multiple active tasks (${substringMatches.length}) match "${parsed.titleQuery}". Please specify the exact task to complete.`
      }
    }

    const completed = this.updateTask({
      profileId,
      id: substringMatches[0].id,
      status: 'completed'
    })
    return {
      status: 'completed',
      completedTask: completed,
      message: `Task "${completed.title}" marked as completed.`
    }
  }

  public deleteTask(request: DeleteTaskRequest): { deleted: boolean; id: string } {
    const parsed = DeleteTaskRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.tasks.findIndex((t) => t.id === parsed.id)
    if (idx === -1) {
      return { deleted: false, id: parsed.id }
    }

    return this.mutateAndPersist(() => {
      data.tasks.splice(idx, 1)
      data.reminders = data.reminders.map((rem) =>
        rem.linkedTaskId === parsed.id ? { ...rem, linkedTaskId: null } : rem
      )
      return { deleted: true, id: parsed.id }
    })
  }

  // --------------------------------------------------------------------------
  // 3. REMINDER SCHEDULING, RECURRENCE & DELIVERY
  // --------------------------------------------------------------------------

  public createReminder(request: CreateReminderRequest): ReminderRecord {
    const parsed = CreateReminderRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety('Reminder', parsed.title, parsed.description)
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { profileId, data } = this.getProfileData(parsed.profileId)
    const now = this.nowFn()
    const safeTz = resolveSafeTimeZone(parsed.timeZone)
    const frequency = parsed.recurrence?.frequency ?? 'none'
    const recurrence: ReminderRecurrenceRule = {
      frequency,
      interval: parsed.recurrence?.interval ?? 1,
      localTime:
        parsed.recurrence?.localTime ??
        (frequency !== 'none' ? formatLocalTime24h(parsed.dueAt, safeTz) : undefined),
      daysOfWeek: parsed.recurrence?.daysOfWeek,
      endsAt: parsed.recurrence?.endsAt ?? null
    }

    const reminder: ReminderRecord = {
      id: `rem_${crypto.randomUUID()}`,
      profileId,
      title: parsed.title,
      description: parsed.description ?? '',
      dueAt: parsed.dueAt,
      timeZone: safeTz,
      status: 'scheduled',
      recurrence,
      linkedTaskId: parsed.linkedTaskId ?? null,
      linkedEventId: parsed.linkedEventId ?? null,
      snoozedUntil: null,
      lastAttemptAt: null,
      lastDeliveredAt: null,
      lastAcknowledgedAt: null,
      failureReason: null,
      occurrenceCount: 0,
      sourceAttribution: parsed.sourceAttribution ?? 'user_direct',
      createdAt: now,
      updatedAt: now,
      schemaVersion: PRODUCTIVITY_SCHEMA_VERSION
    }

    return this.mutateAndPersist(() => {
      data.reminders.push(reminder)
      return reminder
    })
  }

  public getReminder(id: string, rawProfileId?: string): ReminderRecord | null {
    const { data } = this.getProfileData(rawProfileId)
    return data.reminders.find((r) => r.id === id) ?? null
  }

  public listReminders(request: ListRemindersRequest = {}): ReminderRecord[] {
    const parsed = ListRemindersRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)

    return data.reminders
      .filter((rem) => {
        if (!parsed.includeCancelled && rem.status === 'cancelled') return false
        if (parsed.status === 'active_or_due') {
          return (
            rem.status === 'scheduled' ||
            rem.status === 'due' ||
            rem.status === 'delivered' ||
            rem.status === 'snoozed' ||
            rem.status === 'failed_or_unknown'
          )
        }
        if (parsed.status && rem.status !== parsed.status) return false
        return true
      })
      .sort((a, b) => {
        const effA = a.snoozedUntil ?? a.dueAt
        const effB = b.snoozedUntil ?? b.dueAt
        return effA - effB
      })
      .slice(0, parsed.limit)
  }

  public updateReminder(request: UpdateReminderRequest): ReminderRecord {
    const parsed = UpdateReminderRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety('Reminder', parsed.title, parsed.description)
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.reminders.findIndex((r) => r.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Reminder '${parsed.id}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const current = data.reminders[idx]
      const nextTz = parsed.timeZone ? resolveSafeTimeZone(parsed.timeZone) : current.timeZone
      const nextDueAt = parsed.dueAt ?? current.dueAt
      const nextRecurrence: ReminderRecurrenceRule = parsed.recurrence
        ? {
            frequency: parsed.recurrence.frequency ?? current.recurrence.frequency,
            interval: parsed.recurrence.interval ?? current.recurrence.interval,
            localTime:
              parsed.recurrence.localTime ??
              current.recurrence.localTime ??
              formatLocalTime24h(nextDueAt, nextTz),
            daysOfWeek: parsed.recurrence.daysOfWeek ?? current.recurrence.daysOfWeek,
            endsAt:
              parsed.recurrence.endsAt !== undefined
                ? parsed.recurrence.endsAt
                : current.recurrence.endsAt
          }
        : current.recurrence

      const updated: ReminderRecord = {
        ...current,
        title: parsed.title ?? current.title,
        description: parsed.description ?? current.description,
        dueAt: nextDueAt,
        timeZone: nextTz,
        recurrence: nextRecurrence,
        status: parsed.dueAt && parsed.dueAt > this.nowFn() ? 'scheduled' : current.status,
        snoozedUntil: parsed.dueAt ? null : current.snoozedUntil,
        updatedAt: this.nowFn()
      }
      data.reminders[idx] = updated
      return updated
    })
  }

  public snoozeReminder(request: SnoozeReminderRequest): ReminderRecord {
    const parsed = SnoozeReminderRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.reminders.findIndex((r) => r.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Reminder '${parsed.id}' not found.`)
    }

    const now = this.nowFn()
    const targetUntil =
      parsed.snoozedUntil ?? now + (parsed.durationMinutes ?? 10) * 60 * 1000
    if (targetUntil <= now) {
      throw new Error('Snooze target time must be in the future.')
    }

    return this.mutateAndPersist(() => {
      const current = data.reminders[idx]
      if (current.status === 'cancelled') {
        throw new Error('Cannot snooze a cancelled reminder.')
      }
      const updated: ReminderRecord = {
        ...current,
        status: 'snoozed',
        snoozedUntil: targetUntil,
        updatedAt: now
      }
      data.reminders[idx] = updated
      return updated
    })
  }

  public dismissReminder(request: DismissReminderRequest): ReminderRecord {
    const parsed = DismissReminderRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.reminders.findIndex((r) => r.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Reminder '${parsed.id}' not found.`)
    }

    const now = this.nowFn()
    return this.mutateAndPersist(() => {
      const current = data.reminders[idx]
      if (current.recurrence.frequency !== 'none') {
        const nextDueAt = computeNextRecurrenceDueAt(
          current.dueAt,
          current.recurrence,
          current.timeZone,
          now
        )
        if (nextDueAt !== null) {
          const rescheduled: ReminderRecord = {
            ...current,
            dueAt: nextDueAt,
            status: 'scheduled',
            snoozedUntil: null,
            lastAcknowledgedAt: now,
            failureReason: null,
            updatedAt: now
          }
          data.reminders[idx] = rescheduled
          return rescheduled
        }
      }

      const acknowledged: ReminderRecord = {
        ...current,
        status: 'acknowledged',
        snoozedUntil: null,
        lastAcknowledgedAt: now,
        updatedAt: now
      }
      data.reminders[idx] = acknowledged
      return acknowledged
    })
  }

  public cancelReminder(request: CancelReminderRequest): ReminderRecord {
    const parsed = CancelReminderRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.reminders.findIndex((r) => r.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Reminder '${parsed.id}' not found.`)
    }

    return this.mutateAndPersist(() => {
      const current = data.reminders[idx]
      const updated: ReminderRecord = {
        ...current,
        status: 'cancelled',
        snoozedUntil: null,
        updatedAt: this.nowFn()
      }
      data.reminders[idx] = updated
      return updated
    })
  }

  public deleteReminder(request: DeleteReminderRequest): { deleted: boolean; id: string } {
    const parsed = DeleteReminderRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.reminders.findIndex((r) => r.id === parsed.id)
    if (idx === -1) {
      return { deleted: false, id: parsed.id }
    }

    return this.mutateAndPersist(() => {
      data.reminders.splice(idx, 1)
      return { deleted: true, id: parsed.id }
    })
  }

  /**
   * Evaluates all scheduled and snoozed reminders against the current clock,
   * dispatches notifications where permitted, and records truthful delivery state.
   */
  public async evaluateDueReminders(rawProfileId?: string): Promise<ReminderRecord[]> {
    return this.evaluateDueRemindersInternal(rawProfileId)
  }

  private evaluateDueRemindersSyncWhenPossible(rawProfileId?: string): void {
    const profileIds = rawProfileId
      ? [ProductivityProfileIdSchema.parse(rawProfileId)]
      : Object.keys(this.store.profiles)
    const now = this.nowFn()

    for (const profileId of profileIds) {
      const { data } = this.getProfileData(profileId)
      const notificationsAllowed =
        data.notifications.desktopNotificationsEnabled &&
        data.notifications.reminderNotificationsEnabled &&
        this.notificationDispatcher.isSupportedAndPermitted()

      for (let i = 0; i < data.reminders.length; i++) {
        const rem = data.reminders[i]
        if (rem.status !== 'scheduled' && rem.status !== 'snoozed') {
          continue
        }
        const effectiveTarget =
          rem.status === 'snoozed' && rem.snoozedUntil ? rem.snoozedUntil : rem.dueAt
        if (effectiveTarget > now) {
          continue
        }

        let delivered = false
        let failureReason: string | null = null

        if (
          !data.notifications.desktopNotificationsEnabled ||
          !data.notifications.reminderNotificationsEnabled
        ) {
          delivered = false
          failureReason = 'Reminder desktop notifications are disabled in user preferences.'
        } else if (!this.notificationDispatcher.isSupportedAndPermitted()) {
          delivered = false
          failureReason = 'OS desktop notification permission is unavailable or denied.'
        } else if (notificationsAllowed) {
          try {
            const maybePromise = this.notificationDispatcher.dispatch({
              title: `HELIOXEN Reminder: ${rem.title}`,
              body: rem.description || 'Scheduled reminder is now due.',
              category: 'reminder',
              referenceId: rem.id
            })
            if (maybePromise instanceof Promise) {
              void maybePromise.then((res) => {
                this.mutateAndPersist(() => {
                  const current = data.reminders[i]
                  data.reminders[i] = {
                    ...current,
                    status: res.delivered ? 'delivered' : 'failed_or_unknown',
                    snoozedUntil: null,
                    lastAttemptAt: now,
                    lastDeliveredAt: res.delivered ? now : current.lastDeliveredAt,
                    failureReason: res.failureReason ?? null,
                    occurrenceCount: current.occurrenceCount + 1,
                    updatedAt: now
                  }
                })
              })
              continue
            }
            delivered = maybePromise.delivered
            failureReason = maybePromise.failureReason ?? null
          } catch (err) {
            delivered = false
            failureReason = err instanceof Error ? err.message : 'Notification dispatch failed'
          }
        }

        this.mutateAndPersist(() => {
          const current = data.reminders[i]
          data.reminders[i] = {
            ...current,
            status: delivered ? 'delivered' : 'failed_or_unknown',
            snoozedUntil: null,
            lastAttemptAt: now,
            lastDeliveredAt: delivered ? now : current.lastDeliveredAt,
            failureReason,
            occurrenceCount: current.occurrenceCount + 1,
            updatedAt: now
          }
        })
      }
    }
  }

  private async evaluateDueRemindersInternal(rawProfileId?: string): Promise<ReminderRecord[]> {
    const profileIds = rawProfileId
      ? [ProductivityProfileIdSchema.parse(rawProfileId)]
      : Object.keys(this.store.profiles)

    const triggered: ReminderRecord[] = []
    const now = this.nowFn()

    for (const profileId of profileIds) {
      const { data } = this.getProfileData(profileId)
      const notificationsAllowed =
        data.notifications.desktopNotificationsEnabled &&
        data.notifications.reminderNotificationsEnabled &&
        this.notificationDispatcher.isSupportedAndPermitted()

      for (let i = 0; i < data.reminders.length; i++) {
        const rem = data.reminders[i]
        if (rem.status !== 'scheduled' && rem.status !== 'snoozed') {
          continue
        }

        const effectiveTarget = rem.status === 'snoozed' && rem.snoozedUntil ? rem.snoozedUntil : rem.dueAt
        if (effectiveTarget > now) {
          continue
        }

        let delivered = false
        let failureReason: string | null = null

        if (!data.notifications.desktopNotificationsEnabled || !data.notifications.reminderNotificationsEnabled) {
          delivered = false
          failureReason = 'Reminder desktop notifications are disabled in user preferences.'
        } else if (!this.notificationDispatcher.isSupportedAndPermitted()) {
          delivered = false
          failureReason = 'OS desktop notification permission is unavailable or denied.'
        } else if (notificationsAllowed) {
          try {
            const dispatchRes = await this.notificationDispatcher.dispatch({
              title: `HELIOXEN Reminder: ${rem.title}`,
              body: rem.description || 'Scheduled reminder is now due.',
              category: 'reminder',
              referenceId: rem.id
            })
            delivered = dispatchRes.delivered
            failureReason = dispatchRes.failureReason ?? null
          } catch (err) {
            delivered = false
            failureReason = err instanceof Error ? err.message : 'Notification dispatch failed'
          }
        }

        const updatedReminder = this.mutateAndPersist(() => {
          const current = data.reminders[i]
          const next: ReminderRecord = {
            ...current,
            status: delivered ? 'delivered' : 'failed_or_unknown',
            snoozedUntil: null,
            lastAttemptAt: now,
            lastDeliveredAt: delivered ? now : current.lastDeliveredAt,
            failureReason,
            occurrenceCount: current.occurrenceCount + 1,
            updatedAt: now
          }
          data.reminders[i] = next
          return next
        })

        triggered.push(updatedReminder)
      }
    }

    return triggered
  }

  /**
   * Reconciles overdue reminders and missed scheduled daily briefings on application
   * startup or system resume without generating duplicate notifications.
   */
  public reconcileStartupAndResume(): void {
    this.evaluateDueRemindersSyncWhenPossible()
    for (const profileId of Object.keys(this.store.profiles)) {
      const { data } = this.getProfileData(profileId)
      if (!data.dailyBriefing.enabled) continue

      const now = this.nowFn()
      const tz = resolveSafeTimeZone(data.dailyBriefing.timeZone)
      const todayDateKey = formatLocalDateKey(now, tz)
      const scheduledTimestampToday = resolveLocalWallClockToTimestamp(
        todayDateKey,
        data.dailyBriefing.deliveryTimeLocal,
        tz
      )

      if (now >= scheduledTimestampToday && data.dailyBriefing.lastPreparedDateKey !== todayDateKey) {
        void this.generateDailyBriefing({
          profileId,
          mode: 'startup_recovery',
          dateKey: todayDateKey,
          forceRegenerate: false
        })
      }
    }
    this.scheduleNextTimerWakeup()
  }

  private scheduleNextTimerWakeup(): void {
    if (this.disposed || !this.enableBackgroundTimer) return
    if (this.nextTimer) {
      clearTimeout(this.nextTimer)
      this.nextTimer = null
    }

    const now = this.nowFn()
    let earliestTargetMs: number | null = null

    for (const data of Object.values(this.store.profiles)) {
      for (const rem of data.reminders) {
        if (rem.status !== 'scheduled' && rem.status !== 'snoozed') continue
        const target = rem.status === 'snoozed' && rem.snoozedUntil ? rem.snoozedUntil : rem.dueAt
        if (target > now && (earliestTargetMs === null || target < earliestTargetMs)) {
          earliestTargetMs = target
        }
      }

      if (data.dailyBriefing.enabled) {
        const tz = resolveSafeTimeZone(data.dailyBriefing.timeZone)
        const todayKey = formatLocalDateKey(now, tz)
        let nextBriefingTs = resolveLocalWallClockToTimestamp(
          todayKey,
          data.dailyBriefing.deliveryTimeLocal,
          tz
        )
        if (nextBriefingTs <= now || data.dailyBriefing.lastPreparedDateKey === todayKey) {
          const tomorrowKey = addDaysToDateKey(todayKey, 1)
          nextBriefingTs = resolveLocalWallClockToTimestamp(
            tomorrowKey,
            data.dailyBriefing.deliveryTimeLocal,
            tz
          )
        }
        if (earliestTargetMs === null || nextBriefingTs < earliestTargetMs) {
          earliestTargetMs = nextBriefingTs
        }
      }
    }

    if (earliestTargetMs !== null) {
      const delayMs = Math.min(Math.max(50, earliestTargetMs - now), 60 * 60 * 1000)
      this.nextTimer = setTimeout(() => {
        this.reconcileStartupAndResume()
      }, delayMs)
    }
  }

  // --------------------------------------------------------------------------
  // 4. CALENDAR EVENT MANAGEMENT & EXTERNAL PROVIDER ADAPTER
  // --------------------------------------------------------------------------

  private normalizeCalendarEventTimes(input: {
    allDay: boolean
    allDayStartDate?: string | null
    allDayEndDate?: string | null
    startAt?: number
    endAt?: number
    timeZone: string
  }): {
    startAt: number
    endAt: number
    allDayStartDate: string | null
    allDayEndDate: string | null
  } {
    if (input.allDay) {
      const startDate = input.allDayStartDate!
      const endDate = input.allDayEndDate ?? startDate
      const startAt = resolveLocalWallClockToTimestamp(startDate, '00:00', input.timeZone)
      const endAt = resolveLocalWallClockToTimestamp(endDate, '23:59', input.timeZone) + 59999
      return {
        startAt,
        endAt,
        allDayStartDate: startDate,
        allDayEndDate: endDate
      }
    }

    return {
      startAt: input.startAt!,
      endAt: input.endAt!,
      allDayStartDate: null,
      allDayEndDate: null
    }
  }

  public async createCalendarEvent(request: CreateCalendarEventRequest): Promise<CalendarEventRecord> {
    const parsed = CreateCalendarEventRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety(
      'Calendar event',
      parsed.title,
      parsed.description,
      parsed.location
    )
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { profileId, data } = this.getProfileData(parsed.profileId)
    const safeTz = resolveSafeTimeZone(parsed.timeZone)
    const times = this.normalizeCalendarEventTimes({
      allDay: parsed.allDay,
      allDayStartDate: parsed.allDayStartDate,
      allDayEndDate: parsed.allDayEndDate,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      timeZone: safeTz
    })

    const now = this.nowFn()
    if (parsed.providerId !== 'local') {
      if (!parsed.humanConfirmed) {
        throw new Error(
          'CONFIRMATION_REQUIRED: Creating an event on an external calendar provider requires explicit human confirmation.'
        )
      }

      const account = data.externalAccounts.find((a) => a.providerId === parsed.providerId)
      if (!account || account.status === 'disconnected' || !account.credentialRef) {
        throw new Error(`External calendar provider '${parsed.providerId}' is not connected.`)
      }
      const token = this.tokenVault.retrieveToken(account.credentialRef)
      if (!token) {
        throw new Error(`Missing credentials for external calendar provider '${parsed.providerId}'.`)
      }

      const adapter = this.calendarAdapters[parsed.providerId]
      const remoteCreated = await adapter.createRemoteEvent({
        accessToken: token,
        calendarId: parsed.calendarId || account.calendarId,
        event: {
          recurringMasterId: parsed.recurringMasterId ?? null,
          isRecurringInstance: parsed.isRecurringInstance ?? false,
          calendarId: parsed.calendarId || account.calendarId,
          title: parsed.title,
          description: parsed.description,
          startAt: times.startAt,
          endAt: times.endAt,
          allDay: parsed.allDay,
          allDayStartDate: times.allDayStartDate,
          allDayEndDate: times.allDayEndDate,
          timeZone: safeTz,
          location: parsed.location,
          attendees: parsed.attendees
        }
      })

      const record: CalendarEventRecord = {
        id: `evt_${crypto.randomUUID()}`,
        profileId,
        externalEventId: remoteCreated.externalEventId,
        recurringMasterId: remoteCreated.recurringMasterId ?? null,
        isRecurringInstance: remoteCreated.isRecurringInstance ?? false,
        providerId: parsed.providerId,
        calendarId: remoteCreated.calendarId,
        title: remoteCreated.title,
        description: remoteCreated.description,
        startAt: remoteCreated.startAt,
        endAt: remoteCreated.endAt,
        allDay: remoteCreated.allDay,
        allDayStartDate: remoteCreated.allDayStartDate,
        allDayEndDate: remoteCreated.allDayEndDate,
        timeZone: remoteCreated.timeZone,
        location: remoteCreated.location,
        attendees: remoteCreated.attendees,
        source: 'external_provider',
        syncState: 'synced',
        remoteEtag: remoteCreated.remoteEtag,
        lastSyncedAt: now,
        conflictDetails: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: PRODUCTIVITY_SCHEMA_VERSION
      }

      return this.mutateAndPersist(() => {
        data.events.push(record)
        return record
      })
    }

    const localRecord: CalendarEventRecord = {
      id: `evt_${crypto.randomUUID()}`,
      profileId,
      externalEventId: null,
      recurringMasterId: parsed.recurringMasterId ?? null,
      isRecurringInstance: parsed.isRecurringInstance ?? false,
      providerId: 'local',
      calendarId: parsed.calendarId || 'primary',
      title: parsed.title,
      description: parsed.description,
      startAt: times.startAt,
      endAt: times.endAt,
      allDay: parsed.allDay,
      allDayStartDate: times.allDayStartDate,
      allDayEndDate: times.allDayEndDate,
      timeZone: safeTz,
      location: parsed.location,
      attendees: parsed.attendees,
      source: 'local',
      syncState: 'local_only',
      remoteEtag: null,
      lastSyncedAt: null,
      conflictDetails: null,
      createdAt: now,
      updatedAt: now,
      schemaVersion: PRODUCTIVITY_SCHEMA_VERSION
    }

    return this.mutateAndPersist(() => {
      data.events.push(localRecord)
      return localRecord
    })
  }

  public getCalendarEvent(id: string, rawProfileId?: string): CalendarEventRecord | null {
    const { data } = this.getProfileData(rawProfileId)
    return data.events.find((e) => e.id === id) ?? null
  }

  public listCalendarEvents(request: ListCalendarEventsRequest = {}): CalendarEventRecord[] {
    const parsed = ListCalendarEventsRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const q = parsed.query?.toLowerCase().trim()

    return data.events
      .filter((ev) => {
        if (parsed.providerId && ev.providerId !== parsed.providerId) return false
        if (parsed.dateKey) {
          if (ev.allDay && ev.allDayStartDate && ev.allDayEndDate) {
            if (parsed.dateKey < ev.allDayStartDate || parsed.dateKey > ev.allDayEndDate) {
              return false
            }
          } else {
            const evStartKey = formatLocalDateKey(ev.startAt, ev.timeZone)
            const evEndKey = formatLocalDateKey(ev.endAt, ev.timeZone)
            if (parsed.dateKey < evStartKey || parsed.dateKey > evEndKey) {
              return false
            }
          }
        }
        if (parsed.rangeStartAt !== undefined && ev.endAt < parsed.rangeStartAt) return false
        if (parsed.rangeEndAt !== undefined && ev.startAt > parsed.rangeEndAt) return false
        if (q) {
          const inTitle = ev.title.toLowerCase().includes(q)
          const inDesc = ev.description.toLowerCase().includes(q)
          const inLoc = ev.location.toLowerCase().includes(q)
          if (!inTitle && !inDesc && !inLoc) return false
        }
        return true
      })
      .sort((a, b) => a.startAt - b.startAt)
      .slice(0, parsed.limit)
  }

  public async updateCalendarEvent(request: UpdateCalendarEventRequest): Promise<CalendarEventRecord> {
    const parsed = UpdateCalendarEventRequestSchema.parse(request)
    const safety = inspectProductivityTextSafety(
      'Calendar event',
      parsed.title,
      parsed.description,
      parsed.location
    )
    if (!safety.allowed) {
      throw new Error(safety.reason)
    }

    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.events.findIndex((e) => e.id === parsed.id)
    if (idx === -1) {
      throw new Error(`Calendar event '${parsed.id}' not found.`)
    }

    const current = data.events[idx]
    const nextAllDay = parsed.allDay ?? current.allDay
    const nextTz = parsed.timeZone ? resolveSafeTimeZone(parsed.timeZone) : current.timeZone
    const nextStartAt = parsed.startAt ?? current.startAt
    const nextEndAt = parsed.endAt ?? current.endAt

    if (!nextAllDay && nextEndAt < nextStartAt) {
      throw new Error('Calendar event endAt cannot be earlier than startAt.')
    }

    const times = this.normalizeCalendarEventTimes({
      allDay: nextAllDay,
      allDayStartDate:
        parsed.allDayStartDate !== undefined ? parsed.allDayStartDate : current.allDayStartDate,
      allDayEndDate:
        parsed.allDayEndDate !== undefined ? parsed.allDayEndDate : current.allDayEndDate,
      startAt: nextStartAt,
      endAt: nextEndAt,
      timeZone: nextTz
    })

    const now = this.nowFn()

    if (current.providerId !== 'local' && current.externalEventId) {
      if (!parsed.humanConfirmed) {
        throw new Error(
          'CONFIRMATION_REQUIRED: Modifying an external calendar event requires explicit human confirmation.'
        )
      }

      const account = data.externalAccounts.find((a) => a.providerId === current.providerId)
      const token = account?.credentialRef
        ? this.tokenVault.retrieveToken(account.credentialRef)
        : null
      if (!account || !token) {
        throw new Error(`External calendar provider '${current.providerId}' is not connected.`)
      }

      const adapter = this.calendarAdapters[current.providerId]
      try {
        const remoteUpdated = await adapter.updateRemoteEvent({
          accessToken: token,
          calendarId: current.calendarId,
          externalEventId: current.externalEventId,
          expectedEtag: current.remoteEtag,
          recurrenceScope: parsed.recurrenceScope ?? 'single_occurrence',
          updates: {
            title: parsed.title ?? current.title,
            description: parsed.description ?? current.description,
            startAt: times.startAt,
            endAt: times.endAt,
            allDay: nextAllDay,
            allDayStartDate: times.allDayStartDate,
            allDayEndDate: times.allDayEndDate,
            timeZone: nextTz,
            location: parsed.location ?? current.location,
            attendees: parsed.attendees ?? current.attendees
          }
        })

        return this.mutateAndPersist(() => {
          const updated: CalendarEventRecord = {
            ...current,
            title: remoteUpdated.title,
            description: remoteUpdated.description,
            startAt: remoteUpdated.startAt,
            endAt: remoteUpdated.endAt,
            allDay: remoteUpdated.allDay,
            allDayStartDate: remoteUpdated.allDayStartDate,
            allDayEndDate: remoteUpdated.allDayEndDate,
            timeZone: remoteUpdated.timeZone,
            location: remoteUpdated.location,
            attendees: remoteUpdated.attendees,
            syncState: 'synced',
            remoteEtag: remoteUpdated.remoteEtag,
            lastSyncedAt: now,
            conflictDetails: null,
            updatedAt: now
          }
          data.events[idx] = updated
          return updated
        })
      } catch (err) {
        if (err instanceof CalendarAdapterTimeoutError) {
          this.mutateAndPersist(() => {
            data.events[idx] = {
              ...current,
              syncState: 'unknown_timeout',
              conflictDetails: err.message,
              updatedAt: now
            }
          })
          throw err
        }
        if (err instanceof CalendarAdapterConflictError) {
          this.mutateAndPersist(() => {
            data.events[idx] = {
              ...current,
              syncState: 'conflict',
              conflictDetails: err.message,
              updatedAt: now
            }
          })
          throw err
        }
        throw err
      }
    }

    return this.mutateAndPersist(() => {
      const updated: CalendarEventRecord = {
        ...current,
        title: parsed.title ?? current.title,
        description: parsed.description ?? current.description,
        startAt: times.startAt,
        endAt: times.endAt,
        allDay: nextAllDay,
        allDayStartDate: times.allDayStartDate,
        allDayEndDate: times.allDayEndDate,
        timeZone: nextTz,
        location: parsed.location ?? current.location,
        attendees: parsed.attendees ?? current.attendees,
        updatedAt: now
      }
      data.events[idx] = updated
      return updated
    })
  }

  public async deleteCalendarEvent(
    request: DeleteCalendarEventRequest
  ): Promise<{ deleted: boolean; deletedIds: string[]; scope: string }> {
    const parsed = DeleteCalendarEventRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.events.findIndex((e) => e.id === parsed.id)
    if (idx === -1) {
      return { deleted: false, deletedIds: [], scope: parsed.recurrenceScope ?? 'single_occurrence' }
    }

    const current = data.events[idx]
    const scope = parsed.recurrenceScope ?? 'single_occurrence'
    const now = this.nowFn()

    if (current.providerId !== 'local' && current.externalEventId) {
      if (!parsed.humanConfirmed) {
        throw new Error(
          'CONFIRMATION_REQUIRED: Deleting an external calendar event requires explicit human confirmation.'
        )
      }

      const account = data.externalAccounts.find((a) => a.providerId === current.providerId)
      const token = account?.credentialRef
        ? this.tokenVault.retrieveToken(account.credentialRef)
        : null
      if (!account || !token) {
        throw new Error(`External calendar provider '${current.providerId}' is not connected.`)
      }

      const adapter = this.calendarAdapters[current.providerId]
      try {
        const remoteRes = await adapter.deleteRemoteEvent({
          accessToken: token,
          calendarId: current.calendarId,
          externalEventId: current.externalEventId,
          expectedEtag: current.remoteEtag,
          recurrenceScope: scope
        })

        return this.mutateAndPersist(() => {
          const removedLocalIds: string[] = []
          data.events = data.events.filter((ev) => {
            if (ev.id === current.id) {
              removedLocalIds.push(ev.id)
              return false
            }
            if (
              remoteRes.seriesDeleted &&
              current.recurringMasterId &&
              (ev.recurringMasterId === current.recurringMasterId ||
                ev.externalEventId === current.recurringMasterId)
            ) {
              removedLocalIds.push(ev.id)
              return false
            }
            return true
          })
          return { deleted: true, deletedIds: removedLocalIds, scope }
        })
      } catch (err) {
        if (err instanceof CalendarAdapterTimeoutError) {
          this.mutateAndPersist(() => {
            data.events[idx] = {
              ...current,
              syncState: 'unknown_timeout',
              conflictDetails: err.message,
              updatedAt: now
            }
          })
        }
        throw err
      }
    }

    return this.mutateAndPersist(() => {
      const removedLocalIds: string[] = []
      data.events = data.events.filter((ev) => {
        if (ev.id === current.id) {
          removedLocalIds.push(ev.id)
          return false
        }
        if (
          scope === 'entire_series' &&
          current.recurringMasterId &&
          (ev.recurringMasterId === current.recurringMasterId || ev.id === current.recurringMasterId)
        ) {
          removedLocalIds.push(ev.id)
          return false
        }
        return true
      })
      return { deleted: true, deletedIds: removedLocalIds, scope }
    })
  }

  public async connectExternalCalendar(
    request: ConnectExternalCalendarRequest
  ): Promise<ExternalCalendarAccountState> {
    const parsed = ConnectExternalCalendarRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)
    const adapter = this.calendarAdapters[parsed.providerId]

    await adapter.validateCredentials({
      accessToken: parsed.accessToken,
      calendarId: parsed.calendarId
    })

    const credentialRef = `cal_token_${profileId}_${parsed.providerId}`
    this.tokenVault.storeToken(credentialRef, parsed.accessToken)

    const accountState: ExternalCalendarAccountState = {
      providerId: parsed.providerId,
      accountLabel: parsed.accountLabel,
      calendarId: parsed.calendarId,
      status: 'connected',
      credentialRef,
      lastSyncAttemptAt: null,
      lastSyncSuccessAt: null,
      lastSyncError: null,
      syncCursor: null
    }

    return this.mutateAndPersist(() => {
      const idx = data.externalAccounts.findIndex((a) => a.providerId === parsed.providerId)
      if (idx >= 0) {
        data.externalAccounts[idx] = accountState
      } else {
        data.externalAccounts.push(accountState)
      }
      return accountState
    })
  }

  public disconnectExternalCalendar(
    request: DisconnectExternalCalendarRequest
  ): ExternalCalendarAccountState {
    const parsed = DisconnectExternalCalendarRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)
    const idx = data.externalAccounts.findIndex((a) => a.providerId === parsed.providerId)
    if (idx === -1) {
      return {
        providerId: parsed.providerId,
        accountLabel: parsed.providerId,
        calendarId: 'primary',
        status: 'disconnected',
        credentialRef: null,
        lastSyncAttemptAt: null,
        lastSyncSuccessAt: null,
        lastSyncError: null,
        syncCursor: null
      }
    }

    const current = data.externalAccounts[idx]
    if (current.credentialRef) {
      this.tokenVault.deleteToken(current.credentialRef)
    }

    return this.mutateAndPersist(() => {
      const updated: ExternalCalendarAccountState = {
        ...current,
        status: 'disconnected',
        credentialRef: null,
        syncCursor: null
      }
      data.externalAccounts[idx] = updated
      if (parsed.removeCachedEvents) {
        data.events = data.events.filter((e) => e.providerId !== parsed.providerId)
      }
      return updated
    })
  }

  public async syncExternalCalendar(
    request: SyncExternalCalendarRequest
  ): Promise<SyncExternalCalendarResult> {
    const parsed = SyncExternalCalendarRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)
    const accIdx = data.externalAccounts.findIndex((a) => a.providerId === parsed.providerId)
    if (accIdx === -1 || data.externalAccounts[accIdx].status === 'disconnected') {
      throw new Error(`External calendar provider '${parsed.providerId}' is not connected.`)
    }

    const account = data.externalAccounts[accIdx]
    const token = account.credentialRef ? this.tokenVault.retrieveToken(account.credentialRef) : null
    const now = this.nowFn()

    if (!token) {
      this.mutateAndPersist(() => {
        data.externalAccounts[accIdx] = {
          ...account,
          status: 'reauth_required',
          lastSyncAttemptAt: now,
          lastSyncError: 'Credentials missing or expired; re-authentication required.'
        }
      })
      return {
        providerId: parsed.providerId,
        status: 'reauth_required',
        upsertedCount: 0,
        deletedCount: 0,
        conflictCount: 0,
        syncedAt: now,
        errorMessage: 'Credentials missing or expired; re-authentication required.'
      }
    }

    const adapter = this.calendarAdapters[parsed.providerId]
    try {
      let pageToken: string | null | undefined = null
      let nextSyncCursor: string | null = account.syncCursor
      const deduplicatedByExternalId = new Map<string, Awaited<ReturnType<typeof adapter.fetchEventsPage>>['events'][number]>()
      let pageCount = 0

      do {
        pageCount++
        if (pageCount > 25) break
        const page = await adapter.fetchEventsPage({
          accessToken: token,
          calendarId: account.calendarId,
          syncCursor: account.syncCursor,
          pageToken
        })
        for (const item of page.events) {
          deduplicatedByExternalId.set(item.externalEventId, item)
        }
        pageToken = page.nextPageToken ?? null
        if (page.nextSyncCursor) {
          nextSyncCursor = page.nextSyncCursor
        }
      } while (pageToken)

      return this.mutateAndPersist(() => {
        let upsertedCount = 0
        let deletedCount = 0
        let conflictCount = 0

        for (const remoteItem of deduplicatedByExternalId.values()) {
          const existingIdx = data.events.findIndex(
            (e) =>
              e.providerId === parsed.providerId &&
              e.externalEventId === remoteItem.externalEventId
          )

          if (remoteItem.deleted) {
            if (existingIdx !== -1) {
              data.events.splice(existingIdx, 1)
              deletedCount++
            }
            continue
          }

          if (existingIdx !== -1) {
            const localEv = data.events[existingIdx]
            if (
              localEv.syncState === 'pending_push' &&
              localEv.remoteEtag &&
              localEv.remoteEtag !== remoteItem.remoteEtag
            ) {
              data.events[existingIdx] = {
                ...localEv,
                syncState: 'conflict',
                conflictDetails: `Local unpushed edit conflicts with remote update (${remoteItem.remoteEtag}).`,
                updatedAt: now
              }
              conflictCount++
              continue
            }

            data.events[existingIdx] = {
              ...localEv,
              recurringMasterId: remoteItem.recurringMasterId ?? localEv.recurringMasterId,
              isRecurringInstance: remoteItem.isRecurringInstance ?? localEv.isRecurringInstance,
              title: remoteItem.title,
              description: remoteItem.description,
              startAt: remoteItem.startAt,
              endAt: remoteItem.endAt,
              allDay: remoteItem.allDay,
              allDayStartDate: remoteItem.allDayStartDate,
              allDayEndDate: remoteItem.allDayEndDate,
              timeZone: resolveSafeTimeZone(remoteItem.timeZone),
              location: remoteItem.location,
              attendees: remoteItem.attendees,
              syncState: 'synced',
              remoteEtag: remoteItem.remoteEtag,
              lastSyncedAt: now,
              conflictDetails: null,
              updatedAt: now
            }
            upsertedCount++
          } else {
            data.events.push({
              id: `evt_${crypto.randomUUID()}`,
              profileId,
              externalEventId: remoteItem.externalEventId,
              recurringMasterId: remoteItem.recurringMasterId ?? null,
              isRecurringInstance: remoteItem.isRecurringInstance ?? false,
              providerId: parsed.providerId,
              calendarId: remoteItem.calendarId,
              title: remoteItem.title,
              description: remoteItem.description,
              startAt: remoteItem.startAt,
              endAt: remoteItem.endAt,
              allDay: remoteItem.allDay,
              allDayStartDate: remoteItem.allDayStartDate,
              allDayEndDate: remoteItem.allDayEndDate,
              timeZone: resolveSafeTimeZone(remoteItem.timeZone),
              location: remoteItem.location,
              attendees: remoteItem.attendees,
              source: 'external_provider',
              syncState: 'synced',
              remoteEtag: remoteItem.remoteEtag,
              lastSyncedAt: now,
              conflictDetails: null,
              createdAt: now,
              updatedAt: now,
              schemaVersion: PRODUCTIVITY_SCHEMA_VERSION
            })
            upsertedCount++
          }
        }

        data.externalAccounts[accIdx] = {
          ...account,
          status: 'sync_succeeded',
          lastSyncAttemptAt: now,
          lastSyncSuccessAt: now,
          lastSyncError: null,
          syncCursor: nextSyncCursor
        }

        return {
          providerId: parsed.providerId,
          status: 'sync_succeeded',
          upsertedCount,
          deletedCount,
          conflictCount,
          syncedAt: now
        }
      })
    } catch (err) {
      const isAuthErr = err instanceof CalendarAdapterAuthError
      const nextStatus = isAuthErr ? 'reauth_required' : 'sync_failed'
      const errMsg = err instanceof Error ? err.message : 'External calendar synchronization failed'

      this.mutateAndPersist(() => {
        data.externalAccounts[accIdx] = {
          ...account,
          status: nextStatus,
          lastSyncAttemptAt: now,
          lastSyncError: errMsg
        }
      })

      return {
        providerId: parsed.providerId,
        status: nextStatus,
        upsertedCount: 0,
        deletedCount: 0,
        conflictCount: 0,
        syncedAt: now,
        errorMessage: errMsg
      }
    }
  }

  public listExternalAccounts(rawProfileId?: string): ExternalCalendarAccountState[] {
    const { data } = this.getProfileData(rawProfileId)
    const now = this.nowFn()
    return data.externalAccounts.map((acc) => {
      if (
        acc.status === 'sync_succeeded' &&
        acc.lastSyncSuccessAt &&
        now - acc.lastSyncSuccessAt > STALE_SYNC_THRESHOLD_MS
      ) {
        return { ...acc, status: 'stale' }
      }
      return acc
    })
  }

  // --------------------------------------------------------------------------
  // 5. DAILY BRIEFING SERVICE & SETTINGS
  // --------------------------------------------------------------------------

  public updateSettings(request: UpdateProductivitySettingsRequest): {
    notifications: ProductivityNotificationPreferences
    dailyBriefing: DailyBriefingPreferences
  } {
    const parsed = UpdateProductivitySettingsRequestSchema.parse(request)
    const { data } = this.getProfileData(parsed.profileId)

    return this.mutateAndPersist(() => {
      if (parsed.notifications) {
        data.notifications = {
          ...data.notifications,
          ...parsed.notifications
        }
      }
      if (parsed.dailyBriefing) {
        data.dailyBriefing = {
          ...data.dailyBriefing,
          ...parsed.dailyBriefing,
          timeZone: parsed.dailyBriefing.timeZone
            ? resolveSafeTimeZone(parsed.dailyBriefing.timeZone)
            : data.dailyBriefing.timeZone
        }
      }
      return {
        notifications: data.notifications,
        dailyBriefing: data.dailyBriefing
      }
    })
  }

  public async generateDailyBriefing(
    request: GenerateDailyBriefingRequest = {}
  ): Promise<DailyBriefingReport> {
    const parsed = GenerateDailyBriefingRequestSchema.parse(request)
    const { profileId, data } = this.getProfileData(parsed.profileId)
    const now = this.nowFn()
    const prefs = data.dailyBriefing
    const tz = resolveSafeTimeZone(prefs.timeZone)
    const targetDateKey = parsed.dateKey ?? formatLocalDateKey(now, tz)

    // Prevent duplicate scheduled/startup generation for the same calendar date
    if (
      !parsed.forceRegenerate &&
      (parsed.mode === 'scheduled' || parsed.mode === 'startup_recovery') &&
      prefs.lastPreparedDateKey === targetDateKey &&
      data.latestBriefing &&
      data.latestBriefing.dateKey === targetDateKey
    ) {
      return data.latestBriefing
    }

    const dayStartMs = resolveLocalWallClockToTimestamp(targetDateKey, '00:00', tz)
    const dayEndMs = resolveLocalWallClockToTimestamp(targetDateKey, '23:59', tz) + 59999
    const upcomingWindowEndMs = dayEndMs + 48 * 60 * 60 * 1000

    const todaysEvents = prefs.includeCalendar
      ? this.listCalendarEvents({ profileId, dateKey: targetDateKey })
      : []

    const upcomingEvents = prefs.includeCalendar
      ? this.listCalendarEvents({
          profileId,
          rangeStartAt: dayEndMs + 1,
          rangeEndAt: upcomingWindowEndMs
        })
      : []

    const allActiveTasks = prefs.includeTasks
      ? this.listTasks({ profileId, status: 'active_only', sortBy: 'dueAt' })
      : []

    const tasksDueToday = allActiveTasks.filter((t) => t.isDueToday && !t.isOverdue)
    const overdueTasks = allActiveTasks.filter((t) => t.isOverdue)
    const highPriorityTasks = allActiveTasks.filter(
      (t) =>
        (t.priority === 'urgent' || t.priority === 'high') &&
        !t.isDueToday &&
        !t.isOverdue
    )

    const activeReminders = prefs.includeReminders
      ? this.listReminders({ profileId, status: 'active_or_due' })
      : []

    const dueAndOverdueReminders = activeReminders.filter((r) => {
      const eff = r.snoozedUntil ?? r.dueAt
      return eff <= dayEndMs || r.status === 'due' || r.status === 'delivered' || r.status === 'failed_or_unknown'
    })

    const upcomingReminders = activeReminders.filter((r) => {
      const eff = r.snoozedUntil ?? r.dueAt
      return eff > dayEndMs && eff <= upcomingWindowEndMs
    })

    const pinnedAndRecentNotes = prefs.includeNotes
      ? this.listNotes({ profileId, includeArchived: false, limit: 5 })
      : []

    const warnings: DailyBriefingWarning[] = []
    const accounts = this.listExternalAccounts(profileId)
    for (const acc of accounts) {
      if (acc.status === 'disconnected') {
        warnings.push({
          code: 'EXTERNAL_CALENDAR_DISCONNECTED',
          message: `External calendar "${acc.accountLabel}" (${acc.providerId}) is disconnected; showing local calendar events only.`
        })
      } else if (acc.status === 'stale') {
        warnings.push({
          code: 'EXTERNAL_CALENDAR_STALE',
          message: `External calendar "${acc.accountLabel}" (${acc.providerId}) has not synced recently; schedule data may be stale.`
        })
      } else if (acc.status === 'sync_failed') {
        warnings.push({
          code: 'EXTERNAL_CALENDAR_SYNC_FAILED',
          message: `External calendar "${acc.accountLabel}" sync failed: ${acc.lastSyncError || 'Unknown error'}.`
        })
      } else if (acc.status === 'reauth_required') {
        warnings.push({
          code: 'EXTERNAL_CALENDAR_REAUTH_REQUIRED',
          message: `External calendar "${acc.accountLabel}" requires re-authentication.`
        })
      }
    }

    if (
      !data.notifications.desktopNotificationsEnabled ||
      !this.notificationDispatcher.isSupportedAndPermitted()
    ) {
      warnings.push({
        code: 'NOTIFICATION_PERMISSION_DENIED',
        message: 'Desktop OS notifications are disabled or unavailable; reminders and briefings are shown in-app.'
      })
    }

    const isEmpty =
      todaysEvents.length === 0 &&
      upcomingEvents.length === 0 &&
      tasksDueToday.length === 0 &&
      overdueTasks.length === 0 &&
      highPriorityTasks.length === 0 &&
      dueAndOverdueReminders.length === 0 &&
      upcomingReminders.length === 0 &&
      pinnedAndRecentNotes.length === 0

    const deterministicSummary = this.buildDeterministicBriefingSummary({
      dateKey: targetDateKey,
      isEmpty,
      todaysEvents,
      tasksDueToday,
      overdueTasks,
      highPriorityTasks,
      dueAndOverdueReminders,
      pinnedAndRecentNotes,
      warnings
    })

    let summaryText = deterministicSummary
    let aiEnhanced = false
    let aiFallbackReason: string | null = null

    if (prefs.useAiNarrativeSummary && !isEmpty && this.briefingAiSummarizer) {
      try {
        const groundingLines = [
          `Date: ${targetDateKey} (${tz})`,
          `Today's Events (${todaysEvents.length}): ${todaysEvents.map((e) => sanitizeProductivityItemForGrounding(e.title)).join('; ') || 'None'}`,
          `Overdue Tasks (${overdueTasks.length}): ${overdueTasks.map((t) => sanitizeProductivityItemForGrounding(t.title)).join('; ') || 'None'}`,
          `Tasks Due Today (${tasksDueToday.length}): ${tasksDueToday.map((t) => sanitizeProductivityItemForGrounding(t.title)).join('; ') || 'None'}`,
          `High Priority Tasks (${highPriorityTasks.length}): ${highPriorityTasks.map((t) => sanitizeProductivityItemForGrounding(t.title)).join('; ') || 'None'}`,
          `Due/Overdue Reminders (${dueAndOverdueReminders.length}): ${dueAndOverdueReminders.map((r) => sanitizeProductivityItemForGrounding(r.title)).join('; ') || 'None'}`
        ].join('\n')

        const candidateAi = await this.briefingAiSummarizer.summarizeBriefing(groundingLines)
        const trimmedAi = (candidateAi || '').trim()
        if (!trimmedAi || trimmedAi.length < 15 || trimmedAi.startsWith('{')) {
          throw new Error('AI briefing summarizer returned empty or malformed output.')
        }
        summaryText = trimmedAi
        aiEnhanced = true
      } catch (err) {
        aiEnhanced = false
        aiFallbackReason =
          err instanceof Error ? err.message : 'AI summary unavailable; using deterministic summary.'
        warnings.push({
          code: 'AI_SUMMARY_FALLBACK',
          message: `AI narrative summary unavailable (${aiFallbackReason}); displaying verified deterministic briefing.`
        })
      }
    }

    let deliveryState: DailyBriefingReport['deliveryState'] =
      parsed.mode === 'manual' ? 'viewed_in_app' : 'pending'

    if (
      parsed.mode !== 'manual' &&
      data.notifications.desktopNotificationsEnabled &&
      data.notifications.dailyBriefingNotificationsEnabled &&
      this.notificationDispatcher.isSupportedAndPermitted()
    ) {
      try {
        const res = await this.notificationDispatcher.dispatch({
          title: `HELIOXEN Daily Briefing (${targetDateKey})`,
          body: summaryText,
          category: 'daily_briefing',
          referenceId: `briefing_${targetDateKey}`
        })
        deliveryState = res.delivered ? 'delivered' : 'failed_or_unknown'
      } catch {
        deliveryState = 'failed_or_unknown'
      }
    }

    const report: DailyBriefingReport = {
      id: `briefing_${targetDateKey}_${crypto.randomUUID().slice(0, 8)}`,
      profileId,
      dateKey: targetDateKey,
      generatedAt: now,
      timeZone: tz,
      generationMode: parsed.mode,
      summaryText,
      aiEnhanced,
      aiFallbackReason,
      todaysEvents,
      upcomingEvents,
      tasksDueToday,
      overdueTasks,
      highPriorityTasks,
      dueAndOverdueReminders,
      upcomingReminders,
      pinnedAndRecentNotes,
      warnings,
      isEmpty,
      deliveryState
    }

    return this.mutateAndPersist(() => {
      data.latestBriefing = report
      data.dailyBriefing = {
        ...data.dailyBriefing,
        lastPreparedDateKey: targetDateKey,
        lastPreparedAt: now,
        lastDeliveryState: deliveryState
      }
      return report
    })
  }

  private buildDeterministicBriefingSummary(params: {
    dateKey: string
    isEmpty: boolean
    todaysEvents: readonly CalendarEventRecord[]
    tasksDueToday: readonly TaskItemWithComputedState[]
    overdueTasks: readonly TaskItemWithComputedState[]
    highPriorityTasks: readonly TaskItemWithComputedState[]
    dueAndOverdueReminders: readonly ReminderRecord[]
    pinnedAndRecentNotes: readonly NoteRecord[]
    warnings: readonly DailyBriefingWarning[]
  }): string {
    if (params.isEmpty) {
      return `Daily Briefing for ${params.dateKey}: You have no scheduled calendar events, due tasks, active reminders, or pinned notes for today.`
    }

    const segments: string[] = [
      `Daily Briefing for ${params.dateKey}:`
    ]
    segments.push(
      `${params.todaysEvents.length} event(s) today`
    )
    segments.push(
      `${params.tasksDueToday.length} task(s) due today`
    )
    if (params.overdueTasks.length > 0) {
      segments.push(`${params.overdueTasks.length} overdue task(s)`)
    }
    if (params.highPriorityTasks.length > 0) {
      segments.push(`${params.highPriorityTasks.length} additional high-priority task(s)`)
    }
    if (params.dueAndOverdueReminders.length > 0) {
      segments.push(`${params.dueAndOverdueReminders.length} reminder(s) due`)
    }
    if (params.pinnedAndRecentNotes.length > 0) {
      segments.push(`${params.pinnedAndRecentNotes.length} active note(s)`)
    }

    let text = `${segments[0]} ${segments.slice(1).join(', ')}.`
    if (params.warnings.length > 0) {
      text += ` Notice: ${params.warnings.map((w) => w.message).join(' ')}`
    }
    return text
  }

  public getLatestDailyBriefing(rawProfileId?: string): DailyBriefingReport | null {
    const { data } = this.getProfileData(rawProfileId)
    return data.latestBriefing
  }

  public getOverviewSnapshot(rawProfileId?: string): ProductivityOverviewSnapshot {
    const { profileId, data } = this.getProfileData(rawProfileId)
    return {
      profileId,
      notes: this.listNotes({ profileId, includeArchived: false }),
      tasks: this.listTasks({ profileId, sortBy: 'dueAt' }),
      reminders: this.listReminders({ profileId, includeCancelled: false }),
      events: this.listCalendarEvents({ profileId }),
      externalAccounts: this.listExternalAccounts(profileId),
      notifications: data.notifications,
      dailyBriefingPreferences: data.dailyBriefing,
      latestBriefing: data.latestBriefing
    }
  }
}

