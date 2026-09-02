-- Premium includes one free 48-hour boost a month.
--
-- The boost costs ₦5,000 and Premium costs ₦4,999, so a host who boosts once
-- a month is subscribing for less than nothing. That arithmetic is the reason
-- to pay, and it is the same shape the half-fee card used to have before the
-- booking fee moved onto the buyer.
--
-- It is additive on purpose. Gating a boost behind Premium, so free hosts
-- cannot buy one at all, would take a paid capability away from the twelve
-- people this platform can least afford to annoy. Nobody loses anything here:
-- the boost stays purchasable by anyone, and Premium members get one on the
-- house.
--
-- A record per boost, because "have they used this month's" cannot be read
-- from events.featured_until: a second boost overwrites the first and the
-- history disappears with it.
--
-- Safe to run twice.


create table if not exists public.event_boosts (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  -- false means it came out of the Premium allowance rather than a card.
  paid       boolean not null default true,
  amount     integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists event_boosts_host_month_idx
  on public.event_boosts (host_id, created_at desc);

alter table public.event_boosts enable row level security;

drop policy if exists "Hosts read their own boosts" on public.event_boosts;
create policy "Hosts read their own boosts"
  on public.event_boosts for select
  using (host_id = auth.uid() or public.is_admin());


-- Claiming the monthly free boost.
--
-- Everything happens in one place on the server: the eligibility check, the
-- record, and the flag on the event. Done in the client it would be three
-- calls a determined host could interleave to boost twice, and the check
-- would be a suggestion rather than a rule.
create or replace function public.claim_free_boost(p_event uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  is_premium boolean;
  used      int;
begin
  if uid is null then
    return false;
  end if;

  -- Must own the event. Boosting somebody else's listing on your allowance is
  -- not a feature.
  if not exists (
    select 1 from public.events e where e.id = p_event and e.host_id = uid
  ) then
    return false;
  end if;

  select coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    into is_premium
    from public.users u
   where u.id = uid;

  if not coalesce(is_premium, false) then
    return false;
  end if;

  -- Calendar month, in Lagos time, because a host in Nigeria counts their
  -- month the way their calendar does and not the way UTC does.
  select count(*) into used
    from public.event_boosts b
   where b.host_id = uid
     and not b.paid
     and date_trunc('month', b.created_at at time zone 'Africa/Lagos')
         = date_trunc('month', now() at time zone 'Africa/Lagos');

  if used >= 1 then
    return false;
  end if;

  insert into public.event_boosts (host_id, event_id, paid, amount)
  values (uid, p_event, false, 0);

  update public.events
     set featured = true,
         featured_until = now() + interval '48 hours'
   where id = p_event;

  return true;
end;
$$;

grant execute on function public.claim_free_boost(uuid) to authenticated;


-- Whether the button should offer the free one. Read-only, own rows only.
create or replace function public.free_boost_available()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.users u
       where u.id = auth.uid()
         and coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    )
    and not exists (
      select 1 from public.event_boosts b
       where b.host_id = auth.uid()
         and not b.paid
         and date_trunc('month', b.created_at at time zone 'Africa/Lagos')
             = date_trunc('month', now() at time zone 'Africa/Lagos')
    );
$$;

grant execute on function public.free_boost_available() to authenticated;


-- ------------------------------------------------------------ where we are --
-- Run after. Expect zeros: no boost has been recorded through this table yet,
-- including any bought before today.

select count(*)                            as boosts_recorded,
       count(*) filter (where not paid)    as free_boosts_used
  from public.event_boosts;
