import { supabase } from './supabase.js'

// Every function throws on error, with the database's friendly message.
function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export const MAX_ROOM_NAME = 50
export const MAX_ROOM_DESCRIPTION = 200

export async function listMyRooms() {
  // RLS only returns rooms you're a member of.
  return unwrap(
    await supabase
      .from('rooms')
      .select('id, name, description, admin_id, created_at, room_members(count), deletion_requests(status)')
      .order('created_at', { ascending: false }),
  ).map((r) => ({
    ...r,
    memberCount: r.room_members?.[0]?.count ?? 0,
    voteOpen: (r.deletion_requests ?? []).some((d) => d.status === 'open'),
  }))
}

export async function getRoom(roomId) {
  const room = unwrap(
    await supabase
      .from('rooms')
      .select(
        'id, name, description, admin_id, join_code, created_at, room_members(user_id, joined_at, profiles(id, display_name, avatar_url))',
      )
      .eq('id', roomId)
      .maybeSingle(),
  )
  if (!room) return null
  const members = (room.room_members ?? [])
    .map((m) => ({ ...m.profiles, joinedAt: m.joined_at }))
    .sort((a, b) => {
      if (a.id === room.admin_id) return -1
      if (b.id === room.admin_id) return 1
      return new Date(a.joinedAt) - new Date(b.joinedAt)
    })
  return { ...room, members }
}

export async function createRoom(name, description) {
  return unwrap(await supabase.rpc('create_room', { p_name: name, p_description: description || null }))
}

export async function joinRoom(code) {
  return unwrap(await supabase.rpc('join_room', { p_code: code }))
}

export async function updateRoom(roomId, fields) {
  unwrap(await supabase.from('rooms').update(fields).eq('id', roomId))
}

export async function regenerateJoinCode(roomId) {
  return unwrap(await supabase.rpc('regenerate_join_code', { p_room_id: roomId }))
}

export async function removeMember(roomId, userId) {
  unwrap(await supabase.rpc('remove_member', { p_room_id: roomId, p_user_id: userId }))
}

export async function leaveRoom(roomId) {
  unwrap(await supabase.rpc('leave_room', { p_room_id: roomId }))
}

export async function deleteRoom(roomId) {
  unwrap(await supabase.rpc('delete_room', { p_room_id: roomId }))
}

// ---------- join codes ----------
// Stored as 8 chars ("K7QM2XPA"); shown as "K7QM-2XPA".
export function cleanCode(input) {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

export function formatCode(code) {
  const c = cleanCode(code)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function joinLink(code) {
  return `${window.location.origin}/rooms/join?code=${cleanCode(code)}`
}
