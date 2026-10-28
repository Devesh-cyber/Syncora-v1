-- ============================================================
-- Syncora — room calendar + push reminders
-- Run once in Supabase → SQL Editor (after 009_onboarding.sql).
--
-- Rules:
--   • Any member can add an event to their room's calendar.
--   • The creator and the room admin can edit or delete it.
--   • Events stay when their creator leaves the room.
--   • Every member is reminded, unless they mute the room's reminders.
--   • The reminder time (remind_at) is always worked out here, from the
--     event time + the chosen offset; all-day events remind at 9 AM in the
--     creator's time zone (same day, or the day before).
-- ============================================================

-- ---------- events ----------
create table public.room_events (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms (id) on delete cascade,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 80),
  description      text check (description is null or char_length(description) <= 500),
  starts_at        timestamptz not null,
  all_day          boolean not null default false,
  remind_offset    text not null default 'at'
                   check (remind_offset in ('none', 'at', '10m', '1h', '1d', 'morning', 'day_before')),
  remind_at        timestamptz,
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index room_events_room_time_idx on public.room_events (room_id, starts_at);
create index room_events_due_idx on public.room_events (remind_at) where reminder_sent_at is null;

create trigger room_events_set_updated_at
  before update on public.room_events
  for each row execute function public.set_updated_at();

-- Trim text, fit the reminder choice to the event type, compute remind_at.
create or replace function public.room_events_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  d date;
begin
  new.title := trim(new.title);
  new.description := nullif(trim(new.description), '');

  -- Forgiving: map a timed choice onto an all-day event and vice versa.
  if new.all_day and new.remind_offset in ('at', '10m', '1h') then
    new.remind_offset := 'morning';
  elsif new.all_day and new.remind_offset = '1d' then
    new.remind_offset := 'day_before';
  elsif not new.all_day and new.remind_offset = 'morning' then
    new.remind_offset := 'at';
  elsif not new.all_day and new.remind_offset = 'day_before' then
    new.remind_offset := '1d';
  end if;

  if new.remind_offset = 'none' then
    new.remind_at := null;
  elsif new.all_day then
    select coalesce(p.timezone, 'UTC') into tz from public.profiles p where p.id = new.created_by;
    tz := coalesce(tz, 'UTC');
    d := (new.starts_at at time zone tz)::date;
    if new.remind_offset = 'day_before' then
      d := d - 1;
    end if;
    new.remind_at := (d + time '09:00') at time zone tz;
  else
    new.remind_at := new.starts_at - case new.remind_offset
      when '10m' then interval '10 minutes'
      when '1h'  then interval '1 hour'
      when '1d'  then interval '1 day'
      else interval '0'
    end;
  end if;

  -- Moving the reminder re-arms it.
  if tg_op = 'UPDATE' and new.remind_at is distinct from old.remind_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger room_events_before_write
  before insert or update on public.room_events
  for each row execute function public.room_events_before_write();

-- ---------- helpers ----------
create or replace function public.is_room_admin(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.rooms where id = p_room_id and admin_id = (select auth.uid()));
$$;

-- ---------- RLS ----------
alter table public.room_events enable row level security;

create policy "room_events: members can read"
  on public.room_events for select to authenticated
  using (public.is_room_member(room_id));

create policy "room_events: members add their own"
  on public.room_events for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_room_member(room_id));

create policy "room_events: creator or admin edits"
  on public.room_events for update to authenticated
  using (public.is_room_member(room_id) and (created_by = (select auth.uid()) or public.is_room_admin(room_id)))
  with check (public.is_room_member(room_id));

create policy "room_events: creator or admin deletes"
  on public.room_events for delete to authenticated
  using (public.is_room_member(room_id) and (created_by = (select auth.uid()) or public.is_room_admin(room_id)));

revoke all on public.room_events from anon;
revoke insert, update on public.room_events from authenticated;
grant insert (room_id, title, description, starts_at, all_day, remind_offset) on public.room_events to authenticated;
grant update (title, description, starts_at, all_day, remind_offset) on public.room_events to authenticated;
grant select, delete on public.room_events to authenticated;

-- ---------- activity feed: "Aman added 'Mock test'" ----------
alter table public.activity_events add column if not exists event_id uuid
  references public.room_events (id) on delete cascade;
create index if not exists activity_events_event_idx on public.activity_events (event_id);

alter table public.activity_events drop constraint activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check check (type in (
  'room_created', 'member_joined', 'member_left', 'member_removed',
  'task_completed', 'reaction_added', 'admin_transferred',
  'deletion_requested', 'deletion_failed', 'deletion_cancelled',
  'event_added'));

create or replace function public.room_events_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_events (room_id, actor_id, type, event_id)
  values (new.room_id, new.created_by, 'event_added', new.id);
  return null;
end;
$$;

create trigger room_events_after_insert
  after insert on public.room_events
  for each row execute function public.room_events_after_insert();

-- ---------- per-room mute ----------
alter table public.room_members add column if not exists events_muted boolean not null default false;

create or replace function public.set_room_events_muted(p_room_id uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  update public.room_members set events_muted = p_muted where room_id = p_room_id and user_id = uid;
  if not found then
    raise exception 'You''re not in this room.';
  end if;
end;
$$;

-- ---------- push subscriptions (one row per device/browser) ----------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: read own"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
revoke insert, update, delete on public.push_subscriptions from authenticated;

-- Save this device. If another account used it before, it moves to you.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'Invalid push endpoint.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, updated_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = uid;
end;
$$;

-- ---------- for the send-reminders Edge Function (service role only) ----------
-- Atomically claims every reminder that is due (and at most 2 hours late),
-- and returns one row per device that should be notified.
create or replace function public.claim_due_reminders()
returns table (
  event_id uuid, room_id uuid, room_name text, title text, description text,
  starts_at timestamptz, all_day boolean, user_timezone text,
  subscription_id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    update public.room_events e
       set reminder_sent_at = now()
     where e.reminder_sent_at is null
       and e.remind_at <= now()
       and e.remind_at > now() - interval '2 hours'
    returning e.id, e.room_id, e.title, e.description, e.starts_at, e.all_day
  )
  select d.id, d.room_id, r.name, d.title, d.description, d.starts_at, d.all_day,
         coalesce(p.timezone, 'UTC'), s.id, s.endpoint, s.p256dh, s.auth
    from due d
    join public.rooms r on r.id = d.room_id
    join public.room_members m on m.room_id = d.room_id and not m.events_muted
    join public.profiles p on p.id = m.user_id
    join public.push_subscriptions s on s.user_id = m.user_id;
$$;

create or replace function public.forget_push_subscription(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where id = p_id;
$$;

-- ---------- function permissions ----------
revoke execute on function
  public.room_events_before_write(), public.room_events_after_insert(),
  public.claim_due_reminders(), public.forget_push_subscription(uuid),
  public.set_room_events_muted(uuid, boolean), public.save_push_subscription(text, text, text, text),
  public.delete_push_subscription(text), public.is_room_admin(uuid)
from public, anon, authenticated;

grant execute on function
  public.set_room_events_muted(uuid, boolean), public.save_push_subscription(text, text, text, text),
  public.delete_push_subscription(text), public.is_room_admin(uuid)
to authenticated;

grant execute on function public.claim_due_reminders(), public.forget_push_subscription(uuid) to service_role;

-- ---------- realtime ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_events') then
    alter publication supabase_realtime add table public.room_events;
  end if;
end;
$$;
