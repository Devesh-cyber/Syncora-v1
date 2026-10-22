import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const AuthContext = createContext(null)
const RETURN_TO_KEY = 'syncora:returnTo'

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function AuthProvider({ children }) {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState(isSupabaseConfigured ? undefined : null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  // 1. Track the auth session.
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Keep this callback synchronous — Supabase warns against awaiting
    // other supabase calls inside it. Profile loading happens below.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  // 2. Load the profile whenever the signed-in user changes.
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      return
    }
    setProfileError(null)
    setProfile((prev) => (prev?.id === userId ? prev : null))

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) {
      setProfileError(error.message)
      return
    }

    // Keep the stored time zone in sync with this device (used for streaks).
    const tz = deviceTimeZone()
    if (data.timezone !== tz) {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ timezone: tz })
        .eq('id', userId)
        .select()
        .single()
      setProfile(updated ?? data)
    } else {
      setProfile(data)
    }
  }, [userId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const signInWithGoogle = useCallback(async (returnTo = '/') => {
    try {
      sessionStorage.setItem(RETURN_TO_KEY, returnTo)
    } catch {
      /* storage unavailable — fall back to home */
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/signin` },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (fields) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(fields)
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error
      setProfile(data)
      return data
    },
    [userId],
  )

  // Read-only on purpose (safe to call during render). It's overwritten
  // on the next sign-in, so a stale value is harmless.
  const getReturnTo = useCallback(() => {
    try {
      const value = sessionStorage.getItem(RETURN_TO_KEY)
      return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
    } catch {
      return '/'
    }
  }, [])

  const loading = session === undefined || (Boolean(userId) && !profile && !profileError)

  const value = {
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    loading,
    signInWithGoogle,
    signOut,
    updateProfile,
    reloadProfile: loadProfile,
    getReturnTo,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
