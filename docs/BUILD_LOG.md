# Syncora — build log


Stack: React + Vite, Tailwind CSS v4, Supabase (Auth, Postgres, RLS, Realtime), hosted on Vercel, installable as a PWA.

**Status: Version 1 complete (v1.1.0 — Ember theme).** All nine phases are built and the final UI is applied; next step is the pilot.

### Look & feel: "Ember"
Warm charcoal dark theme with an ember-orange accent, Bricolage Grotesque headings + Inter body.
- **Tokens** live in `src/index.css` (`@theme`): `canvas`, `surface`, `sunken`, `raised`, `ink`, `muted`, `line`, `brand` + `on-brand`, `brand-soft` + `brand-ink`, `warn`, `danger` + `danger-strong`. Change a colour there and the whole app follows.
- **Layout pieces:** `syncora.` wordmark header, floating pill nav (active tab shows its label), progress-ring hero on Home, tasks as individual tonal rows with rounded-square checkboxes, member tabs in rooms (`You · 🔥4 / Shivam · 🔥12`), and a **Room feed** with a one-tap **Cheer** on teammates' completed tasks.
- Native controls (date picker, selects, scrollbars) are dark via `color-scheme: dark`. App icons and the PWA theme colour match.

---

## Build phases

| # | Phase | Done when |
|---|---|---|
| **1** | **Setup** — Vite, Tailwind, Supabase client, routing, nav shell, PWA manifest | App runs locally and shows "Supabase connected" |
| **2** | **Auth + profiles** — Google sign-in, profile auto-created, edit name/avatar, route guard | Two Google accounts have separate profiles |
| **3** | **Rooms** — create, join by code (cap 20), members list, regenerate code, remove member, leave | Second account joins by code; outsiders can't read room data |
| **4** | **Tasks** — add/edit/delete, check/uncheck, due dates, ownership rules | Members edit only their own tasks |
| **5** | **Dashboards** + activity feed — personal Today view, room view, feed | Each account sees the correct data |
| **6** | **Reactions + streaks** — 👏🔥💪🎉 on completed tasks, derived streak | Unchecking removes reactions/events; streak is predictable |
| **7** | **Deletion votes** — delete/leave requests, majority vote, 48h expiry, admin transfer | Vote passes/fails/expires correctly |
| **8** | **Realtime + polish** — live updates, loading/empty/error states | A second device sees changes without refresh |
| **9** | **PWA + reminder banner + deploy** — PNG icons, install prompt, Vercel | Installed on a phone and used by the pilot group |

Each database phase adds one file in `supabase/migrations/` that you run in the Supabase SQL editor, in order.

---

## Phase 1 setup

### 1. Install and run

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

Open http://localhost:5173. You should see the Home screen and a yellow "Supabase not configured" banner — that's expected until step 2.

### 2. Create the Supabase project

1. https://supabase.com → **New project** → name it `syncora`. Pick the region closest to you (Mumbai = `ap-south-1`).
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `.env.local`.
3. Restart `npm run dev`. The banner should turn green: **Supabase connected**.

### 3. Prepare Google sign-in (used in Phase 2 — easier to do now)

