-- ============================================================
-- Syncora — Phase 2: profiles + avatars
-- Run once in Supabase → SQL Editor.
-- ============================================================

-- ---------- profiles ----------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 1 and 40),
  avatar_url        text,
  timezone          text not null default 'UTC',
  reminders_enabled boolean not null default true,
  onboarded         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Phase 2: you can only see yourself.
-- Phase 3 widens this to "people who share a room with you".
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: rows are created by the signup trigger
-- and removed when the auth user is deleted (cascade).

-- Only these columns are editable from the app.
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url, timezone, reminders_enabled, onboarded)
  on public.profiles to authenticated;

-- ---------- shared helper: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- validation: trim name, reject unknown time zones ----------
create or replace function public.profiles_validate()
returns trigger
language plpgsql
as $$
begin
  new.display_name := trim(new.display_name);
  -- Raises an error if the time zone name is not valid.
  perform now() at time zone new.timezone;
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function public.profiles_validate();

-- ---------- auto-create a profile on first Google sign-in ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'New member'
      ),
      40
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- avatars storage bucket ----------
-- Public read (so <img> tags work), 2 MB limit, images only.
-- Files live at avatars/<user_id>/<file>, and users can only write their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: read own files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: update own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- backfill: anyone who signed in before this migration ----------
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  left(coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'New member'
  ), 40),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;
