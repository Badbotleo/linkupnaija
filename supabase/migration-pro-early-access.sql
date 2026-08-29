-- Pro members can ask to join before requests open to everyone.
--
-- Host-controlled, and null by default, so nothing changes on the 100-odd
-- events that already exist. That default is the important part: making every
-- new event Pro-only for its first day would hide the freshest listings from
-- almost everybody, which is the opposite of what a platform with four events
-- per RSVP needs.
--
-- It only earns its keep on an event that fills. When a host sets a moment for
-- requests to open, Pro members get in 24 hours before it — which is a real
-- perk precisely because a spot at that event is scarce. On everything else
-- the column stays null and the button behaves exactly as it does today.
--
-- Safe to run twice.

alter table public.events
  add column if not exists requests_open_at timestamptz;

comment on column public.events.requests_open_at is
  'When join requests open to everyone. Pro members may request 24h earlier. Null means open now.';

-- The gate is enforced in the database, not only in the button.
--
-- rsvps insert is granted to authenticated and the client builds its own row,
-- so a check that lives only in RsvpButton is a suggestion. Anybody could post
-- an insert straight past it and take a spot the host meant to hold.
create or replace function public.enforce_request_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opens_at timestamptz;
  is_pro_now boolean;
begin
  select e.requests_open_at into opens_at
    from public.events e
   where e.id = new.event_id;

  -- No window set: behaves as it always has.
  if opens_at is null or now() >= opens_at then
    return new;
  end if;

  select coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    into is_pro_now
    from public.users u
   where u.id = new.user_id;

  -- The whole perk, in one line: Pro gets the 24 hours before opening.
  if is_pro_now and now() >= opens_at - interval '24 hours' then
    return new;
  end if;

  raise exception 'Requests for this link-up open %', to_char(opens_at at time zone 'Africa/Lagos', 'DD Mon at HH12:MIam');
end;
$$;

drop trigger if exists rsvps_request_window on public.rsvps;
create trigger rsvps_request_window
  before insert on public.rsvps
  for each row execute function public.enforce_request_window();


-- ------------------------------------------------------------ where we are --
-- Run after. Changes nothing. Should be 0 until a host sets one.

select count(*) filter (where requests_open_at is not null) as events_with_a_window,
       count(*)                                             as events_total
  from public.events;
