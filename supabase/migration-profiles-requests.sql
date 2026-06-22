-- ============================================================================
-- LinkUpNaija — Profiles + Request-to-Join migration
-- Run in Supabase: Dashboard → SQL Editor → New query → Run.
-- (Idempotent — safe to re-run.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend user profiles
-- ----------------------------------------------------------------------------
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists avatar_url text;        -- (already exists in base schema)
alter table public.users add column if not exists instagram_url text;
alter table public.users add column if not exists twitter_url text;
alter table public.users add column if not exists facebook_url text;
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists profile_completed boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. RSVP request status: 'pending' | 'accepted' | 'declined'
--    Existing RSVPs (from the old instant-join flow) are treated as accepted.
-- ----------------------------------------------------------------------------
alter table public.rsvps add column if not exists status text;
update public.rsvps set status = 'accepted' where status is null;
alter table public.rsvps alter column status set default 'pending';
alter table public.rsvps alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rsvps_status_check'
  ) then
    alter table public.rsvps
      add constraint rsvps_status_check
      check (status in ('pending', 'accepted', 'declined'));
  end if;
end $$;

create index if not exists rsvps_status_idx on public.rsvps (event_id, status);

-- ----------------------------------------------------------------------------
-- 3. RSVP policies
--    - Users request to join (insert) only as themselves, only as 'pending'.
--    - Hosts can update (accept/decline) RSVPs for events they host.
-- ----------------------------------------------------------------------------
drop policy if exists "Users can RSVP for themselves" on public.rsvps;
drop policy if exists "Users can request to join" on public.rsvps;
create policy "Users can request to join"
  on public.rsvps for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Hosts can manage requests for their events" on public.rsvps;
create policy "Hosts can manage requests for their events"
  on public.rsvps for update
  using (
    exists (
      select 1 from public.events e
      where e.id = rsvps.event_id and e.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = rsvps.event_id and e.host_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Chat access now requires an *accepted* RSVP (or being the host)
-- ----------------------------------------------------------------------------
create or replace function public.can_access_event_chat(target_event uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.rsvps r
      where r.event_id = target_event
        and r.user_id = auth.uid()
        and r.status = 'accepted'
    )
    or exists (
      select 1 from public.events e
      where e.id = target_event and e.host_id = auth.uid()
    );
$$;

-- ----------------------------------------------------------------------------
-- 5. Avatar storage bucket + policies (public read, owner-only write)
--    Files are stored under a folder named after the user's id: "<uid>/..."
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
