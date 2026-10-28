import { useEffect, useState } from 'react'
import Sheet from '../Sheet.jsx'
import { ErrorNote, PrimaryButton, SecondaryButton, TextArea, TextField } from '../ui.jsx'
import {
  ALL_DAY_REMINDERS,
  eventToFields,
  MAX_EVENT_DESCRIPTION,
  MAX_EVENT_TITLE,
  TIMED_REMINDERS,
} from '../../lib/events.js'

// Add / edit an event. `draft` is either { date } for a new event or an
// existing event row. Closed when draft is null.
export default function EventEditor({ draft, onClose, onSave, onDelete }) {
  const editing = Boolean(draft?.id)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [remind, setRemind] = useState('at')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!draft) return
    if (draft.id) {
      const f = eventToFields(draft)
      setTitle(f.title)
      setDescription(f.description)
      setDate(f.date)
      setTime(f.time || '18:00')
      setAllDay(f.allDay)
      setRemind(f.remindOffset)
    } else {
      setTitle('')
      setDescription('')
      setDate(draft.date)
      setTime(nextHalfHour(draft.date))
      setAllDay(false)
      setRemind('at')
    }
    setBusy(false)
    setConfirmDelete(false)
    setError(null)
  }, [draft])

  function toggleAllDay(next) {
    setAllDay(next)
    // Keep the reminder meaningful for the new type.
    if (next && !ALL_DAY_REMINDERS.some((r) => r.value === remind)) setRemind(remind === 'none' ? 'none' : remind === '1d' ? 'day_before' : 'morning')
    if (!next && !TIMED_REMINDERS.some((r) => r.value === remind)) setRemind(remind === 'none' ? 'none' : remind === 'day_before' ? '1d' : 'at')
  }

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('Give the event a title.')
    if (!date) return setError('Pick a date.')
    if (!allDay && !time) return setError('Pick a time, or switch on All day.')
    run(() => onSave(draft, { title: title.trim(), description: description.trim(), date, time, allDay, remindOffset: remind }))
  }

  const reminders = allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS

  return (
    <Sheet open={Boolean(draft)} onClose={() => !busy && onClose()} labelledBy="event-editor-title">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 id="event-editor-title" className="text-xl font-extrabold">
          {editing ? 'Edit event' : 'New event'}
        </h2>

        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_EVENT_TITLE}
          placeholder="e.g. Mock test, Team call, Submission deadline"
          autoFocus={!editing}
        />

        <TextArea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_EVENT_DESCRIPTION}
          rows={3}
          placeholder="Where, what to bring, links…"
          hint={`${description.length}/${MAX_EVENT_DESCRIPTION}`}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-semibold">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-transparent bg-sunken px-3 py-3 outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className={`text-sm font-semibold ${allDay ? 'text-muted' : ''}`}>Time</span>
            <input
              type="time"
              value={allDay ? '' : time}
              onChange={(e) => setTime(e.target.value)}
              disabled={allDay}
              className="mt-1.5 w-full rounded-xl border border-transparent bg-sunken px-3 py-3 outline-none focus:border-brand disabled:opacity-40"
            />
          </label>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-sunken px-4 py-3">
          <span className="font-semibold">All day</span>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => toggleAllDay(e.target.checked)}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold">Remind everyone</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {reminders.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setRemind(r.value)}
                aria-pressed={remind === r.value}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  remind === r.value ? 'bg-brand text-on-brand' : 'bg-raised text-muted hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Room members who turned on reminders get a notification.</p>
        </fieldset>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex gap-3">
          <SecondaryButton type="button" onClick={onClose} disabled={busy} className="flex-1">
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy} className="flex-1">
            {busy ? 'Saving…' : editing ? 'Save' : 'Add event'}
          </PrimaryButton>
        </div>

        {editing && onDelete && (
          <div className="border-t border-line pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <p className="flex-1 text-sm text-muted">Delete this event for everyone?</p>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="text-sm font-semibold text-muted">
                  No
                </button>
                <button
                  type="button"
                  onClick={() => run(() => onDelete(draft))}
                  disabled={busy}
                  className="rounded-lg bg-danger-strong px-3 py-2 text-sm font-semibold text-white"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-danger">
                Delete event
              </button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}

// New events default to the next half hour today, or 6 PM on other days.
function nextHalfHour(date) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (date !== today) return '18:00'
  const m = now.getMinutes() < 30 ? 30 : 60
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), m)
  if (d.getDate() !== now.getDate()) return '23:30'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
