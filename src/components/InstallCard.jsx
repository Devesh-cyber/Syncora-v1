import { useState } from 'react'
import { useInstallPrompt } from '../lib/pwa.js'

const DISMISS_KEY = 'syncora:installDismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

// "Add Syncora to your home screen". Android/desktop Chrome get a real
// Install button; iPhone gets the Share → Add to Home Screen steps.
// dismissible: Home shows it once until dismissed; Profile always shows it.
export default function InstallCard({ dismissible = false }) {
  const { installed, canPrompt, showIOSHelp, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(readDismissed)

  if (installed || (!canPrompt && !showIOSHelp)) return null
  if (dismissible && dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="flex items-start gap-3 rounded-2xl bg-surface p-4">
      <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Add Syncora to your home screen</h2>
        {canPrompt ? (
          <p className="mt-0.5 text-sm text-muted">Opens like an app, full screen, one tap away.</p>
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            In Safari, tap <span className="font-semibold text-ink">Share</span>{' '}
            <span aria-hidden="true">⎋</span> then <span className="font-semibold text-ink">Add to Home Screen</span>.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {canPrompt && (
            <button onClick={install} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-on-brand">
              Install
            </button>
          )}
          {dismissible && (
            <button onClick={dismiss} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-ink">
              Not now
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
