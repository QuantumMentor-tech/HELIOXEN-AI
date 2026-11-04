import React, { useEffect, useState, useCallback } from 'react'
import {
  Calendar,
  CheckSquare,
  Bell,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Pin,
  Archive,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import {
  CalendarEventRecord,
  DailyBriefingReport,
  ExternalCalendarAccountState,
  NoteRecord,
  ProductivityOverviewSnapshot,
  ReminderRecord,
  ReminderRecurrenceFrequency,
  TaskItemWithComputedState,
  TaskPriority,
  TaskStatus
} from '../../../../shared/productivity/types'

type ProductivitySection = 'briefing' | 'tasks' | 'notes' | 'reminders' | 'calendar'

export const ProductivityWorkspacePanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ProductivitySection>('briefing')
  const [overview, setOverview] = useState<ProductivityOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Notes form state
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteTags, setNoteTags] = useState('')
  const [notePinned, setNotePinned] = useState(false)
  const [noteSearchQuery, setNoteSearchQuery] = useState('')

  // Tasks form state
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium')
  const [taskDueInput, setTaskDueInput] = useState('')
  const [taskFilterStatus, setTaskFilterStatus] = useState<TaskStatus | 'active_only'>('active_only')

  // Reminders form state
  const [remTitle, setRemTitle] = useState('')
  const [remDescription, setRemDescription] = useState('')
  const [remDueInput, setRemDueInput] = useState('')
  const [remFrequency, setRemFrequency] = useState<ReminderRecurrenceFrequency>('none')

  // Calendar form state
  const [evtTitle, setEvtTitle] = useState('')
  const [evtLocation, setEvtLocation] = useState('')
  const [evtAllDay, setEvtAllDay] = useState(false)
  const [evtAllDayDate, setEvtAllDayDate] = useState('')
  const [evtStartInput, setEvtStartInput] = useState('')
  const [evtEndInput, setEvtEndInput] = useState('')

  // Briefing schedule settings
  const [briefingTimeInput, setBriefingTimeInput] = useState('08:30')

  const refreshOverview = useCallback(async () => {
    if (!window.helioxen?.productivity) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setErrorMessage(null)
      const snap = await window.helioxen.productivity.getOverview()
      setOverview(snap)
      if (snap.dailyBriefingPreferences?.deliveryTimeLocal) {
        setBriefingTimeInput(snap.dailyBriefingPreferences.deliveryTimeLocal)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load productivity workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshOverview()
  }, [refreshOverview])

  const handleGenerateBriefing = async () => {
    if (!window.helioxen?.productivity) return
    try {
      setErrorMessage(null)
      await window.helioxen.productivity.generateBriefing({
        mode: 'manual',
        forceRegenerate: true
      })
      setStatusMessage('Daily Briefing updated from verified local records.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate daily briefing')
    }
  }

  const handleUpdateBriefingTime = async () => {
    if (!window.helioxen?.productivity) return
    try {
      setErrorMessage(null)
      await window.helioxen.productivity.updateSettings({
        dailyBriefing: {
          enabled: true,
          deliveryTimeLocal: briefingTimeInput
        }
      })
      setStatusMessage(`Scheduled Daily Briefing time updated to ${briefingTimeInput}.`)
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid briefing time (use HH:mm)')
    }
  }

  // Notes handlers
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.helioxen?.productivity || !noteTitle.trim()) return
    try {
      setErrorMessage(null)
      const tags = noteTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      await window.helioxen.productivity.createNote({
        title: noteTitle.trim(),
        body: noteBody,
        tags,
        pinned: notePinned
      })
      setNoteTitle('')
      setNoteBody('')
      setNoteTags('')
      setNotePinned(false)
      setStatusMessage('Note saved.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create note')
    }
  }

  const handleTogglePinNote = async (note: NoteRecord) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.updateNote({
        id: note.id,
        pinned: !note.pinned
      })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update note')
    }
  }

  const handleDeleteNote = async (id: string) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.deleteNote({ id })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete note')
    }
  }

  // Tasks handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.helioxen?.productivity || !taskTitle.trim()) return
    try {
      setErrorMessage(null)
      const dueAt = taskDueInput ? new Date(taskDueInput).getTime() : null
      await window.helioxen.productivity.createTask({
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        dueAt: dueAt && !Number.isNaN(dueAt) ? dueAt : null
      })
      setTaskTitle('')
      setTaskDescription('')
      setTaskDueInput('')
      setStatusMessage('Task created.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create task')
    }
  }

  const handleToggleTaskComplete = async (task: TaskItemWithComputedState) => {
    if (!window.helioxen?.productivity) return
    try {
      const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed'
      await window.helioxen.productivity.updateTask({
        id: task.id,
        status: nextStatus
      })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.deleteTask({ id })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  // Reminders handlers
  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.helioxen?.productivity || !remTitle.trim()) return
    try {
      setErrorMessage(null)
      const dueAt = remDueInput ? new Date(remDueInput).getTime() : Date.now() + 3600000
      await window.helioxen.productivity.createReminder({
        title: remTitle.trim(),
        description: remDescription.trim(),
        dueAt,
        recurrence: { frequency: remFrequency, interval: 1 }
      })
      setRemTitle('')
      setRemDescription('')
      setRemDueInput('')
      setRemFrequency('none')
      setStatusMessage('Reminder scheduled.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to schedule reminder')
    }
  }

  const handleSnoozeReminder = async (id: string) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.snoozeReminder({ id, durationMinutes: 10 })
      setStatusMessage('Reminder snoozed for 10 minutes.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to snooze reminder')
    }
  }

  const handleDismissReminder = async (id: string) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.dismissReminder({ id })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to dismiss reminder')
    }
  }

  const handleCancelReminder = async (id: string) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.cancelReminder({ id })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to cancel reminder')
    }
  }

  // Calendar handlers
  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.helioxen?.productivity || !evtTitle.trim()) return
    try {
      setErrorMessage(null)
      if (evtAllDay) {
        await window.helioxen.productivity.createCalendarEvent({
          title: evtTitle.trim(),
          location: evtLocation.trim(),
          allDay: true,
          allDayStartDate: evtAllDayDate || new Date().toISOString().slice(0, 10),
          allDayEndDate: evtAllDayDate || new Date().toISOString().slice(0, 10)
        })
      } else {
        const startAt = evtStartInput ? new Date(evtStartInput).getTime() : Date.now() + 3600000
        const endAt = evtEndInput ? new Date(evtEndInput).getTime() : startAt + 3600000
        await window.helioxen.productivity.createCalendarEvent({
          title: evtTitle.trim(),
          location: evtLocation.trim(),
          allDay: false,
          startAt,
          endAt
        })
      }
      setEvtTitle('')
      setEvtLocation('')
      setStatusMessage('Calendar event created.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create calendar event')
    }
  }

  const handleDeleteCalendarEvent = async (ev: CalendarEventRecord) => {
    if (!window.helioxen?.productivity) return
    try {
      await window.helioxen.productivity.deleteCalendarEvent({
        id: ev.id,
        recurrenceScope: 'single_occurrence',
        humanConfirmed: true
      })
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete calendar event')
    }
  }

  const notes = overview?.notes ?? []
  const filteredNotes = noteSearchQuery.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
          n.body.toLowerCase().includes(noteSearchQuery.toLowerCase())
      )
    : notes

  const tasks = overview?.tasks ?? []
  const filteredTasks = tasks.filter((t) => {
    if (taskFilterStatus === 'active_only') {
      return t.status === 'todo' || t.status === 'in_progress'
    }
    return t.status === taskFilterStatus
  })

  const reminders = overview?.reminders ?? []
  const events = overview?.events ?? []
  const briefing: DailyBriefingReport | null = overview?.latestBriefing ?? null
  const externalAccounts: readonly ExternalCalendarAccountState[] = overview?.externalAccounts ?? []

  return (
    <div className="space-y-5" data-testid="productivity-workspace-panel">
      {/* Section Navigation Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hx-border-subtle pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeSection === 'briefing' ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setActiveSection('briefing')}
          >
            Daily Briefing
          </Button>
          <Button
            variant={activeSection === 'tasks' ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
            onClick={() => setActiveSection('tasks')}
          >
            Tasks ({tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length})
          </Button>
          <Button
            variant={activeSection === 'notes' ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<FileText className="w-3.5 h-3.5" />}
            onClick={() => setActiveSection('notes')}
          >
            Notes ({notes.length})
          </Button>
          <Button
            variant={activeSection === 'reminders' ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<Bell className="w-3.5 h-3.5" />}
            onClick={() => setActiveSection('reminders')}
          >
            Reminders ({reminders.length})
          </Button>
          <Button
            variant={activeSection === 'calendar' ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<Calendar className="w-3.5 h-3.5" />}
            onClick={() => setActiveSection('calendar')}
          >
            Calendar ({events.length})
          </Button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={() => void refreshOverview()}
        >
          Refresh
        </Button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="px-3 py-2 rounded border border-hx-danger/50 bg-hx-danger/10 text-xs text-hx-danger flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[11px] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="px-3 py-2 rounded border border-hx-cyan/40 bg-hx-cyan/10 text-xs text-hx-cyan flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <Card variant="default" border="subtle" padding="md">
          <p className="text-xs text-hx-text-secondary">Loading productivity workspace...</p>
        </Card>
      ) : null}

      {/* 1. DAILY BRIEFING SECTION */}
      {activeSection === 'briefing' && (
        <div className="space-y-4">
          <Card variant="panel" border="glow" padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-display font-semibold text-hx-cyan flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Daily Briefing &amp; Schedule Overview
                </h3>
                <p className="text-xs text-hx-text-secondary">
                  Grounded exclusively in your verified local notes, tasks, reminders, and synced calendar events.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  aria-label="Scheduled Daily Briefing Time"
                  value={briefingTimeInput}
                  onChange={(e) => setBriefingTimeInput(e.target.value)}
                  className="px-2 py-1 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                />
                <Button variant="secondary" size="sm" onClick={() => void handleUpdateBriefingTime()}>
                  Save Time
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => void handleGenerateBriefing()}
                >
                  Generate Briefing Now
                </Button>
              </div>
            </div>

            {briefing ? (
              <div className="space-y-3 mt-3 pt-3 border-t border-hx-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-hx-text-muted">
                    Date: {briefing.dateKey} ({briefing.timeZone})
                  </span>
                  <Badge variant={briefing.aiEnhanced ? 'info' : 'nominal'} size="sm">
                    {briefing.aiEnhanced ? 'AI-ENHANCED GROUNDED' : 'VERIFIED DETERMINISTIC'}
                  </Badge>
                </div>
                <p className="text-xs text-hx-text-primary leading-relaxed bg-hx-space/60 p-3 rounded border border-hx-border-subtle">
                  {briefing.summaryText}
                </p>

                {briefing.warnings.length > 0 && (
                  <div className="space-y-1">
                    {briefing.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-[11px] text-hx-warning bg-hx-warning/10 px-2.5 py-1.5 rounded border border-hx-warning/30"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded bg-hx-surface/50 border border-hx-border-subtle">
                    <h4 className="text-xs font-semibold text-hx-cyan mb-2">
                      Today&apos;s Calendar Events ({briefing.todaysEvents.length})
                    </h4>
                    {briefing.todaysEvents.length === 0 ? (
                      <p className="text-[11px] text-hx-text-muted">No events scheduled for today.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-hx-text-primary">
                        {briefing.todaysEvents.map((ev) => (
                          <li key={ev.id} className="flex items-center justify-between">
                            <span>{ev.title}</span>
                            <span className="text-[10px] font-mono text-hx-text-muted">
                              {ev.allDay ? 'All Day' : new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3 rounded bg-hx-surface/50 border border-hx-border-subtle">
                    <h4 className="text-xs font-semibold text-hx-cyan mb-2">
                      Due &amp; Overdue Tasks ({briefing.tasksDueToday.length + briefing.overdueTasks.length})
                    </h4>
                    {briefing.tasksDueToday.length === 0 && briefing.overdueTasks.length === 0 ? (
                      <p className="text-[11px] text-hx-text-muted">No tasks due or overdue today.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-hx-text-primary">
                        {[...briefing.overdueTasks, ...briefing.tasksDueToday].map((t) => (
                          <li key={t.id} className="flex items-center justify-between">
                            <span>{t.title}</span>
                            <Badge variant={t.isOverdue ? 'danger' : 'warning'} size="sm">
                              {t.isOverdue ? 'OVERDUE' : t.priority.toUpperCase()}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-hx-text-muted mt-2">
                No Daily Briefing generated yet for today. Click &ldquo;Generate Briefing Now&rdquo; to assemble your briefing.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* 2. TASKS SECTION */}
      {activeSection === 'tasks' && (
        <div className="space-y-4">
          <Card variant="default" border="subtle" padding="md">
            <h3 className="text-sm font-display font-semibold text-hx-cyan mb-3">
              Create New Task
            </h3>
            <form onSubmit={(e) => void handleCreateTask(e)} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary md:col-span-2"
              />
              <select
                aria-label="Task Priority"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
              >
                <option value="low">Priority: Low</option>
                <option value="medium">Priority: Medium</option>
                <option value="high">Priority: High</option>
                <option value="urgent">Priority: Urgent</option>
              </select>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Task
              </Button>
            </form>
          </Card>

          <Card variant="default" border="subtle" padding="md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-hx-text-primary">
                Tasks ({filteredTasks.length})
              </h4>
              <div className="flex items-center gap-1.5">
                {(['active_only', 'todo', 'completed', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTaskFilterStatus(st)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      taskFilterStatus === st
                        ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/50'
                        : 'text-hx-text-muted hover:text-hx-text-primary'
                    }`}
                  >
                    {st === 'active_only' ? 'Active' : st}
                  </button>
                ))}
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <p className="text-xs text-hx-text-muted">No tasks match the current filter.</p>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2.5 rounded bg-hx-space/60 border border-hx-border-subtle"
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleTaskComplete(task)}
                        aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
                        className="text-hx-cyan hover:opacity-80"
                      >
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            task.status === 'completed' ? 'text-hx-nominal' : 'text-hx-text-muted'
                          }`}
                        />
                      </button>
                      <div>
                        <p
                          className={`text-xs font-medium ${
                            task.status === 'completed'
                              ? 'line-through text-hx-text-muted'
                              : 'text-hx-text-primary'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-[11px] text-hx-text-secondary">{task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.isOverdue && (
                        <Badge variant="danger" size="sm">
                          OVERDUE
                        </Badge>
                      )}
                      <Badge variant="neutral" size="sm">
                        {task.priority.toUpperCase()}
                      </Badge>
                      <button
                        type="button"
                        aria-label="Delete task"
                        onClick={() => void handleDeleteTask(task.id)}
                        className="text-hx-text-muted hover:text-hx-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 3. NOTES SECTION */}
      {activeSection === 'notes' && (
        <div className="space-y-4">
          <Card variant="default" border="subtle" padding="md">
            <h3 className="text-sm font-display font-semibold text-hx-cyan mb-3">
              Create Note
            </h3>
            <form onSubmit={(e) => void handleCreateNote(e)} className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                />
                <input
                  type="text"
                  placeholder="Tags (comma-separated)..."
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                />
              </div>
              <textarea
                placeholder="Write note content..."
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-hx-text-secondary">
                  <input
                    type="checkbox"
                    checked={notePinned}
                    onChange={(e) => setNotePinned(e.target.checked)}
                  />
                  Pin note to top &amp; Daily Briefing
                </label>
                <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Save Note
                </Button>
              </div>
            </form>
          </Card>

          <Card variant="default" border="subtle" padding="md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-hx-text-primary">
                Saved Notes ({filteredNotes.length})
              </h4>
              <input
                type="text"
                placeholder="Search notes..."
                value={noteSearchQuery}
                onChange={(e) => setNoteSearchQuery(e.target.value)}
                className="px-2.5 py-1 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
              />
            </div>

            {filteredNotes.length === 0 ? (
              <p className="text-xs text-hx-text-muted">No notes stored yet.</p>
            ) : (
              <div className="space-y-2">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded bg-hx-space/60 border border-hx-border-subtle flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-hx-text-primary">
                          {note.title}
                        </span>
                        {note.pinned && (
                          <Badge variant="info" size="sm">
                            PINNED
                          </Badge>
                        )}
                        {note.tags.map((tag) => (
                          <Badge key={tag} variant="neutral" size="sm">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-hx-text-secondary whitespace-pre-wrap">
                        {note.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                        onClick={() => void handleTogglePinNote(note)}
                        className={`text-xs ${note.pinned ? 'text-hx-cyan' : 'text-hx-text-muted'}`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete note"
                        onClick={() => void handleDeleteNote(note.id)}
                        className="text-hx-text-muted hover:text-hx-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 4. REMINDERS SECTION */}
      {activeSection === 'reminders' && (
        <div className="space-y-4">
          <Card variant="default" border="subtle" padding="md">
            <h3 className="text-sm font-display font-semibold text-hx-cyan mb-3">
              Schedule Reminder
            </h3>
            <form onSubmit={(e) => void handleCreateReminder(e)} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Reminder title..."
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
              />
              <input
                type="datetime-local"
                aria-label="Reminder Due Date and Time"
                value={remDueInput}
                onChange={(e) => setRemDueInput(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
              />
              <select
                aria-label="Reminder Recurrence"
                value={remFrequency}
                onChange={(e) => setRemFrequency(e.target.value as ReminderRecurrenceFrequency)}
                className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
              >
                <option value="none">One-Time</option>
                <option value="daily">Daily Recurrence</option>
                <option value="weekly">Weekly Recurrence</option>
              </select>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Bell className="w-3.5 h-3.5" />}>
                Schedule
              </Button>
            </form>
          </Card>

          <Card variant="default" border="subtle" padding="md">
            <h4 className="text-xs font-semibold text-hx-text-primary mb-3">
              Active &amp; Recent Reminders ({reminders.length})
            </h4>
            {reminders.length === 0 ? (
              <p className="text-xs text-hx-text-muted">No reminders scheduled.</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((rem: ReminderRecord) => (
                  <div
                    key={rem.id}
                    className="p-2.5 rounded bg-hx-space/60 border border-hx-border-subtle flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-hx-text-primary">
                          {rem.title}
                        </span>
                        <Badge
                          variant={
                            rem.status === 'delivered'
                              ? 'nominal'
                              : rem.status === 'failed_or_unknown'
                                ? 'warning'
                                : 'info'
                          }
                          size="sm"
                        >
                          {rem.status.toUpperCase()}
                        </Badge>
                        {rem.recurrence.frequency !== 'none' && (
                          <Badge variant="neutral" size="sm">
                            {rem.recurrence.frequency.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-hx-text-muted mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(rem.snoozedUntil ?? rem.dueAt).toLocaleString()} ({rem.timeZone})
                      </p>
                      {rem.failureReason && (
                        <p className="text-[11px] text-hx-warning mt-0.5">{rem.failureReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleSnoozeReminder(rem.id)}
                      >
                        Snooze 10m
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleDismissReminder(rem.id)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleCancelReminder(rem.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 5. CALENDAR SECTION */}
      {activeSection === 'calendar' && (
        <div className="space-y-4">
          <Card variant="default" border="subtle" padding="md">
            <h3 className="text-sm font-display font-semibold text-hx-cyan mb-3">
              Create Local Calendar Event
            </h3>
            <form onSubmit={(e) => void handleCreateCalendarEvent(e)} className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Event title..."
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                />
                <input
                  type="text"
                  placeholder="Location (optional)..."
                  value={evtLocation}
                  onChange={(e) => setEvtLocation(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                />
                <label className="flex items-center gap-2 text-xs text-hx-text-secondary px-2">
                  <input
                    type="checkbox"
                    checked={evtAllDay}
                    onChange={(e) => setEvtAllDay(e.target.checked)}
                  />
                  All-Day Event
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {evtAllDay ? (
                  <input
                    type="date"
                    aria-label="All-Day Event Date"
                    value={evtAllDayDate}
                    onChange={(e) => setEvtAllDayDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      aria-label="Event Start Time"
                      value={evtStartInput}
                      onChange={(e) => setEvtStartInput(e.target.value)}
                      className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                    />
                    <span className="text-xs text-hx-text-muted">to</span>
                    <input
                      type="datetime-local"
                      aria-label="Event End Time"
                      value={evtEndInput}
                      onChange={(e) => setEvtEndInput(e.target.value)}
                      className="px-2.5 py-1.5 rounded bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                    />
                  </div>
                )}
                <Button type="submit" variant="primary" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5" />}>
                  Add Event
                </Button>
              </div>
            </form>
          </Card>

          <Card variant="default" border="subtle" padding="md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-hx-text-primary">
                External Calendar Providers ({externalAccounts.length})
              </h4>
              <Badge variant="neutral" size="sm">
                PROVIDER ADAPTER BOUNDARY
              </Badge>
            </div>
            {externalAccounts.length === 0 ? (
              <p className="text-[11px] text-hx-text-muted">
                No external calendar providers connected. Local calendar events work offline by default.
              </p>
            ) : (
              <div className="space-y-2">
                {externalAccounts.map((acc) => (
                  <div
                    key={acc.providerId}
                    className="flex items-center justify-between p-2 rounded bg-hx-space/60 border border-hx-border-subtle text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-hx-cyan" />
                      <span className="font-semibold text-hx-text-primary">{acc.accountLabel}</span>
                      <span className="text-hx-text-muted">({acc.providerId})</span>
                    </div>
                    <Badge
                      variant={acc.status === 'sync_succeeded' || acc.status === 'connected' ? 'nominal' : 'warning'}
                      size="sm"
                    >
                      {acc.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card variant="default" border="subtle" padding="md">
            <h4 className="text-xs font-semibold text-hx-text-primary mb-3">
              Scheduled Events ({events.length})
            </h4>
            {events.length === 0 ? (
              <p className="text-xs text-hx-text-muted">No calendar events scheduled.</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded bg-hx-space/60 border border-hx-border-subtle flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-hx-text-primary">
                          {ev.title}
                        </span>
                        <Badge variant="neutral" size="sm">
                          {ev.providerId === 'local' ? 'LOCAL' : ev.providerId.toUpperCase()}
                        </Badge>
                        {ev.syncState !== 'local_only' && (
                          <Badge
                            variant={ev.syncState === 'synced' ? 'nominal' : 'warning'}
                            size="sm"
                          >
                            {ev.syncState.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-hx-text-muted mt-0.5">
                        {ev.allDay
                          ? `All Day (${ev.allDayStartDate})`
                          : `${new Date(ev.startAt).toLocaleString()} — ${new Date(ev.endAt).toLocaleString()}`}
                        {ev.location ? ` • ${ev.location}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete calendar event"
                      onClick={() => void handleDeleteCalendarEvent(ev)}
                      className="text-hx-text-muted hover:text-hx-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

