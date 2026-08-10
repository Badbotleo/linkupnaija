-- Past-event recaps: the public proof that things actually happen here.
--
-- SCHEMA CHANGE. One new table, one new storage bucket, and their policies.
-- Nothing existing is altered or dropped.
--
-- Why not the event gallery: event_photos is images-only and RLS-gated to the
-- host and accepted attendees — an anonymous visitor reads zero rows. Recap
-- footage that only past attendees can see is social proof aimed at the wrong
-- audience. These are deliberately public.
--
-- Safe to run more than once.

create table if not exists public.event_recaps (
  id uuid primary key default gen_random_uuid(),
  -- Links the clip back to the event it came from. ON DELETE SET NULL, not
  -- CASCADE: deleting an old event should never silently destroy the footage
  -- that proves it happened. The card just stops linking.
  event_id uuid references public.events(id) on delete set null,
  -- Optional caption. Same convention as things_to_do — blank means "this
  -- clip has its own burned-in text, don't draw over it".
  title text,
  media_url text not null,
  media_type text not null default 'video' check (media_type in ('video', 'image')),
  state text,
  credit text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_recaps_active_idx
  on public.event_recaps (is_active, sort_order, created_at desc);
create index if not exists event_recaps_event_idx
  on public.event_recaps (event_id);

alter table public.event_recaps enable row level security;

-- These use public.is_admin() rather than an inline subquery on users: the
-- policy would otherwise have to read a row the caller can't see. is_admin()
-- is SECURITY DEFINER and reads it regardless.
drop policy if exists "Anyone can read active recaps" on public.event_recaps;
create policy "Anyone can read active recaps"
  on public.event_recaps for select
  using (is_active or public.is_admin());

drop policy if exists "Admins manage recaps" on public.event_recaps;
create policy "Admins manage recaps"
  on public.event_recaps for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- storage ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-recaps', 'event-recaps', true)
on conflict (id) do nothing;

drop policy if exists "Public read event-recaps media" on storage.objects;
create policy "Public read event-recaps media"
  on storage.objects for select
  using (bucket_id = 'event-recaps');

drop policy if exists "Admins upload event-recaps media" on storage.objects;
create policy "Admins upload event-recaps media"
  on storage.objects for insert
  with check (bucket_id = 'event-recaps' and public.is_admin());

drop policy if exists "Admins replace event-recaps media" on storage.objects;
create policy "Admins replace event-recaps media"
  on storage.objects for update
  using (bucket_id = 'event-recaps' and public.is_admin());

drop policy if exists "Admins delete event-recaps media" on storage.objects;
create policy "Admins delete event-recaps media"
  on storage.objects for delete
  using (bucket_id = 'event-recaps' and public.is_admin());
