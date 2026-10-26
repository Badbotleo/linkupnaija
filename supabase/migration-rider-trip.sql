-- ============================================================================
-- LinkUpNaija — let the rider see who is collecting them, and rate them after
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- Everything this needs already existed: ride_requests.driver_id and
-- completed_at, the driver_ratings table with its one-rating-per-ride
-- constraint, and the public_drivers view that exposes the safe columns and
-- withholds the ID number and document. None of it had reached a screen, so
-- in four months not one rating has ever been recorded.
--
-- The only thing missing at the database level is permission to read that
-- view. Supabase's defaults usually cover it; stating it means the rider's
-- screen cannot be one project setting away from showing an empty card where
-- the driver's face should be.
-- ============================================================================

grant select on public.public_drivers to authenticated;

-- A rider rates a trip they took. The insert policy in migration-driver-ratings
-- already requires the ride to be theirs, to name this driver, and to be
-- completed. What was missing is the ability to read their own rating back, so
-- the screen can tell "not rated yet" from "already rated" instead of offering
-- the stars again and failing on the unique constraint.
drop policy if exists "Anyone can read driver ratings" on public.driver_ratings;
create policy "Anyone can read driver ratings"
  on public.driver_ratings for select
  using (true);

-- A driver's score, kept on the driver row so a rider does not have to
-- aggregate ratings on the client to see one number.
create or replace function public.refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := coalesce(new.driver_id, old.driver_id);
begin
  update public.drivers d
     set rating = (
           select round(avg(r.rating)::numeric, 1)
             from public.driver_ratings r
            where r.driver_id = v_driver
         )
   where d.id = v_driver;
  return null;
end;
$$;

drop trigger if exists driver_rating_rollup on public.driver_ratings;
create trigger driver_rating_rollup
  after insert or update or delete on public.driver_ratings
  for each row execute function public.refresh_driver_rating();
