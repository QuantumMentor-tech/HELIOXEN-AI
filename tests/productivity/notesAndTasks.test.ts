import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ProductivityService } from '../../src/main/productivity'

describe('Step 35 — Notes & Task Management Subsystem (Sections 16.1 & 16.2)', () => {
  let tmpDir: string
  let currentTimeMs: number
  let service: ProductivityService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step35-notes-tasks-'))
    currentTimeMs = Date.parse('2026-11-04T10:00:00.000Z')
    service = new ProductivityService({
      storageDir: tmpDir,
      nowFn: () => currentTimeMs
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

  describe('16.1 Notes Management', () => {
    it('creates, retrieves, updates, pins, archives, searches, and deletes notes with persistence across restarts', () => {
      const created = service.createNote({
        title: 'Phase 12 Architecture Notes',
        body: 'Ensure strict separation between conversational memory and productivity records.',
        tags: ['architecture', 'phase-12'],
        pinned: true
      })

      expect(created.id).toMatch(/^note_/)
      expect(created.pinned).toBe(true)
      expect(created.tags).toEqual(['architecture', 'phase-12'])

      const second = service.createNote({
        title: 'Grocery List',
        body: 'Coffee beans and oat milk',
        tags: ['personal'],
        pinned: false
      })

      // Search by keyword
      const archMatches = service.listNotes({ query: 'conversational memory' })
      expect(archMatches).toHaveLength(1)
      expect(archMatches[0].id).toBe(created.id)

      // Filter by tag
      const personalMatches = service.listNotes({ tag: 'personal' })
      expect(personalMatches).toHaveLength(1)
      expect(personalMatches[0].id).toBe(second.id)

      // Update & archive second note
      const updatedSecond = service.updateNote({
        id: second.id,
        body: 'Coffee beans, oat milk, and dark chocolate',
        archived: true
      })
      expect(updatedSecond.archived).toBe(true)

      // Default list excludes archived notes
      expect(service.listNotes()).toHaveLength(1)
      expect(service.listNotes({ includeArchived: true })).toHaveLength(2)

      // Restart persistence verification
      service.dispose()
      const restartedService = new ProductivityService({
        storageDir: tmpDir,
        nowFn: () => currentTimeMs
      })
      const reloaded = restartedService.getNote(created.id)
      expect(reloaded).not.toBeNull()
      expect(reloaded?.title).toBe('Phase 12 Architecture Notes')

      // Delete note
      const delRes = restartedService.deleteNote({ id: created.id })
      expect(delRes.deleted).toBe(true)
      expect(restartedService.getNote(created.id)).toBeNull()
      restartedService.dispose()
    })

    it('rolls back in-memory state if disk persistence fails during note creation or update', () => {
      const note = service.createNote({
        title: 'Initial Committed Note',
        body: 'Safe content'
      })

      service.setSimulateDiskWriteFailure(true)
      expect(() =>
        service.createNote({
          title: 'Uncommitted Note',
          body: 'Should not remain in memory'
        })
      ).toThrow(/DISK_WRITE_FAILED/)

      service.setSimulateDiskWriteFailure(false)
      const notes = service.listNotes()
      expect(notes).toHaveLength(1)
      expect(notes[0].id).toBe(note.id)
    })

    it('unlinks linked tasks cleanly when a note is deleted without deleting the task', () => {
      const note = service.createNote({
        title: 'Sprint Spec',
        body: 'Spec details'
      })
      const task = service.createTask({
        title: 'Implement Sprint Spec',
        linkedNoteId: note.id
      })
      expect(task.linkedNoteId).toBe(note.id)

      service.deleteNote({ id: note.id })

      const survivingTask = service.getTask(task.id)
      expect(survivingTask).not.toBeNull()
      expect(survivingTask?.linkedNoteId).toBeNull()
    })
  })

  describe('16.2 Task Management', () => {
    it('tracks task lifecycle, priorities, due dates, overdue detection, and clears completedAt when reopened', () => {
      const overdueTask = service.createTask({
        title: 'Submit Q3 Security Audit',
        priority: 'urgent',
        dueAt: currentTimeMs - 2 * 60 * 60 * 1000, // 2 hours ago
        timeZone: 'UTC'
      })
      expect(overdueTask.isOverdue).toBe(true)
      expect(overdueTask.completedAt).toBeNull()

      const dueTodayTask = service.createTask({
        title: 'Review PR #42',
        priority: 'high',
        dueAt: currentTimeMs + 3 * 60 * 60 * 1000, // Later today
        timeZone: 'UTC'
      })
      expect(dueTodayTask.isOverdue).toBe(false)
      expect(dueTodayTask.isDueToday).toBe(true)

      // Complete overdueTask
      currentTimeMs += 60000
      const completed = service.updateTask({
        id: overdueTask.id,
        status: 'completed'
      })
      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toBe(currentTimeMs)
      expect(completed.isOverdue).toBe(false)

      // Reopen completed task -> completedAt MUST be cleared
      currentTimeMs += 60000
      const reopened = service.updateTask({
        id: overdueTask.id,
        status: 'in_progress'
      })
      expect(reopened.status).toBe('in_progress')
      expect(reopened.completedAt).toBeNull()
      expect(reopened.isOverdue).toBe(true)
    })

    it('prevents ambiguous natural-language task completion from mutating the wrong task', () => {
      const t1 = service.createTask({
        title: 'Prepare client presentation deck',
        priority: 'high'
      })
      const t2 = service.createTask({
        title: 'Prepare internal presentation notes',
        priority: 'medium'
      })

      // Ambiguous query matching both active tasks
      const ambiguousResult = service.completeTaskByTitle({
        titleQuery: 'presentation'
      })
      expect(ambiguousResult.status).toBe('ambiguous')
      expect(ambiguousResult.candidates).toHaveLength(2)
      expect(service.getTask(t1.id)?.status).toBe('todo')
      expect(service.getTask(t2.id)?.status).toBe('todo')

      // Unambiguous completion using specific title or targetTaskId
      const resolvedResult = service.completeTaskByTitle({
        titleQuery: 'presentation',
        targetTaskId: t1.id
      })
      expect(resolvedResult.status).toBe('completed')
      expect(resolvedResult.completedTask?.id).toBe(t1.id)
      expect(service.getTask(t1.id)?.status).toBe('completed')
      expect(service.getTask(t2.id)?.status).toBe('todo')
    })
  })
})

