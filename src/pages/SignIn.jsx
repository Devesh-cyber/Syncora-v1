import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FullScreenSpinner } from '../components/FullScreen.jsx'

// Supabase puts OAuth errors in the query string or the hash.
function readOAuthError() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('error_description') || hash.get('error_description') || null
}

export default function SignIn() {
  const { configured, session, signInWithGoogle, getReturnTo } = useAuth()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(readOAuthError)

  if (configured && session === undefined) return <FullScreenSpinner />
  if (session) return <Navigate to={getReturnTo()} replace />

  async function handleGoogle() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle(location.state?.from ?? '/')
      // The browser now leaves for Google; nothing else to do here.
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
      setBusy(false)
    }
  }

  const from = location.state?.from ?? '/'
  const invited = from.startsWith('/rooms/join')

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {invited && (
          <div role="status" className="mb-8 flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-left">
            <span className="text-xl" aria-hidden="true">💌</span>
            <p className="text-sm text-brand-ink">
              <span className="font-bold">You’ve been invited to a room.</span> Sign in and you’ll join it right after.
            </p>
          </div>
        )}

        <div className="text-center">
          <img src="/icon.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
          <h1 className="mt-5 text-[44px] leading-none font-extrabold">
            syncora<span className="text-brand">.</span>
          </h1>
          <p className="mt-3 text-muted">Your goals, your crew, your progress.</p>
        </div>

        <ul className="mt-8 space-y-2" aria-label="What you can do">
          {FEATURES.map(({ icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3">
              <span className="mt-0.5 text-xl" aria-hidden="true">
                {icon}
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        {!configured ? (
          <p className="mt-6 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
            Supabase isn't configured yet. Add your keys to .env.local and restart.
          </p>
        ) : (
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-brand px-4 py-3.5 font-bold text-on-brand transition-colors disabled:bg-raised disabled:text-muted"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            {busy ? 'Opening Google…' : invited ? 'Continue with Google to join' : 'Continue with Google'}
          </button>
        )}
        <p className="mt-3 text-center text-xs text-muted">Free · no password · takes 10 seconds</p>

        {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: '🏠', title: 'Make a room for your crew', body: 'Study group, hackathon team or side project — friends join with a code.' },
  { icon: '✅', title: 'Keep your own task list', body: 'Everyone sees who’s done what. Only you can tick yours off.' },
  { icon: '🔥', title: 'Cheer each other on', body: 'React to a friend’s finished task and keep a daily streak.' },
]

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
