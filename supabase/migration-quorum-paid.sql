-- Paid events can have a quorum, because no money moves until the room fills.
--
-- Replaces the free-events-only rule from migration-quorum.sql. That rule
-- existed because a guest paid at request time, so a room that never filled
-- left us holding cash with no refund pipeline. This removes the reason
-- rather than working around it: on a paid event with a minimum, you reserve
-- for free, and you are only asked for money once the event is confirmed.
--
-- No refunds are ever needed, because nothing is ever collected for an event
-- that doesn't happen.
--
-- Run migration-quorum.sql first. Safe to run twice.

-- The free-only guard is now wrong, not just unnecessary.
alter table public.events
  drop constraint if exists events_quorum_free_only;

-- How long guests get to pay once the room fills. Short enough that a
-- confirmed event isn't held hostage by someone who has stopped reading their
-- notifications, long enough to survive a night's sleep and a payday.
alter table public.events
  add column if not exists payment_window_hours int not null default 48
    check (payment_window_hours between 6 and 168);

comment on column public.events.payment_window_hours is
  'Hours a reserved guest has to pay after quorum is met. Paid quorum events only.';

-- ------------------------------------------------------------------ rsvps --
-- Two new states:
--   reserved — said yes, owes nothing yet, does not hold a ticket
--   expired  — the payment window closed unpaid; the spot went back
--
-- 'reserved' counts toward quorum. That is the entire point: a reservation is
-- a real commitment to attend, it just isn't a payment yet.
alter table public.rsvps
  drop constraint if exists rsvps_status_check;
alter table public.rsvps
  add constraint rsvps_status_check
  check (status in ('pending', 'accepted', 'declined', 'reserved', 'expired'));

alter table public.rsvps
  add column if not exists payment_due_at timestamptz;
alter table public.rsvps
  add column if not exists paid_at timestamptz;

comment on column public.rsvps.payment_due_at is
  'Set when quorum is met. After this, an unpaid reservation expires.';

create index if not exists rsvps_payment_due_idx
  on public.rsvps (payment_due_at)
  where status = 'reserved';

-- ---------------------------------------------------------------- trigger --
-- Counts reservations toward quorum, and starts everyone's payment clock at
-- the same moment the room fills.
create or replace function public.check_event_quorum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  committed_count int;
begin
  select id, min_attendees, quorum_met_at, price, payment_window_hours
    into ev
    from public.events
   where id = new.event_id
   for update;   -- serialises concurrent joins on the same event

  if ev.min_attendees is null or ev.quorum_met_at is not null then
    return new;
  end if;

  -- A reservation is a commitment to attend; on a free event an acceptance is
  -- the same thing. Both fill the room.
  select count(*) into committed_count
    from public.rsvps
   where event_id = new.event_id
     and status in ('accepted', 'reserved');

  if committed_count >= ev.min_attendees then
    update public.events
       set quorum_met_at = now()
     where id = new.event_id
       and quorum_met_at is null;

    -- Everyone's clock starts together, so nobody is asked to pay for an
    -- event that might still fall through, and nobody gets a shorter window
    -- than anyone else for having joined later.
    if ev.price > 0 then
      update public.rsvps
         set payment_due_at =
               now() + make_interval(hours => coalesce(ev.payment_window_hours, 48))
       where event_id = new.event_id
         and status = 'reserved'
         and payment_due_at is null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rsvps_check_quorum on public.rsvps;
create trigger rsvps_check_quorum
  after insert or update of status on public.rsvps
  for each row
  when (new.status in ('accepted', 'reserved'))
  execute function public.check_event_quorum();

-- ---------------------------------------------------------------- expiry --
-- Releases spots whose payment window has closed. Called on a schedule; also
-- safe to call by hand.
--
-- Deliberately a function rather than a trigger: expiry is driven by the
-- clock, and nothing writes to the row at the moment it lapses.
create or replace function public.expire_unpaid_reservations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.rsvps
     set status = 'expired'
   where status = 'reserved'
     and payment_due_at is not null
     and payment_due_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_unpaid_reservations() from public, anon, authenticated;

-- --------------------------------------------------------------------- RLS --
-- A guest reserving their own spot, and marking it paid. The host still
-- approves; reserving is not the same as being let in.
drop policy if exists "reserve own spot" on public.rsvps;
create policy "reserve own spot" on public.rsvps
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('reserved', 'accepted'));
