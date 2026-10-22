import { useState } from 'react'
import { todayISO } from '../lib/dates.js'

const DISMISS_KEY = 'syncora:reminderDismissed'
export const REMINDER_HOUR = 18 // 6 PM local time

function dismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayISO()
  } catch {
    return false
  }
}

// The gentle evening nudge on Home. Shows at most once a day (until
// dismissed), only after 6 PM, only if something is still open or the
// streak is at risk — and never if reminders are turned off in Profile.
export default function ReminderBanner({ enabled, pendingToday, streak }) {
  const [hidden, setHidden] = useState(dismissedToday)

  const streakAtRisk = streak && streak.current_streak > 0 && !streak.done_today
  if (!enabled || hidden) return null
  if (new Date().getHours() < REMINDER_HOUR) return null
  if (pendingToday === 0 && !streakAtRisk) return null

  const tasks = `${pendingToday} task${pendingToday === 1 ? '' : 's'}`
  let message
  if (streakAtRisk && pendingToday > 0) {
    message = `Your ${streak.current_streak}-day streak is on the line — ${tasks} still open today. One counts.`
  } else if (streakAtRisk) {
    message = `Finish any task today to keep your ${streak.current_streak}-day streak going.`
  } else {
    message = `You've still got ${tasks} for today. One small win is enough.`
  }

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, todayISO())
    } catch {
      /* ignore */
    }
  }

  return (
    <section role="status" className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/5 p-4">
      <span className="text-xl" aria-hidden="true">
        {streakAtRisk ? '🔥' : '🌙'}
      </span>
      <p className="flex-1 text-sm">{message}</p>
      <button onClick={dismiss} className="shrink-0 text-sm font-semibold text-muted hover:text-ink">
        Not now
      </button>
    </section>
  )
}
