import { supabase } from './supabase.js'
import { toISODate } from './dates.js'

export const MAX_EVENT_TITLE = 80
export const MAX_EVENT_DESCRIPTION = 500

const FIELDS =
  'id, room_id, created_by, title, description, starts_at, all_day, remind_offset, remind_at, created_at, creator:profiles!room_events_created_by_fkey(id, display_name, avatar_url)'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// Reminder choices shown in the editor.
export const TIMED_REMINDERS = [
  { value: 'none', label: 'None' },
  { value: 'at', label: 'At start' },
  { value: '10m', label: '10 min before' },
  { value: '1h', label: '1 hour before' },
  { value: '1d', label: '1 day before' },
]
export const ALL_DAY_REMINDERS = [
  { value: 'none', label: 'None' },
  { value: 'morning', label: 'Morning of (9 AM)' },
  { value: 'day_before', label: 'Day before (9 AM)' },
]

export function reminderLabel(offset) {
  return [...TIMED_REMINDERS, ...ALL_DAY_REMINDERS].find((r) => r.value === offset)?.label ?? 'None'
}

// Events whose start falls in [fromDate, toDate] (local YYYY-MM-DD, inclusive).
export async function listRoomEvents(roomId, fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00`).toISOString()
  const to = new Date(new Date(`${toDate}T00:00`).getTime() + 86_400_000).toISOString()
  return unwrap(
    await supabase
      .from('room_events')
      .select(FIELDS)
      .eq('room_id', roomId)
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at', { ascending: true }),
  )
}

// Next events across all your rooms (RLS limits it to rooms you're in).
// Includes today's earlier events so "today" reads complete.
export async function listUpcomingEvents({ days = 14, limit = 6 } = {}) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const until = new Date(now.getTime() + days * 86_400_000).toISOString()
  return unwrap(
    await supabase
      .from('room_events')
      .select(`${FIELDS}, room:rooms(id, name)`)
      .gte('starts_at', startOfToday)
      .lt('starts_at', until)
      .order('starts_at', { ascending: true })
      .limit(limit),
  )
}

// Reminders that fire within the window (for the in-app fallback).
export async function listRemindersBetween(fromIso, toIso) {
  return unwrap(
    await supabase
      .from('room_events')
      .select('id, room_id, title, starts_at, all_day, remind_at, room:rooms(id, name)')
      .gte('remind_at', fromIso)
      .lte('remind_at', toIso)
      .order('remind_at', { ascending: true }),
  )
}

// fields: { title, description, date: 'YYYY-MM-DD', time: 'HH:MM' | '', allDay, remindOffset }
function toRow({ title, description, date, time, allDay, remindOffset }) {
  const startsAt = allDay ? new Date(`${date}T00:00`) : new Date(`${date}T${time}`)
  return {
    title,
    description: description || null,
    starts_at: startsAt.toISOString(),
    all_day: allDay,
    remind_offset: remindOffset,
  }
}

export async function createEvent(roomId, fields) {
  return unwrap(await supabase.from('room_events').insert({ room_id: roomId, ...toRow(fields) }).select(FIELDS).single())
}

export async function updateEvent(eventId, fields) {
  return unwrap(await supabase.from('room_events').update(toRow(fields)).eq('id', eventId).select(FIELDS).single())
}

export async function deleteEvent(eventId) {
  unwrap(await supabase.from('room_events').delete().eq('id', eventId))
}

export async function getRoomMuted(roomId, userId) {
  const row = unwrap(
    await supabase.from('room_members').select('events_muted').eq('room_id', roomId).eq('user_id', userId).maybeSingle(),
  )
  return Boolean(row?.events_muted)
}

export async function setRoomMuted(roomId, muted) {
  unwrap(await supabase.rpc('set_room_events_muted', { p_room_id: roomId, p_muted: muted }))
}

// ---------- display helpers ----------
export function eventLocalDate(event) {
  return toISODate(new Date(event.starts_at))
}

export function eventTimeLabel(event) {
  if (event.all_day) return 'All day'
  return new Date(event.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function eventIsPast(event) {
  const start = new Date(event.starts_at)
  if (event.all_day) return toISODate(start) < toISODate(new Date())
  return start.getTime() < Date.now()
}

// For the editor: split an event back into date / time fields.
export function eventToFields(event) {
  const d = new Date(event.starts_at)
  return {
    title: event.title,
    description: event.description ?? '',
    date: toISODate(d),
    time: event.all_day ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    allDay: event.all_day,
    remindOffset: event.remind_offset,
  }
}
