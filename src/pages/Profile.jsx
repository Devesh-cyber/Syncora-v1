import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ProfileForm from '../components/ProfileForm.jsx'
import InstallCard from '../components/InstallCard.jsx'
import { REMINDER_HOUR } from '../components/ReminderBanner.jsx'

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [savingReminder, setSavingReminder] = useState(false)
  const [reminderError, setReminderError] = useState(null)

  async function toggleReminders() {
    setSavingReminder(true)
    setReminderError(null)
    try {
      await updateProfile({ reminders_enabled: !profile.reminders_enabled })
    } catch (err) {
      setReminderError(err.message)
    } finally {
      setSavingReminder(false)
    }
  }

  const reminderTime = new Date(2000, 0, 1, REMINDER_HOUR).toLocaleTimeString(undefined, { hour: 'numeric' })

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-5">
        <h1 className="mb-5 text-xl font-bold">Profile</h1>
        <ProfileForm
          userId={user.id}
          initialName={profile.display_name}
          initialAvatar={profile.avatar_url}
          submitLabel="Save changes"
          requireChange
          onSubmit={updateProfile}
        />
      </section>

      <section className="rounded-2xl bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Evening reminder</h2>
            <p className="mt-0.5 text-sm text-muted">
              A gentle nudge on Home after {reminderTime} if today's tasks are still open or your streak is at risk. At
              most once a day.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={profile.reminders_enabled}
            aria-label="Evening reminder"
            onClick={toggleReminders}
            disabled={savingReminder}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              profile.reminders_enabled ? 'bg-brand' : 'bg-line'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                profile.reminders_enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        {reminderError && <p className="mt-2 text-sm text-danger">{reminderError}</p>}
      </section>

      <Link
        to="/tour?replay=1"
        className="flex items-center gap-3 rounded-2xl bg-surface p-5 transition hover:bg-raised"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg" aria-hidden="true">
          🧭
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">How Syncora works</span>
          <span className="block text-sm text-muted">A 30-second tour of rooms, tasks, cheers and streaks</span>
        </span>
        <span className="text-muted" aria-hidden="true">›</span>
      </Link>

      <InstallCard />

      <section className="rounded-2xl bg-surface p-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Signed in as</span>
          <span className="truncate font-medium">{user.email}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-muted">Time zone</span>
          <span className="font-medium">{profile.timezone}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-muted">Version</span>
          <span className="font-medium">{__APP_VERSION__}</span>
        </div>
      </section>

      <button
        onClick={async () => {
          setSigningOut(true)
          await signOut()
        }}
        disabled={signingOut}
        className="w-full rounded-xl bg-surface px-4 py-3 font-semibold text-danger disabled:opacity-60"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
