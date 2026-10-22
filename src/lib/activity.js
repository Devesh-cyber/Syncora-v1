import { supabase } from './supabase.js'

export const PAGE_SIZE = 30

// activity_events has two links to profiles (actor + target), so the
// embeds name the foreign key explicitly.
const EVENT_FIELDS = `
  id, room_id, type, emoji, created_at, actor_id, target_user_id,
  actor:profiles!activity_events_actor_id_fkey(id, display_name, avatar_url),
  target:profiles!activity_events_target_user_id_fkey(id, display_name),
  task:tasks(id, title),
  room:rooms(id, name)
`

// Newest first. Pass `beforeId` to load the next (older) page.
export async function listActivity({ roomId = null, beforeId = null, limit = PAGE_SIZE } = {}) {
  let query = supabase.from('activity_events').select(EVENT_FIELDS).order('id', { ascending: false }).limit(limit)
  if (roomId) query = query.eq('room_id', roomId)
  if (beforeId) query = query.lt('id', beforeId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

// Turns an event into { actor, text } for display. `meId` makes it say "You".
// Profiles of people who've left all your shared rooms aren't readable,
// so they show as "A former member".
export function describeEvent(event, meId) {
  const name = (person, id) => (id === meId ? 'You' : person?.display_name ?? 'A former member')
  const actor = name(event.actor, event.actor_id)
  const target = event.target_user_id === meId ? 'you' : event.target?.display_name ?? 'a former member'
  const task = event.task?.title ? `“${event.task.title}”` : 'a task'

  switch (event.type) {
    case 'room_created':
      return `${actor} created the room`
    case 'member_joined':
      return `${actor} joined`
    case 'member_left':
      return `${actor} left`
    case 'member_removed':
      return `${actor} removed ${target}`
    case 'task_completed':
      return `${actor} completed ${task}`
    case 'reaction_added': {
      const owner =
        event.target_user_id === meId ? 'your' : event.target?.display_name ? `${event.target.display_name}'s` : 'a'
      return `${actor} cheered ${event.emoji ?? ''} on ${owner} ${task}`
    }
    case 'admin_transferred':
      return `${actor} handed admin to ${target}`
    case 'deletion_requested':
      return `${actor} started a vote to delete the room`
    case 'deletion_cancelled':
      return `${actor} cancelled the vote to delete the room`
    case 'deletion_failed':
      return 'The vote to delete the room didn’t pass'
    default:
      return `${actor} did something`
  }
}

export function eventIcon(type) {
  return (
    {
      room_created: '🏠',
      member_joined: '👋',
      member_left: '🚪',
      member_removed: '🚪',
      task_completed: '✅',
      reaction_added: '🎉',
      admin_transferred: '🔑',
      deletion_requested: '🗳️',
      deletion_failed: '🗳️',
      deletion_cancelled: '🗳️',
    }[type] ?? '•'
  )
}
