-- A venue can be run by the person who runs it.
--
-- 257 venues are onboarded and 223 of them have no photograph, because the
-- importer refuses to copy Google's and we have not been to these places. The
-- venue reel is a format that lives on photography and it is currently
-- drawing generated art for nearly everything in it. The people who have the
-- photographs are the venues themselves, and they have no way in.
--
-- So: a venue owner claims their venue, we approve it, and from then on they
-- can put their own pictures and their own details on their own page.
--
-- THREE THINGS THIS DELIBERATELY DOES NOT DO.
--
-- It does not let a claim approve itself. Anybody can type a venue's name; a
-- claim is a request, and a human at our end says yes. Until then the claimer
-- has no more power over the row than a stranger.
--
-- It does not let an owner change what a venue IS. Name, category, state,
-- coordinates and is_featured are ours. Rating is nobody's to set by hand:
-- it is recomputed from venue_reviews, so it is left out of the guard rather
-- than locked, or an owner could never be reviewed. An owner who could set
-- is_featured would be paying themselves the money we charge for it, and an
-- owner who could rename the row could point a trusted listing at anything.
-- RLS cannot restrict columns, so a trigger does it and names the column it
-- refused, which is the difference between a rule and a mystery.
--
-- It does not build a second inbox. support_threads already exists and is
-- already answered from /admin/support. A venue owner is a user, so the
-- hotline is the one we have, tagged with the venue so the admin knows who
-- is talking.
--
-- Safe to run twice.


-- --------------------------------------------------------------- gallery ---
-- venues.image_url is one picture. A venue has a room, a plate and a bar, and
-- one field could only ever hold whichever the admin pasted last. Same shape
-- as vendors.gallery_urls, which already works.
alter table public.venues
  add column if not exists gallery_urls text[] not null default '{}';

comment on column public.venues.gallery_urls is
  'Photographs of the place, owner-uploaded. image_url stays the cover.';


-- ------------------------------------------------------------ the claims ---
create table if not exists public.venue_owners (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  -- What they said to convince us. Read by whoever approves.
  note        text check (note is null or length(note) <= 1000),
  -- Their claim to be who they say: a work email, a phone on the listing,
  -- an Instagram. Not verified by us, just recorded.
  contact     text check (contact is null or length(contact) <= 200),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references public.users(id) on delete set null
);

-- One approved owner per venue. Partial, because a venue can carry any number
-- of rejected claims and that is not a conflict.
create unique index if not exists venue_owners_one_approved
  on public.venue_owners (venue_id) where status = 'approved';

-- And one live claim per person per venue, so a refresh does not queue three.
create unique index if not exists venue_owners_one_pending
  on public.venue_owners (venue_id, user_id) where status = 'pending';

create index if not exists venue_owners_user_idx
  on public.venue_owners (user_id, status);
create index if not exists venue_owners_queue_idx
  on public.venue_owners (status, created_at desc);


/** Does this person run this venue? Used by policies, so security definer. */
create or replace function public.owns_venue(p_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_owners
     where venue_id = p_venue
       and user_id = auth.uid()
       and status = 'approved'
  );
$$;

grant execute on function public.owns_venue(uuid) to authenticated;


/**
 * Is this venue spoken for, by anyone?
 *
 * Different question from owns_venue, and it needs its own function because
 * the read policy on venue_owners deliberately shows you only your own
 * claims. Without this a visitor could not be told "someone already runs
 * this" and would be invited to claim a venue that is taken, which is a
 * wasted claim for them and a wasted read for whoever triages it.
 *
 * Returns a boolean and nothing else. Who owns it is not public.
 */
create or replace function public.venue_is_claimed(p_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_owners
     where venue_id = p_venue and status = 'approved'
  );
$$;

grant execute on function public.venue_is_claimed(uuid) to authenticated, anon;


-- ------------------------------------------------------------------- RLS ---
alter table public.venue_owners enable row level security;

drop policy if exists venue_owners_read_own on public.venue_owners;
create policy venue_owners_read_own on public.venue_owners
  for select using (user_id = auth.uid() or public.is_admin());

