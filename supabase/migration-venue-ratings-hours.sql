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
