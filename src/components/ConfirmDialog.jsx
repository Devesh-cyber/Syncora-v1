import { useEffect, useState } from 'react'

// Bottom-sheet style confirm on phones, centered card on desktop.
// onConfirm may be async; errors it throws are shown inside the dialog.
export default function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setBusy(false)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        {body && <p className="mt-2 text-sm text-muted">{body}</p>}
        {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-line px-4 py-3 font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl px-4 py-3 font-semibold disabled:opacity-60 ${danger ? 'bg-danger-strong text-white' : 'bg-brand text-on-brand'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
