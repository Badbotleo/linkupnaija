-- Boosting becomes a Premium capability, the way X gates ads and boosts.
--
-- Not a free boost included with the subscription, which is what an earlier
-- draft of this file did. The ABILITY is what Premium unlocks: a Premium host
-- can put an event at the top of the feed for 48 hours and pay for it, and a
-- free host cannot buy one at all.
--
-- This takes something away. Any host could previously pay ₦5,000 to boost,
-- and now they must subscribe first. That is a deliberate product decision
-- and worth naming here rather than discovering later from a confused host.
--
-- THE GATE IS A TRIGGER, NOT A BUTTON. FeatureButton writes events.featured
-- straight from the browser under a policy that lets a host update their own
-- event, so a check that lives only in the UI is a suggestion: anyone can
-- post the same update with a token. The trigger below is what actually makes
-- boosting Premium-only.
--
-- Safe to run twice.


-- ---------------------------------------- undo the earlier free-boost draft --
-- These shipped in an earlier version of this file. Dropped rather than left
-- lying around: free_boost_available returning true to a client that no
-- longer understands it would offer a boost nobody is entitled to.

drop function if exists public.claim_free_boost(uuid);
drop function if exists public.free_boost_available();


-- ------------------------------------------------------------- boost history --
-- Kept, because "when did this host last boost" is not answerable from
-- events.featured_until: a second boost overwrites the first.

create table if not exists public.event_boosts (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
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

drop policy if exists "Hosts record their own boosts" on public.event_boosts;
create policy "Hosts record their own boosts"
  on public.event_boosts for insert
  with check (host_id = auth.uid());


-- ------------------------------------------------------------- the real gate --
-- Fires only when featured is being switched ON. Editing the title of an
-- already-boosted event, or a boost lapsing, must not be blocked by this.
create or replace function public.enforce_premium_boost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_is_premium boolean;
begin
  -- Not a new boost: nothing to check.
  if coalesce(new.featured, false) = false
     or coalesce(old.featured, false) = true then
    return new;
  end if;

  -- Admins feature events from the admin panel on the platform's behalf, and
  -- that is not a host buying a boost.
  if exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return new;
  end if;

  select coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    into host_is_premium
    from public.users u
   where u.id = new.host_id;

  if not coalesce(host_is_premium, false) then
    raise exception 'Boosting is a LinkUpNaija Premium feature.';
  end if;

  return new;
end;
$$;

drop trigger if exists events_premium_boost on public.events;
create trigger events_premium_boost
  before update on public.events
  for each row execute function public.enforce_premium_boost();


-- Whether the button should offer to boost at all.
create or replace function public.can_boost()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users u
     where u.id = auth.uid()
       and coalesce(u.is_pro, false)
       and (u.pro_expires_at is null or u.pro_expires_at > now())
  );
$$;

grant execute on function public.can_boost() to authenticated;


-- ------------------------------------------------------------ where we are --
-- Run after. Confirms the trigger is attached; currently-featured events are
-- untouched, since the trigger only fires when featured switches on.

select
  (select count(*) from pg_trigger
    where tgname = 'events_premium_boost' and not tgisinternal)      as gate_installed,
  (select count(*) from public.events
    where featured and featured_until > now())                       as currently_boosted,
  (select count(*) from public.event_boosts)                         as boosts_recorded;
