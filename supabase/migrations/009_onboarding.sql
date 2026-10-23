-- ============================================================
-- Syncora — onboarding tour flag
-- Run once in Supabase → SQL Editor (after 008_realtime.sql).
--
-- Everyone starts with tour_seen = false, so existing users also see
-- the 4-card "how Syncora works" tour once on their next visit.
-- ============================================================

alter table public.profiles
  add column if not exists tour_seen boolean not null default false;

grant update (tour_seen) on public.profiles to authenticated;
