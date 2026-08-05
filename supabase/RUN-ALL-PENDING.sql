-- ============================================================================
-- LinkUpNaija — every pending migration, in dependency order.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file
--   -> Run.
--
-- Every statement is idempotent: running it twice is safe, and re-running
-- after a failure part-way through is safe too.
-- ============================================================================


-- ==========================================================================
-- migration-tournament.sql
-- FC26 registrations — URGENT: without this, paying customers are charged and their registration fails to save
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — FC26 Tournament registrations
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

create table if not exists public.tournament_registrations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null,
  phone             text not null,
  state             text,
  psn_id            text,
  payment_reference text,
  paid              boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists tournament_reg_created_idx
  on public.tournament_registrations (created_at desc);

alter table public.tournament_registrations enable row level security;

-- Anyone can register (the registration is gated by a Paystack payment in the
-- UI). Only admins can read the rows (they contain personal contact details).
drop policy if exists "Anyone can register for the tournament" on public.tournament_registrations;
create policy "Anyone can register for the tournament"
  on public.tournament_registrations for insert
  with check (true);

drop policy if exists "Admins read tournament registrations" on public.tournament_registrations;
create policy "Admins read tournament registrations"
  on public.tournament_registrations for select
  using (public.is_admin());

-- Public spots-filled count without exposing any personal data.
create or replace function public.count_tournament_registrations()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.tournament_registrations where paid = true;
$$;

grant execute on function public.count_tournament_registrations() to anon, authenticated;


-- ==========================================================================
-- migration-things-to-do.sql
-- Things to do — RE-RUN: fixes the admin upload RLS error
-- ==========================================================================
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


-- ==========================================================================
-- migration-host-limit.sql
-- Free hosting cap — RE-RUN: moves the enforced limit from 4 to 2
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — free members host 4 events per calendar month, Pro unlimited
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- The /host page already refuses to render the form past the limit, but that
-- is only a courtesy: anyone can POST straight to the REST API with their own
-- token. This trigger is the actual enforcement.
-- ============================================================================

create or replace function public.enforce_host_event_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_limit  constant int := 2;   -- keep in sync with FREE_HOST_LIMIT in lib/pro.ts
  is_pro_now  boolean;
  used        int;
begin
  -- Pro members are unlimited. Expired Pro counts as free.
  select coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    into is_pro_now
    from public.users u
   where u.id = new.host_id;

  if coalesce(is_pro_now, false) then
    return new;
  end if;

  -- Count on created_at, not the event date: otherwise someone could host
  -- four, delete one, and host again — or schedule everything into next month
  -- to dodge the window entirely.
  select count(*)
    into used
    from public.events e
   where e.host_id = new.host_id
     and e.created_at >= date_trunc('month', now() at time zone 'utc');

  if used >= free_limit then
    raise exception
      'Free members can host % events per month. Upgrade to Pro for unlimited hosting.',
      free_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_host_event_limit_trg on public.events;

create trigger enforce_host_event_limit_trg
  before insert on public.events
  for each row
  execute function public.enforce_host_event_limit();

-- Counting per host per month is the hot path for this trigger.
create index if not exists events_host_created_idx
  on public.events (host_id, created_at desc);


-- ==========================================================================
-- migration-event-gallery.sql
-- Up to 5 pictures per event
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — up to 5 pictures per event
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- cover_image_url stays the single headline image, so nothing that reads it
-- has to change. gallery_urls holds the EXTRA pictures beyond the cover.
-- ============================================================================

alter table public.events
  add column if not exists gallery_urls text[] not null default '{}';

-- Four extras plus the cover is the five the host was promised. Enforced here
-- as well as in the form, because the form is only a courtesy — anyone can
-- POST straight to the REST API.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_gallery_max'
  ) then
    alter table public.events
      add constraint events_gallery_max
      check (array_length(gallery_urls, 1) is null or array_length(gallery_urls, 1) <= 4);
  end if;
end $$;

comment on column public.events.gallery_urls is
  'Extra pictures beyond cover_image_url. Max 4, so 5 images total per event.';


-- ==========================================================================
-- migration-venue-ratings-hours.sql
-- Venue rating + opening hours columns
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — venue ratings and opening hours
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

alter table public.venues
  add column if not exists rating        numeric(2,1),
  add column if not exists opening_hours text;

-- A rating is out of 5 or absent. No default: an unrated venue should read as
-- unrated, not as zero stars.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venues_rating_range'
  ) then
    alter table public.venues
      add constraint venues_rating_range
      check (rating is null or (rating >= 0 and rating <= 5));
  end if;
end $$;

comment on column public.venues.rating is
  'Venue rating out of 5, set by an admin from the venue''s real public rating. Null when unrated.';

comment on column public.venues.opening_hours is
  'OSM opening_hours syntax, e.g. "Mo-Fr 09:00-22:00; Sa,Su 10:00-00:00". Parsed by lib/opening-hours.ts.';

-- Featured/active venues are listed rating-first, so index the read path.
create index if not exists venues_active_rating_idx
  on public.venues (is_active, rating desc nulls last);


