-- A host can let anyone join their free event instantly.
--
-- Default false, so nothing changes unless a host asks for it. "The host
-- approves every guest" is the promise the home page, the event page, the
-- demo and the Instagram cards are all built on — it stays true everywhere a
-- host hasn't deliberately turned it off.
--
-- Free events only. On a paid event the payment is already the gate, and
-- "instant" there would mean letting somebody in before they've paid.
--
-- Safe to run twice.

alter table public.events
  add column if not exists auto_confirm boolean not null default false;

comment on column public.events.auto_confirm is
  'Host let anyone join instantly. Free events only — enforced by trigger, not trust.';

-- ------------------------------------------------------------------ RLS ---
-- Two fixes in one, because they're the same policy.
--
-- 1. The insert policy allowed only status = 'pending'. RsvpButton has been
--    inserting 'reserved' for quorum events since migration-quorum-paid, so
--    every reserve-first join was being rejected — silently, because a
--    policy failure returns no rows rather than an error the client shows.
--
-- 2. It still must not allow 'accepted'. A guest who could insert that would
--    approve themselves, which is the whole promise gone. Auto-confirm is
--    applied by the trigger below, server-side, where the guest can't reach
--    it.
drop policy if exists "Users can request to join" on public.rsvps;
create policy "Users can request to join"
  on public.rsvps for insert
  with check (
    auth.uid() = user_id
    and status in ('pending', 'reserved')
  );

-- -------------------------------------------------------------- trigger ---
-- Promotes a request the moment it lands, when the host has said to.
--
-- In the database rather than the client for two reasons: the guest inserts
-- 'pending' and RLS keeps it that way, so nobody can approve themselves by
-- editing a request; and the free-only rule is checked against the event's
-- real price rather than whatever the browser believed it was.
create or replace function public.apply_auto_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select auto_confirm, price, max_attendees
    into ev
    from public.events
   where id = new.event_id;

  if ev.auto_confirm is not true or coalesce(ev.price, 0) > 0 then
    return new;
  end if;

  -- A full room still says no. Auto-confirm is the host skipping the
  -- approval, not the host abandoning their capacity.
  if ev.max_attendees is not null then
    if (
      select count(*) from public.rsvps r
       where r.event_id = new.event_id and r.status = 'accepted'
    ) >= ev.max_attendees then
      return new;
    end if;
  end if;

  new.status := 'accepted';
  return new;
end;
$$;

drop trigger if exists rsvps_auto_confirm on public.rsvps;
create trigger rsvps_auto_confirm
  before insert on public.rsvps
  for each row execute function public.apply_auto_confirm();
