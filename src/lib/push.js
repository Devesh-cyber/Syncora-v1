import { supabase } from './supabase.js'
import { isIOS, isStandalone } from './pwa.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

async function registration() {
  // ready never resolves without a service worker, so don't wait forever.
  return withTimeout(navigator.serviceWorker.ready, 5000)
}

/**
 * Where this device stands:
 *  'unconfigured'  VITE_VAPID_PUBLIC_KEY isn't set (or a dev build: no service worker)
 *  'unsupported'   browser can't do Web Push
 *  'ios-install'   iPhone/iPad in Safari — must Add to Home Screen first
 *  'denied'        user blocked notifications for this site
 *  'off'           can be turned on
 *  'on'            subscribed on this device
 */
export async function getPushState() {
  if (!VAPID_PUBLIC_KEY || !import.meta.env.PROD) return 'unconfigured'
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!supported) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

async function save(sub) {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw new Error(error.message)
}

// Must be called from a tap (browsers require a user gesture for the prompt).
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Notifications are blocked for Syncora in your browser settings.' : 'Notifications weren’t allowed.')
  }
  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
  await save(sub)
}

export async function disablePush() {
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

// On app start: make sure the server knows this device belongs to the
// signed-in account (keys can rotate; a shared device may switch users).
export async function syncPushSubscription() {
  if ((await getPushState()) !== 'on') return
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    if (sub) await save(sub)
  } catch {
    /* best effort */
  }
}

// On sign-out: stop sending this account's reminders to this device.
export async function forgetThisDevice() {
  try {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator)) return
    const sub = await (await registration()).pushManager.getSubscription()
    if (!sub) return
    await withTimeout(supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint }), 3000)
    await sub.unsubscribe()
  } catch {
    /* best effort */
  }
}

// Local test: shows a notification through the service worker, no server.
export async function showTestNotification() {
  const reg = await registration()
  await reg.showNotification('📅 Reminders are on', {
    body: 'This is how Syncora calendar reminders will look.',
    icon: '/icon-192.png',
    tag: 'syncora-test',
  })
}