-- ==========================================================================
-- migration-venue-reviews.sql
-- Guest-written venue reviews (needs the file above first)
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — venue ratings from real guests
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- Run AFTER migration-venue-ratings-hours.sql, which adds venues.rating.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reservations only recorded a venue NAME, so nothing tied a booking back
--    to the venue row. Without this a review has nothing to attach to.
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists venue_id uuid references public.venues(id) on delete set null;

create index if not exists reservations_venue_idx
  on public.reservations (venue_id);

alter table public.venues
  add column if not exists rating_count int not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Reviews
-- ---------------------------------------------------------------------------
create table if not exists public.venue_reviews (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  rating         int  not null check (rating between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now(),
  -- One review per booking: rating the same visit twice would let a single
  -- guest move a venue's average on their own.
  unique (user_id, reservation_id)
);

create index if not exists venue_reviews_venue_idx
  on public.venue_reviews (venue_id, created_at desc);

alter table public.venue_reviews enable row level security;

drop policy if exists "Anyone can read venue reviews" on public.venue_reviews;
create policy "Anyone can read venue reviews"
  on public.venue_reviews for select
  using (true);

-- Only someone who actually turned up can rate: a confirmed reservation, for
-- this venue, in their own name, whose date has passed.
drop policy if exists "Guests review venues they booked" on public.venue_reviews;
create policy "Guests review venues they booked"
  on public.venue_reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.reservations r
       where r.id = venue_reviews.reservation_id
         and r.user_id = auth.uid()
         and r.venue_id = venue_reviews.venue_id
         and r.status = 'confirmed'
         and r.date <= current_date
    )
  );

drop policy if exists "Guests edit their own review" on public.venue_reviews;
create policy "Guests edit their own review"
  on public.venue_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Guests delete their own review" on public.venue_reviews;
create policy "Guests delete their own review"
  on public.venue_reviews for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Keep venues.rating / rating_count in step with the reviews
-- ---------------------------------------------------------------------------
create or replace function public.refresh_venue_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.venue_id, old.venue_id);
begin
  update public.venues v
     set rating = sub.avg_rating,
         rating_count = sub.n
    from (
      select round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as n
        from public.venue_reviews
       where venue_id = target
    ) sub
   where v.id = target;

  -- No reviews left: back to unrated, not to zero stars.
  update public.venues
     set rating = null
   where id = target and rating_count = 0;

  return null;
end;
$$;

drop trigger if exists refresh_venue_rating_trg on public.venue_reviews;
create trigger refresh_venue_rating_trg
  after insert or update or delete on public.venue_reviews
  for each row execute function public.refresh_venue_rating();


-- ==========================================================================
-- migration-drivers.sql
-- Driver onboarding — /drive and the admin review queue need this
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — driver onboarding (Bolt/Uber style)
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

create table if not exists public.drivers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,

  -- Who they are
  full_name         text not null,
  phone             text not null,
  photo_url         text,              -- face photo, shown to riders
  id_type           text,              -- NIN / Driver's Licence / Voter's Card / Passport
  id_number         text,
  id_document_url   text,              -- scan/photo of the ID — NEVER shown to riders
  licence_expiry    date,

  -- What they drive
  vehicle_make      text,
  vehicle_model     text,
  vehicle_colour    text,
  vehicle_year      int,
  plate_number      text,
  vehicle_photo_url text,
  seats             int not null default 4,

  -- Where
  state             text,
  city              text,

  -- Review
  status            text not null default 'pending'
                    check (status in ('pending','approved','rejected','suspended')),
  admin_notes       text,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.users(id) on delete set null,

  rating            numeric(2,1),
  trips_completed   int not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists drivers_status_idx on public.drivers (status, created_at desc);
create index if not exists drivers_state_idx  on public.drivers (state) where status = 'approved';

-- A plate belongs to one driver.
create unique index if not exists drivers_plate_uniq
  on public.drivers (upper(replace(plate_number, ' ', '')))
  where plate_number is not null;

alter table public.drivers enable row level security;

-- Riders may see APPROVED drivers only, and only the safe columns — the ID
-- number and ID document must never reach a rider. Exposed through a view
-- rather than a policy, because a policy filters rows, not columns.
drop policy if exists "Drivers read own record" on public.drivers;
create policy "Drivers read own record"
  on public.drivers for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users create their own driver application" on public.drivers;
create policy "Users create their own driver application"
  on public.drivers for insert
  with check (user_id = auth.uid());

-- An applicant may edit their own details, but must not be able to approve
-- themselves — status changes are admin-only, enforced by the trigger below.
drop policy if exists "Drivers update own record" on public.drivers;
create policy "Drivers update own record"
  on public.drivers for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins delete drivers" on public.drivers;
create policy "Admins delete drivers"
  on public.drivers for delete
  using (public.is_admin());

create or replace function public.guard_driver_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only an admin can change a driver''s status.'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_driver_status_trg on public.drivers;
create trigger guard_driver_status_trg
  before update on public.drivers
  for each row execute function public.guard_driver_status();

