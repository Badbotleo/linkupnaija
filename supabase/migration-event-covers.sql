-- ============================================================================
-- LinkUpNaija — Event cover images migration
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

-- 1. Cover image URL on events
alter table public.events add column if not exists cover_image_url text;

-- 2. Public storage bucket for event covers
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

-- 3. Storage policies — public read, owner-only write.
--    Files live under a folder named after the host's id: "<uid>/...".
drop policy if exists "Event covers are publicly readable" on storage.objects;
create policy "Event covers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-covers');

drop policy if exists "Users can upload event covers" on storage.objects;
create policy "Users can upload event covers"
  on storage.objects for insert
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their event covers" on storage.objects;
create policy "Users can update their event covers"
  on storage.objects for update
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their event covers" on storage.objects;
create policy "Users can delete their event covers"
  on storage.objects for delete
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
