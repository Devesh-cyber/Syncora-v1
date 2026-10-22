-- ============================================================
-- Syncora — Phase 6: reactions + streaks
-- Run once in Supabase → SQL Editor (after 004_tasks.sql).
--
-- Reactions: 👏 🔥 💪 🎉 on other people's COMPLETED tasks, one of each per person.
-- Unchecking a task removes its reactions. Leaving a room removes the
-- reactions you gave there.
--
-- Streak: consecutive local days (your profile time zone) with at least
-- one completed task. Calculated on the fly, never stored.
-- ============================================================

create table public.reactions (
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('👏', '🔥', '💪', '🎉')),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id, emoji)
);
create index reactions_user_idx on public.reactions (user_id);

-- ---------- helpers ----------
create or replace function public.can_see_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    join public.room_members m on m.room_id = t.room_id and m.user_id = (select auth.uid())
    where t.id = p_task_id
  );
$$;

-- You can react if you can see the task, it's completed, and it isn't yours.
create or replace function public.can_react_to(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    join public.room_members m on m.room_id = t.room_id and m.user_id = (select auth.uid())
    where t.id = p_task_id
      and t.completed_at is not null
      and t.owner_id <> (select auth.uid())
  );
$$;

-- ---------- RLS ----------
alter table public.reactions enable row level security;

create policy "reactions: members can read"
  on public.reactions for select to authenticated
  using (public.can_see_task(task_id));

create policy "reactions: react to others' completed tasks"
  on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_react_to(task_id));

create policy "reactions: remove your own"
  on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.reactions from anon;
revoke insert, update, delete on public.reactions from authenticated;
grant insert (task_id, emoji) on public.reactions to authenticated;
grant select, delete on public.reactions to authenticated;

-- ---------- activity log for reactions ----------
create or replace function public.reactions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_events (room_id, actor_id, type, task_id, target_user_id, emoji)
  select t.room_id, new.user_id, 'reaction_added', t.id, t.owner_id, new.emoji
  from public.tasks t where t.id = new.task_id;
  return null;
end;
$$;

create trigger reactions_after_insert
  after insert on public.reactions
  for each row execute function public.reactions_after_insert();

-- Un-reacting removes the matching feed line.
create or replace function public.reactions_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_events
  where type = 'reaction_added'
    and task_id = old.task_id
    and actor_id = old.user_id
    and emoji = old.emoji;
  return null;
end;
$$;

create trigger reactions_after_delete
  after delete on public.reactions
  for each row execute function public.reactions_after_delete();

-- ---------- extend Phase 4 triggers ----------
-- Unchecking now also clears the task's reactions.
create or replace function public.tasks_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    insert into public.activity_events (room_id, actor_id, type, task_id)
    values (new.room_id, new.owner_id, 'task_completed', new.id);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.reactions where task_id = new.id;
    delete from public.activity_events
    where task_id = new.id and type in ('task_completed', 'reaction_added');
  end if;
  return null;
end;
$$;

-- Leaving / removal now also clears the reactions you gave in that room.
create or replace function public.room_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reactions r
  using public.tasks t
  where r.task_id = t.id and t.room_id = old.room_id and r.user_id = old.user_id;

  delete from public.tasks where room_id = old.room_id and owner_id = old.user_id;
  return null;
end;
$$;

-- ---------- streaks ----------
-- Internal: streak numbers for one user, using their profile time zone.
-- "current" stays alive through today even if today has no completion yet
-- (it only breaks once a whole day passes with nothing done).
create or replace function public.streak_for(p_user_id uuid)
returns table (current_streak int, best_streak int, done_today boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (
    select coalesce((select timezone from public.profiles where id = p_user_id), 'UTC') as name
  ),
  today as (
    select (now() at time zone (select name from tz))::date as d
  ),
  days as (
    select distinct (t.completed_at at time zone (select name from tz))::date as d
    from public.tasks t
    where t.owner_id = p_user_id and t.completed_at is not null
  ),
  islands as (
    select max(d) as last_day, count(*)::int as len
    from (select d, d - (row_number() over (order by d))::int as grp from days) x
    group by grp
  )
  select
    coalesce((select len from islands where last_day >= (select d from today) - 1), 0) as current_streak,
    coalesce((select max(len) from islands), 0) as best_streak,
    exists (select 1 from days where d = (select d from today)) as done_today;
$$;

create or replace function public.get_my_streak()
returns table (current_streak int, best_streak int, done_today boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.streak_for(public.require_user());
$$;

-- Current streak of everyone in a room you belong to.
create or replace function public.get_room_streaks(p_room_id uuid)
returns table (user_id uuid, current_streak int, done_today boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_room_member(p_room_id) then
    raise exception 'You''re not in this room.';
  end if;
  return query
    select m.user_id, s.current_streak, s.done_today
    from public.room_members m
    cross join lateral public.streak_for(m.user_id) s
    where m.room_id = p_room_id;
end;
$$;

-- ---------- function permissions ----------
revoke execute on function
  public.can_see_task(uuid), public.can_react_to(uuid), public.streak_for(uuid),
  public.get_my_streak(), public.get_room_streaks(uuid),
  public.reactions_after_insert(), public.reactions_after_delete()
from public, anon;

grant execute on function
  public.can_see_task(uuid), public.can_react_to(uuid),
  public.get_my_streak(), public.get_room_streaks(uuid)
to authenticated;
