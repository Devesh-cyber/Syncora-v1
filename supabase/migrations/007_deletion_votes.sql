-- ============================================================
-- Syncora — Phase 7: room deletion votes
-- Run once in Supabase → SQL Editor (after 006_reactions_streaks.sql).
--
-- Rules:
--   • Only the admin can start a request, as "delete" (delete the room) or
--     "leave" (admin wants out; leaving deletes the room).
--   • Admin alone in the room → deleted immediately, no vote.
--   • Otherwise every member votes yes/no (admin auto-votes yes), and can
--     change their vote while it's open. One open request per room.
--   • Passes the moment yes votes are MORE than half the current members
--     → room deleted.
--   • Fails the moment a majority becomes impossible, or after 48 hours.
--       - "delete" fails → room carries on.
--       - "leave"  fails → admin passes to the longest-standing member and the
--                          old admin leaves (their tasks are deleted).
--   • The admin can cancel an open request.
--   • While a vote is open, the admin can't remove members (no kicking "no" voters).
--   • If a member leaves mid-vote, their vote is dropped and it's re-counted.
-- ============================================================

-- New event type for cancellations.
alter table public.activity_events drop constraint activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check check (type in (
  'room_created', 'member_joined', 'member_left', 'member_removed',
  'task_completed', 'reaction_added', 'admin_transferred',
  'deletion_requested', 'deletion_failed', 'deletion_cancelled'));

-- ---------- tables ----------
create table public.deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('delete', 'leave')),
  status       text not null default 'open' check (status in ('open', 'passed', 'failed', 'cancelled')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '48 hours',
  resolved_at  timestamptz
);
create unique index deletion_requests_one_open_per_room on public.deletion_requests (room_id) where status = 'open';

