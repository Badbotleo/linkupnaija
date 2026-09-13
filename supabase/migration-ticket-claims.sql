-- Giveaway slots: a ticket tier reachable only by its own link.
--
-- The problem this solves. A N0 tier sitting on a paid event's page next to
-- the N2,000 one is not a giveaway, it is a price cut: everybody picks free,
-- including the people who would have paid. So the tier needs somewhere else
-- to live, and a claim code is that somewhere.
--
-- WHAT EACH RULE ACTUALLY GOVERNS, because the three of them get confused.
--
--   quantity          first come, first served. Being early gets you into the
--                     queue. It does NOT get you in the door.
--   requires_approval the host decides. Always. A claim is a request.
--   profile           the ORDER the host reads the queue in. A host works
--                     down a list and stops, so position is the perk. Same
--                     reasoning Pro already uses in ManageRequests.
--
-- Nobody is accepted by being fast, and nobody is accepted by having a photo.
-- They are accepted because a person said yes, having seen them sooner.
--
-- WHY THE PROFILE RULE IS WORTH ANYTHING. Measured 13 Sep 2026 across 149
-- members: 23% have an avatar, 31% a bio, 32% an Instagram, and 20 people have
-- all four. "Ask to join and the host decides" currently means a host looking
-- at a blank circle and a first name, deciding nothing. A reward tied to
-- completeness repairs the one screen the whole trust model rests on.
--
-- Safe to run twice.


-- ---------------------------------------------------------------- the code --
alter table public.ticket_tiers
  add column if not exists claim_code text;

comment on column public.ticket_tiers.claim_code is
  'Set to make this tier claim-only: hidden from the event page, reachable at /claim/<code>. Used for giveaways so a free tier cannot undercut the paid one beside it.';

-- One tier per code, and a code is optional, so partial.
create unique index if not exists ticket_tiers_claim_code_key
  on public.ticket_tiers (claim_code) where claim_code is not null;


-- -------------------------------------------------------- how full is it --
-- Public on purpose: the claim page says "3 of 10 left" to somebody who has
-- not logged in yet, and that scarcity is most of why they bother. Returns
-- only counts, never who claimed.
create or replace function public.claim_slots(p_code text)
returns table (
  tier_id      uuid,
  event_id     uuid,
  tier_name    text,
  quantity     int,
  taken        int,
  remaining    int,
  closes_at    timestamptz,
  is_open      boolean
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
      and (t.quantity is null or public.tier_seats_sold(t.id) < t.quantity)
  from public.ticket_tiers t
  where t.claim_code = p_code
  limit 1;
$$;

grant execute on function public.claim_slots(text) to anon, authenticated;


-- ------------------------------------------------- how complete is a profile --
-- Scored rather than gated. At 23% avatars a gate would turn ten slots away
-- and teach nobody anything; a score moves the people who did the work to the
-- top of the list and leaves everyone else still in it.
--
-- Deliberately cheap and legible: four things a guest can see themselves
-- having done, so the nudge on the claim page can name them.
create or replace function public.profile_score(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select
    (case when u.avatar_url    is not null                     then 30 else 0 end) +
    (case when length(trim(coalesce(u.bio, ''))) >= 20         then 25 else 0 end) +
    (case when u.state         is not null                     then 20 else 0 end) +
    (case when u.instagram_url is not null                     then 15 else 0 end) +
    (case when length(trim(coalesce(u.name, ''))) >= 3         then 10 else 0 end)
  from public.users u
  where u.id = p_user;
$$;

grant execute on function public.profile_score(uuid) to authenticated;


-- ------------------------------------------------------------ where we are --
-- Any claim tiers that exist, and how full.

select
  e.title,
  t.name        as tier,
  t.claim_code,
  t.quantity    as slots,
  public.tier_seats_sold(t.id) as taken,
  t.closes_at
from public.ticket_tiers t
join public.events e on e.id = t.event_id
where t.claim_code is not null
order by e.date;
