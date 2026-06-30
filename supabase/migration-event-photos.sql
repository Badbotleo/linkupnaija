-- ============================================================================
-- LinkUpNaija — Post-event photo gallery
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on events, rsvps, users, notifications.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- event_photos
-- ----------------------------------------------------------------------------
create table if not exists public.event_photos (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  uploader_id uuid not null references public.users (id) on delete cascade,
  photo_url   text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

create index if not exists event_photos_event_idx
  on public.event_photos (event_id, created_at desc);
create index if not exists event_photos_uploader_idx
  on public.event_photos (uploader_id);

alter table public.event_photos enable row level security;

-- View: host + accepted attendees of the event.
drop policy if exists "Gallery visible to host and attendees" on public.event_photos;
create policy "Gallery visible to host and attendees"
  on public.event_photos for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_photos.event_id and e.host_id = auth.uid()
    )
    or exists (
      select 1 from public.rsvps r
      where r.event_id = event_photos.event_id
        and r.user_id = auth.uid()
        and r.status = 'accepted'
    )
  );

-- Upload: host + accepted attendees, as themselves.
drop policy if exists "Attendees can add photos" on public.event_photos;
create policy "Attendees can add photos"
  on public.event_photos for insert
  with check (
    uploader_id = auth.uid()
    and (
      exists (
        select 1 from public.events e
        where e.id = event_photos.event_id and e.host_id = auth.uid()
      )
      or exists (
        select 1 from public.rsvps r
        where r.event_id = event_photos.event_id
          and r.user_id = auth.uid()
          and r.status = 'accepted'
      )
    )
  );

-- Delete: the uploader, or the event host (can remove any photo).
drop policy if exists "Uploader or host can delete photos" on public.event_photos;
create policy "Uploader or host can delete photos"
  on public.event_photos for delete
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_photos.event_id and e.host_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Storage bucket "event-photos" — public read; write/delete scoped by folder.
-- Files live at "<event_id>/<uploader_id>/<file>".
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

drop policy if exists "Event photos are publicly readable" on storage.objects;
create policy "Event photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-photos');

drop policy if exists "Users can upload event photos" on storage.objects;
create policy "Users can upload event photos"
  on storage.objects for insert
  with check (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Uploader or host can delete event photos" on storage.objects;
create policy "Uploader or host can delete event photos"
  on storage.objects for delete
  using (
    bucket_id = 'event-photos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and e.host_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- FOMO: when the FIRST photo lands in a gallery, notify everyone who ever
-- requested to join (any status) — "see what you missed".
-- ----------------------------------------------------------------------------
create or replace function public.handle_first_event_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
  ev_title text;
begin
  select count(*) into cnt from public.event_photos where event_id = new.event_id;
  if cnt = 1 then
    select title into ev_title from public.events where id = new.event_id;
    insert into public.notifications (user_id, message, event_id)
    select distinct r.user_id,
           '"' || coalesce(ev_title, 'An event') || '" photos are in 📸 See what you missed!',
           new.event_id
    from public.rsvps r
    where r.event_id = new.event_id
      and r.user_id <> new.uploader_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_first_event_photo on public.event_photos;
create trigger on_first_event_photo
  after insert on public.event_photos
  for each row execute function public.handle_first_event_photo();
