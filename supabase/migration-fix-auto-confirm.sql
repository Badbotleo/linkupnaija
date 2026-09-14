-- Nobody has ever been able to join an instant-join event.
--
-- The symptom, in red, on the event page:
--
--   new row violates row-level security policy for table "rsvps"
--
-- The cause is an argument between a trigger and a policy, and both of them
-- are individually correct.
--
--   apply_auto_confirm is a BEFORE INSERT trigger that sets
--     new.status := 'accepted'
--
--   the insert policy is
--     with check (auth.uid() = user_id and status in ('pending','reserved'))
--
-- Postgres applies the WITH CHECK to the row AS IT WILL BE STORED, which is
-- to say AFTER before-triggers have rewritten it. So the trigger promotes the
-- row to 'accepted' and the policy then refuses the very thing the trigger
-- just produced. The guest sees a security error for pressing a button that
-- says "you're in straight away".
--
-- MEASURED, not guessed. Six events carry auto_confirm = true, the oldest
-- from 29 August, and every one of them has received exactly ZERO joins. Not
-- one person has got through since the feature shipped.
--
-- THE FIX IS TO PROMOTE AFTER THE ROW EXISTS. An AFTER INSERT trigger updates
-- a row that has already passed the policy, and the function is security
-- definer so the update is not re-checked against the guest's own permissions.
-- The alternative, widening the policy to admit 'accepted', would let a guest
-- insert themselves as accepted directly, and reproducing the trigger's
-- capacity check inside a policy means a subquery on rsvps from within an
-- rsvps policy, which is how recursive policy evaluation starts.
--
-- Safe to run twice.


-- --------------------------------------------------------------- the promo --
create or replace function public.apply_auto_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev       record;
  needs_ok boolean := false;
  seated   int;
begin
  -- Only an ordinary request is promoted. A reservation on a quorum event is
  -- doing something else, and a row already accepted has nothing to do.
  if new.status is distinct from 'pending' then
    return null;
  end if;

  -- The tier decides first. A vendor table on an otherwise open event is
  -- still a request, because somebody has to allocate it.
  if new.tier_id is not null then
    select requires_approval into needs_ok
      from public.ticket_tiers
     where id = new.tier_id;

    if coalesce(needs_ok, false) then
      return null;
    end if;
  end if;

  select auto_confirm, auto_chat, price, max_attendees
    into ev
    from public.events
   where id = new.event_id;

  if ev.auto_confirm is not true or coalesce(ev.price, 0) > 0 then
    return null;
  end if;

  -- A full room still says no. Auto-confirm is the host skipping the
  -- approval, not the host abandoning their capacity. Counted excluding this
  -- row, which now exists: in the old BEFORE trigger it did not.
  if ev.max_attendees is not null then
    select count(*) into seated
      from public.rsvps r
     where r.event_id = new.event_id
       and r.status = 'accepted'
       and r.id <> new.id;
    if seated >= ev.max_attendees then
      return null;
    end if;
  end if;

  update public.rsvps
     set status = 'accepted'
   where id = new.id;

  -- grant_chat_on_manual_accept fires on that update and grants the chat,
  -- which is right for a host who looked at somebody and wrong here, where
  -- nobody looked. Taking it back needs its own statement: that trigger is
  -- declared UPDATE OF status and fires whenever status is a target, whatever
  -- the value, so folding this into the statement above would not help.
  if not coalesce(ev.auto_chat, false) then
    update public.rsvps
       set chat_approved = false
     where id = new.id;
  end if;

  return null;
end;
$$;

drop trigger if exists rsvps_auto_confirm on public.rsvps;
create trigger rsvps_auto_confirm
  after insert on public.rsvps
  for each row execute function public.apply_auto_confirm();


-- ------------------------------------------------------------ where we are --
-- The trigger should now read AFTER, not BEFORE. Anything else and the join
-- button is still broken.
select
  t.tgname                                as trigger,
  case when (t.tgtype::int & 2) = 2 then 'BEFORE' else 'AFTER' end as timing
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'rsvps'
  and t.tgname = 'rsvps_auto_confirm';

-- And the events this was silently breaking. They should start taking joins
-- the moment this runs.
select title, date, max_attendees
  from public.events
 where auto_confirm is true
   and date >= current_date
 order by date;
