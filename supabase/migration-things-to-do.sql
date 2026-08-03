-- ============================================================================
-- LinkUpNaija — admin-curated "Things to do this week"
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

create table if not exists public.things_to_do (
  id          uuid primary key default gen_random_uuid(),
  -- What you'd do ("Sunday picnic"), and where ("Jabi Recreational Park").
  title       text not null,
  place       text,
  -- The event category the host form should open on.
  category    text not null,
  -- Optional link to a partner venue, so the idea can carry its address.
  venue_id    uuid references public.venues(id) on delete set null,
  state       text,
  -- Pre-written event title, so /host opens part-done.
  seed_title  text,
  media_url   text,
  media_type  text not null default 'image'
                check (media_type in ('image', 'video')),
  -- Whoever shot the photo/video, so borrowed media is attributed rather
  -- than quietly reposted. credit_url is optional and only linked when set.
  credit      text,
  credit_url  text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Safe to re-run on a table created before credits existed.
alter table public.things_to_do
  add column if not exists credit     text,
  add column if not exists credit_url text;

create index if not exists things_to_do_active_idx
  on public.things_to_do (is_active, sort_order, created_at desc);

alter table public.things_to_do enable row level security;

-- Everyone reads the live ones; only admins see drafts or write.
--
-- These use public.is_admin() rather than an inline `select ... from
-- public.users`. A subquery inside a policy runs AS THE CALLER, so it is
-- itself subject to RLS on public.users — it came back empty and every admin
-- write was rejected with "new row violates row-level security policy".
-- is_admin() is SECURITY DEFINER and reads the row regardless.
drop policy if exists "Anyone can read active things to do" on public.things_to_do;
create policy "Anyone can read active things to do"
  on public.things_to_do for select
  using (is_active or public.is_admin());

drop policy if exists "Admins manage things to do" on public.things_to_do;
create policy "Admins manage things to do"
  on public.things_to_do for all
  using (public.is_admin())
  with check (public.is_admin());

-- Videos and cover art for the cards.
insert into storage.buckets (id, name, public)
values ('things-to-do', 'things-to-do', true)
on conflict (id) do nothing;

drop policy if exists "Public read things-to-do media" on storage.objects;
create policy "Public read things-to-do media"
  on storage.objects for select
  using (bucket_id = 'things-to-do');

drop policy if exists "Admins upload things-to-do media" on storage.objects;
create policy "Admins upload things-to-do media"
  on storage.objects for insert
  with check (bucket_id = 'things-to-do' and public.is_admin());

drop policy if exists "Admins replace things-to-do media" on storage.objects;
create policy "Admins replace things-to-do media"
  on storage.objects for update
  using (bucket_id = 'things-to-do' and public.is_admin());

drop policy if exists "Admins delete things-to-do media" on storage.objects;
create policy "Admins delete things-to-do media"
  on storage.objects for delete
  using (bucket_id = 'things-to-do' and public.is_admin());
