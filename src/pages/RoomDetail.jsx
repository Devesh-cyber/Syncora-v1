import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  formatCode,
  getRoom,
  joinLink,
  leaveRoom,
  MAX_ROOM_DESCRIPTION,
  MAX_ROOM_NAME,
  regenerateJoinCode,
  removeMember,
  updateRoom,
} from '../lib/rooms.js'
import Avatar from '../components/Avatar.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RoomTasks from '../components/tasks/RoomTasks.jsx'
import RoomActivity from '../components/RoomActivity.jsx'
import VotePanel from '../components/VotePanel.jsx'
import { useLiveRefresh } from '../lib/useLiveRefresh.js'
import { cancelDeletion, checkRoomDeletion, getOpenRequest, nextAdmin, requestDeletion, voteOnDeletion } from '../lib/deletion.js'
import {
  BackLink,
  Badge,
  Card,
  ErrorNote,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  TextArea,
  TextField,
} from '../components/ui.jsx'

export default function RoomDetail() {
  const { roomId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [room, setRoom] = useState(undefined) // undefined = loading, null = not found
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null) // { title, body, confirmLabel, danger, onConfirm }
  const [activityKey, setActivityKey] = useState(0)
  const [request, setRequest] = useState(null) // open deletion vote, if any

  const load = useCallback(async () => {
    try {
      setError(null)
      await checkRoomDeletion(roomId) // settle an expired vote first
      const [r, req] = await Promise.all([getRoom(roomId), getOpenRequest(roomId)])
      setRoom(r)
      setRequest(req)
    } catch (err) {
      setError(err.message)
    }
  }, [roomId])

  useEffect(() => {
    load()
  }, [load])

  // Live: anything in this room changes → refetch room, tasks and feed.
  const [liveKey, setLiveKey] = useState(0)
  useLiveRefresh(
    `room:${roomId}`,
    [
      { table: 'rooms', filter: `id=eq.${roomId}` },
      { table: 'room_members', filter: `room_id=eq.${roomId}` },
      { table: 'tasks', filter: `room_id=eq.${roomId}` },
      { table: 'reactions' },
      { table: 'activity_events', filter: `room_id=eq.${roomId}` },
      { table: 'deletion_requests', filter: `room_id=eq.${roomId}` },
      { table: 'deletion_votes' },
    ],
    () => {
      load()
      setLiveKey((k) => k + 1)
    },
  )

  if (error && room === undefined) {
    return (
      <div className="space-y-4">
        <BackLink to="/rooms">Rooms</BackLink>
        <ErrorNote>{error}</ErrorNote>
      </div>
    )
  }
  if (room === undefined) return <Spinner />
  if (room === null) {
    return (
      <div className="space-y-4">
        <BackLink to="/rooms">Rooms</BackLink>
        <Card className="text-center">
          <h1 className="font-semibold">Room not found</h1>
          <p className="mt-1 text-sm text-muted">It may have been deleted, or you're no longer a member.</p>
        </Card>
      </div>
    )
  }

  const isAdmin = room.admin_id === user.id
  const memberCount = room.members.length
  const voteOpen = Boolean(request)
  const successor = nextAdmin(room.members, room.admin_id)

  // Shared by "Delete room" and "Leave room" for the admin.
  async function startRequest(kind) {
    const result = await requestDeletion(room.id, kind)
    if (result === 'deleted') {
      navigate('/rooms', { replace: true })
      return
    }
    await load()
    setActivityKey((k) => k + 1)
  }

  async function handleVote(vote) {
    const status = await voteOnDeletion(request.id, vote)
    if (status === 'passed') {
      navigate('/rooms', { replace: true })
      return
    }
    await load()
    setActivityKey((k) => k + 1)
  }

  async function handleCancelVote() {
    await cancelDeletion(request.id)
    await load()
    setActivityKey((k) => k + 1)
  }

  const askRemove = (member) =>
    setDialog({
      title: `Remove ${member.display_name}?`,
      body: 'They lose access to this room, and their tasks in it are deleted. They can rejoin with the code.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        await removeMember(room.id, member.id)
        await load()
        setActivityKey((k) => k + 1)
      },
    })

  const askRegenerate = () =>
    setDialog({
      title: 'Make a new code?',
      body: "The current code stops working right away. People already in the room aren't affected.",
      confirmLabel: 'New code',
      onConfirm: async () => {
        const code = await regenerateJoinCode(room.id)
        setRoom((r) => ({ ...r, join_code: code }))
      },
    })

  const askLeave = () =>
    setDialog({
      title: `Leave ${room.name}?`,
      body: 'Your tasks in this room will be deleted. You can rejoin later with the code.',
      confirmLabel: 'Leave room',
      danger: true,
      onConfirm: async () => {
        await leaveRoom(room.id)
        navigate('/rooms', { replace: true })
      },
    })

  const askDelete = () =>
    setDialog(
      memberCount === 1
        ? {
            title: `Delete ${room.name}?`,
            body: 'You’re the only member, so it’s deleted right away with everything in it. This can’t be undone.',
            confirmLabel: 'Delete room',
            danger: true,
            onConfirm: () => startRequest('delete'),
          }
        : {
            title: `Start a vote to delete ${room.name}?`,
            body: `Everyone gets 48 hours to vote. The room is deleted if more than half of the ${memberCount} members say yes; otherwise it carries on.`,
            confirmLabel: 'Start vote',
            danger: true,
            onConfirm: () => startRequest('delete'),
          },
    )

  const askAdminLeave = () =>
    setDialog(
      memberCount === 1
        ? {
            title: `Leave ${room.name}?`,
            body: 'You’re the only member, so leaving deletes the room right away. This can’t be undone.',
            confirmLabel: 'Leave and delete',
            danger: true,
            onConfirm: () => startRequest('leave'),
          }
        : {
            title: `Leave ${room.name}?`,
            body: `As admin, leaving deletes the room — so everyone votes first (48 hours). If more than half say yes, the room is deleted. If not, ${successor?.display_name ?? 'the longest-standing member'} becomes admin and you leave (your tasks here are deleted).`,
            confirmLabel: 'Start vote',
            danger: true,
            onConfirm: () => startRequest('leave'),
          },
    )

  return (
    <div className="space-y-4">
      <BackLink to="/rooms">Rooms</BackLink>

      <RoomHeader room={room} isAdmin={isAdmin} memberCount={memberCount} onSaved={load} />

      {voteOpen && (
        <VotePanel request={request} room={room} meId={user.id} onVote={handleVote} onCancel={handleCancelVote} />
      )}

      {memberCount === 1 && (
        <InviteCard code={room.join_code} roomName={room.name} isAdmin={isAdmin} onRegenerate={askRegenerate} prominent />
      )}

      <RoomTasks room={room} currentUserId={user.id} liveKey={liveKey} onChange={() => setActivityKey((k) => k + 1)} />

      <RoomActivity
        roomId={room.id}
        meId={user.id}
        refreshKey={activityKey + liveKey}
        onCheered={() => setLiveKey((k) => k + 1)}
      />

      <Card>
        <h2 className="text-lg font-extrabold">Members</h2>
        <ul className="mt-3 divide-y divide-line">
          {room.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Avatar name={m.display_name} url={m.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {m.display_name}
                    {m.id === user.id && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  {m.id === room.admin_id && <Badge>Admin</Badge>}
                </div>
                <p className="text-xs text-muted">
                  Joined {new Date(m.joinedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </p>
              </div>
              {isAdmin && m.id !== user.id && !voteOpen && (
                <button
                  onClick={() => askRemove(m)}
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:text-danger"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {memberCount > 1 && (
        <InviteCard code={room.join_code} roomName={room.name} isAdmin={isAdmin} onRegenerate={askRegenerate} />
      )}

      <div className="pt-2">
        {isAdmin ? (
          voteOpen ? (
            <p className="text-center text-xs text-muted">A vote is open — see the top of the page.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <SecondaryButton onClick={askAdminLeave} className="text-danger">
                Leave room
              </SecondaryButton>
              <SecondaryButton onClick={askDelete} className="text-danger">
                Delete room
              </SecondaryButton>
            </div>
          )
        ) : (
          <SecondaryButton onClick={askLeave} className="w-full text-danger">
            Leave room
          </SecondaryButton>
        )}
      </div>

      <ConfirmDialog open={Boolean(dialog)} {...dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

function RoomHeader({ room, isAdmin, memberCount, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function startEdit() {
    setName(room.name)
    setDescription(room.description ?? '')
    setError(null)
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return setError('The room needs a name.')
    setBusy(true)
    setError(null)
    try {
      await updateRoom(room.id, { name: name.trim(), description: description.trim() || null })
      await onSaved()
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <TextField label="Room name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_ROOM_NAME} />
          <TextArea
            label="What's it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_ROOM_DESCRIPTION}
            rows={3}
            hint={`${description.length}/${MAX_ROOM_DESCRIPTION}`}
          />
          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-3">
            <SecondaryButton type="button" onClick={() => setEditing(false)} disabled={busy} className="flex-1">
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={busy} className="flex-1">
              {busy ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    )
  }

  return (
    <div className="flex items-start gap-3 px-1">
      <div className="min-w-0 flex-1">
        <h1 className="text-[32px] leading-[1.05] font-extrabold break-words">{room.name}</h1>
        <p className="mt-1.5 text-sm text-muted break-words">
          {room.description ? `${room.description} · ` : ''}
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
      {isAdmin && (
        <button onClick={startEdit} className="mt-1 rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-brand">
          Edit
        </button>
      )}
    </div>
  )
}

// prominent: the "Invite your crew" version shown at the top while you're
// alone in the room. The shared text explains Syncora to people who've
// never heard of it, and the link drops them straight into this room.
function InviteCard({ code, roomName, isAdmin, onRegenerate, prominent = false }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share)
  const link = joinLink(code)
  const message = `Join my room "${roomName}" on Syncora — we keep our task lists together and cheer each other on. Tap to join: ${link} (code ${formatCode(code)})`

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Join ${roomName} on Syncora`,
        text: `Join my room "${roomName}" on Syncora — we keep our task lists together and cheer each other on. Code: ${formatCode(code)}`,
        url: link,
      })
    } catch {
      /* user cancelled */
    }
  }

  return (
    <Card className={prominent ? '!bg-brand-soft' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={prominent ? 'text-xl font-extrabold' : 'font-semibold'}>
            {prominent ? 'Invite your crew' : 'Room code'}
          </h2>
          {prominent && (
            <p className="mt-1 text-sm text-brand-ink">
              Syncora works best together. Send the invite — friends sign in with Google and land straight in this room.
            </p>
          )}
        </div>
        {isAdmin && (
          <button onClick={onRegenerate} className="shrink-0 text-sm font-semibold text-muted hover:text-ink">
            New code
          </button>
        )}
      </div>
      <p className="mt-4 text-center font-mono text-3xl font-semibold tracking-[0.2em] select-all">{formatCode(code)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={copy} className={canShare ? '' : 'col-span-2'}>
          {copied ? 'Copied ✓' : 'Copy invite'}
        </SecondaryButton>
        {canShare && <PrimaryButton onClick={share}>Share</PrimaryButton>}
      </div>
    </Card>
  )
}
