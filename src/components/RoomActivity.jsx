import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listActivity } from '../lib/activity.js'
import { addReaction, EMOJIS } from '../lib/reactions.js'
import ActivityList from './ActivityList.jsx'

// "Room feed": the latest events for one room. Someone else finishing a
// task gets a one-tap Cheer button right in the feed.
export default function RoomActivity({ roomId, meId, refreshKey = 0, onCheered = () => {} }) {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    let cancelled = false
    listActivity({ roomId, limit: 6 })
      .then((e) => !cancelled && setEvents(e))
      .catch(() => !cancelled && setEvents([]))
    return () => {
      cancelled = true
    }
  }, [roomId, refreshKey])

  if (!events || events.length === 0) return null

  const action = (event) =>
    event.type === 'task_completed' && event.actor_id !== meId && event.task ? (
      <QuickCheer taskId={event.task.id} onCheered={onCheered} />
    ) : null

  return (
    <section className="space-y-2 pt-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-extrabold">Room feed</h2>
        <Link to={`/activity?room=${roomId}`} className="text-sm font-semibold text-brand">
          See all
        </Link>
      </div>
      <div className="rounded-2xl bg-surface px-4 py-1">
        <ActivityList events={events} meId={meId} action={action} />
      </div>
    </section>
  )
}

function QuickCheer({ taskId, onCheered }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(null)

  async function send(emoji) {
    setOpen(false)
    setSent(emoji)
    try {
      await addReaction(taskId, emoji)
    } catch (err) {
      // Already cheered with this emoji → that's fine; anything else → undo.
      if (!/duplicate|unique/i.test(err.message)) setSent(null)
    }
    onCheered()
  }

  if (sent) {
    return (
      <span className="shrink-0 rounded-xl bg-brand-soft px-2.5 py-1.5 text-sm font-bold text-brand-ink" aria-label={`You cheered ${sent}`}>
        {sent}
      </span>
    )
  }

  if (open) {
    return (
      <div className="flex shrink-0 items-center rounded-xl bg-raised p-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => send(emoji)}
            aria-label={`Cheer ${emoji}`}
            className="rounded-lg px-1.5 py-1 text-base transition hover:scale-110"
          >
            {emoji}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="shrink-0 rounded-xl bg-raised px-3 py-1.5 text-[13px] font-bold text-brand hover:bg-brand hover:text-on-brand"
    >
      Cheer
    </button>
  )
}
