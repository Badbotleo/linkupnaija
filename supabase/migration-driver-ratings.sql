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
