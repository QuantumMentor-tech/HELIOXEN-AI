/**
 * HELIOXEN AI — Step 35: External Calendar Provider Adapter Boundary
 * Provider-neutral adapter interface and error taxonomy for external calendar synchronization.
 */

import {
  CalendarProviderId,
  RecurrenceModificationScope
} from '../../shared/productivity'

export type ExternalProviderType = Exclude<CalendarProviderId, 'local'>

export interface ExternalCalendarEventPayload {
  readonly externalEventId: string
  readonly recurringMasterId?: string | null
  readonly isRecurringInstance?: boolean
  readonly calendarId: string
  readonly title: string
  readonly description: string
  readonly startAt: number
  readonly endAt: number
  readonly allDay: boolean
  readonly allDayStartDate: string | null
  readonly allDayEndDate: string | null
  readonly timeZone: string
  readonly location: string
  readonly attendees: readonly string[]
  readonly remoteEtag: string
  readonly deleted?: boolean
}

export interface ExternalCalendarSyncPage {
  readonly events: readonly ExternalCalendarEventPayload[]
  readonly nextPageToken?: string | null
  readonly nextSyncCursor?: string | null
}

export class CalendarAdapterAuthError extends Error {
  readonly code = 'CALENDAR_AUTH_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'CalendarAdapterAuthError'
  }
}

export class CalendarAdapterConflictError extends Error {
  readonly code = 'CALENDAR_CONFLICT_ERROR'
  readonly remoteEvent?: ExternalCalendarEventPayload
  constructor(message: string, remoteEvent?: ExternalCalendarEventPayload) {
    super(message)
    this.name = 'CalendarAdapterConflictError'
    this.remoteEvent = remoteEvent
  }
}

export class CalendarAdapterTimeoutError extends Error {
  readonly code = 'CALENDAR_TIMEOUT_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'CalendarAdapterTimeoutError'
  }
}

export interface CalendarProviderAdapter {
  readonly providerId: ExternalProviderType

  validateCredentials(options: {
    accessToken: string
    calendarId: string
  }): Promise<{ valid: boolean; accountName?: string }>

  fetchEventsPage(options: {
    accessToken: string
    calendarId: string
    syncCursor?: string | null
    pageToken?: string | null
  }): Promise<ExternalCalendarSyncPage>

  createRemoteEvent(options: {
    accessToken: string
    calendarId: string
    event: Omit<ExternalCalendarEventPayload, 'externalEventId' | 'remoteEtag'>
  }): Promise<ExternalCalendarEventPayload>

  updateRemoteEvent(options: {
    accessToken: string
    calendarId: string
    externalEventId: string
    expectedEtag?: string | null
    recurrenceScope: RecurrenceModificationScope
    updates: Partial<Omit<ExternalCalendarEventPayload, 'externalEventId' | 'remoteEtag'>>
  }): Promise<ExternalCalendarEventPayload>

  deleteRemoteEvent(options: {
    accessToken: string
    calendarId: string
    externalEventId: string
    expectedEtag?: string | null
    recurrenceScope: RecurrenceModificationScope
  }): Promise<{ deletedIds: readonly string[]; seriesDeleted: boolean }>
}

/**
 * Default safe adapter implementation that maintains an isolated in-memory remote state
 * per provider when connected with a valid token, allowing full verification of OAuth token
 * checks, pagination, ETag conflicts, single-instance vs series deletion, and timeout handling
 * without leaking network requests to unconfigured third-party endpoints.
 */
export class InMemoryExternalCalendarAdapter implements CalendarProviderAdapter {
  readonly providerId: ExternalProviderType
  private remoteEvents = new Map<string, ExternalCalendarEventPayload>()
  private customPages: ExternalCalendarSyncPage[] | null = null
  private simulateTimeoutOnWrite = false
  private simulateAuthExpired = false
  private etagCounter = 1

  constructor(providerId: ExternalProviderType) {
    this.providerId = providerId
  }

  public setSimulateTimeoutOnWrite(enabled: boolean): void {
    this.simulateTimeoutOnWrite = enabled
  }

  public setSimulateAuthExpired(enabled: boolean): void {
    this.simulateAuthExpired = enabled
  }

  public seedRemoteEvents(events: readonly ExternalCalendarEventPayload[]): void {
    for (const ev of events) {
      this.remoteEvents.set(ev.externalEventId, { ...ev })
    }
  }

  public setCustomPaginatedResponse(pages: ExternalCalendarSyncPage[] | null): void {
    this.customPages = pages
  }

  private assertAuthorized(accessToken: string): void {
    if (!accessToken || accessToken.trim().length < 8 || this.simulateAuthExpired) {
      throw new CalendarAdapterAuthError(
        `External calendar provider (${this.providerId}) rejected expired or invalid credentials.`
      )
    }
  }

