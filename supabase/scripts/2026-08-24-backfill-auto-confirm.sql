-- ============================================================================
-- ONE-TIME BACKFILL — not a schema change, not part of the migration chain.
--
-- Sets auto_confirm = true on free events created before the RSVP flow
-- update, so they behave like events created after it.
--
-- Run the DRY RUN first. It changes nothing and shows you exactly which
-- events and which hosts are affected.
--
-- What this does NOT touch:
--   · paid events — payment is already the gate there
--   · anything created on or after the cutoff — those hosts saw the toggle
--     and made a choice, and overriding a deliberate "no" is worse than
--     never asking
--   · RSVPs already sitting pending — the trigger only promotes new inserts,
--     so a host mid-way through approving a queue keeps that queue
-- ============================================================================

-- The day the join sheet and the instant-join toggle shipped.
\set cutoff '2026-08-24'


-- ---------------------------------------------------------------- DRY RUN --
-- Read this before running anything below it.

select
  e.id,
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
  and e.created_at < :'cutoff'::date
  and e.auto_confirm is not true
  and e.date >= current_date
order by u.name, e.date;

-- How many hosts is this, and have they been told?
select count(distinct e.host_id) as hosts_affected,
       count(*)                  as events_affected
from public.events e
where e.event_type = 'general'
  and coalesce(e.price, 0) = 0
  and e.created_at < :'cutoff'::date
  and e.auto_confirm is not true
  and e.date >= current_date;


-- ------------------------------------------------------------------ APPLY --
-- Uncomment to run. Everything above stays true of it.

-- begin;
--
-- update public.events e
--    set auto_confirm = true
--  where e.event_type = 'general'
--    and coalesce(e.price, 0) = 0
--    and e.created_at < :'cutoff'::date
--    and e.auto_confirm is not true
--    -- Upcoming only. A past event's approval setting changes nothing except
--    -- the record of how it was run.
--    and e.date >= current_date
--  returning e.id, e.title;
--
-- -- Check the count matches the dry run before committing.
-- commit;


-- ------------------------------------------------------------------ UNDO --
-- If it turns out a host wanted to vet their room after all. Bounded to the
-- same set, so it can't clear a host's own deliberate choice made afterwards.
--
-- update public.events e
--    set auto_confirm = false
--  where e.event_type = 'general'
--    and coalesce(e.price, 0) = 0
--    and e.created_at < '2026-08-24'::date
--    and e.date >= current_date;
