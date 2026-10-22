import { supabase } from './supabase.js'

export const EMOJIS = ['👏', '🔥', '💪', '🎉']

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// All reactions on tasks in one room.
export async function listRoomReactions(roomId) {
  const rows = unwrap(
    await supabase.from('reactions').select('task_id, user_id, emoji, tasks!inner(room_id)').eq('tasks.room_id', roomId),
  )
  return rows.map(({ task_id, user_id, emoji }) => ({ task_id, user_id, emoji }))
}

export async function listReactionsForTasks(taskIds) {
  if (taskIds.length === 0) return []
  return unwrap(await supabase.from('reactions').select('task_id, user_id, emoji').in('task_id', taskIds))
}

export async function addReaction(taskId, emoji) {
  unwrap(await supabase.from('reactions').insert({ task_id: taskId, emoji }))
}

export async function removeReaction(taskId, userId, emoji) {
  unwrap(await supabase.from('reactions').delete().eq('task_id', taskId).eq('user_id', userId).eq('emoji', emoji))
}

// [{task_id, user_id, emoji}] → { [taskId]: { [emoji]: [userId, …] } }
export function groupReactions(rows) {
  const out = {}
  for (const { task_id, user_id, emoji } of rows) {
    out[task_id] ??= {}
    ;(out[task_id][emoji] ??= []).push(user_id)
  }
  return out
}
