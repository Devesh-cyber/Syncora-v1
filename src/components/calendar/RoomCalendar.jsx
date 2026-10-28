import { useCallback, useEffect, useMemo, useState } from 'react'
import Avatar from '../Avatar.jsx'
import { ErrorNote } from '../ui.jsx'
import EventEditor from './EventEditor.jsx'
import NotificationsCard, { BellIcon } from './NotificationsCard.jsx'
import { addDaysISO, toISODate, todayISO } from '../../lib/dates.js'
import {
  createEvent,
  deleteEvent,
  eventIsPast,
  eventLocalDate,
  eventTimeLabel,
  getRoomMuted,
  listRoomEvents,
  reminderLabel,
  setRoomMuted,
  updateEvent,
} from '../../lib/events.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 6 rows × 7 days, Monday first, covering the month of `monthISO`.
function monthGrid(monthISO) {
  const first = parseISO(monthISO.slice(0, 8) + '01')
  const offset = (first.getDay() + 6) % 7
  const start = toISODate(new Date(first.getFullYear(), first.getMonth(), 1 - offset))
  return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i))
}

export default function RoomCalendar({ room, meId, isAdmin, initialDate = null, liveKey = 0 }) {
  const [selected, setSelected] = useState(() => (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayISO()))
  const [month, setMonth] = useState(() => selected.slice(0, 7))
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null)
  const [muted, setMuted] = useState(false)
  const [mutedBusy, setMutedBusy] = useState(false)

  const days = useMemo(() => monthGrid(`${month}-01`), [month])
  const today = todayISO()

  const load = useCallback(async () => {
    try {
      setError(null)
      setEvents(await listRoomEvents(room.id, days[0], days[days.length - 1]))
    } catch (err) {
      setError(err.message)
    }
  }, [room.id, days])

  useEffect(() => {
    load()
  }, [load, liveKey])

  useEffect(() => {
    getRoomMuted(room.id, meId)
      .then(setMuted)
      .catch(() => {})
  }, [room.id, meId])

  const byDay = useMemo(() => {
    const map = {}
    for (const e of events ?? []) (map[eventLocalDate(e)] ??= []).push(e)
    return map
  }, [events])

  const dayEvents = byDay[selected] ?? []
  const monthLabel = parseISO(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const selectedLabel = parseISO(selected).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  function shiftMonth(n) {
    const d = parseISO(`${month}-01`)
    setMonth(toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1)).slice(0, 7))
  }

  function pick(day) {
    setSelected(day)
    if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7))
  }

  function goToday() {
    setSelected(today)
    setMonth(today.slice(0, 7))
  }

  async function toggleMuted() {
    setMutedBusy(true)
    try {
      await setRoomMuted(room.id, !muted)
      setMuted(!muted)
    } catch (err) {
      setError(err.message)
    } finally {
      setMutedBusy(false)
    }
  }

  async function handleSave(target, fields) {
    if (target.id) {
      const saved = await updateEvent(target.id, fields)
      setEvents((list) => list.map((e) => (e.id === saved.id ? saved : e)))
    } else {
      const saved = await createEvent(room.id, fields)
      setEvents((list) => [...(list ?? []), saved].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
    }
    pick(fields.date)
  }

  async function handleDelete(target) {
    await deleteEvent(target.id)
    setEvents((list) => list.filter((e) => e.id !== target.id))
  }

  return (
    <div className="space-y-3">
      <NotificationsCard compact />

      {/* Month header */}
      <section className="rounded-3xl bg-surface p-4">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold">{monthLabel}</h2>
          {(selected !== today || month !== today.slice(0, 7)) && (
            <button onClick={goToday} className="rounded-lg bg-raised px-2.5 py-1.5 text-xs font-bold text-brand">
              Today
            </button>
          )}
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-xl bg-raised hover:brightness-125">
            <Chevron dir="left" />
          </button>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-xl bg-raised hover:brightness-125">
            <Chevron dir="right" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold tracking-wide text-muted uppercase" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1">
              {d.slice(0, 2)}
            </span>
          ))}
        </div>

        <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const inMonth = day.slice(0, 7) === month
            const isSelected = day === selected
            const isToday = day === today
            const count = byDay[day]?.length ?? 0
            const label = `${parseISO(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${
              count ? `, ${count} event${count > 1 ? 's' : ''}` : ''
            }`
            return (
              <button
                key={day}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={label}
                onClick={() => pick(day)}
                className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                  isSelected
                    ? 'bg-brand font-bold text-on-brand'
                    : isToday
                      ? 'font-bold text-brand ring-2 ring-brand/60'
                      : inMonth
                        ? 'text-ink hover:bg-raised'
                        : 'text-muted/40 hover:bg-raised'
                }`}
              >
                {Number(day.slice(8))}
                <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden="true">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <span key={i} className={`h-1 w-1 rounded-full ${isSelected ? 'bg-on-brand' : 'bg-brand'}`} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Selected day */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1 pt-1">
          <h3 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold">
            {selected === today ? 'Today' : selected === addDaysISO(today, 1) ? 'Tomorrow' : selectedLabel}
          </h3>
          <button
            onClick={() => setDraft({ date: selected })}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-bold text-on-brand"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add event
          </button>
        </div>

        {events === null ? (
          <p className="rounded-2xl bg-surface px-4 py-4 text-sm text-muted">Loading…</p>
        ) : dayEvents.length === 0 ? (
          <button
            onClick={() => setDraft({ date: selected })}
            className="w-full rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted hover:border-brand hover:text-ink"
          >
            Nothing planned. Tap to add an event — a test, a call, a deadline.
          </button>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                meId={meId}
                canEdit={event.created_by === meId || isAdmin}
                onEdit={() => setDraft(event)}
              />
            ))}
          </ul>
        )}

        <button
          onClick={toggleMuted}
          disabled={mutedBusy}
          className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-muted hover:text-ink disabled:opacity-60"
        >
          <BellIcon muted={muted} />
          {muted ? `Reminders muted for ${room.name} — tap to unmute` : `Mute reminders for ${room.name}`}
        </button>
      </section>

      <EventEditor
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={handleSave}
        onDelete={draft?.id && (draft.created_by === meId || isAdmin) ? handleDelete : null}
      />
    </div>
  )
}

function EventItem({ event, meId, canEdit, onEdit }) {
  const [open, setOpen] = useState(false)
  const past = eventIsPast(event)
  const creator = event.created_by === meId ? 'You' : event.creator?.display_name ?? 'A former member'

  return (
    <li className={`rounded-2xl px-4 py-3 ${past ? 'bg-sunken' : 'bg-surface'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-16 shrink-0 pt-0.5 text-sm font-bold ${past ? 'text-muted' : 'text-brand'}`}>{eventTimeLabel(event)}</div>
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className={`font-semibold break-words ${past ? 'text-muted' : ''}`}>{event.title}</p>
          {event.description && (
            <p className={`mt-0.5 text-sm break-words whitespace-pre-line text-muted ${open ? '' : 'line-clamp-2'}`}>{event.description}</p>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Avatar name={event.creator?.display_name ?? '?'} url={event.creator?.avatar_url} size={16} />
              {creator}
            </span>
            {event.remind_offset !== 'none' && (
              <span className="flex items-center gap-1">
                <BellIcon className="h-3 w-3" /> {reminderLabel(event.remind_offset)}
              </span>
            )}
          </p>
        </button>
        {canEdit && (
          <button onClick={onEdit} className="shrink-0 rounded-lg bg-raised px-2.5 py-1.5 text-xs font-bold hover:brightness-125">
            Edit
          </button>
        )}
      </div>
    </li>
  )
}

function Chevron({ dir }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}
