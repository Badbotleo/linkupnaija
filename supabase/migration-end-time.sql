-- Events get an end time.
--
-- Every listing said when it started and nothing about when it finished, so
-- "9:00 PM" left a guest guessing whether that meant two hours or all night.
-- It's the first thing anyone asks about a party and the first thing a host
-- puts on their flyer.
--
-- Nullable: plenty of hangouts genuinely end when they end, and forcing a
-- guess is worse than saying nothing. Existing events keep working untouched.
--
-- Safe to run twice.

alter table public.events
  add column if not exists end_time time;

comment on column public.events.end_time is
  'Optional. NULL means the host did not say — the card shows only a start.';

-- No constraint that end_time > time.
--
-- A party starting 10:00 PM and ending 4:00 AM is the normal case here, not
-- an error, and a naive check would reject exactly the events this platform
-- exists for. Overnight is inferred at render time instead: an end earlier
-- than the start means the next morning.
