import { useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

/**
 * Calls `onChange` (debounced) whenever any watched table changes, and
 * whenever the tab/app comes back into view (covers sleeping phones and
 * missed events).
 *
 * watches: [{ table, filter? }]   e.g. { table: 'tasks', filter: 'room_id=eq.123' }
 *
 * Supabase can't filter DELETE events, so filtered tables also get an
 * unfiltered DELETE listener. That can cause the odd extra refresh, which
 * is harmless — the screen just refetches.
 */
export function useLiveRefresh(key, watches, onChange, { delay = 350 } = {}) {
  const callback = useRef(onChange)
  callback.current = onChange
  const spec = JSON.stringify(watches)

  useEffect(() => {
    if (!supabase || !key) return
    let timer = null
    const fire = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), delay)
    }

    const channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`)
    for (const { table, filter } of JSON.parse(spec)) {
      const base = { schema: 'public', table }
      if (filter) {
        channel.on('postgres_changes', { ...base, event: 'INSERT', filter }, fire)
        channel.on('postgres_changes', { ...base, event: 'UPDATE', filter }, fire)
        channel.on('postgres_changes', { ...base, event: 'DELETE' }, fire)
      } else {
        channel.on('postgres_changes', { ...base, event: '*' }, fire)
      }
    }
    channel.subscribe()

    const onVisible = () => document.visibilityState === 'visible' && fire()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', fire)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', fire)
      supabase.removeChannel(channel)
    }
  }, [key, spec, delay])
}
