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
