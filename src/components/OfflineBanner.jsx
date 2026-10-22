import { useEffect, useState } from 'react'

// Thin strip at the top when the device loses its connection.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null
  return (
    <div role="status" className="sticky top-0 z-40 bg-raised px-4 py-2 text-center text-sm font-medium text-ink">
      You're offline — changes won't save until you're back.
    </div>
  )
}
