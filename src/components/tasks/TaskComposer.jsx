import { useRef, useState } from 'react'
import { MAX_TASK_TITLE } from '../../lib/tasks.js'
import { addDaysISO, dueInfo, todayISO } from '../../lib/dates.js'

// Quick "add a task" row: type, optionally pick a due date, press Enter.
// Optional room picker (Home dashboard): pass rooms, roomId and onRoomChange.
export default function TaskComposer({ onAdd, rooms = null, roomId = null, onRoomChange }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dateInput = useRef(null)

  const today = todayISO()
  const tomorrow = addDaysISO(today, 1)
  const active = title.trim().length > 0 || dueDate

  async function handleSubmit(e) {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return
    setBusy(true)
    setError(null)
    try {
      await onAdd({ title: clean, dueDate })
      setTitle('')
      setDueDate(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const chip = (value, label) => (
    <button
      type="button"
      onClick={() => setDueDate(dueDate === value ? null : value)}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        dueDate === value ? 'border-brand bg-brand text-on-brand' : 'border-transparent bg-raised text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  )

  const customPicked = dueDate && dueDate !== today && dueDate !== tomorrow

  function openPicker() {
    const input = dateInput.current
    if (!input) return
    try {
      input.showPicker() // Chrome, Edge, Firefox, Safari 16+
    } catch {
      input.focus() // older browsers: focusing usually opens it on mobile
      input.click()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-surface p-1.5">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TASK_TITLE}
          placeholder="What's next?"
          aria-label="New task"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-[15px] outline-none"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          aria-label="Add task"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand transition-colors disabled:bg-raised disabled:text-muted"
        >
          {busy ? (
            '…'
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
      </div>

      {rooms && rooms.length > 0 && (
        <div className="flex items-center gap-2 px-2 pt-1 pb-1">
          <span className="text-xs text-muted">In:</span>
          <select
            value={roomId ?? ''}
            onChange={(e) => onRoomChange(e.target.value)}
            aria-label="Room for this task"
            className="max-w-[14rem] truncate rounded-full border border-transparent bg-raised px-3 py-1 text-xs font-semibold outline-none focus:border-brand"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-2 px-2 pt-1 pb-1">
          <span className="text-xs text-muted">Due:</span>
          {chip(today, 'Today')}
          {chip(tomorrow, 'Tomorrow')}
          <span className="relative">
            <button
              type="button"
              onClick={openPicker}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                customPicked ? 'border-brand bg-brand text-on-brand' : 'border-transparent bg-raised text-muted hover:text-ink'
              }`}
            >
              {customPicked ? dueInfo(dueDate).label : 'Pick date'}
            </button>
            {/* Hidden native picker, opened by the button above. It stays rendered
                (not display:none) because showPicker() needs a laid-out input. */}
            <input
              ref={dateInput}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              value={dueDate ?? ''}
              onChange={(e) => setDueDate(e.target.value || null)}
              className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
            />
          </span>
        </div>
      )}

      {error && <p className="px-2 pt-1 text-xs text-danger">{error}</p>}
    </form>
  )
}
