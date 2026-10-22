-- ============================================================
-- Syncora — Phase 8: realtime
-- Run once in Supabase → SQL Editor (after 007_deletion_votes.sql).
--
-- Adds the tables to Supabase's realtime publication so open screens
-- refresh when something changes. Realtime respects RLS: people only
-- receive changes for rows they're allowed to read.
-- Safe to run more than once.
-- ============================================================

do $$
declare
  t text;
begin
  -- Supabase creates this publication; create it if this is a fresh Postgres.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'rooms', 'room_members', 'tasks', 'reactions',
    'activity_events', 'deletion_requests', 'deletion_votes'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