**Google Cloud Console** (https://console.cloud.google.com):
1. Create a project (e.g. `syncora`).
2. **APIs & Services → OAuth consent screen** → External → fill in app name, your email. Add yourself (and pilot friends) as **test users** while it's in Testing mode.
3. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
   - **Authorized JavaScript origins:** `http://localhost:5173`
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.

**Supabase dashboard:**
1. **Authentication → Sign In / Providers → Google** → enable, paste the Client ID and secret, save.
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173`
   - **Redirect URLs:** add `http://localhost:5173/**`
   (Your Vercel URL gets added here in Phase 9.)

### 4. Phase 1 checklist

- [ ] `npm run dev` runs with no errors
- [ ] Bottom nav switches between Home / Rooms / Activity / Profile
- [ ] Home shows **Supabase connected** (green)
- [ ] `npm run build` succeeds
- [ ] Google provider enabled in Supabase (ready for Phase 2)

---

## Phase 2 — Auth + profiles

### 1. Run the migration
Supabase → **SQL Editor** → New query → paste all of `supabase/migrations/002_profiles.sql` → **Run**.
It creates the `profiles` table, the signup trigger, the RLS rules and the `avatars` storage bucket.

Check: **Table Editor** shows `profiles`; **Storage** shows an `avatars` bucket.

### 2. Run the app
```bash
npm install
npm run dev
```

### 3. Phase 2 checklist
- [ ] Opening http://localhost:5173 while signed out lands on **/signin**
- [ ] **Continue with Google** → Google → back to the **Welcome** screen with your Google name and photo prefilled
- [ ] Change your name / photo on Welcome → **Continue** → Home says "Good …, <first name>"
- [ ] Refreshing keeps you signed in; Welcome doesn't show again
- [ ] Profile tab: change name or photo → **Save changes** → "Saved ✓", header avatar updates
- [ ] **Remove** photo → initials show instead
- [ ] Sign out → back to /signin
- [ ] Sign in with a **second Google account** (add it as a test user on the OAuth consent screen first) → it gets its own Welcome + profile
- [ ] Supabase **Table Editor → profiles** has two rows, both `onboarded = true`

**If Google sign-in fails:** check the redirect URI in Google Cloud is exactly `https://<project-ref>.supabase.co/auth/v1/callback`, and that `http://localhost:5173/**` is in Supabase → Authentication → URL Configuration → Redirect URLs.

---

## Phase 3 — Rooms

### 1. Run the migration
Supabase → SQL Editor → paste all of `supabase/migrations/003_rooms.sql` → Run.
It adds `rooms`, `room_members`, `activity_events` (filled now, shown in Phase 5), the RLS rules, and the room functions (`create_room`, `join_room`, `regenerate_join_code`, `remove_member`, `leave_room`, `delete_room`).

It also widens profile visibility: you can now see the profiles of people who share a room with you.

### 2. Phase 3 checklist
Use two Google accounts — e.g. a normal window (A) and an incognito window (B).
- [ ] A: Rooms → **Create room** → lands on the room page with an 8-character code, A is **Admin**
- [ ] A: **Copy code** works (and **Share** on a phone)
- [ ] B: Rooms → **Join with code** → type it in lowercase or with a dash — still works
- [ ] B: a wrong code shows "That room code doesn't match any room."
- [ ] Both see 2 members with names + avatars; B has no Remove / Edit / New code buttons
- [ ] A: **Edit** name/description → saved; B sees it after refresh
- [ ] A: **New code** → old code stops working for a third account
- [ ] A: **Remove** B → B's Rooms list no longer shows the room; opening its URL says "Room not found"
- [ ] B rejoins, then **Leave room** → gone from B's list
- [ ] A, alone in the room: **Delete room** works (Phase 7 adds the vote for rooms with others)
- [ ] Shared link: open `http://localhost:5173/rooms/join?code=XXXXXXXX` signed out → after sign-in the code is prefilled

---

## Phase 4 — Tasks

### 1. Run the migration
Supabase → SQL Editor → paste all of `supabase/migrations/004_tasks.sql` → Run.
It adds the `tasks` table, RLS (everyone in the room reads, only the owner writes), and triggers that:
- set `completed_at` from the server clock (no backdating),
- log `task_completed` and erase it again if you uncheck,
- delete a person's tasks when they leave or are removed.

### 2. Phase 4 checklist
Two accounts again (A normal window, B incognito), both in the same room.
- [ ] A: room page → **Your tasks** → type a task → **Add**. Try the **Today / Tomorrow / Pick date** chips
- [ ] A: a task with a past due date shows an orange **Overdue** chip and sorts to the top
- [ ] A: tap the circle → turns green, moves to **Completed**; tap again → back to pending
- [ ] A: tap a task's text → edit sheet → change title / notes / date → **Save**; **Delete task** asks once more
- [ ] B (refresh): sees A's tasks under A's name with status, but **can't** tick or open them
- [ ] B: adds their own task → A sees it (live since Phase 8)
- [ ] A removes B (or B leaves) → B's tasks disappear from the room
- [ ] Supabase **Table Editor → activity_events**: a `task_completed` row appears on check and disappears on uncheck

---

## Phase 5 — Dashboards + activity feed

**No SQL this phase.** The activity log has been filling since Phase 3; this phase displays it.

### Checklist
- [ ] **Home** opens after login: greeting, "X of Y done today" + progress bar
- [ ] **Today** lists your pending tasks from *all* rooms that are overdue, due today, or undated — each tagged with its room
- [ ] Add a task from Home → pick the room in the **In:** dropdown; it remembers your last room
- [ ] Tick a task on Home → moves to **Done today**, progress bar fills; it's also ticked inside the room
- [ ] Future-dated tasks sit under **Coming up**
- [ ] **Your rooms** strip shows each room with your pending count; tapping opens the room
- [ ] **Recent activity** on Home shows the last 5 events across rooms → **See all** opens the Activity tab
- [ ] **Activity** tab: room filter chips (when you're in 2+ rooms), "Load older" after 30 events
- [ ] Room page now has **Recent activity**; it refreshes when you tick a task there
- [ ] Account with no rooms: Home shows "Start with a room" with Create / Join buttons
- [ ] Uncheck a task → its "completed" line disappears from the feeds

---

## Phase 6 — Reactions + streaks

### 1. Run the migration
Supabase → SQL Editor → paste all of `supabase/migrations/006_reactions_streaks.sql` → Run.
(There's no 005 file — Phase 5 needed no SQL.)

It adds the `reactions` table, the streak functions (`get_my_streak`, `get_room_streaks`), and updates two Phase 4 triggers so unchecking a task / leaving a room also clears reactions.

### 2. Streak rule (documented, as the spec asked)
- A day counts when you complete **at least one task** on that **local calendar day** (your profile time zone).
- Your streak stays alive through today until midnight, even before you've done anything today.
- Unchecking or deleting a completed task removes its credit — the streak is recalculated, never stored.
- One global streak across all rooms.

### 3. Phase 6 checklist
- [ ] Home banner: "Finish a task today to start a streak" → tick a task → **🔥 1-day streak · Today counted ✓**
- [ ] Untick it → back to the "start a streak" line
- [ ] Room page: each member with a streak shows a **🔥 N** badge
- [ ] B: on A's **completed** task → **+ Cheer** → pick 🔥 → pill shows **🔥 1**; tap the pill again to remove it
- [ ] B can't cheer A's *pending* tasks; A can't cheer their own tasks (but sees the pills, also on Home → Done today)
- [ ] Feed shows "B cheered 🔥 on your “…”"; removing the cheer removes that line
- [ ] A unticks the task → its cheers and feed lines disappear
- [ ] Banner reads "All N of today's tasks done 🎉 · M coming up" when future tasks exist

---

## Phase 7 — Deletion votes

### 1. Run the migration
Supabase → SQL Editor → paste all of `supabase/migrations/007_deletion_votes.sql` → Run.

**Optional:** to also close expired votes in the background (not just when someone opens the room), enable **pg_cron** under Database → Extensions, then run the one `cron.schedule(...)` line at the bottom of the file.

### 2. The rules
- Admin taps **Delete room** or **Leave room**. Alone in the room → happens immediately.
- Otherwise a 48-hour vote opens. The admin's yes is automatic; everyone else votes and can change their mind.
- **Passes** as soon as yes votes are more than half of current members → room deleted.
- **Fails** as soon as that can't happen anymore, or at 48 hours.
  - Delete vote fails → room carries on.
  - Leave vote fails → the longest-standing member becomes admin, the old admin leaves (their tasks go).
- Admin can cancel. Nobody can be removed while a vote is open. A member who leaves mid-vote has their vote dropped.

### 3. Phase 7 checklist (three accounts makes it interesting)
- [ ] Admin alone in a room → **Delete room** deletes immediately
- [ ] With 3 members: admin → **Delete room** → **Start vote** → orange vote panel at the top, "2 of 3 needed"
- [ ] Rooms list shows **🗳️ Vote open** on that room; **Remove** buttons are hidden
- [ ] Member B votes **Yes, delete** → room is deleted for everyone
- [ ] New room, same setup: B and C both vote **No** → panel disappears, feed says the vote didn't pass
- [ ] Admin → **Leave room** → B and C vote No → the earliest-joined member becomes **Admin**, the old admin is gone
- [ ] Admin → **Cancel the vote** → panel disappears, feed says it was cancelled
- [ ] Expiry test: in Table Editor set an open request's `expires_at` to the past → open the room → it's settled

---

## Phase 8 — Realtime + polish

### 1. Run the migration
Supabase → SQL Editor → paste all of `supabase/migrations/008_realtime.sql` → Run.
It adds the app's tables to the `supabase_realtime` publication. Realtime respects RLS, so people only get changes they're allowed to see. Safe to run twice.

Check: Database → Publications → `supabase_realtime` lists rooms, room_members, tasks, reactions, activity_events, deletion_requests, deletion_votes.

### 2. How it works
Each screen opens one realtime channel for what it shows. When something changes it waits ~0.35 s (to batch bursts) and quietly refetches — no spinner. It also refetches when you come back to the tab/app or reconnect, so a phone that slept catches up.

### 3. Phase 8 checklist — two windows side by side (A and B in the same room)
- [ ] B adds / ticks / unticks / edits / deletes a task → A's room page updates within a second
- [ ] B cheers A's task → A's room page **and** A's Home show the pill; A's feed shows the line
- [ ] B joins / leaves the room → member list updates for A
- [ ] A starts a delete vote → B's room page shows the vote panel; B's Rooms list shows 🗳️
- [ ] B votes yes on a 2-person room → A's page shows "Room not found"
- [ ] Activity tab on A updates while open
- [ ] Turn Wi-Fi off → black "You're offline" strip; back on → screens refresh
- [ ] On an iPhone: tapping the "In:" room picker or a date chip doesn't zoom the page

---

## Phase 9 — PWA, reminders, deploy

**No SQL this phase.**

### What's new
- Proper app icons (Android adaptive/maskable, iPhone home-screen icon) and a full manifest
- A small service worker (production builds only): the installed app opens offline instead of showing the browser's error page. It never caches Supabase data — everything you see is live.
- **Install card** on Home (dismissible) and Profile: real **Install** button on Android/desktop Chrome; Share → Add to Home Screen steps on iPhone
- **Evening reminder** on Home after 6 PM if today's tasks are open or your streak is at risk; once a day, "Not now" hides it until tomorrow; toggle in **Profile**
- App version shown in Profile

### Deploy to Vercel
1. **Push to GitHub.** Create a repo (e.g. `syncora`) and push this folder. `.env.local` is gitignored — keep it that way.
2. **Import on Vercel.** vercel.com → Add New → Project → pick the repo. Framework: **Vite** (auto-detected). Build command `npm run build`, output `dist`.
3. **Environment variables** (Project → Settings → Environment Variables): add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as `.env.local`. Deploy.
4. **Tell Supabase about the new address.** Authentication → URL Configuration:
   - **Site URL:** `https://<your-app>.vercel.app`
   - **Redirect URLs:** add `https://<your-app>.vercel.app/**` (keep the localhost one for development)
5. **Google sign-in for friends.** Google Cloud → OAuth consent screen. While it's in **Testing**, only listed test users can sign in — add each pilot friend's Gmail, *or* click **Publish app** (with just the basic profile/email scopes this doesn't need Google review).
   The redirect URI stays `https://<project-ref>.supabase.co/auth/v1/callback` — nothing to change there.
6. Open the Vercel URL on your phone → sign in → install it from the card.

`vercel.json` already handles page refreshes on deep links, keeps `sw.js` uncached, and caches built assets forever (their filenames change on every build).

### Phase 9 checklist
- [ ] `npm run build && npm run preview` → Chrome DevTools → Application → Manifest shows no errors and the icons
- [ ] Deployed URL loads; Google sign-in works there
- [ ] Android/desktop Chrome: **Install** button works → app opens in its own window
- [ ] iPhone Safari: Share → Add to Home Screen → teal icon, opens full screen
- [ ] After 6 PM with an open task: reminder shows on Home → **Not now** hides it until tomorrow
- [ ] Profile → turn **Evening reminder** off → no banner
- [ ] Airplane mode → open the installed app → it opens with the offline strip

---

## Pilot acceptance checklist (from the spec, section 14)
Run with 2–6 people before adding anything new.
- [ ] Sign up, log in, set a display name — without help
- [ ] Add an optional profile image
- [ ] Create a room and share it by code/link
- [ ] Another account joins
- [ ] Creator can delete the room (alone: instantly; with others: by vote) and remove members, with confirmation
- [ ] A normal member can't remove members or delete the room
- [ ] Members manage only their own tasks; everyone sees everyone's status
- [ ] Login lands on the personal dashboard
- [ ] Streak behaves predictably (rule documented in Phase 6)
- [ ] Personal and room history are available (Home, Activity tab, room Completed + feed)
- [ ] Usable on phone and desktop
- [ ] Non-members can't read room data
- [ ] Reminders are optional and not excessive
- [ ] Note what people struggle with → that's the V2 list

---

## Project structure

```
src/
  lib/supabase.js          Supabase client (reads env vars)
  components/Layout.jsx    Header + bottom nav shell
  context/AuthContext.jsx  Session + profile state (useAuth hook)
  components/RequireAuth.jsx  Route guard: signed out → /signin, new user → /welcome
  components/ProfileForm.jsx  Name + photo form (Welcome and Profile)
  lib/avatars.js           Crop/resize photo to 256px, upload to Storage
  lib/rooms.js             Room queries + RPC calls, join-code formatting
  components/ui.jsx        Shared buttons, inputs, cards
  components/ConfirmDialog.jsx  Confirmation for destructive actions
  components/Sheet.jsx     Bottom-sheet modal
  components/tasks/        RoomTasks (grouped by member), TaskItem, TaskComposer, TaskEditor
  lib/tasks.js             Task queries + sorting
  lib/dates.js             Local dates, due-date labels
  lib/activity.js          Activity queries + event wording
  components/ActivityList.jsx  Feed rows (Activity tab, Home, room page)
  components/RoomActivity.jsx  Latest events for one room
  components/tasks/ReactionBar.jsx  Cheer pills + emoji picker
  lib/reactions.js         Reaction queries
  lib/streaks.js           Streak RPC calls
  lib/deletion.js          Deletion vote RPC calls + helpers
  components/VotePanel.jsx Open vote: tally, voters, Yes/No, cancel
  lib/useLiveRefresh.js    Realtime hook: watch tables → debounced refetch
  components/OfflineBanner.jsx, ErrorBoundary.jsx  Offline strip, crash screen
  lib/pwa.js               Install prompt + service worker registration
  components/InstallCard.jsx, ReminderBanner.jsx  Add-to-home-screen card, evening nudge
  pages/                   One file per screen
  index.css                Tailwind + design tokens (bg-brand, text-muted, …)
supabase/migrations/       SQL files, one per database phase
public/                    PWA manifest, icons, service worker (sw.js)
```
