# Calendar reminders — one-time setup

Calendar reminders are real push notifications: the phone buzzes even when Syncora is closed. They need four things wired together. Do these once, in order (about 15 minutes).

```
pg_cron (every minute) ──► send-reminders Edge Function ──► Web Push ──► each member's phone
            ▲                          │
            └── room_events.remind_at ◄┘ claim_due_reminders()
```

## 1. Database
Supabase → **SQL Editor** → run `supabase/migrations/010_calendar.sql`.

The calendar works right after this step. People with Syncora open get an in-app reminder toast. Steps 2–6 add notifications when it's closed.

## 2. Generate VAPID keys (identifies your app to push services)
On your computer:
```bash
npx web-push generate-vapid-keys
```
Keep the output. The **public** key goes to the app; the **private** key goes only to Supabase. Never commit the private key.

## 3. Give the app the public key
- `.env.local` → `VITE_VAPID_PUBLIC_KEY=<public key>`
- Vercel → Project → **Settings → Environment Variables** → add the same `VITE_VAPID_PUBLIC_KEY` → **Redeploy**

Until this is set, the app hides every "turn on reminders" prompt.

## 4. Supabase secrets
Supabase → **Edge Functions → Secrets** (or `npx supabase secrets set NAME=value`):

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:` + your email, e.g. `mailto:you@gmail.com` |
| `CRON_SECRET` | any long random string, e.g. from `openssl rand -hex 32` |

## 5. Deploy the `send-reminders` function
**Option A: CLI** (from the project folder):
```bash
npx supabase login
npx supabase functions deploy send-reminders --project-ref <your-project-ref> --no-verify-jwt
```
**Option B: dashboard:** Edge Functions → **Deploy a new function → Via Editor** → name it `send-reminders` → paste `supabase/functions/send-reminders/index.ts` → Deploy. Then open the function's **Details / Settings** and turn **off** "Enforce JWT verification" (the function checks `CRON_SECRET` itself).

Quick check. This should print `{"events":0,"deliveries":0,...}`:
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/send-reminders \
  -H "Authorization: Bearer <your CRON_SECRET>"
```
`401` → the secret doesn't match. `500` with "Missing secret" → step 4 isn't complete.

## 6. Run it every minute
Supabase → **Database → Extensions** → enable **pg_cron** and **pg_net**.
Open `supabase/reminders-schedule.sql`, replace `YOUR-PROJECT-REF` and `YOUR-CRON-SECRET`, and run it in the SQL Editor.

## 7. Try it
1. On your phone, open Syncora. **On iPhone, install it first** (Share → Add to Home Screen) and open it from the home screen.
2. **Profile → Calendar reminders → on**, then tap **Send a test notification**. You should see a notification right away; it's shown by the phone, so this works even before steps 4–6.
3. In a room → **Calendar** → add an event 3 minutes from now with reminder **At start**.
4. Close the app. Within about a minute of the start time, the notification arrives. Tapping it opens that room's calendar on that day.

## Troubleshooting
- **No "turn on" option:** `VITE_VAPID_PUBLIC_KEY` isn't in the deployed build. Add it in Vercel, then redeploy.
- **"Notifications are blocked":** the site was blocked once. Allow it in the browser's site settings (Android Chrome: ⋮ → Settings → Site settings → Notifications).
- **Test notification works but event reminders don't:** check the cron job is running and what the function answered:
  ```sql
  select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
  select status_code, content from net._http_response order by created desc limit 5;
  ```
- **Someone gets nothing:** they need reminders on for *their* device, and the room must not be muted (Calendar tab → bottom). Every device is separate: phone and laptop each need turning on.
- Reminders more than 2 hours late are skipped, so a long outage never sends a burst of stale notifications.
