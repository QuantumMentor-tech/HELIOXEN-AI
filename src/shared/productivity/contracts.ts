/**
 * HELIOXEN AI — Step 35: Integrated Productivity System
 * Zod validation schemas, time-zone/date validators, secret scanners,
 * and prompt-injection neutralizers for notes, tasks, reminders, calendar, and briefings.
 */

import { z } from 'zod'
import { inspectMemorySafetyPolicy } from '../memory/contracts'
import { DEFAULT_PRODUCTIVITY_PROFILE_ID } from './types'

export const ProductivityProfileIdSchema = z
  .string()
  .trim()
  .min(1, 'Profile ID cannot be empty')
  .max(80, 'Profile ID exceeds maximum length')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Profile ID contains invalid characters')
  .default(DEFAULT_PRODUCTIVITY_PROFILE_ID)

export const ProductivityRecordIdSchema = z
  .string()
  .trim()
  .min(1, 'Record ID cannot be empty')
  .max(120, 'Record ID exceeds maximum length')
  .regex(/^[a-zA-Z0-9_.:-]+$/, 'Record ID contains invalid characters')

export const ProductivitySourceAttributionSchema = z
  .enum(['user_direct', 'assistant_command', 'imported', 'external_sync'])
  .default('user_direct')

export const LocalDateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => {
    const [year, month, day] = val.split('-').map(Number)
    const d = new Date(Date.UTC(year, month - 1, day))
    return (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    )
  }, 'Invalid calendar date')

export const LocalTime24hSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in 24-hour HH:mm format')

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function resolveSafeTimeZone(tz?: string): string {
  if (tz && isValidIanaTimeZone(tz)) {
    return tz
  }
  try {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (systemTz && isValidIanaTimeZone(systemTz)) {
      return systemTz
    }
  } catch {
    // Fallback to UTC
  }
  return 'UTC'
}

export const TimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(isValidIanaTimeZone, 'Invalid IANA time zone identifier')

export const TagListSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Tag cannot be empty')
      .max(40, 'Tag cannot exceed 40 characters')
      .regex(/^[a-zA-Z0-9_./ -]+$/, 'Tag contains invalid characters')
  )
  .max(20, 'Maximum of 20 tags allowed')
  .default([])

// ============================================================================
// 1. NOTES SCHEMAS
// ============================================================================

export const CreateNoteRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Note title is required')
      .max(200, 'Note title cannot exceed 200 characters'),
    body: z
      .string()
      .max(20000, 'Note body cannot exceed 20,000 characters')
      .default(''),
    tags: TagListSchema.optional(),
    pinned: z.boolean().default(false),
    archived: z.boolean().default(false),
    sourceAttribution: ProductivitySourceAttributionSchema.optional()
  })
  .strict()

export const UpdateNoteRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema,
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(20000).optional(),
    tags: TagListSchema.optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional()
  })
  .strict()

export const ListNotesRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    query: z.string().trim().max(200).optional(),
    tag: z.string().trim().max(40).optional(),
    pinnedOnly: z.boolean().optional(),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(100)
  })
  .strict()

export const DeleteNoteRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema
  })
  .strict()

// ============================================================================
// 2. TASKS SCHEMAS
// ============================================================================

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'completed', 'cancelled'])
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
export const TaskSortFieldSchema = z.enum(['dueAt', 'priority', 'updatedAt', 'createdAt'])

export const CreateTaskRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Task title is required')
      .max(240, 'Task title cannot exceed 240 characters'),
    description: z
      .string()
      .trim()
      .max(4000, 'Task description cannot exceed 4,000 characters')
      .default(''),
    status: TaskStatusSchema.default('todo'),
    priority: TaskPrioritySchema.default('medium'),
    dueAt: z.number().int().positive().nullable().optional(),
    timeZone: TimeZoneSchema.optional(),
    tags: TagListSchema.optional(),
    linkedNoteId: ProductivityRecordIdSchema.nullable().optional(),
    sourceAttribution: ProductivitySourceAttributionSchema.optional()
  })
  .strict()

export const UpdateTaskRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema,
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(4000).optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    dueAt: z.number().int().positive().nullable().optional(),
    timeZone: TimeZoneSchema.optional(),
    tags: TagListSchema.optional(),
    linkedNoteId: ProductivityRecordIdSchema.nullable().optional()
  })
  .strict()

