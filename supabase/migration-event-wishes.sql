-- What people looked for and did not find.
--
-- A search that returns nothing is the most useful thing this platform is
-- told all day. "Chill rooftop in Lekki on Friday" with zero results is not a
-- failure, it is a member naming an event that ought to exist, in their own
-- words, at the moment they wanted it. With 24 link-ups live and 109 members,
-- the misses outnumber the hits and nothing was recording them.
--
-- Two things come out of this table:
--   1. What to seed next, and in which city.
--   2. Somebody to tell when it finally happens.
--
-- Safe to run twice.


create table if not exists public.event_wishes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  -- Exactly what they typed, before any matching. The raw sentence is the
  -- part with the information in it.
  query      text not null,
  -- What the matcher made of it, when it made anything. Null is normal and
  -- means the words did not map onto a category or a state, which is itself
  -- worth knowing: it may be a vibe this platform has no name for yet.
  category   text,
  state      text,
  -- Cleared when somebody has actually been told. Not deleted: the wish is
  -- still demand data after it has been answered.
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per person per wish. Searching the same thing four times in a
-- frustrated minute should not read as four people wanting it.
create unique index if not exists event_wishes_unique_idx
  on public.event_wishes (user_id, lower(query));

create index if not exists event_wishes_recent_idx
  on public.event_wishes (created_at desc);

alter table public.event_wishes enable row level security;

-- Signed in only. An anonymous insert endpoint on a public page is a spam
-- funnel, and a wish nobody can be notified about is only half the point.
drop policy if exists "Members record their own wish" on public.event_wishes;
create policy "Members record their own wish"
  on public.event_wishes for insert
  with check (user_id = auth.uid());

drop policy if exists "Members read their own wishes" on public.event_wishes;
create policy "Members read their own wishes"
  on public.event_wishes for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Members withdraw their own wish" on public.event_wishes;
create policy "Members withdraw their own wish"
  on public.event_wishes for delete
  using (user_id = auth.uid());


-- ------------------------------------------------------------ where we are --
-- Run this whenever you want to know what to put on next. The top of this
-- list is your event calendar, written by the people who will attend it.

select
  coalesce(category, '(no category)') as category,
  coalesce(state, '(anywhere)')       as state,
  count(*)                            as people,
  max(created_at)                     as latest
from public.event_wishes
group by 1, 2
order by people desc, latest desc
limit 20;