create table public.deletion_votes (
  request_id uuid not null references public.deletion_requests (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  vote       boolean not null,
  voted_at   timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- ---------- RLS: read-only for members; all writes go through functions ----------
alter table public.deletion_requests enable row level security;
alter table public.deletion_votes enable row level security;

create policy "deletion_requests: members can read"
  on public.deletion_requests for select to authenticated
  using (public.is_room_member(room_id));

create policy "deletion_votes: members can read"
  on public.deletion_votes for select to authenticated
  using (exists (
    select 1 from public.deletion_requests r
    where r.id = request_id and public.is_room_member(r.room_id)
  ));

revoke all on public.deletion_requests, public.deletion_votes from anon;
revoke insert, update, delete on public.deletion_requests, public.deletion_votes from authenticated;

-- ---------- core: count votes and settle the request if it's decided ----------
-- Returns the request's status afterwards ('open', 'passed', 'failed', 'cancelled').
create or replace function public.evaluate_deletion_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.deletion_requests%rowtype;
  members int;
  yes_votes int;
  voted int;
  new_admin uuid;
begin
  select * into req from public.deletion_requests where id = p_request_id for update;
  if not found then
    return 'passed'; -- room (and request) already deleted
  end if;
  if req.status <> 'open' then
    return req.status;
  end if;

  select count(*) into members from public.room_members where room_id = req.room_id;
  select count(*) filter (where v.vote), count(*)
    into yes_votes, voted
  from public.deletion_votes v
  join public.room_members m on m.room_id = req.room_id and m.user_id = v.user_id
  where v.request_id = req.id;

  -- Passed: strict majority of current members said yes.
  if yes_votes * 2 > members then
    delete from public.rooms where id = req.room_id; -- cascades everything
    return 'passed';
  end if;

  -- Still possible and not expired → keep waiting.
  if (yes_votes + (members - voted)) * 2 > members and now() < req.expires_at then
    return 'open';
  end if;

  -- Failed.
  update public.deletion_requests set status = 'failed', resolved_at = now() where id = req.id;
  insert into public.activity_events (room_id, actor_id, type) values (req.room_id, req.requested_by, 'deletion_failed');

  if req.kind = 'leave' then
    select m.user_id into new_admin
    from public.room_members m
    where m.room_id = req.room_id and m.user_id <> req.requested_by
    order by m.joined_at, m.user_id
    limit 1;

    if new_admin is not null then
      update public.rooms set admin_id = new_admin where id = req.room_id;
      insert into public.activity_events (room_id, actor_id, type, target_user_id)
      values (req.room_id, req.requested_by, 'admin_transferred', new_admin);
      delete from public.room_members where room_id = req.room_id and user_id = req.requested_by;
      insert into public.activity_events (room_id, actor_id, type)
      values (req.room_id, req.requested_by, 'member_left');
    end if;
  end if;

  return 'failed';
end;
$$;

-- Settle the open request in a room, if any (used after membership changes).
create or replace function public.evaluate_open_request_in_room(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  select id into rid from public.deletion_requests where room_id = p_room_id and status = 'open';
  if rid is null then
    return null;
  end if;
  return public.evaluate_deletion_request(rid);
end;
$$;

-- ---------- actions ----------

-- Admin: start a vote ('delete' or 'leave'). Alone in the room → deleted now.
-- Returns 'deleted' or 'open'.
create or replace function public.request_room_deletion(p_room_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  new_id uuid;
begin
  if p_kind not in ('delete', 'leave') then
    raise exception 'Unknown request type.';
  end if;
  -- Lock the room so two requests can't race.
  perform 1 from public.rooms where id = p_room_id and admin_id = uid for update;
  if not found then
    raise exception 'Only the room admin can do that.';
  end if;

  if (select count(*) from public.room_members where room_id = p_room_id) = 1 then
    delete from public.rooms where id = p_room_id;
    return 'deleted';
  end if;

  -- Settle an expired request first, then make sure none is open.
  perform public.evaluate_open_request_in_room(p_room_id);
  if exists (select 1 from public.deletion_requests where room_id = p_room_id and status = 'open') then
    raise exception 'There''s already a vote open in this room.';
  end if;

  insert into public.deletion_requests (room_id, requested_by, kind)
  values (p_room_id, uid, p_kind)
  returning id into new_id;
  insert into public.deletion_votes (request_id, user_id, vote) values (new_id, uid, true);
  insert into public.activity_events (room_id, actor_id, type) values (p_room_id, uid, 'deletion_requested');

  return case public.evaluate_deletion_request(new_id) when 'passed' then 'deleted' else 'open' end;
end;
$$;

-- Member: vote or change your vote. Returns the request status afterwards.
create or replace function public.vote_on_deletion(p_request_id uuid, p_vote boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  rid uuid;
  status_now text;
begin
  select room_id into rid from public.deletion_requests where id = p_request_id;
  if rid is null or not public.is_room_member(rid) then
    raise exception 'That vote isn''t in a room you''re part of.';
  end if;

  status_now := public.evaluate_deletion_request(p_request_id); -- handles expiry
  if status_now <> 'open' then
    raise exception 'This vote has already closed.';
  end if;

  insert into public.deletion_votes (request_id, user_id, vote)
  values (p_request_id, uid, p_vote)
  on conflict (request_id, user_id) do update set vote = excluded.vote, voted_at = now();

  return public.evaluate_deletion_request(p_request_id);
end;
$$;

-- Admin: call off an open request.
create or replace function public.cancel_deletion_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  req public.deletion_requests%rowtype;
begin
  select * into req from public.deletion_requests where id = p_request_id for update;
  if not found or req.requested_by <> uid then
    raise exception 'Only the admin who started the vote can cancel it.';
  end if;
  if req.status <> 'open' then
    raise exception 'This vote has already closed.';
  end if;
  update public.deletion_requests set status = 'cancelled', resolved_at = now() where id = req.id;
  insert into public.activity_events (room_id, actor_id, type) values (req.room_id, uid, 'deletion_cancelled');
end;
$$;

-- Member: settle an expired vote when opening the room. Returns status or null.
create or replace function public.check_room_deletion(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_room_member(p_room_id) then
    return null;
  end if;
  return public.evaluate_open_request_in_room(p_room_id);
end;
$$;

-- Scheduled sweep (optional, see bottom): settle every expired request.
create or replace function public.sweep_deletion_requests()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in select id from public.deletion_requests where status = 'open' and expires_at <= now() loop
    perform public.evaluate_deletion_request(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------- update Phase 3 functions ----------

-- Joining mid-vote changes the member count, so re-check.
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
  perform public.evaluate_open_request_in_room(target);
  return target;
end;
$$;

-- No removing members while a vote is open.
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
    raise exception 'You can''t remove yourself — use Leave room instead.';
  end if;
  if exists (select 1 from public.deletion_requests where room_id = p_room_id and status = 'open') then
    raise exception 'You can''t remove members while a vote is open.';
  end if;

  delete from public.room_members where room_id = p_room_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn''t in this room.';
  end if;
  insert into public.activity_events (room_id, actor_id, type, target_user_id)
  values (p_room_id, uid, 'member_removed', p_user_id);
end;
$$;

-- A member leaving mid-vote: drop their vote and re-count.
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
    raise exception 'As admin, leaving needs a vote — use Leave room from the room page.';
  end if;

  delete from public.room_members where room_id = p_room_id and user_id = uid;
  if not found then
    raise exception 'You''re not in this room.';
  end if;
  delete from public.deletion_votes v
  using public.deletion_requests r
  where v.request_id = r.id and r.room_id = p_room_id and r.status = 'open' and v.user_id = uid;

  insert into public.activity_events (room_id, actor_id, type) values (p_room_id, uid, 'member_left');
  perform public.evaluate_open_request_in_room(p_room_id);
end;
$$;

-- ---------- function permissions ----------
revoke execute on function
  public.evaluate_deletion_request(uuid), public.evaluate_open_request_in_room(uuid),
  public.sweep_deletion_requests(),
  public.request_room_deletion(uuid, text), public.vote_on_deletion(uuid, boolean),
  public.cancel_deletion_request(uuid), public.check_room_deletion(uuid)
from public, anon, authenticated;

grant execute on function
  public.request_room_deletion(uuid, text), public.vote_on_deletion(uuid, boolean),
  public.cancel_deletion_request(uuid), public.check_room_deletion(uuid)
to authenticated;

-- (create or replace keeps existing grants for join_room / remove_member / leave_room.)

-- ============================================================
-- OPTIONAL — automatic expiry every 15 minutes.
-- Without this, an expired vote is settled the next time anyone opens the
-- room (which is all the app needs). To also sweep in the background:
--   1. Supabase → Database → Extensions → enable "pg_cron"
--   2. Run this line on its own:
--
-- select cron.schedule('syncora-expire-votes', '*/15 * * * *', $$select public.sweep_deletion_requests()$$);
-- ============================================================
