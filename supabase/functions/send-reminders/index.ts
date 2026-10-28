// Syncora — send-reminders
//
// Called every minute by pg_cron (see supabase/reminders-schedule.sql).
// Claims every calendar reminder that is due and sends a Web Push
// notification to each device of each (un-muted) room member.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@gmail.com)
//   CRON_SECRET  — any long random string; pg_cron sends it as a Bearer token
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy with JWT verification off (it checks CRON_SECRET itself):
//   npx supabase functions deploy send-reminders --no-verify-jwt

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

type Row = {
  event_id: string
  room_id: string
  room_name: string
  title: string
  description: string | null
  starts_at: string
  all_day: boolean
  user_timezone: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing secret: ${name}`)
  return value
}

// "Today, 6:00 PM" / "Tomorrow · All day" / "Thu 29 Oct, 6:00 PM" in the recipient's time zone.
function whenText(startsAt: string, allDay: boolean, timeZone: string) {
  const start = new Date(startsAt)
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const today = dayKey(new Date())
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000))
  const key = dayKey(start)

  const day =
    key === today
      ? 'Today'
      : key === tomorrow
        ? 'Tomorrow'
        : new Intl.DateTimeFormat('en-IN', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(start)
  if (allDay) return `${day} · All day`
  const time = new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(start)
  return `${day}, ${time}`
}

function safeTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

Deno.serve(async (req) => {
  try {
    if (req.headers.get('Authorization') !== `Bearer ${env('CRON_SECRET')}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase.rpc('claim_due_reminders')
    if (error) throw error
    const rows = (data ?? []) as Row[]

    let sent = 0
    let removed = 0
    const failures: string[] = []

    await Promise.all(
      rows.map(async (row) => {
        const tz = safeTimeZone(row.user_timezone)
        const description = row.description ? `\n${row.description.slice(0, 90)}` : ''
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
          new Date(row.starts_at),
        )
        const payload = JSON.stringify({
          title: `📅 ${row.title}`,
          body: `${row.room_name} · ${whenText(row.starts_at, row.all_day, tz)}${description}`,
          url: `/rooms/${row.room_id}?tab=calendar&date=${date}`,
          tag: `event-${row.event_id}`,
        })

        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            payload,
            { TTL: 60 * 60, urgency: 'high' },
          )
          sent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            // The browser dropped this subscription — forget it.
            await supabase.rpc('forget_push_subscription', { p_id: row.subscription_id })
            removed++
          } else {
            failures.push(`${status ?? '?'} ${(err as Error).message}`)
          }
        }
      }),
    )

    const events = new Set(rows.map((r) => r.event_id)).size
    if (failures.length) console.error('Push failures:', failures)
    return Response.json({ events, deliveries: rows.length, sent, removed, failed: failures.length })
  } catch (err) {
    console.error(err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
})
