-- The only thing you could do on an event page was ask a stranger to approve
-- you.
--
-- Every other action was about an event you had already decided on: share it,
-- add it to your calendar, hail a ride to it, report it. The single action
-- that expressed wanting to go was "request to join", which means asking
-- somebody you have never met to accept you, with the possibility of being
-- turned down. That is a fine second rung. It is a very high first one.
--
-- WHAT IT COST, measured. 156 of 194 members have never requested anything.
-- Nothing in the database can say whether they wanted nothing or wanted
-- something and were not ready to ask for it, because there was no signal
-- between event_views (anonymous, per day) and rsvps (a social risk). Those
-- two are very far apart and there was nothing in between.
--
-- Three things this makes possible that were not:
--
--   A host with no requests can currently not tell "nobody saw it" from
--   "nobody wanted it". Those call for opposite responses and look identical.
--
--   47 events created this month have ZERO accepted guests. Interest on a
--   failed event is the cheapest research available: it says what to put on
--   next, and it costs nothing to collect.
--
--   "The thing you said you were interested in is on Saturday" is the highest
--   converting message this kind of product sends, and it could not be sent.
--
-- ONE ACTION, NOT THREE. Liked, saved and interested are the same intent
-- wearing three hats, and a page with all three teaches people to use none.
-- Interested states something about the event rather than filing it away,
-- which is what both the host and we actually need to know.
--
-- Safe to run twice.


-- ------------------------------------------------------------- the table --
create table if not exists public.event_interest (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.users  (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Tapping it twice is un-tapping it, handled in the client by deleting.
  -- The constraint is here so a double submit cannot record two.
  unique (event_id, user_id)
);

comment on table public.event_interest is
  'Lightweight "I want to go" on an event. Private to the member; the host sees only a count, via event_interest_count().';

create index if not exists event_interest_user_idx
  on public.event_interest (user_id, created_at desc);

create index if not exists event_interest_event_idx
  on public.event_interest (event_id);


-- ----------------------------------------------------------------- policy --
-- YOUR INTEREST IS YOURS. Unlike rsvps, which are deliberately public so an
-- event page can show who is coming, this is not a guest list and saying you
-- fancy something is not the same as committing to it in front of people.
-- Nobody reads anybody else's rows, including the host. The host gets a
-- number, from the function below, and never the names.
alter table public.event_interest enable row level security;

drop policy if exists "Own interest is readable" on public.event_interest;
create policy "Own interest is readable"
  on public.event_interest for select
  using (user_id = auth.uid());

drop policy if exists "Mark your own interest" on public.event_interest;
create policy "Mark your own interest"
  on public.event_interest for insert
  with check (user_id = auth.uid());

drop policy if exists "Take back your own interest" on public.event_interest;
create policy "Take back your own interest"
  on public.event_interest for delete
  using (user_id = auth.uid());


-- ------------------------------------------------------------ the number --
-- Public on purpose, and the same shape as tier_seats_sold: the event page
-- shows the count to somebody who has not logged in, and a count is not a
-- list. Returns an integer and nothing else, so no row-level policy is being
-- worked around here.
create or replace function public.event_interest_count(p_event uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.event_interest where event_id = p_event;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on a new function and Supabase
-- separately grants it to anon by name, so a revoke has to say both. Here we
-- want both, but stated rather than inherited, so the next audit does not
-- have to work out whether it was meant.
grant execute on function public.event_interest_count(uuid) to anon;
grant execute on function public.event_interest_count(uuid) to authenticated;


-- ------------------------------------------------------------ where we are --
-- Nothing yet. After the button ships this should start climbing, and the
-- interesting column is the last one: interest on events nobody asked to
-- join is demand that currently goes nowhere.
select
  e.title,
  e.date,
  public.event_interest_count(e.id)                                as interested,
  (select count(*) from public.rsvps r where r.event_id = e.id)    as requests
from public.events e
where e.date >= current_date
order by interested desc, e.date
limit 20;