-- A claim is always born pending. Anything else and the status check below
-- would be the only thing between a stranger and a venue.
drop policy if exists venue_owners_claim on public.venue_owners;
create policy venue_owners_claim on public.venue_owners
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Only an admin decides. Deliberately no self-update at all: there is nothing
-- on this row a claimant needs to change after sending it, and "withdraw"
-- would be the one write that has to be told apart from "approve".
drop policy if exists venue_owners_decide on public.venue_owners;
create policy venue_owners_decide on public.venue_owners
  for update using (public.is_admin()) with check (public.is_admin());


-- -------------------------------------------------- what an owner may edit --
-- RLS grants the row, not the column, so this is what actually holds the
-- line. Ours stay ours; the rest is theirs to describe.
create or replace function public.guard_venue_owner_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  locked text;
begin
  -- Only an OWNER editing their own venue is what this exists for, and the
  -- test has to be that narrow.
  --
  -- The first version said "not an admin", which would have broken venue
  -- reviews outright. refresh_venue_rating() is security definer, but a
  -- BEFORE UPDATE trigger still fires inside it, and auth.uid() there is
  -- still the guest who left the review. So every review by a non-admin
  -- would have updated venues.rating, hit this guard, and been rejected.
  if not public.owns_venue(old.id) then
    return new;
  end if;

  locked := case
    when new.name        is distinct from old.name        then 'name'
    when new.category    is distinct from old.category    then 'category'
    when new.state       is distinct from old.state       then 'state'
    when new.lat         is distinct from old.lat         then 'lat'
    when new.lng         is distinct from old.lng         then 'lng'
    when new.is_featured is distinct from old.is_featured then 'is_featured'
    when new.is_active   is distinct from old.is_active   then 'is_active'
    when new.created_by  is distinct from old.created_by  then 'created_by'
    else null
  end;

  if locked is not null then
    raise exception
      'Only LinkUpNaija can change %. Message us if it is wrong.', locked
      using errcode = 'insufficient_privilege';
  end if;

  -- updated_at is touch_venue_updated_at's job, and it already runs first.
  return new;
end;
$$;

drop trigger if exists venue_owner_edit_guard on public.venues;
create trigger venue_owner_edit_guard
  before update on public.venues
  for each row execute function public.guard_venue_owner_edit();

drop policy if exists venues_owner_update on public.venues;
create policy venues_owner_update on public.venues
  for update to authenticated
  using (public.owns_venue(id))
  with check (public.owns_venue(id));


-- --------------------------------------------------------------- pictures --
insert into storage.buckets (id, name, public)
values ('venue-assets', 'venue-assets', true)
on conflict (id) do nothing;

-- Path is <venue_id>/<file>, so ownership is readable straight off the key.
-- Same shape ticket-files uses, for the same reason: the policy has to be
-- able to answer "whose is this?" without a join table lookup per object.
drop policy if exists venue_assets_read on storage.objects;
create policy venue_assets_read on storage.objects
  for select using (bucket_id = 'venue-assets');

drop policy if exists venue_assets_write on storage.objects;
create policy venue_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'venue-assets'
    and (
      public.is_admin()
      or public.owns_venue((storage.foldername(name))[1]::uuid)
    )
  );

drop policy if exists venue_assets_delete on storage.objects;
create policy venue_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'venue-assets'
    and (
      public.is_admin()
      or public.owns_venue((storage.foldername(name))[1]::uuid)
    )
  );


-- --------------------------------------------------------- the hotline -----
-- Not a new inbox. support_threads is already answered from /admin/support,
-- and a venue owner is a user like any other. The column only tells whoever
-- opens the thread that they are talking to a venue rather than a guest.
alter table public.support_threads
  add column if not exists venue_id uuid references public.venues(id) on delete set null;

comment on column public.support_threads.venue_id is
  'Set when the thread was opened from a venue owner dashboard. Display only.';

create index if not exists support_threads_venue_idx
  on public.support_threads (venue_id) where venue_id is not null;


-- ------------------------------------------------------------ where we are --
-- Nothing claimed yet is the expected answer on the first run.

select
  (select count(*) from public.venues where is_active)                     as venues,
  (select count(*) from public.venues where is_active and image_url is null) as without_a_photo,
  (select count(*) from public.venue_owners where status = 'pending')      as claims_waiting,
  (select count(*) from public.venue_owners where status = 'approved')     as venues_claimed;
