-- ============================================================================
-- ONE-TIME BACKFILL — not a schema change, not part of the migration chain.
--
-- Sets auto_confirm = true on free events created before the RSVP flow
-- update, so they behave like events created after it.
--
-- Plain SQL. An earlier version used \set and :'cutoff', which are psql
-- meta-commands — the Supabase SQL editor is a plain statement runner and
-- rejects them. The date is written out in each statement instead.
--
-- Run STEP 1 first. It changes nothing.
--
-- What this does NOT touch:
--   · paid events — payment is already the gate there
--   · anything created on or after the cutoff — those hosts saw the toggle
--     and made a choice, and overriding a deliberate "no" is worse than
--     never asking
--   · past events — their setting changes nothing except the record
--   · RSVPs already pending — the trigger only promotes new inserts, so a
--     host part-way through a queue keeps it
-- ============================================================================


-- ------------------------------------------------------- STEP 1: DRY RUN ---
-- Read this before running anything below it.

select
  e.title,
  e.category,
  e.date,
  coalesce(u.name, '(unknown host)') as host,
  (select count(*) from public.rsvps r
    where r.event_id = e.id and r.status = 'pending') as pending_requests
from public.events e
left join public.users u on u.id = e.host_id
where e.event_type = 'general'
  and coalesce(e.price, 0) = 0
  and e.created_at < date '2026-08-24'
  and e.auto_confirm is not true
  and e.date >= current_date
order by u.name, e.date;


-- --------------------------------------------------- STEP 2: THE TOTALS ---
-- How many events, and how many people's events are they?

select
  count(*)                    as events_affected,
  count(distinct e.host_id)   as hosts_affected
from public.events e
where e.event_type = 'general'
  and coalesce(e.price, 0) = 0
  and e.created_at < date '2026-08-24'
  and e.auto_confirm is not true
  and e.date >= current_date;


-- ---------------------------------------------------------- STEP 3: APPLY --
-- Uncomment the block below and run it once the two above look right.
-- The returning clause prints exactly what changed.

/*
update public.events e
   set auto_confirm = true
 where e.event_type = 'general'
   and coalesce(e.price, 0) = 0
   and e.created_at < date '2026-08-24'
   and e.auto_confirm is not true
   and e.date >= current_date
returning e.id, e.title;
*/


-- ------------------------------------------------------------ STEP 4: UNDO --
-- If a host turns out to have wanted to vet their room after all. Bounded to
-- the same set, so it can't clear a choice a host makes afterwards.

/*
update public.events e
   set auto_confirm = false
 where e.event_type = 'general'
   and coalesce(e.price, 0) = 0
   and e.created_at < date '2026-08-24'
   and e.date >= current_date
returning e.id, e.title;
*/
