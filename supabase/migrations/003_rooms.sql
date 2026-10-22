-- ============================================================
-- Syncora — Phase 3: rooms, members, join codes, activity log
-- Run once in Supabase → SQL Editor (after 002_profiles.sql).
--
-- All writes go through the functions below (create_room, join_room, …),
-- which check permissions. Clients can only read, plus let the admin
-- rename a room.
-- ============================================================

-- ---------- tables ----------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 50),
  description text check (description is null or char_length(description) <= 200),
  admin_id    uuid not null references public.profiles (id) on delete cascade,
  join_code   text not null unique check (join_code ~ '^[A-Z2-9]{8}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.room_members (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);

-- One shared log per room. Clients never write here directly;
-- functions/triggers do. task_id gets its foreign key in Phase 4.
create table public.activity_events (
  id             bigint generated always as identity primary key,
  room_id        uuid not null references public.rooms (id) on delete cascade,
  actor_id       uuid references public.profiles (id) on delete cascade,
  type           text not null check (type in (
                   'room_created', 'member_joined', 'member_left', 'member_removed',
                   'task_completed', 'reaction_added', 'admin_transferred',
                   'deletion_requested', 'deletion_failed')),
  task_id        uuid,
  target_user_id uuid references public.profiles (id) on delete cascade,
  emoji          text,
  created_at     timestamptz not null default now()
);
create index activity_events_room_idx on public.activity_events (room_id, created_at desc);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- Trim text and turn empty descriptions into NULL.
create or replace function public.rooms_validate()
returns trigger
language plpgsql
as $$
begin
  new.name := trim(new.name);
  new.description := nullif(trim(new.description), '');
  return new;
end;
$$;

create trigger rooms_validate
  before insert or update on public.rooms
  for each row execute function public.rooms_validate();

-- ---------- helpers (security definer = bypass RLS, avoids recursion) ----------
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_room_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members me
    join public.room_members them on them.room_id = me.room_id
    where me.user_id = (select auth.uid()) and them.user_id = p_user_id
  );
$$;

-- 8 characters, no look-alikes (no 0/O, 1/I/L). Random bits come from
-- gen_random_uuid(), so no extension is needed.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := uuid_send(gen_random_uuid());
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'You need to be signed in.';
  end if;
  return uid;
end;
$$;

-- ---------- RLS ----------
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.activity_events enable row level security;

create policy "rooms: members can read"
  on public.rooms for select to authenticated
  using (public.is_room_member(id));

create policy "rooms: admin can edit"
  on public.rooms for update to authenticated
  using (admin_id = (select auth.uid()))
  with check (admin_id = (select auth.uid()));

create policy "room_members: members can read"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

create policy "activity: members can read"
  on public.activity_events for select to authenticated
  using (public.is_room_member(room_id));

-- Profiles: now also visible to people you share a room with.
drop policy "profiles: read own" on public.profiles;
create policy "profiles: read own or roommates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_room_with(id));

-- Table privileges: read-only for clients, except renaming a room.
revoke all on public.rooms, public.room_members, public.activity_events from anon;
revoke insert, update, delete on public.rooms, public.room_members, public.activity_events from authenticated;
grant update (name, description) on public.rooms to authenticated;

-- ---------- actions ----------

-- Create a room; the creator becomes admin and first member.
create or replace function public.create_room(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  new_id uuid;
begin
  insert into public.rooms (name, description, admin_id, join_code)
  values (p_name, p_description, uid, public.generate_join_code())
  returning id into new_id;

  insert into public.room_members (room_id, user_id) values (new_id, uid);
  insert into public.activity_events (room_id, actor_id, type) values (new_id, uid, 'room_created');
  return new_id;
end;
$$;

-- Join with a code. Spaces, dashes and lowercase are ignored.
-- Max 20 members. Joining a room you're already in just returns it.
create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  target uuid;
  member_count int;
begin
  -- Lock the room row so two people can't squeeze past the cap at once.
  select id into target from public.rooms where join_code = clean for update;
  if target is null then
    raise exception 'That room code doesn''t match any room.';
  end if;

  if exists (select 1 from public.room_members where room_id = target and user_id = uid) then
    return target;
  end if;

  select count(*) into member_count from public.room_members where room_id = target;
  if member_count >= 20 then
    raise exception 'This room is full (20 members max).';
  end if;

  insert into public.room_members (room_id, user_id) values (target, uid);
  insert into public.activity_events (room_id, actor_id, type) values (target, uid, 'member_joined');
  return target;
end;
$$;

-- Admin: new code (old one stops working immediately).
create or replace function public.regenerate_join_code(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  new_code text;
begin
  if not exists (select 1 from public.rooms where id = p_room_id and admin_id = uid) then
    raise exception 'Only the room admin can do that.';
  end if;
  new_code := public.generate_join_code();
  update public.rooms set join_code = new_code where id = p_room_id;
  return new_code;
end;
$$;

-- Admin: remove someone else. Their tasks go with them (trigger added in Phase 4).
create or replace function public.remove_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if not exists (select 1 from public.rooms where id = p_room_id and admin_id = uid) then
    raise exception 'Only the room admin can do that.';
  end if;
  if p_user_id = uid then
    raise exception 'You can''t remove yourself — use Delete room instead.';
  end if;

  delete from public.room_members where room_id = p_room_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn''t in this room.';
  end if;
  insert into public.activity_events (room_id, actor_id, type, target_user_id)
  values (p_room_id, uid, 'member_removed', p_user_id);
end;
$$;

-- Member: leave. The admin can't leave this way (Phase 7 adds the vote).
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if exists (select 1 from public.rooms where id = p_room_id and admin_id = uid) then
    raise exception 'The admin can''t leave directly — the room has to be deleted.';
  end if;

  delete from public.room_members where room_id = p_room_id and user_id = uid;
  if not found then
    raise exception 'You''re not in this room.';
  end if;
  insert into public.activity_events (room_id, actor_id, type) values (p_room_id, uid, 'member_left');
end;
$$;

-- Admin: delete. For now only allowed when the admin is the only member.
-- Phase 7 replaces this with the majority-vote flow for bigger rooms.
create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if not exists (select 1 from public.rooms where id = p_room_id and admin_id = uid) then
    raise exception 'Only the room admin can do that.';
  end if;
  if (select count(*) from public.room_members where room_id = p_room_id) > 1 then
    raise exception 'Rooms with other members need a vote to delete (coming in Phase 7).';
  end if;
  delete from public.rooms where id = p_room_id; -- cascades members + events
end;
$$;

-- Only signed-in users may call these; internal helpers stay private.
revoke execute on function
  public.create_room(text, text), public.join_room(text), public.regenerate_join_code(uuid),
  public.remove_member(uuid, uuid), public.leave_room(uuid), public.delete_room(uuid),
  public.generate_join_code(), public.require_user(),
  public.is_room_member(uuid), public.shares_room_with(uuid)
from public, anon;

grant execute on function
  public.create_room(text, text), public.join_room(text), public.regenerate_join_code(uuid),
  public.remove_member(uuid, uuid), public.leave_room(uuid), public.delete_room(uuid),
  public.is_room_member(uuid), public.shares_room_with(uuid)
to authenticated;
