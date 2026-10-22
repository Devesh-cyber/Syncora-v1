import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import { prepareAvatar, uploadAvatar, removeUploadedAvatar } from '../lib/avatars.js'

const MAX_NAME = 40

// Shared by the Welcome screen and the Profile screen.
// onSubmit receives { display_name, avatar_url } and should save them.
export default function ProfileForm({ userId, initialName, initialAvatar, submitLabel, onSubmit, requireChange = false }) {
  const [name, setName] = useState(initialName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar ?? null)
  const [pendingBlob, setPendingBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedNote, setSavedNote] = useState(false)
  const fileInput = useRef(null)

  // Free the preview object URL when it changes or on unmount.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const trimmed = name.trim()
  const dirty = trimmed !== (initialName ?? '') || avatarUrl !== (initialAvatar ?? null) || Boolean(pendingBlob)
  const shownAvatar = previewUrl ?? avatarUrl

  async function handlePick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setError(null)
    try {
      const blob = await prepareAvatar(file)
      setPendingBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err.message)
    }
  }

  function handleRemove() {
    setPendingBlob(null)
    setPreviewUrl(null)
    setAvatarUrl(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!trimmed) return setError('Please enter a name.')
    if (trimmed.length > MAX_NAME) return setError(`Keep it under ${MAX_NAME} characters.`)

    setSaving(true)
    setError(null)
    setSavedNote(false)
    const previousAvatar = initialAvatar ?? null
    try {
      let finalAvatar = avatarUrl
      if (pendingBlob) finalAvatar = await uploadAvatar(userId, pendingBlob)
      await onSubmit({ display_name: trimmed, avatar_url: finalAvatar })

      // Clean up the old uploaded file (never touches Google photos).
      if (finalAvatar !== previousAvatar) removeUploadedAvatar(userId, previousAvatar).catch(() => {})

      setAvatarUrl(finalAvatar)
      setPendingBlob(null)
      setPreviewUrl(null)
      setSavedNote(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={trimmed} url={shownAvatar} size={72} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg bg-raised px-3 py-2 text-sm font-semibold hover:brightness-125"
          >
            {shownAvatar ? 'Change photo' : 'Add photo'}
          </button>
          {shownAvatar && (
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-danger"
            >
              Remove
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handlePick} />
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Display name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSavedNote(false)
          }}
          maxLength={MAX_NAME}
          autoComplete="nickname"
          className="mt-1.5 w-full rounded-xl border border-transparent bg-sunken px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="How your crew sees you"
        />
        <span className="mt-1 block text-right text-xs text-muted">
          {trimmed.length}/{MAX_NAME}
        </span>
      </label>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={saving || (requireChange && !dirty)}
        className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-on-brand transition-colors disabled:bg-raised disabled:text-muted"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
      {savedNote && !dirty && <p className="text-center text-sm font-medium text-done">Saved ✓</p>}
    </form>
  )
}