  async validateCredentials(options: {
    accessToken: string
    calendarId: string
  }): Promise<{ valid: boolean; accountName?: string }> {
    this.assertAuthorized(options.accessToken)
    return {
      valid: true,
      accountName: `${this.providerId}:${options.calendarId}`
    }
  }

  async fetchEventsPage(options: {
    accessToken: string
    calendarId: string
    syncCursor?: string | null
    pageToken?: string | null
  }): Promise<ExternalCalendarSyncPage> {
    this.assertAuthorized(options.accessToken)

    if (this.customPages && this.customPages.length > 0) {
      const pageIndex = options.pageToken ? Number(options.pageToken) : 0
      const page = this.customPages[pageIndex]
      if (!page) {
        return {
          events: [],
          nextPageToken: null,
          nextSyncCursor: `cursor-${Date.now()}`
        }
      }
      return page
    }

    const events = Array.from(this.remoteEvents.values()).filter(
      (e) => e.calendarId === options.calendarId
    )
    return {
      events,
      nextPageToken: null,
      nextSyncCursor: `cursor-${this.etagCounter}`
    }
  }

  async createRemoteEvent(options: {
    accessToken: string
    calendarId: string
    event: Omit<ExternalCalendarEventPayload, 'externalEventId' | 'remoteEtag'>
  }): Promise<ExternalCalendarEventPayload> {
    this.assertAuthorized(options.accessToken)
    if (this.simulateTimeoutOnWrite) {
      throw new CalendarAdapterTimeoutError(
        `Timed out waiting for ${this.providerId} to confirm remote event creation.`
      )
    }

    const externalEventId = `ext-${this.providerId}-${++this.etagCounter}`
    const created: ExternalCalendarEventPayload = {
      ...options.event,
      externalEventId,
      remoteEtag: `etag-${this.etagCounter}`
    }
    this.remoteEvents.set(externalEventId, created)
    return created
  }

  async updateRemoteEvent(options: {
    accessToken: string
    calendarId: string
    externalEventId: string
    expectedEtag?: string | null
    recurrenceScope: RecurrenceModificationScope
    updates: Partial<Omit<ExternalCalendarEventPayload, 'externalEventId' | 'remoteEtag'>>
  }): Promise<ExternalCalendarEventPayload> {
    this.assertAuthorized(options.accessToken)
    if (this.simulateTimeoutOnWrite) {
      throw new CalendarAdapterTimeoutError(
        `Timed out waiting for ${this.providerId} to confirm remote event modification.`
      )
    }

    const existing = this.remoteEvents.get(options.externalEventId)
    if (!existing) {
      throw new Error(`Remote event '${options.externalEventId}' does not exist on ${this.providerId}.`)
    }

    if (options.expectedEtag && existing.remoteEtag !== options.expectedEtag) {
      throw new CalendarAdapterConflictError(
        `Remote event '${options.externalEventId}' was modified externally (expected ${options.expectedEtag}, found ${existing.remoteEtag}).`,
        existing
      )
    }

    const updated: ExternalCalendarEventPayload = {
      ...existing,
      ...options.updates,
      externalEventId: existing.externalEventId,
      remoteEtag: `etag-${++this.etagCounter}`
    }
    this.remoteEvents.set(existing.externalEventId, updated)
    return updated
  }

  async deleteRemoteEvent(options: {
    accessToken: string
    calendarId: string
    externalEventId: string
    expectedEtag?: string | null
    recurrenceScope: RecurrenceModificationScope
  }): Promise<{ deletedIds: readonly string[]; seriesDeleted: boolean }> {
    this.assertAuthorized(options.accessToken)
    if (this.simulateTimeoutOnWrite) {
      throw new CalendarAdapterTimeoutError(
        `Timed out waiting for ${this.providerId} to confirm remote event deletion.`
      )
    }

    const existing = this.remoteEvents.get(options.externalEventId)
    if (!existing) {
      return { deletedIds: [options.externalEventId], seriesDeleted: false }
    }

    if (options.expectedEtag && existing.remoteEtag !== options.expectedEtag) {
      throw new CalendarAdapterConflictError(
        `Remote event '${options.externalEventId}' changed before deletion.`,
        existing
      )
    }

    if (options.recurrenceScope === 'entire_series' && existing.recurringMasterId) {
      const masterId = existing.recurringMasterId
      const deletedIds: string[] = []
      for (const [id, ev] of this.remoteEvents.entries()) {
        if (ev.externalEventId === masterId || ev.recurringMasterId === masterId) {
          this.remoteEvents.delete(id)
          deletedIds.push(id)
        }
      }
      return { deletedIds, seriesDeleted: true }
    }

    this.remoteEvents.delete(options.externalEventId)
    return { deletedIds: [options.externalEventId], seriesDeleted: false }
  }
}

