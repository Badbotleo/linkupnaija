-- Turn the giveaway from a queue into a raffle.
--
-- First come, first served rewards whoever happened to be holding their phone.
-- A draw lets everybody claim and picks ten, which is a better offer to the
-- 140 members who were asleep when the link went out.
--
-- WHY DRAW_SIZE AND NOT QUANTITY. quantity is a CAP, enforced by the tier
-- stock trigger, so a tier of 10 would refuse the eleventh claim at the
-- database. That is exactly right for a ticket tier and exactly wrong for a
-- raffle, where the eleventh claim is the point. So claims run uncapped
-- (quantity null) and draw_size records how many will actually win.
--
-- WEIGHTED, NOT RANKED. The earlier design sorted the host's queue by profile
-- completeness, which made a fuller profile mean "read sooner". In a draw it
-- can mean what it sounds like: a better chance. Weight runs 1.0 to 5.0 on
-- profile_score, so somebody with nothing filled in still has a real ticket in
-- the hat and somebody who did the work has five. Nobody is excluded, which is
-- what keeps it a raffle rather than a ranking wearing a raffle's clothes.
--
-- The draw is Efraimidis-Spirakis: order by random()^(1/weight) and take the
-- top N. It is weighted sampling WITHOUT replacement, which naive approaches
-- like order by random()*weight are not.
--
-- Safe to run twice.


-- ----------------------------------------------------------- the draw size --
alter table public.ticket_tiers
  add column if not exists draw_size integer
  check (draw_size is null or draw_size > 0);

comment on column public.ticket_tiers.draw_size is
  'How many claims win, when this tier is a raffle. Claims themselves are uncapped: quantity would refuse them at the trigger.';


-- ------------------------------------------------------------ what is open --
-- Replaces the version in migration-ticket-claims.sql. Same name and shape
-- plus the two raffle columns, so the claim page reads one row as before.
--
-- is_open no longer closes on a full house, because a raffle does not fill.
-- Only the clock and the host's switch close it.
create or replace function public.claim_slots(p_code text)
returns table (
  tier_id      uuid,
  event_id     uuid,
  tier_name    text,
  quantity     int,
  taken        int,
  remaining    int,
  closes_at    timestamptz,
  is_open      boolean,
  draw_size    int,
  claimed      int,
  drawn        int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.event_id,
    t.name,
    t.quantity,
    public.tier_seats_sold(t.id),
    case when t.quantity is null then null
         else greatest(0, t.quantity - public.tier_seats_sold(t.id)) end,
    t.closes_at,
    t.is_active
      and (t.closes_at is null or now() < t.closes_at)
      and (t.quantity is null or public.tier_seats_sold(t.id) < t.quantity),
    t.draw_size,
    (select count(*)::int from public.rsvps r
      where r.tier_id = t.id and r.status <> 'declined'),
    (select count(*)::int from public.rsvps r
      where r.tier_id = t.id and r.status = 'accepted')
  from public.ticket_tiers t
  where t.claim_code = p_code
  limit 1;
$$;

grant execute on function public.claim_slots(text) to anon, authenticated;


-- ---------------------------------------------------------------- the draw --
-- Run by the event's host or an admin. Picks from claims still pending, so
-- running it twice tops up rather than re-drawing, and anybody the host has
-- already accepted by hand counts against the ten.
create or replace function public.draw_claim_winners(p_code text)
returns table (winner_id uuid, winner_name text, weight numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  t     record;
  need  int;
begin
  select ti.id, ti.event_id, ti.draw_size, e.host_id
    into t
    from public.ticket_tiers ti
    join public.events e on e.id = ti.event_id
   where ti.claim_code = p_code;

  if t.id is null then
    raise exception 'No giveaway with that code.';
  end if;

  if t.host_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the host of this event can draw.'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(t.draw_size, 0) <= 0 then
    raise exception 'This giveaway has no draw size set.';
  end if;

  -- Already-accepted claims count, so a second run fills the gap left by
  -- somebody the host declined rather than handing out another ten.
  need := t.draw_size - (
    select count(*) from public.rsvps
     where tier_id = t.id and status = 'accepted'
  );

  if need <= 0 then
    return;
  end if;

  return query
  with pool as (
    select
      r.id,
      r.user_id,
      -- 1.0 with nothing filled in, 5.0 with everything. Everybody keeps a
      -- real chance; that is the difference between a raffle and a queue.
      1.0 + (public.profile_score(r.user_id)::numeric / 25.0) as w
    from public.rsvps r
    where r.tier_id = t.id
      and r.status = 'pending'
  ),
  picked as (
    select id, user_id, w
      from pool
     order by random() ^ (1.0 / w) desc
     limit need
  ),
  won as (
    update public.rsvps r
       set status = 'accepted',
           paid = true,
           decided_at = now()
      from picked p
     where r.id = p.id
     returning r.user_id, p.w
  )
  select w.user_id, u.name, round(w.w, 2)
    from won w
    join public.users u on u.id = w.user_id;
end;
$$;

grant execute on function public.draw_claim_winners(text) to authenticated;


-- ------------------------------------------------------------ the potluck --
-- Uncap the claims and set the draw at ten. Without the first half the
-- eleventh person to click is refused by the stock trigger.
update public.ticket_tiers
   set quantity = null,
       draw_size = 10
 where claim_code = 'potluck';


-- ------------------------------------------------------------ where we are --
select * from public.claim_slots('potluck');
