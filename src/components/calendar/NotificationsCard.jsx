import { useCallback, useEffect, useState } from 'react'
import { disablePush, enablePush, getPushState, showTestNotification } from '../../lib/push.js'

// "Reminders on this device" — turns Web Push on/off for this browser.
// compact: the one-line prompt shown at the top of a room's calendar
// (hidden once on, or if it can't work here).
export default function NotificationsCard({ compact = false }) {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    getPushState().then(setState)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  if (state === null) return null

  if (compact) {
    if (state !== 'off' && state !== 'ios-install') return null
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3">
        <BellIcon className="shrink-0 text-brand-ink" />
        <p className="min-w-0 flex-1 text-sm text-brand-ink">
          {state === 'off'
            ? 'Get a notification when events in your rooms are coming up.'
            : 'On iPhone, add Syncora to your Home Screen (Share → Add to Home Screen) to get reminders.'}
        </p>
        {state === 'off' && (
          <button
            onClick={() => run(enablePush)}
            disabled={busy}
            className="shrink-0 rounded-xl bg-brand px-3 py-2 text-sm font-bold text-on-brand disabled:opacity-60"
          >
            {busy ? '…' : 'Turn on'}
          </button>
        )}
        {error && <span className="sr-only">{error}</span>}
      </div>
    )
  }

  const body = {
    unconfigured: 'Reminders aren’t set up on this server yet.',
    unsupported: 'This browser can’t show reminders. Try Chrome, Edge or Firefox, or install Syncora on your phone.',
    'ios-install': 'On iPhone and iPad: tap Share → Add to Home Screen, open Syncora from there, then turn this on.',
    denied: 'Notifications are blocked for Syncora. Allow them in your browser’s site settings, then come back.',
    off: 'Get a notification on this device when an event in your rooms is coming up.',
    on: 'You’ll get calendar reminders on this device. Mute a room from its Calendar tab.',
  }[state]

  return (
    <section className="rounded-2xl bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold" style={{ fontFamily: 'inherit', letterSpacing: 0 }}>
            Calendar reminders
          </h2>
          <p className="mt-0.5 text-sm text-muted">{body}</p>
        </div>
        {(state === 'off' || state === 'on') && (
          <button
            role="switch"
            aria-checked={state === 'on'}
            aria-label="Calendar reminders on this device"
            onClick={() => run(state === 'on' ? disablePush : enablePush)}
            disabled={busy}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              state === 'on' ? 'bg-brand' : 'bg-raised'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                state === 'on' ? 'translate-x-5' : ''
              }`}
            />
          </button>
        )}
      </div>
      {state === 'on' && (
        <button
          onClick={() => run(showTestNotification)}
          disabled={busy}
          className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm font-semibold hover:brightness-125"
        >
          Send a test notification
        </button>
      )}
      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  )
}

export function BellIcon({ className = '', muted = false }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      {muted && <path d="M3 3l18 18" />}
    </svg>
  )
}
