-- Stop selling a ticket tier that is gone.
--
-- On 8 Sep 2026 two people bought early bird at N7,000 each. By the time the
-- real tickets were bought from the organiser, early bird had sold out, so
-- they cost N10,000 each and LinkUpNaija covered the N6,000 gap. That is the
-- whole reason this file exists.
--
-- ticket_tiers has had a `quantity` column since the day it was created and
-- NOTHING HAS EVER READ IT. Not the app, not the database. A tier capped at
-- twenty would happily sell two hundred. The cap was a note to the host.
--
-- Two ways a tier runs out, and both are now enforced here rather than in the
-- browser, because a check in the browser is a suggestion:
--
--   quantity   how many exist. Early bird is usually "the first 20".
--   closes_at  when it stops. Early bird is also often "until Friday".
--
-- SEATS, which is the part that made the count wrong even in principle.
-- The checkout sells N tickets and writes ONE rsvp row, with the number of
-- tickets surviving only inside the transaction amount. So counting rows
-- undercounts: the two early bird buyers were two rows and could just as
-- easily have been one person buying two. Every count here is a sum of
-- seats, and seats is written by the checkout.
--
-- Safe to run twice.


-- ------------------------------------------------------------ the columns --
alter table public.rsvps
  add column if not exists seats integer not null default 1
  check (seats between 1 and 20);

comment on column public.rsvps.seats is
  'Tickets bought in this one order. 1 for an ordinary RSVP.';

alter table public.ticket_tiers
  add column if not exists closes_at timestamptz;

comment on column public.ticket_tiers.closes_at is
  'When this tier stops selling. NULL means it runs until the quantity is gone.';


-- ------------------------------------------------------------- how many ----
-- Counts everything that is holding a ticket. A declined request never took
-- one, so it does not; a reserved seat on a quorum event does, because that
-- is exactly what a reservation is.
create or replace function public.tier_seats_sold(p_tier uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(seats, 1)), 0)::int
    from public.rsvps
   where tier_id = p_tier
     and status <> 'declined';
$$;

grant execute on function public.tier_seats_sold(uuid) to authenticated, anon;


-- ---------------------------------------------------------------- the gate --
create or replace function public.enforce_tier_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t       record;
  sold    int;
  wanted  int := coalesce(new.seats, 1);
begin
  if new.tier_id is null then
    return new;
  end if;

  select id, name, quantity, closes_at, is_active
    into t
    from public.ticket_tiers
   where id = new.tier_id;

  if t.id is null then
    return new;                       -- tier deleted; nothing to enforce
  end if;

  if not t.is_active then
    raise exception 'That ticket type is no longer on sale.'
      using errcode = 'check_violation';
  end if;

  if t.closes_at is not null and now() >= t.closes_at then
    raise exception 'That ticket type closed on %.',
      to_char(t.closes_at at time zone 'Africa/Lagos', 'DD Mon at HH12:MIam')
      using errcode = 'check_violation';
  end if;

  if t.quantity is not null then
    -- The row being replaced does not compete with itself. An upsert reopens
    -- a declined request, and without this a guest coming back would be
    -- refused against their own seats.
    select coalesce(sum(coalesce(seats, 1)), 0)::int
      into sold
      from public.rsvps
     where tier_id = new.tier_id
       and status <> 'declined'
       and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if sold + wanted > t.quantity then
      if t.quantity - sold <= 0 then
        raise exception '% is sold out.', t.name
          using errcode = 'check_violation';
      else
        raise exception 'Only % left of %.', t.quantity - sold, t.name
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tier_stock on public.rsvps;
create trigger tier_stock
  before insert or update on public.rsvps
  for each row execute function public.enforce_tier_stock();


-- ------------------------------------------------------------ where we are --
-- Every tier with a cap, and how much of it is gone. A row where sold is
-- already above quantity was oversold before this trigger existed.

select
  e.title,
  t.name,
  t.price,
  t.quantity,
  public.tier_seats_sold(t.id)                   as sold,
  case when t.quantity is null then null
       else t.quantity - public.tier_seats_sold(t.id) end as remaining,
  t.closes_at
from public.ticket_tiers t
join public.events e on e.id = t.event_id
where t.is_active
order by e.date desc, t.sort_order;
