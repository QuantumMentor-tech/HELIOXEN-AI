import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  ProductivityService,
  NotificationDispatchRequest,
  formatLocalTime24h,
  formatLocalDateKey,
  resolveLocalWallClockToTimestamp
} from '../../src/main/productivity'

describe('Step 35 — Reminder Scheduling, Recurrence, DST & Notification Delivery (Section 16.3)', () => {
  let tmpDir: string
  let currentTimeMs: number
  let dispatchedNotifications: NotificationDispatchRequest[]
  let notificationPermitted: boolean
  let service: ProductivityService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step35-reminders-'))
    currentTimeMs = Date.parse('2026-11-04T12:00:00.000Z')
    dispatchedNotifications = []
    notificationPermitted = true

    service = new ProductivityService({
      storageDir: tmpDir,
      nowFn: () => currentTimeMs,
      notificationDispatcher: {
        isSupportedAndPermitted: () => notificationPermitted,
        dispatch: (req) => {
          dispatchedNotifications.push(req)
          return { delivered: true }
        }
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

  it('triggers due one-time reminders, supports snooze and dismiss, and prevents cancelled reminders from firing', async () => {
    const dueTime = currentTimeMs + 15 * 60 * 1000
    const r1 = service.createReminder({
      title: 'Join Architecture Sync',
      dueAt: dueTime,
      timeZone: 'UTC'
    })
    const rCancelled = service.createReminder({
      title: 'Cancelled Check-in',
      dueAt: dueTime,
      timeZone: 'UTC'
    })

    service.cancelReminder({ id: rCancelled.id })
    expect(service.getReminder(rCancelled.id)?.status).toBe('cancelled')

    // Before due time -> nothing triggers
    const earlyTriggered = await service.evaluateDueReminders()
    expect(earlyTriggered).toHaveLength(0)

    // Advance clock past dueAt
    currentTimeMs = dueTime + 1000
    const dueTriggered = await service.evaluateDueReminders()
    expect(dueTriggered).toHaveLength(1)
    expect(dueTriggered[0].id).toBe(r1.id)
    expect(dueTriggered[0].status).toBe('delivered')
    expect(dispatchedNotifications).toHaveLength(1)

    // Re-evaluating immediately does NOT fire duplicate notifications
    const duplicateCheck = await service.evaluateDueReminders()
    expect(duplicateCheck).toHaveLength(0)
    expect(dispatchedNotifications).toHaveLength(1)

    // Snooze for 10 minutes
    const snoozed = service.snoozeReminder({ id: r1.id, durationMinutes: 10 })
    expect(snoozed.status).toBe('snoozed')
    expect(snoozed.snoozedUntil).toBe(currentTimeMs + 10 * 60 * 1000)

    // Advance 5 minutes -> still snoozed
    currentTimeMs += 5 * 60 * 1000
    expect(await service.evaluateDueReminders()).toHaveLength(0)

    // Advance another 6 minutes -> snoozed reminder fires again
    currentTimeMs += 6 * 60 * 1000
    const snoozeTriggered = await service.evaluateDueReminders()
    expect(snoozeTriggered).toHaveLength(1)
    expect(snoozeTriggered[0].status).toBe('delivered')
    expect(snoozeTriggered[0].occurrenceCount).toBe(2)

    // Dismiss one-time reminder -> transitions to acknowledged
    const dismissed = service.dismissReminder({ id: r1.id })
    expect(dismissed.status).toBe('acknowledged')
  })

  it('preserves local wall-clock time (09:00 America/New_York) across a DST transition for recurring reminders', async () => {
    const nyTz = 'America/New_York'
    // 2026-03-07 is Saturday (EST, UTC-5); 2026-03-08 is DST spring-forward Sunday (EDT, UTC-4)
    const beforeDstNineAm = resolveLocalWallClockToTimestamp('2026-03-07', '09:00', nyTz)
    currentTimeMs = beforeDstNineAm - 60000

    const recurring = service.createReminder({
      title: 'Morning Standup Prep',
      dueAt: beforeDstNineAm,
      timeZone: nyTz,
      recurrence: {
        frequency: 'daily',
        interval: 1,
        localTime: '09:00'
      }
    })

    // Trigger at 2026-03-07 09:00 EST
    currentTimeMs = beforeDstNineAm + 1000
    await service.evaluateDueReminders()
    expect(service.getReminder(recurring.id)?.status).toBe('delivered')

    // Dismiss -> reschedules for 2026-03-08 09:00 EDT
    const rescheduled = service.dismissReminder({ id: recurring.id })
    expect(rescheduled.status).toBe('scheduled')
    expect(formatLocalDateKey(rescheduled.dueAt, nyTz)).toBe('2026-03-08')
    expect(formatLocalTime24h(rescheduled.dueAt, nyTz)).toBe('09:00')
  })

  it('records failed_or_unknown when OS notification permission is denied instead of falsely claiming delivered', async () => {
    notificationPermitted = false
    const dueTime = currentTimeMs + 5000
    const rem = service.createReminder({
      title: 'Check Deployment Pipeline',
      dueAt: dueTime,
      timeZone: 'UTC'
    })

    currentTimeMs = dueTime + 1000
    const triggered = await service.evaluateDueReminders()
    expect(triggered).toHaveLength(1)
    expect(triggered[0].id).toBe(rem.id)
    expect(triggered[0].status).toBe('failed_or_unknown')
    expect(triggered[0].failureReason).toMatch(/permission is unavailable or denied/i)
    expect(dispatchedNotifications).toHaveLength(0)

    // Still surfaces in active_or_due list so user sees it in-app and in Daily Briefing
    const activeList = service.listReminders({ status: 'active_or_due' })
    expect(activeList.some((r) => r.id === rem.id)).toBe(true)
  })

  it('recovers overdue reminders on application restart without duplicate firing', () => {
    const dueWhileClosed = currentTimeMs + 60000
    const rem = service.createReminder({
      title: 'Overdue While App Was Closed',
      dueAt: dueWhileClosed,
      timeZone: 'UTC'
    })

    service.dispose()

    // App restarts 30 minutes after the reminder was due
    currentTimeMs = dueWhileClosed + 30 * 60 * 1000
    const restartedNotifications: NotificationDispatchRequest[] = []
    const restarted = new ProductivityService({
      storageDir: tmpDir,
      nowFn: () => currentTimeMs,
      notificationDispatcher: {
        isSupportedAndPermitted: () => true,
        dispatch: (req) => {
          restartedNotifications.push(req)
          return { delivered: true }
        }
      }
    })

    const recovered = restarted.getReminder(rem.id)
    expect(recovered?.status).toBe('delivered')
    expect(recovered?.occurrenceCount).toBe(1)
    expect(restartedNotifications.filter((n) => n.category === 'reminder')).toHaveLength(1)
    restarted.dispose()
  })
})

