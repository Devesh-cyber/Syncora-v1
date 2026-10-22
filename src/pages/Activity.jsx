import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { listActivity, PAGE_SIZE } from '../lib/activity.js'
import { listMyRooms } from '../lib/rooms.js'
import ActivityList from '../components/ActivityList.jsx'
import { useLiveRefresh } from '../lib/useLiveRefresh.js'
import { Card, ErrorNote, Spinner } from '../components/ui.jsx'

export default function Activity() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const roomId = params.get('room')
  const [rooms, setRooms] = useState([])
  const [events, setEvents] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    listMyRooms()
      .then(setRooms)
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setEvents(null)
    setError(null)
    try {
      const page = await listActivity({ roomId })
      setEvents(page)
      setHasMore(page.length === PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    }
  }, [roomId])

  useEffect(() => {
    load()
  }, [load])

  // Live: refetch the newest page and keep any older pages already loaded.
  useLiveRefresh(`activity:${user.id}:${roomId ?? 'all'}`, [{ table: 'activity_events' }], async () => {
    try {
      const page = await listActivity({ roomId })
      setEvents((prev) => {
        if (!prev || page.length === 0) return page
        const oldestFresh = page[page.length - 1].id
        return [...page, ...prev.filter((e) => e.id < oldestFresh)]
      })
    } catch {
      /* keep what we have */
    }
  })

  async function loadMore() {
    setLoadingMore(true)
    try {
      const page = await listActivity({ roomId, beforeId: events[events.length - 1].id })
      setEvents((list) => [...list, ...page])
      setHasMore(page.length === PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const chip = (id, label) => {
    const active = (id ?? null) === roomId
    return (
      <button
        key={id ?? 'all'}
        onClick={() => setParams(id ? { room: id } : {}, { replace: true })}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
          active ? 'border-brand bg-brand text-on-brand' : 'border-transparent bg-surface text-muted hover:text-ink'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activity</h1>

      {rooms.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {chip(null, 'All rooms')}
          {rooms.map((r) => chip(r.id, r.name))}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>
      {!events && !error && <Spinner />}

      {events && events.length === 0 && (
        <Card className="text-center">
          <p className="text-3xl" aria-hidden="true">🌱</p>
          <h2 className="mt-2 font-semibold">Nothing yet</h2>
          <p className="mt-1 text-sm text-muted">Completed tasks and room updates will show up here.</p>
        </Card>
      )}

      {events && events.length > 0 && (
        <Card className="!py-1">
          <ActivityList events={events} meId={user.id} showRoom={!roomId} />
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full border-t border-line py-3 text-sm font-semibold text-brand disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older'}
            </button>
          )}
        </Card>
      )}
    </div>
  )
}
