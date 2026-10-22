import Avatar from './Avatar.jsx'
import { describeEvent, eventIcon } from '../lib/activity.js'
import { relativeTime } from '../lib/dates.js'

// Shared by the Activity tab, the Home preview and the room page.
// showRoom: add the room name under each line (for cross-room feeds).
// action(event): optional element on the right of a row (the room feed's Cheer).
export default function ActivityList({ events, meId, showRoom = false, action = null }) {
  return (
    <ul className="divide-y divide-line">
      {events.map((event) => (
        <li key={event.id} className="flex items-center gap-3 py-3">
          <div className="relative shrink-0">
            <Avatar name={event.actor?.display_name ?? '?'} url={event.actor?.avatar_url} size={36} rounded="xl" />
            <span className="absolute -right-1 -bottom-1 text-sm leading-none" aria-hidden="true">
              {eventIcon(event.type)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm break-words">{describeEvent(event, meId)}</p>
            <p className="mt-0.5 text-xs text-muted">
              {relativeTime(event.created_at)}
              {showRoom && event.room?.name && <> · {event.room.name}</>}
            </p>
          </div>
          {action?.(event)}
        </li>
      ))}
    </ul>
  )
}
