import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPushState, syncPushSubscription } from '../../lib/push.js'
import { eventTimeLabel, listRemindersBetween } from '../../lib/events.js'
import { BellIcon } from './NotificationsCard.jsx'

const SHOWN_KEY = 'syncora:remindersShown'
const CHECK_EVERY = 60_000

function readShown() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

// In-app fallback for reminders: while Syncora is open on a device that
// doesn't have push turned on, show a toast when an event's reminder time
// arrives. (With push on, the system notification does the job.)
export default function ReminderToasts() {
  const [toasts, setToasts] = useState([])
  const shown = useRef(readShown())
  const navigate = useNavigate()

  const check = useCallback(async () => {
    try {
      if ((await getPushState()) === 'on') return
      const now = Date.now()
      const due = await listRemindersBetween(new Date(now - 2 * 60_000).toISOString(), new Date(now).toISOString())
      const fresh = due.filter((e) => !shown.current.has(e.id))
      if (fresh.length === 0) return
      fresh.forEach((e) => shown.current.add(e.id))
      try {
        sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shown.current].slice(-50)))
      } catch {
        /* ignore */
      }
      setToasts((list) => [...list, ...fresh].slice(-3))
    } catch {
      /* calendar not set up yet, or offline — try again next minute */
    }
  }, [])

  useEffect(() => {
    syncPushSubscription()
    check()
    const id = setInterval(check, CHECK_EVERY)
    return () => clearInterval(id)
  }, [check])

  // Auto-hide each toast after 12 seconds.
  useEffect(() => {
    if (toasts.length === 0) return
    const id = setTimeout(() => setToasts((list) => list.slice(1)), 12_000)
    return () => clearTimeout(id)
  }, [toasts])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]" aria-live="polite">
      {toasts.map((e) => (
        <div
          key={e.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-raised px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-1 ring-brand/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand">
            <BellIcon />
          </span>
          <button
            onClick={() => {
              setToasts((list) => list.filter((t) => t.id !== e.id))
              const d = new Date(e.starts_at)
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              navigate(`/rooms/${e.room_id}?tab=calendar&date=${date}`)
            }}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate font-bold">{e.title}</p>
            <p className="truncate text-xs text-muted">
              {e.room?.name} · {eventTimeLabel(e)}
            </p>
          </button>
          <button
            onClick={() => setToasts((list) => list.filter((t) => t.id !== e.id))}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg px-2 py-1 text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
