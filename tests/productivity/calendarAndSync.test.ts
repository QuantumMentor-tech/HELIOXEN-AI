import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  ProductivityService,
  InMemoryExternalCalendarAdapter
} from '../../src/main/productivity'

describe('Step 35 — Calendar Events & External Provider Adapter Boundary (Section 16.4 & 17.4)', () => {
  let tmpDir: string
  let currentTimeMs: number
  let googleAdapter: InMemoryExternalCalendarAdapter
  let vaultMap: Map<string, string>
  let service: ProductivityService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step35-calendar-'))
    currentTimeMs = Date.parse('2026-11-04T09:00:00.000Z')
    googleAdapter = new InMemoryExternalCalendarAdapter('google_calendar')
    vaultMap = new Map<string, string>()

    service = new ProductivityService({
      storageDir: tmpDir,
      nowFn: () => currentTimeMs,
      tokenVault: {
        storeToken: (k, v) => vaultMap.set(k, v),
        retrieveToken: (k) => vaultMap.get(k) ?? null,
        deleteToken: (k) => {
          vaultMap.delete(k)
        }
      },
      calendarAdapters: {
        google_calendar: googleAdapter
      }
    })
  })

  afterEach(() => {
    service.dispose()
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('creates local timed and all-day events, validates start/end integrity, and preserves all-day YYYY-MM-DD dates across time zones', async () => {
    await expect(
      service.createCalendarEvent({
        title: 'Invalid Reversed Times',
        startAt: currentTimeMs + 7200000,
        endAt: currentTimeMs + 3600000
      })
    ).rejects.toThrow(/endAt cannot be earlier than startAt/i)

    const allDay = await service.createCalendarEvent({
      title: 'Company Offsite',
      allDay: true,
      allDayStartDate: '2026-11-04',
      allDayEndDate: '2026-11-04',
      timeZone: 'America/Los_Angeles'
    })
    expect(allDay.allDay).toBe(true)
    expect(allDay.allDayStartDate).toBe('2026-11-04')

    // Query by dateKey returns the all-day event without off-by-one shift
    const nov4Events = service.listCalendarEvents({ dateKey: '2026-11-04' })
    expect(nov4Events).toHaveLength(1)
    expect(nov4Events[0].id).toBe(allDay.id)
    expect(service.listCalendarEvents({ dateKey: '2026-11-03' })).toHaveLength(0)
  })

  it('stores external calendar tokens in the encrypted vault (never in productivity_store.json) and deduplicates paginated sync results', async () => {
    const secretToken = 'oauth2_secret_google_calendar_token_xyz987'
    const acc = await service.connectExternalCalendar({
      providerId: 'google_calendar',
      accountLabel: 'Work Google Calendar',
      calendarId: 'primary',
      accessToken: secretToken
    })
    expect(acc.status).toBe('connected')

    // Verify productivity_store.json on disk does NOT contain the raw OAuth token
    const rawStoreJson = fs.readFileSync(path.join(tmpDir, 'productivity_store.json'), 'utf-8')
    expect(rawStoreJson).not.toContain(secretToken)
    expect(vaultMap.get(acc.credentialRef!)).toBe(secretToken)

    // Configure 2-page response where ext-evt-1 appears on both pages
    googleAdapter.setCustomPaginatedResponse([
      {
        events: [
          {
            externalEventId: 'ext-evt-1',
            calendarId: 'primary',
            title: 'Design Review (Page 1)',
            description: 'Initial',
            startAt: currentTimeMs + 3600000,
            endAt: currentTimeMs + 7200000,
            allDay: false,
            allDayStartDate: null,
            allDayEndDate: null,
            timeZone: 'UTC',
            location: 'Room A',
            attendees: [],
            remoteEtag: 'etag-1'
          }
        ],
        nextPageToken: '1',
        nextSyncCursor: null
      },
      {
        events: [
          {
            externalEventId: 'ext-evt-1',
            calendarId: 'primary',
            title: 'Design Review (Updated on Page 2)',
            description: 'Deduplicated',
            startAt: currentTimeMs + 3600000,
            endAt: currentTimeMs + 7200000,
            allDay: false,
            allDayStartDate: null,
            allDayEndDate: null,
            timeZone: 'UTC',
            location: 'Room B',
            attendees: [],
            remoteEtag: 'etag-2'
          },
          {
            externalEventId: 'ext-evt-2',
            calendarId: 'primary',
            title: 'Engineering All-Hands',
            description: '',
            startAt: currentTimeMs + 10800000,
            endAt: currentTimeMs + 14400000,
            allDay: false,
            allDayStartDate: null,
            allDayEndDate: null,
            timeZone: 'UTC',
            location: 'Auditorium',
            attendees: [],
            remoteEtag: 'etag-3'
          }
        ],
        nextPageToken: null,
        nextSyncCursor: 'cursor-final'
      }
    ])

    const syncRes = await service.syncExternalCalendar({ providerId: 'google_calendar' })
    expect(syncRes.status).toBe('sync_succeeded')
    expect(syncRes.upsertedCount).toBe(2)

    const syncedEvents = service.listCalendarEvents({ providerId: 'google_calendar' })
    expect(syncedEvents).toHaveLength(2)
    const evt1 = syncedEvents.find((e) => e.externalEventId === 'ext-evt-1')
    expect(evt1?.title).toBe('Design Review (Updated on Page 2)')
  })

  it('enforces human confirmation for external writes, detects ETag conflicts, handles remote timeouts, and protects recurring series when deleting a single occurrence', async () => {
    await service.connectExternalCalendar({
      providerId: 'google_calendar',
      accountLabel: 'Work Calendar',
      calendarId: 'primary',
      accessToken: 'valid_oauth_token_12345'
    })

    // Seed two instances of a recurring series
    googleAdapter.seedRemoteEvents([
      {
        externalEventId: 'series-inst-1',
        recurringMasterId: 'series-master-100',
        isRecurringInstance: true,
        calendarId: 'primary',
        title: 'Weekly Team Sync #1',
        description: '',
        startAt: currentTimeMs + 3600000,
        endAt: currentTimeMs + 5400000,
        allDay: false,
        allDayStartDate: null,
        allDayEndDate: null,
        timeZone: 'UTC',
        location: '',
        attendees: [],
        remoteEtag: 'etag-inst-1'
      },
      {
        externalEventId: 'series-inst-2',
        recurringMasterId: 'series-master-100',
        isRecurringInstance: true,
        calendarId: 'primary',
        title: 'Weekly Team Sync #2',
        description: '',
        startAt: currentTimeMs + 7 * 86400000,
        endAt: currentTimeMs + 7 * 86400000 + 1800000,
        allDay: false,
        allDayStartDate: null,
        allDayEndDate: null,
        timeZone: 'UTC',
        location: '',
        attendees: [],
        remoteEtag: 'etag-inst-2'
      }
    ])

    await service.syncExternalCalendar({ providerId: 'google_calendar' })
    const initialEvents = service.listCalendarEvents({ providerId: 'google_calendar' })
    expect(initialEvents).toHaveLength(2)
    const inst1 = initialEvents.find((e) => e.externalEventId === 'series-inst-1')!
    const inst2 = initialEvents.find((e) => e.externalEventId === 'series-inst-2')!

    // 1. Attempting to modify external event without humanConfirmed: true is rejected
    await expect(
      service.updateCalendarEvent({
        id: inst1.id,
        title: 'Unauthorized Edit',
        humanConfirmed: false
      })
    ).rejects.toThrow(/CONFIRMATION_REQUIRED/)

    // 2. Simulate remote write timeout -> marks syncState: 'unknown_timeout' and throws
    googleAdapter.setSimulateTimeoutOnWrite(true)
    await expect(
      service.updateCalendarEvent({
        id: inst1.id,
        title: 'Timed Out Edit',
        humanConfirmed: true
      })
    ).rejects.toThrow(/Timed out waiting/)
    expect(service.getCalendarEvent(inst1.id)?.syncState).toBe('unknown_timeout')
    googleAdapter.setSimulateTimeoutOnWrite(false)

    // 3. Simulate external ETag change -> marks syncState: 'conflict'
    googleAdapter.seedRemoteEvents([
      {
        externalEventId: 'series-inst-1',
        recurringMasterId: 'series-master-100',
        isRecurringInstance: true,
        calendarId: 'primary',
        title: 'Externally Changed Title',
        description: '',
        startAt: inst1.startAt,
        endAt: inst1.endAt,
        allDay: false,
        allDayStartDate: null,
        allDayEndDate: null,
        timeZone: 'UTC',
        location: '',
        attendees: [],
        remoteEtag: 'etag-changed-remotely'
      }
    ])
    await expect(
      service.updateCalendarEvent({
        id: inst1.id,
        title: 'Conflicting Local Edit',
        humanConfirmed: true
      })
    ).rejects.toThrow(/modified externally/)
    expect(service.getCalendarEvent(inst1.id)?.syncState).toBe('conflict')

    // 4. Delete single occurrence of inst2 -> inst1 remains intact!
    const delSingle = await service.deleteCalendarEvent({
      id: inst2.id,
      recurrenceScope: 'single_occurrence',
      humanConfirmed: true
    })
    expect(delSingle.deleted).toBe(true)
    expect(service.getCalendarEvent(inst2.id)).toBeNull()
    expect(service.getCalendarEvent(inst1.id)).not.toBeNull()
  })
})

