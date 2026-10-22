import { useState } from 'react'
import Avatar from './Avatar.jsx'
import { ErrorNote } from './ui.jsx'
import { nextAdmin, timeLeft, votesNeeded } from '../lib/deletion.js'

// The open deletion vote at the top of a room page.
export default function VotePanel({ request, room, meId, onVote, onCancel }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const members = room.members
  const votes = Object.fromEntries((request.deletion_votes ?? []).map((v) => [v.user_id, v.vote]))
  const yes = members.filter((m) => votes[m.id] === true).length
  const no = members.filter((m) => votes[m.id] === false).length
  const waiting = members.length - yes - no
  const needed = votesNeeded(members.length)
  const requester = members.find((m) => m.id === request.requested_by)
  const requesterName = request.requested_by === meId ? 'You' : requester?.display_name ?? 'The admin'
  const isRequester = request.requested_by === meId
  const myVote = votes[meId]
  const successor = nextAdmin(members, room.admin_id)

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-warn/40 bg-warn/5 p-5">
      <p className="text-xs font-bold tracking-wide text-warn uppercase">🗳️ Vote open · {timeLeft(request.expires_at)}</p>
      <h2 className="mt-1 text-lg font-bold">
        {request.kind === 'leave'
          ? `${requesterName} ${isRequester ? 'want' : 'wants'} to leave, which deletes the room`
          : `${requesterName} ${isRequester ? 'want' : 'wants'} to delete this room`}
      </h2>
      <p className="mt-1 text-sm text-muted">
        It's deleted if {needed} of {members.length} vote yes.
        {request.kind === 'leave' && successor && (
          <> If not, {successor.id === meId ? 'you become' : `${successor.display_name} becomes`} admin and {isRequester ? 'you leave' : `${requester?.display_name ?? 'the admin'} leaves`}.</>
        )}
        {request.kind === 'delete' && ' If not, the room carries on.'}
      </p>

      {/* Tally */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={yes} aria-valuemax={needed}>
        <div className="h-full rounded-full bg-warn transition-all" style={{ width: `${Math.min(100, (yes / needed) * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs font-medium text-muted">
        {yes} yes · {no} no · {waiting} not voted
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5 rounded-full bg-surface py-0.5 pr-2.5 pl-0.5 text-xs">
            <Avatar name={m.display_name} url={m.avatar_url} size={20} />
            <span className="max-w-[7rem] truncate">{m.id === meId ? 'You' : m.display_name.split(/\s+/)[0]}</span>
            <span aria-label={votes[m.id] === true ? 'voted yes' : votes[m.id] === false ? 'voted no' : 'not voted'}>
              {votes[m.id] === true ? '✅' : votes[m.id] === false ? '❌' : '…'}
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-4">
        {isRequester ? (
          <button
            onClick={() => run(onCancel)}
            disabled={busy}
            className="w-full rounded-xl bg-surface px-4 py-3 font-semibold disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Cancel the vote'}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => run(() => onVote(false))}
              disabled={busy}
              aria-pressed={myVote === false}
              className={`rounded-xl px-4 py-3 font-semibold disabled:opacity-50 ${
                myVote === false ? 'bg-brand text-on-brand' : 'bg-surface'
              }`}
            >
              {myVote === false ? 'Keeping it ✓' : 'No, keep it'}
            </button>
            <button
              onClick={() => run(() => onVote(true))}
              disabled={busy}
              aria-pressed={myVote === true}
              className={`rounded-xl px-4 py-3 font-semibold disabled:opacity-50 ${
                myVote === true ? 'bg-danger-strong text-white' : 'border border-danger/40 bg-surface text-danger'
              }`}
            >
              {myVote === true ? 'Voted delete ✓' : 'Yes, delete'}
            </button>
          </div>
        )}
        {!isRequester && myVote !== undefined && (
          <p className="mt-2 text-center text-xs text-muted">You can change your vote until it closes.</p>
        )}
      </div>
    </section>
  )
}
