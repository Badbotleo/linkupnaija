-- Data cleanup for the retention fixes. Run in the Supabase SQL editor.
--
-- This file touches ROWS ONLY — no schema changes, no new columns, no new
-- constraints. A proposed unique index is at the bottom, commented out, for
-- you to decide on separately.
--
-- Every destructive statement is guarded so it cannot do more than intended,
-- and each section ends with a SELECT so you can see what happened.

begin;

-- ---------------------------------------------------------------------------
-- 1. Duplicate listings
-- ---------------------------------------------------------------------------
-- Two groups exist, both genuine duplicate rows (identical title, date, time,
-- venue, price, host — not a rendering artefact):
--
--   "Cocktails and Chow Festival 2.0"    2 rows, created 15 minutes apart
--   "African SDGs Film Festival 2026"    3 rows, created ~4 minutes apart
--
-- Both look like a host submitting the form more than once. We keep the
-- oldest row of each group and delete the rest.
--
-- The NOT EXISTS clause is the safety catch: if anybody has since joined one
-- of these rows, the delete silently skips it rather than destroying their
-- RSVP. (At the time of writing all three had zero RSVPs, but the guard costs
-- nothing and this file may be run later.)

delete from public.events e
where e.id in (
  'e0960214-0dad-43f1-a327-dd694d863dd9',  -- dup of eac04039… (Cocktails)
  'aebf366e-c5c4-4221-b621-325a277cef21',  -- dup of f4cad129… (SDGs)
  '11bf5294-1919-4205-acfe-6c7ce6f1db26'   -- dup of f4cad129… (SDGs)
)
and not exists (select 1 from public.rsvps r where r.event_id = e.id);

-- Anything still listed here was NOT deleted because someone had joined it.
select id, title, date,
       (select count(*) from public.rsvps r where r.event_id = e.id) as rsvps
from public.events e
where e.id in (
  'e0960214-0dad-43f1-a327-dd694d863dd9',
  'aebf366e-c5c4-4221-b621-325a277cef21',
  '11bf5294-1919-4205-acfe-6c7ce6f1db26'
);

-- ---------------------------------------------------------------------------
-- 2. Descriptions pasted into the location field
-- ---------------------------------------------------------------------------
-- Two events had their whole description in `location`, so the venue line on
-- the card rendered a paragraph. The text is preserved into `description`
-- first (only where it isn't already there) so nothing is lost.

-- 2a. AFRICA - DUBAI HOME EXPO, ABUJA 2026 — 474 characters.
-- The venue is named in that text: "all under one roof at Sandralia Hotel by
-- Whitestone". That is the host's own wording, not a guess on our part.
update public.events
set description = case
      when description is null or description = '' then location
      when position(location in description) > 0 then description
      else description || E'\n\n' || location
    end,
    location = 'Sandralia Hotel by Whitestone, Abuja'
where id = '40c9b206-3c59-4586-9a2a-a03842f42368'
  and length(location) > 160;

-- 2b. GITEX AI NIGERIA 2026 — 485 characters.
-- This one names no venue anywhere in its text, so there is nothing to
-- recover it from and we are NOT inventing one. The text is moved into the
-- description and the location is set to the city, which is true and is the
-- least we can say. >>> Replace with the real venue when you know it. <<<
update public.events
set description = case
      when description is null or description = '' then location
      when position(location in description) > 0 then description
      else description || E'\n\n' || location
    end,
    location = 'Abuja — venue to be announced'
where id = '2548f4eb-ca3d-4807-b004-c1688b1677ab'
  and length(location) > 160;

-- Should return zero rows.
select id, title, length(location) as location_length
from public.events
where length(location) > 160;

-- ---------------------------------------------------------------------------
-- 3. Placeholder "Things to do" cards
-- ---------------------------------------------------------------------------
-- All 26 rows in things_to_do were saved with '.' as the title (and mostly
-- '.' as the place too). Curated cards outrank venue-derived ones, so these
-- were both blank themselves AND crowding the real ideas off the shelf.
--
-- Deactivated rather than deleted: the category, state and any uploaded media
-- are still attached, so you can retitle and re-enable any that were meant to
-- be something. The app now filters them out either way.

update public.things_to_do
set is_active = false,
    updated_at = now()
where is_active = true
  and (
    title is null
    or btrim(title) = ''
    -- only punctuation and whitespace, i.e. no real content
    or btrim(title) ~ '^[[:punct:][:space:]]+$'
  );

select count(*) filter (where is_active) as still_active,
       count(*) filter (where not is_active) as deactivated,
       count(*) as total
from public.things_to_do;

commit;

-- ---------------------------------------------------------------------------
-- PROPOSED SCHEMA CHANGE — NOT APPLIED. Decide separately.
-- ---------------------------------------------------------------------------
-- The host form now refuses a second identical submission, which covers the
-- normal path. A unique index would also cover imports, scripts and any
-- future write path that skips the form.
--
-- Two things to weigh before running it:
--   * It would permanently block a host legitimately re-listing the same
--     title at the same venue on the same date (rare, but possible for a
--     morning and evening sitting of the same thing — though those differ by
--     `time`, which this index ignores).
--   * It fails to create while duplicates remain, so section 1 must run first.
--
-- create unique index concurrently events_no_duplicate_listing
--   on public.events (host_id, date, lower(btrim(title)), lower(btrim(location)));
