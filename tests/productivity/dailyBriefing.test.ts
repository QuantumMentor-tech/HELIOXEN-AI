import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ProductivityService } from '../../src/main/productivity'

describe('Step 35 — Daily Briefing Assembly, Grounding, Warnings & Scheduling (Section 16.5)', () => {
  let tmpDir: string
  let currentTimeMs: number
  let service: ProductivityService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step35-briefing-'))
    currentTimeMs = Date.parse('2026-11-04T08:00:00.000Z')
    service = new ProductivityService({
      storageDir: tmpDir,
      nowFn: () => currentTimeMs
    })
    service.updateSettings({
      dailyBriefing: {
        enabled: true,
        deliveryTimeLocal: '08:30',
        timeZone: 'UTC',
        useAiNarrativeSummary: false
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

  it('produces an honest empty briefing when no events, tasks, reminders, or notes exist', async () => {
    const emptyBriefing = await service.generateDailyBriefing({
      dateKey: '2026-11-04',
      mode: 'manual'
    })

    expect(emptyBriefing.isEmpty).toBe(true)
    expect(emptyBriefing.todaysEvents).toHaveLength(0)
    expect(emptyBriefing.tasksDueToday).toHaveLength(0)
    expect(emptyBriefing.overdueTasks).toHaveLength(0)
    expect(emptyBriefing.dueAndOverdueReminders).toHaveLength(0)
    expect(emptyBriefing.summaryText).toContain('no scheduled calendar events, due tasks, active reminders, or pinned notes')
  })

  it('assembles a grounded briefing from actual records and excludes completed tasks, cancelled reminders, and archived notes', async () => {
    // Active note vs archived note
    const activeNote = service.createNote({
      title: 'Release Checklist',
      body: 'Verify telemetry and audit logs.',
      pinned: true
    })
    service.createNote({
      title: 'Archived Old Note',
      body: 'Should not appear',
      archived: true
    })

    // Overdue task, due-today task, and completed task
    const overdueTask = service.createTask({
      title: 'Fix P1 Regression',
      priority: 'urgent',
      dueAt: currentTimeMs - 3600000,
      timeZone: 'UTC'
    })
    const dueTodayTask = service.createTask({
      title: 'Update Architecture Doc',
      priority: 'high',
      dueAt: currentTimeMs + 7200000,
      timeZone: 'UTC'
    })
    const completedTask = service.createTask({
      title: 'Already Done Task',
      status: 'completed',
      dueAt: currentTimeMs + 3600000,
      timeZone: 'UTC'
    })

    // Active reminder vs cancelled reminder
    const activeRem = service.createReminder({
      title: 'Call Release Manager',
      dueAt: currentTimeMs + 3600000,
      timeZone: 'UTC'
    })
    const cancelledRem = service.createReminder({
      title: 'Cancelled Reminder',
      dueAt: currentTimeMs + 3600000,
      timeZone: 'UTC'
    })
    service.cancelReminder({ id: cancelledRem.id })

    // Today's calendar event
    const todayEvent = await service.createCalendarEvent({
      title: 'Phase 12 Go-Live Review',
      startAt: currentTimeMs + 3600000,
      endAt: currentTimeMs + 5400000,
      timeZone: 'UTC'
    })

    const report = await service.generateDailyBriefing({
      dateKey: '2026-11-04',
      mode: 'manual',
      forceRegenerate: true
    })

    expect(report.isEmpty).toBe(false)
    expect(report.todaysEvents.map((e) => e.id)).toEqual([todayEvent.id])
    expect(report.overdueTasks.map((t) => t.id)).toEqual([overdueTask.id])
    expect(report.tasksDueToday.map((t) => t.id)).toEqual([dueTodayTask.id])
    expect(report.tasksDueToday.some((t) => t.id === completedTask.id)).toBe(false)
    expect(report.dueAndOverdueReminders.map((r) => r.id)).toEqual([activeRem.id])
    expect(report.pinnedAndRecentNotes.map((n) => n.id)).toEqual([activeNote.id])
  })

  it('includes explicit warnings when an external calendar is disconnected or stale, and falls back deterministically if AI summarization fails', async () => {
    await service.connectExternalCalendar({
      providerId: 'google_calendar',
      accountLabel: 'Team Calendar',
      accessToken: 'valid_token_abc12345'
    })
    await service.syncExternalCalendar({ providerId: 'google_calendar' })

    // Advance clock by 8 hours so external calendar becomes stale (> 6h threshold)
    currentTimeMs += 8 * 60 * 60 * 1000

    service.createTask({
      title: 'Review Stale Sync',
      priority: 'high',
      dueAt: currentTimeMs + 1800000,
      timeZone: 'UTC'
    })

    // Enable AI narrative summary and inject a failing AI summarizer
    service.updateSettings({
      dailyBriefing: {
        useAiNarrativeSummary: true
      }
    })
    service.setBriefingAiSummarizer({
      summarizeBriefing: async () => {
        throw new Error('Simulated provider offline')
      }
    })

    const report = await service.generateDailyBriefing({
      dateKey: '2026-11-04',
      mode: 'manual',
      forceRegenerate: true
    })

    expect(report.aiEnhanced).toBe(false)
    expect(report.aiFallbackReason).toContain('Simulated provider offline')
    expect(report.warnings.some((w) => w.code === 'EXTERNAL_CALENDAR_STALE')).toBe(true)
    expect(report.warnings.some((w) => w.code === 'AI_SUMMARY_FALLBACK')).toBe(true)
    expect(report.summaryText).toContain('Daily Briefing for 2026-11-04')
  })

  it('prevents duplicate scheduled briefing generation for the same calendar day while permitting manual regeneration', async () => {
    service.createTask({
      title: 'Morning Task',
      dueAt: currentTimeMs + 3600000,
      timeZone: 'UTC'
    })

    const firstScheduled = await service.generateDailyBriefing({
      dateKey: '2026-11-04',
      mode: 'scheduled',
      forceRegenerate: false
    })

    // Add another task and invoke scheduled generation again without forceRegenerate
    service.createTask({
      title: 'Second Task Added Later',
      dueAt: currentTimeMs + 7200000,
      timeZone: 'UTC'
    })

    const duplicateScheduledAttempt = await service.generateDailyBriefing({
      dateKey: '2026-11-04',
      mode: 'scheduled',
      forceRegenerate: false
    })
    expect(duplicateScheduledAttempt.id).toBe(firstScheduled.id)

    // Manual regeneration updates the briefing with the new task
    const manualRegen = await service.generateDailyBriefing({
      dateKey: '2026-11-04',
      mode: 'manual',
      forceRegenerate: true
    })
    expect(manualRegen.id).not.toBe(firstScheduled.id)
    expect(manualRegen.tasksDueToday).toHaveLength(2)
  })
})

