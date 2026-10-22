import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { listMyRooms } from '../lib/rooms.js'
import { useLiveRefresh } from '../lib/useLiveRefresh.js'
import { Badge, Card, ErrorNote, Spinner } from '../components/ui.jsx'

export default function Rooms() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    listMyRooms()
      .then((data) => {
        setRooms(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(
    `rooms:${user.id}`,
    [
      { table: 'room_members', filter: `user_id=eq.${user.id}` },
      { table: 'rooms' },
      { table: 'deletion_requests' },
    ],
    load,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Rooms</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/rooms/new" className="rounded-xl bg-brand px-4 py-3 text-center font-semibold text-on-brand">
          + Create room
        </Link>
        <Link to="/rooms/join" className="rounded-xl bg-surface px-4 py-3 text-center font-semibold">
          Join with code
        </Link>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {!rooms && !error && <Spinner />}

      {rooms && rooms.length === 0 && (
        <Card className="text-center">
          <p className="text-3xl" aria-hidden="true">🏠</p>
          <h2 className="mt-2 font-semibold">No rooms yet</h2>
          <p className="mt-1 text-sm text-muted">
            Create one for your study group or team, or join a friend's room with their code.
          </p>
        </Card>
      )}

      {rooms && rooms.length > 0 && (
        <ul className="space-y-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                to={`/rooms/${room.id}`}
                className="block rounded-2xl bg-surface p-4 transition hover:bg-raised"
              >
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold">{room.name}</h2>
                  {room.admin_id === user.id && <Badge>Admin</Badge>}
                  {room.voteOpen && (
                    <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">🗳️ Vote open</span>
                  )}
                </div>
                {room.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{room.description}</p>}
                <p className="mt-2 text-xs font-medium text-muted">
                  {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
