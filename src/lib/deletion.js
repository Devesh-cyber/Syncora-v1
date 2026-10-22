import { supabase } from './supabase.js'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// Settles an expired vote (if any) before the room is shown.
export async function checkRoomDeletion(roomId) {
  const { error } = await supabase.rpc('check_room_deletion', { p_room_id: roomId })
  if (error) console.warn('check_room_deletion:', error.message)
}

export async function getOpenRequest(roomId) {
  return unwrap(
    await supabase
      .from('deletion_requests')
      .select('id, room_id, kind, status, requested_by, created_at, expires_at, deletion_votes(user_id, vote)')
      .eq('room_id', roomId)
      .eq('status', 'open')
      .maybeSingle(),
  )
}

// → 'deleted' (admin was alone) or 'open' (vote started)
export async function requestDeletion(roomId, kind) {
  return unwrap(await supabase.rpc('request_room_deletion', { p_room_id: roomId, p_kind: kind }))
}

// → status afterwards: 'open' | 'passed' | 'failed'
export async function voteOnDeletion(requestId, vote) {
  return unwrap(await supabase.rpc('vote_on_deletion', { p_request_id: requestId, p_vote: vote }))
}

export async function cancelDeletion(requestId) {
  unwrap(await supabase.rpc('cancel_deletion_request', { p_request_id: requestId }))
}

export function votesNeeded(memberCount) {
  return Math.floor(memberCount / 2) + 1
}

// Who becomes admin if a "leave" vote fails: longest-standing other member.
export function nextAdmin(members, currentAdminId) {
  return (
    [...members]
      .filter((m) => m.id !== currentAdminId)
      .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt) || (a.id < b.id ? -1 : 1))[0] ?? null
  )
}

export function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'closing now'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`
}
