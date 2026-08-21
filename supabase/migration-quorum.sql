-- "Nobody goes alone": an event can require a minimum number of guests
-- before it's confirmed.
--
-- The median room on this platform has one person in it. This moves the
-- social risk of being that one person off the individual — you're in if
-- enough others are, and if it never fills it quietly expires.
--
-- Optional per event. NULL means the event behaves exactly as it does today.
-- Safe to run twice.

alter table public.events
  add column if not exists min_attendees int
    check (min_attendees is null or min_attendees between 2 and 500);

-- Recorded the first time the threshold is reached, and never cleared.
-- Once a room has filled, people have arranged their evening around it; one
-- person dropping out must not un-confirm everybody else.
alter table public.events
  add column if not exists quorum_met_at timestamptz;

comment on column public.events.min_attendees is
  'Minimum accepted guests before the event is confirmed. NULL = no quorum.';
comment on column public.events.quorum_met_at is
  'Set once min_attendees was first reached. Never cleared — quorum is sticky.';

-- Stamp quorum_met_at the moment an accepted RSVP takes a room over its
-- threshold.
--
-- In the database rather than the app because the count has to be read and
-- the stamp written without another request slipping in between. Doing it
-- client-side would let two people accepting at once both read "one short"
-- and neither trigger it.
create or replace function public.check_event_quorum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  accepted_count int;
begin
  select id, min_attendees, quorum_met_at
    into ev
    from public.events
   where id = new.event_id
   for update;   -- serialises concurrent accepts on the same event

  if ev.min_attendees is null or ev.quorum_met_at is not null then
    return new;
  end if;

  select count(*) into accepted_count
    from public.rsvps
   where event_id = new.event_id
     and status = 'accepted';

  if accepted_count >= ev.min_attendees then
    update public.events
       set quorum_met_at = now()
     where id = new.event_id
       and quorum_met_at is null;  -- belt and braces against a double stamp
  end if;

  return new;
end;
$$;

-- Fires on insert and on the update that flips a request to accepted, since
-- most guests arrive by a host approving a pending row rather than by a fresh
-- insert.
drop trigger if exists rsvps_check_quorum on public.rsvps;
create trigger rsvps_check_quorum
  after insert or update of status on public.rsvps
  for each row
  when (new.status = 'accepted')
  execute function public.check_event_quorum();

-- Backfill: events already at or over a threshold they never had are
-- confirmed as of now, not silently left pending. No-op today because no
-- event has a minimum yet — it exists so re-running after hosts start
-- setting minimums stays correct.
update public.events e
   set quorum_met_at = now()
 where e.min_attendees is not null
   and e.quorum_met_at is null
   and (
     select count(*) from public.rsvps r
      where r.event_id = e.id and r.status = 'accepted'
   ) >= e.min_attendees;
