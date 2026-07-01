-- ============================================================================
-- LinkUpNaija — Profile media (banner + profile photo gallery)
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Reuses the existing public "avatars" storage bucket for uploads.
-- ============================================================================

-- Banner / cover photo on the profile.
alter table public.users add column if not exists banner_url text;

-- Standalone profile photo gallery (separate from event galleries).
create table if not exists public.profile_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  photo_url  text not null,
  created_at timestamptz not null default now()
);
create index if not exists profile_photos_user_idx
  on public.profile_photos (user_id, created_at desc);

alter table public.profile_photos enable row level security;

drop policy if exists "Profile photos are viewable by everyone" on public.profile_photos;
create policy "Profile photos are viewable by everyone"
  on public.profile_photos for select using (true);

drop policy if exists "Users add their own profile photos" on public.profile_photos;
create policy "Users add their own profile photos"
  on public.profile_photos for insert with check (user_id = auth.uid());

drop policy if exists "Users delete their own profile photos" on public.profile_photos;
create policy "Users delete their own profile photos"
  on public.profile_photos for delete using (user_id = auth.uid());