export const ListTasksRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    query: z.string().trim().max(200).optional(),
    status: z.union([TaskStatusSchema, z.literal('active_only')]).optional(),
    priority: TaskPrioritySchema.optional(),
    tag: z.string().trim().max(40).optional(),
    overdueOnly: z.boolean().optional(),
    dueTodayOnly: z.boolean().optional(),
    sortBy: TaskSortFieldSchema.default('dueAt'),
    limit: z.number().int().min(1).max(200).default(100)
  })
  .strict()

export const CompleteTaskByTitleRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    titleQuery: z.string().trim().min(1).max(240),
    targetTaskId: ProductivityRecordIdSchema.optional()
  })
  .strict()

export const DeleteTaskRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema
  })
  .strict()

// ============================================================================
// 3. REMINDERS SCHEMAS
// ============================================================================

export const ReminderStatusSchema = z.enum([
  'scheduled',
  'due',
  'notification_requested',
  'delivered',
  'acknowledged',
  'snoozed',
  'cancelled',
  'failed_or_unknown'
])

export const ReminderRecurrenceFrequencySchema = z.enum(['none', 'daily', 'weekly'])

export const ReminderRecurrenceRuleSchema = z
  .object({
    frequency: ReminderRecurrenceFrequencySchema.default('none'),
    interval: z.number().int().min(1).max(365).default(1),
    localTime: LocalTime24hSchema.optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    endsAt: z.number().int().positive().nullable().optional()
  })
  .strict()

export const CreateReminderRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Reminder title is required')
      .max(240, 'Reminder title cannot exceed 240 characters'),
    description: z.string().trim().max(2000).default(''),
    dueAt: z.number().int().positive('Reminder dueAt must be a valid timestamp'),
    timeZone: TimeZoneSchema.optional(),
    recurrence: ReminderRecurrenceRuleSchema.partial().optional(),
    linkedTaskId: ProductivityRecordIdSchema.nullable().optional(),
    linkedEventId: ProductivityRecordIdSchema.nullable().optional(),
    sourceAttribution: ProductivitySourceAttributionSchema.optional()
  })
  .strict()

export const UpdateReminderRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema,
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(2000).optional(),
    dueAt: z.number().int().positive().optional(),
    timeZone: TimeZoneSchema.optional(),
    recurrence: ReminderRecurrenceRuleSchema.partial().optional()
  })
  .strict()

export const SnoozeReminderRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema,
    durationMinutes: z.number().int().min(1).max(10080).optional(),
    snoozedUntil: z.number().int().positive().optional()
  })
  .strict()

export const DismissReminderRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema
  })
  .strict()

export const CancelReminderRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema
  })
  .strict()

export const DeleteReminderRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema
  })
  .strict()

export const ListRemindersRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    status: z.union([ReminderStatusSchema, z.literal('active_or_due')]).optional(),
    includeCancelled: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(100)
  })
  .strict()

// ============================================================================
// 4. CALENDAR SCHEMAS
// ============================================================================

export const CalendarProviderIdSchema = z.enum([
  'local',
  'google_calendar',
  'microsoft_outlook',
  'caldav_generic'
])

export const ExternalCalendarProviderIdSchema = z.enum([
  'google_calendar',
  'microsoft_outlook',
  'caldav_generic'
])

export const RecurrenceModificationScopeSchema = z
  .enum(['single_occurrence', 'entire_series'])
  .default('single_occurrence')

export const CreateCalendarEventRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    providerId: CalendarProviderIdSchema.default('local'),
    calendarId: z.string().trim().min(1).max(120).default('primary'),
    title: z
      .string()
      .trim()
      .min(1, 'Event title is required')
      .max(240, 'Event title cannot exceed 240 characters'),
    description: z.string().trim().max(4000).default(''),
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    allDay: z.boolean().default(false),
    allDayStartDate: LocalDateStringSchema.nullable().optional(),
    allDayEndDate: LocalDateStringSchema.nullable().optional(),
    timeZone: TimeZoneSchema.optional(),
    location: z.string().trim().max(300).default(''),
    attendees: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
    recurringMasterId: ProductivityRecordIdSchema.nullable().optional(),
    isRecurringInstance: z.boolean().default(false),
    humanConfirmed: z.boolean().default(false)
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.allDay) {
      if (!val.allDayStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All-day events require allDayStartDate in YYYY-MM-DD format',
          path: ['allDayStartDate']
        })
      }
      if (val.allDayStartDate && val.allDayEndDate && val.allDayEndDate < val.allDayStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'allDayEndDate cannot be earlier than allDayStartDate',
          path: ['allDayEndDate']
        })
      }
    } else {
      if (typeof val.startAt !== 'number' || typeof val.endAt !== 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Timed calendar events require both startAt and endAt timestamps',
          path: ['startAt']
        })
      } else if (val.endAt < val.startAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Calendar event endAt cannot be earlier than startAt',
          path: ['endAt']
        })
      }
    }
  })

