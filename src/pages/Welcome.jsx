import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ProfileForm from '../components/ProfileForm.jsx'

// One-time screen after the first sign-in: confirm name + photo.
export default function Welcome() {
  const { user, profile, updateProfile, getReturnTo } = useAuth()
  // Saving sets onboarded=true, which re-renders this and redirects.
  if (profile.onboarded) return <Navigate to={getReturnTo()} replace />

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Syncora 👋</h1>
        <p className="mt-2 text-muted">This is how your crew will see you. You can change it any time.</p>
        <div className="mt-8">
          <ProfileForm
            userId={user.id}
            initialName={profile.display_name}
            initialAvatar={profile.avatar_url}
            submitLabel="Continue"
            onSubmit={(fields) => updateProfile({ ...fields, onboarded: true })}
          />
        </div>
      </div>
    </div>
  )
}
