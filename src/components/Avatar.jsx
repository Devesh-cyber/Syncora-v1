import { useEffect, useState } from 'react'

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

// Shows the photo if there is one, otherwise the person's initials.
// rounded: 'full' (circle, default) or 'xl' (rounded square, used in the header).
export default function Avatar({ name, url, size = 40, className = '', rounded = 'full' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  const style = { width: size, height: size }
  const base = `shrink-0 ${rounded === 'xl' ? 'rounded-xl' : 'rounded-full'} ${className}`

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name ? `${name}'s avatar` : ''}
        style={style}
        className={`${base} object-cover bg-line`}
        referrerPolicy="no-referrer" // Google profile photos can fail without this
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      style={{ ...style, fontSize: Math.max(11, size * 0.38) }}
      className={`${base} flex items-center justify-center bg-brand-soft font-bold text-brand-ink`}
      aria-label={name ? `${name}'s avatar` : undefined}
    >
      {initialsOf(name)}
    </div>
  )
}
