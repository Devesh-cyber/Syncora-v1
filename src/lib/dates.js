// Dates are plain 'YYYY-MM-DD' strings in the user's local time.

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + n))
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Label + tone for a due date chip.
export function dueInfo(dueDate, done = false) {
  if (!dueDate) return null
  const today = todayISO()
  const tomorrow = addDaysISO(today, 1)
  const yesterday = addDaysISO(today, -1)

  let label
  if (dueDate === today) label = 'Today'
  else if (dueDate === tomorrow) label = 'Tomorrow'
  else if (dueDate === yesterday) label = 'Yesterday'
  else {
    const date = parseISODate(dueDate)
    const sameYear = date.getFullYear() === new Date().getFullYear()
    label = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  }

  let tone = 'normal'
  if (!done && dueDate < today) tone = 'overdue'
  else if (!done && dueDate === today) tone = 'today'
  return { label, tone }
}

export function relativeTime(timestamp) {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
