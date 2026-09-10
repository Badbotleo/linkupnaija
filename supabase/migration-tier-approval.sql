-- Approval per ticket type, and the chat that comes with it.
--
-- auto_confirm is one flag on the event, so a room is either all instant or
-- all by hand. That was fine while every tier was a thing you bought. It is
-- not fine now that a tier can be a thing you ask for: the trade fair link-up
-- wants anyone to walk in, and wants the four vendor tables held back for a
-- person to say yes to. One flag cannot say both.
--
-- So approval moves to the tier, with the event flag as the default. A tier
-- marked requires_approval stays pending no matter what the event says. A
-- tier that is not marked follows the event, exactly as before.
--
-- AND THE CHAT. grant_chat_on_manual_accept deliberately leaves chat_approved
-- alone on the auto-confirm path, with a good reason in its comment: nobody
-- looked, so the host still has a decision about the room. That is the right
-- default and it stays the default. But a host running an open link-up wants
-- the group chat to be the point, not a second queue they have to clear, so
-- auto_chat lets them say so once. Off unless asked for, so no existing event
-- changes behaviour.
--
-- Safe to run twice.


-- ------------------------------------------------------------- the columns --
alter table public.ticket_tiers
  add column if not exists requires_approval boolean not null default false;

comment on column public.ticket_tiers.requires_approval is
  'Hold this tier for the host to approve, even on an auto-confirm event. For limited things somebody has to allocate, like a vendor table.';

alter table public.events
  add column if not exists auto_chat boolean not null default false;

comment on column public.events.auto_chat is
  'Auto-confirmed guests also get the group chat. Off by default: auto-confirm means nobody looked, so the chat stays a separate decision unless the host opts in.';


-- ---------------------------------------------------------------- the gate --
-- Replaces the function from migration-auto-confirm.sql. Same trigger, same
-- name, two new questions asked before it says yes.
create or replace function public.apply_auto_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev       record;
  needs_ok boolean := false;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  -- The tier decides first. A vendor table on an otherwise open event is
  -- still a request, because somebody has to allocate it.
  if new.tier_id is not null then
    select requires_approval into needs_ok
      from public.ticket_tiers
     where id = new.tier_id;

    if coalesce(needs_ok, false) then
      return new;
    end if;
  end if;

  select auto_confirm, auto_chat, price, max_attendees
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

  -- Only where the host asked for it. The manual-accept trigger still owns
  -- the ordinary path, and it is untouched.
  if ev.auto_chat is true then
    new.chat_approved := true;
  end if;

  return new;
end;
$$;

drop trigger if exists rsvps_auto_confirm on public.rsvps;
create trigger rsvps_auto_confirm
  before insert on public.rsvps
  for each row execute function public.apply_auto_confirm();


-- ------------------------------------------------------------ where we are --
-- Every tier that holds itself back, and every event that opens its chat.

select e.title, t.name as tier, t.quantity, t.requires_approval
  from public.ticket_tiers t
  join public.events e on e.id = t.event_id
 where t.requires_approval
 order by e.date desc;

select title, date, auto_confirm, auto_chat
  from public.events
 where auto_chat
 order by date desc;
