import { useEffect } from 'react'

// Bottom sheet on phones, centered card on larger screens.
export default function Sheet({ open, onClose, labelledBy, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