export const UpdateCalendarEventRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema,
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(4000).optional(),
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    allDay: z.boolean().optional(),
    allDayStartDate: LocalDateStringSchema.nullable().optional(),
    allDayEndDate: LocalDateStringSchema.nullable().optional(),
    timeZone: TimeZoneSchema.optional(),
    location: z.string().trim().max(300).optional(),
    attendees: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
    recurrenceScope: RecurrenceModificationScopeSchema.optional(),
    humanConfirmed: z.boolean().optional()
  })
  .strict()

export const DeleteCalendarEventRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    id: ProductivityRecordIdSchema,
    recurrenceScope: RecurrenceModificationScopeSchema.optional(),
    humanConfirmed: z.boolean().optional()
  })
  .strict()

export const ListCalendarEventsRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    rangeStartAt: z.number().int().positive().optional(),
    rangeEndAt: z.number().int().positive().optional(),
    dateKey: LocalDateStringSchema.optional(),
    providerId: CalendarProviderIdSchema.optional(),
    query: z.string().trim().max(200).optional(),
    limit: z.number().int().min(1).max(500).default(200)
  })
  .strict()

export const ConnectExternalCalendarRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    providerId: ExternalCalendarProviderIdSchema,
    accountLabel: z.string().trim().min(1).max(120),
    calendarId: z.string().trim().min(1).max(120).default('primary'),
    accessToken: z.string().trim().min(8, 'Access token is required').max(4096)
  })
  .strict()

export const DisconnectExternalCalendarRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    providerId: ExternalCalendarProviderIdSchema,
    removeCachedEvents: z.boolean().default(true)
  })
  .strict()

export const SyncExternalCalendarRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    providerId: ExternalCalendarProviderIdSchema
  })
  .strict()

// ============================================================================
// 5. DAILY BRIEFING & SETTINGS SCHEMAS
// ============================================================================

export const GenerateDailyBriefingRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    mode: z.enum(['manual', 'scheduled', 'startup_recovery']).default('manual'),
    dateKey: LocalDateStringSchema.optional(),
    forceRegenerate: z.boolean().default(false)
  })
  .strict()

export const UpdateProductivitySettingsRequestSchema = z
  .object({
    profileId: ProductivityProfileIdSchema.optional(),
    notifications: z
      .object({
        desktopNotificationsEnabled: z.boolean().optional(),
        reminderNotificationsEnabled: z.boolean().optional(),
        dailyBriefingNotificationsEnabled: z.boolean().optional(),
        soundEnabled: z.boolean().optional()
      })
      .strict()
      .optional(),
    dailyBriefing: z
      .object({
        enabled: z.boolean().optional(),
        deliveryTimeLocal: LocalTime24hSchema.optional(),
        timeZone: TimeZoneSchema.optional(),
        includeCalendar: z.boolean().optional(),
        includeTasks: z.boolean().optional(),
        includeReminders: z.boolean().optional(),
        includeNotes: z.boolean().optional(),
        useAiNarrativeSummary: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict()

// ============================================================================
// 6. SAFETY, SECRET SCANNING & PROMPT-INJECTION NEUTRALIZATION
// ============================================================================

export function inspectProductivityTextSafety(
  fieldLabel: string,
  ...texts: Array<string | undefined | null>
): { allowed: boolean; reason?: string } {
  for (const text of texts) {
    if (!text) continue
    const result = inspectMemorySafetyPolicy(text)
    if (!result.allowed) {
      return {
        allowed: false,
        reason: `${fieldLabel} rejected by HELIOXEN secret & privacy guard: ${result.reason}`
      }
    }
  }
  return { allowed: true }
}

/**
 * Neutralizes untrusted or user-supplied note/task/calendar text before inclusion
 * in any AI daily briefing summarization prompt so embedded instructions can never
 * trigger tool calls or override system boundaries.
 */
export function sanitizeProductivityItemForGrounding(raw: string): string {
  return (raw || '')
    .replace(/\[SYSTEM\]/gi, '[DATA]')
    .replace(/\[DEVELOPER\]/gi, '[DATA]')
    .replace(/<\/?(?:system|instruction|prompt|tool_call)[^>]*>/gi, '')
    .replace(/\r?\n+/g, ' ')
    .trim()
}

