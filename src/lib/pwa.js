import { useEffect, useState } from 'react'

// Chrome/Edge/Android fire `beforeinstallprompt` once, early. We catch it at
// startup (see main.jsx) and let any screen offer an "Install" button later.
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })

  // Service worker: production builds only, so dev never serves stale files.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed:', err))
    })
  }
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function isIOS() {
  const ua = window.navigator.userAgent
  // iPadOS reports itself as a Mac with touch.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  const standalone = isStandalone()
  return {
    installed: standalone,
    canPrompt: Boolean(deferredPrompt) && !standalone,
    showIOSHelp: isIOS() && !standalone,
    async install() {
      if (!deferredPrompt) return false
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      notify()
      return outcome === 'accepted'
    },
  }
}
