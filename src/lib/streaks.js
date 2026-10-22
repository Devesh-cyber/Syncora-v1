import { supabase } from './supabase.js'

const EMPTY = { current_streak: 0, best_streak: 0, done_today: false }

export async function getMyStreak() {
  const { data, error } = await supabase.rpc('get_my_streak')
  if (error) throw new Error(error.message)
  return data?.[0] ?? EMPTY
}

// → { [userId]: { current_streak, done_today } }
export async function getRoomStreaks(roomId) {
  const { data, error } = await supabase.rpc('get_room_streaks', { p_room_id: roomId })
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map((row) => [row.user_id, row]))
}
