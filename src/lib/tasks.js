import { supabase } from './supabase.js'

export const MAX_TASK_TITLE = 120
export const MAX_TASK_DESCRIPTION = 500

const TASK_FIELDS = 'id, room_id, owner_id, title, description, due_date, completed_at, created_at, updated_at'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export async function listRoomTasks(roomId) {
  return unwrap(
    await supabase.from('tasks').select(TASK_FIELDS).eq('room_id', roomId).order('created_at', { ascending: true }),
  )
}

// For the Home dashboard: all your pending tasks across rooms, plus the
// ones you finished since local midnight. Each row includes its room name.
export async function listMyDashboardTasks(userId) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  return unwrap(
    await supabase
      .from('tasks')
      .select(`${TASK_FIELDS}, room:rooms(id, name)`)
      .eq('owner_id', userId)
      .or(`completed_at.is.null,completed_at.gte."${startOfToday}"`)
      .order('created_at', { ascending: true }),
  )
}

export async function createTask({ roomId, title, description = null, dueDate = null }) {
  return unwrap(
    await supabase
      .from('tasks')
      .insert({ room_id: roomId, title, description, due_date: dueDate })
      .select(TASK_FIELDS)
      .single(),
  )
}

export async function updateTask(taskId, { title, description, dueDate }) {
  return unwrap(
    await supabase
      .from('tasks')
      .update({ title, description: description || null, due_date: dueDate || null })
      .eq('id', taskId)
      .select(TASK_FIELDS)
      .single(),
  )
}

// The database replaces the timestamp with its own clock.
export async function setTaskDone(taskId, done) {
  return unwrap(
    await supabase
      .from('tasks')
      .update({ completed_at: done ? new Date().toISOString() : null })
      .eq('id', taskId)
      .select(TASK_FIELDS)
      .single(),
  )
}

export async function deleteTask(taskId) {
  unwrap(await supabase.from('tasks').delete().eq('id', taskId))
}

// Pending first: earliest due date first (so overdue sits on top), undated last.
export function sortPending(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    return new Date(a.created_at) - new Date(b.created_at)
  })
}

// Completed: most recently finished first.
export function sortCompleted(tasks) {
  return [...tasks].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
}
