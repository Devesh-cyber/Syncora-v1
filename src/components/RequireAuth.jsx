import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FullScreenSpinner, FullScreenMessage } from './FullScreen.jsx'

// Guards every signed-in screen.
// - not configured  → setup hint
// - signed out      → /signin (remembers where you were going)
// - not onboarded   → /welcome (unless this route *is* the welcome screen)
// - tour not seen   → /tour    (only when the 009 column exists: tour_seen === false)
export default function RequireAuth({ allowUnonboarded = false, allowUntoured = false, children }) {
  const { configured, session, profile, profileError, loading, reloadProfile, signOut } = useAuth()
  const location = useLocation()

  if (!configured) {
    return (
      <FullScreenMessage
        title="Supabase not configured"
        body="Copy .env.example to .env.local, add your project URL and anon key, then restart npm run dev."
      />
    )
  }

  if (loading) return <FullScreenSpinner />

  if (!session) {
    // Keep the query string so shared join links (?code=…) survive sign-in.
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  }

  if (profileError) {
    return (
      <FullScreenMessage title="Couldn't load your profile" body={profileError}>
        <div className="mt-6 flex gap-3">
          <button onClick={reloadProfile} className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-on-brand">
            Try again
          </button>
          <button onClick={signOut} className="flex-1 rounded-xl border border-line px-4 py-3 font-semibold">
            Sign out
          </button>
        </div>
      </FullScreenMessage>
    )
  }

  if (!profile.onboarded && !allowUnonboarded) {
    return <Navigate to="/welcome" replace />
  }

  if (profile.onboarded && profile.tour_seen === false && !allowUntoured && !allowUnonboarded) {
    return <Navigate to="/tour" replace />
  }

  return children ?? <Outlet />
}
