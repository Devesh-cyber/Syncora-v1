import { Link } from 'react-router-dom'
import { addDaysISO, todayISO } from '../../lib/dates.js'
import { eventIsPast, eventLocalDate, eventTimeLabel } from '../../lib/events.js'

// Home: the next few events across all your rooms.
export default function UpcomingEvents({ events }) {
  const upcoming = (events ?? []).filter((e) => !eventIsPast(e))
  if (upcoming.length === 0) return null

  const today = todayISO()
  const tomorrow = addDaysISO(today, 1)
  const dayLabel = (e) => {
    const d = eventLocalDate(e)
    if (d === today) return 'Today'
    if (d === tomorrow) return 'Tomorrow'
    return new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted" style={{ fontFamily: 'inherit', letterSpacing: 0 }}>
        Upcoming
      </h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {upcoming.map((e) => {
          const isToday = eventLocalDate(e) === today
          return (
            <li key={e.id} className="shrink-0">
              <Link
                to={`/rooms/${e.room_id}?tab=calendar&date=${eventLocalDate(e)}`}
                className={`block w-48 rounded-2xl px-4 py-3 transition hover:bg-raised ${isToday ? 'bg-brand-soft' : 'bg-surface'}`}
              >
                <p className={`text-xs font-bold ${isToday ? 'text-brand-ink' : 'text-brand'}`}>
                  {dayLabel(e)} · {eventTimeLabel(e)}
                </p>
                <p className="mt-1 truncate font-bold">{e.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{e.room?.name}</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
