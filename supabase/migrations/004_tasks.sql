-- ============================================================
-- Syncora — Phase 4: tasks
-- Run once in Supabase → SQL Editor (after 003_rooms.sql).
--
-- Rules:
--   • Room members can see every task in the room.
--   • Only the owner can add / edit / complete / delete their tasks.
--   • completed_at is always set by the database (no backdating).
--   • Unchecking a task erases its completion from the activity log.
--   • Leaving or being removed from a room deletes your tasks there.
-- ============================================================

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (description is null or char_length(description) <= 500),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_room_idx on public.tasks (room_id);
create index tasks_owner_completed_idx on public.tasks (owner_id, completed_at);

-- Activity events can now point at tasks; deleting a task removes its events.
alter table public.activity_events
  add constraint activity_events_task_fk
  foreign key (task_id) references public.tasks (id) on delete cascade;
create index activity_events_task_idx on public.activity_events (task_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------- validation + server-controlled completion time ----------
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
as $$
begin
  new.title := trim(new.title);
  new.description := nullif(trim(new.description), '');

  if tg_op = 'INSERT' then
    new.completed_at := null;                -- new tasks always start pending
  elsif new.completed_at is not null and old.completed_at is null then
    new.completed_at := now();               -- checked now: use server time
  elsif new.completed_at is not null then
    new.completed_at := old.completed_at;    -- already done: keep original time
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------- activity log on check / uncheck ----------
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
    -- "Unchecking means it never happened": drop its completion + reaction events.
    delete from public.activity_events
    where task_id = new.id and type in ('task_completed', 'reaction_added');
  end if;
  return null;
end;
$$;

create trigger tasks_after_update
  after update of completed_at on public.tasks
  for each row execute function public.tasks_after_update();

-- ---------- leaving / removal deletes that person's tasks in the room ----------
create or replace function public.room_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tasks where room_id = old.room_id and owner_id = old.user_id;
  return null;
end;
$$;

create trigger room_members_after_delete
  after delete on public.room_members
  for each row execute function public.room_members_after_delete();

-- ---------- RLS ----------
alter table public.tasks enable row level security;

create policy "tasks: members can read"
  on public.tasks for select to authenticated
  using (public.is_room_member(room_id));

create policy "tasks: members add their own"
  on public.tasks for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_room_member(room_id));

create policy "tasks: owner edits"
  on public.tasks for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "tasks: owner deletes"
  on public.tasks for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Column privileges: tasks can't be moved between rooms or given to someone else.
revoke all on public.tasks from anon;
revoke insert, update on public.tasks from authenticated;
grant insert (room_id, title, description, due_date) on public.tasks to authenticated;
grant update (title, description, due_date, completed_at) on public.tasks to authenticated;
grant select, delete on public.tasks to authenticated;

-- Trigger helpers aren't meant to be called directly.
revoke execute on function public.tasks_after_update(), public.room_members_after_delete() from public, anon, authenticated;