-- What a rider is allowed to see about an approved driver.
create or replace view public.public_drivers as
  select id, user_id, full_name, photo_url,
         vehicle_make, vehicle_model, vehicle_colour, vehicle_year,
         plate_number, vehicle_photo_url, seats, state, city,
         rating, trips_completed
    from public.drivers
   where status = 'approved';

-- ----------------------------------------------------------------------------
-- Documents. Private bucket: these are government IDs, not avatars.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('driver-docs', 'driver-docs', false)
on conflict (id) do nothing;

drop policy if exists "Drivers upload own documents" on storage.objects;
create policy "Drivers upload own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Drivers read own documents" on storage.objects;
create policy "Drivers read own documents"
  on storage.objects for select
  using (
    bucket_id = 'driver-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "Drivers replace own documents" on storage.objects;
create policy "Drivers replace own documents"
  on storage.objects for update
  using (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Face and vehicle photos are shown to riders, so they live in a public
-- bucket, separate from the ID documents above.
insert into storage.buckets (id, name, public)
values ('driver-photos', 'driver-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read driver photos" on storage.objects;
create policy "Public read driver photos"
  on storage.objects for select
  using (bucket_id = 'driver-photos');

drop policy if exists "Drivers upload own photos" on storage.objects;
create policy "Drivers upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'driver-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Drivers replace own photos" on storage.objects;
create policy "Drivers replace own photos"
  on storage.objects for update
  using (
    bucket_id = 'driver-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ==========================================================================
-- migration-driver-ratings.sql
-- Driver ratings + leaderboard (needs migration-drivers.sql first)
-- ==========================================================================
-- ============================================================================
-- LinkUpNaija — riders rate drivers
-- Run AFTER migration-drivers.sql.
-- Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- Mirrors how hosts are rated: a rating is earned by a completed trip, one
-- per ride, and the driver's average is maintained by a trigger rather than
-- computed on every read.
-- ============================================================================

alter table public.ride_requests
  add column if not exists driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists completed_at timestamptz;

create index if not exists ride_requests_driver_idx
  on public.ride_requests (driver_id);

create table if not exists public.driver_ratings (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  rider_id    uuid not null references public.users(id) on delete cascade,
  ride_id     uuid references public.ride_requests(id) on delete set null,
  rating      int  not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  -- One rating per ride. Without this a single rider could move a driver's
  -- average on their own, which is the whole game with reputation scores.
  unique (rider_id, ride_id)
);

create index if not exists driver_ratings_driver_idx
  on public.driver_ratings (driver_id, created_at desc);

alter table public.driver_ratings enable row level security;

drop policy if exists "Anyone can read driver ratings" on public.driver_ratings;
create policy "Anyone can read driver ratings"
  on public.driver_ratings for select
  using (true);

-- Only the rider on a completed ride with this driver may rate it.
drop policy if exists "Riders rate their completed rides" on public.driver_ratings;
create policy "Riders rate their completed rides"
  on public.driver_ratings for insert
  with check (
    auth.uid() = rider_id
    and exists (
      select 1 from public.ride_requests r
       where r.id = driver_ratings.ride_id
         and r.user_id = auth.uid()
         and r.driver_id = driver_ratings.driver_id
         and r.completed_at is not null
    )
  );

drop policy if exists "Riders edit their own rating" on public.driver_ratings;
create policy "Riders edit their own rating"
  on public.driver_ratings for update
  using (auth.uid() = rider_id)
  with check (auth.uid() = rider_id);

drop policy if exists "Riders delete their own rating" on public.driver_ratings;
create policy "Riders delete their own rating"
  on public.driver_ratings for delete
  using (auth.uid() = rider_id);

-- ----------------------------------------------------------------------------
-- Keep drivers.rating / trips_completed in step.
-- ----------------------------------------------------------------------------
create or replace function public.refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.driver_id, old.driver_id);
  n      int;
begin
  select count(*) into n from public.driver_ratings where driver_id = target;

  update public.drivers d
     set rating = case
                    when n = 0 then null   -- unrated, not zero stars
                    else (select round(avg(rating)::numeric, 1)
                            from public.driver_ratings
                           where driver_id = target)
                  end
   where d.id = target;

  return null;
end;
$$;

drop trigger if exists refresh_driver_rating_trg on public.driver_ratings;
create trigger refresh_driver_rating_trg
  after insert or update or delete on public.driver_ratings
  for each row execute function public.refresh_driver_rating();

-- Completed trips are counted from the rides themselves, so the number can't
-- be inflated by rating activity.
create or replace function public.bump_driver_trips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null
     and old.completed_at is null
     and new.driver_id is not null then
    update public.drivers
       set trips_completed = trips_completed + 1
     where id = new.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bump_driver_trips_trg on public.ride_requests;
create trigger bump_driver_trips_trg
  after update on public.ride_requests
  for each row execute function public.bump_driver_trips();

-- Leaderboard reads: best-rated approved drivers first.
create index if not exists drivers_leaderboard_idx
  on public.drivers (rating desc nulls last, trips_completed desc)
  where status = 'approved';
