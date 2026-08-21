-- Host analytics: where people drop off between seeing an event and turning up.
--
-- Three of the four stages already exist — event_interests, rsvps, and
-- rsvps.attended from the QR door scan. Only views were missing, which is why
-- a host could see that 12 people said yes but never that 900 looked and
-- didn't.
--
-- Safe to run twice.

-- ------------------------------------------------------------------ views --
create table if not exists public.event_views (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  -- A random id the browser keeps, not a user id and not an IP. Logged-out
  -- people are most of the traffic on an event page, and a funnel that only
  -- counts signed-in views measures the wrong thing. Nothing here identifies
  -- a person.
  viewer_key text not null,
  -- Truncated to the day so a host refreshing their own listing twenty times
  -- doesn't invent an audience.
  viewed_on  date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create unique index if not exists event_views_unique_day
  on public.event_views (event_id, viewer_key, viewed_on);
create index if not exists event_views_event_idx
  on public.event_views (event_id);

alter table public.event_views enable row level security;

-- Nobody reads this table directly. Counts come back through the funnel
-- function below, which checks you're the host first.
drop policy if exists "views are write-only" on public.event_views;
create policy "views are write-only" on public.event_views
  for insert with check (true);

-- --------------------------------------------------------------- record --
-- Called once per page view. Silently does nothing on a repeat — the unique
-- index means a second view the same day is a no-op rather than an error the
-- client has to swallow.
create or replace function public.record_event_view(p_event uuid, p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_views (event_id, viewer_key)
  values (p_event, p_key)
  on conflict (event_id, viewer_key, viewed_on) do nothing;
$$;

grant execute on function public.record_event_view(uuid, text) to anon, authenticated;

-- --------------------------------------------------------------- funnel --
-- The four numbers, for the host only.
--
-- SECURITY DEFINER because interests and views are deliberately unreadable —
-- a host is entitled to the counts, not to who looked. Returns nulls rather
-- than raising if you aren't the host, so the page can say "not yours"
-- instead of showing an error.
create or replace function public.event_funnel(p_event uuid)
returns table (viewed int, interested int, rsvpd int, attended int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.events e
     where e.id = p_event and e.host_id = auth.uid()
  ) then
    return;   -- no rows: not your event
  end if;

  return query
  select
    (select count(*)::int from public.event_views v where v.event_id = p_event),
    (select count(*)::int from public.event_interests i where i.event_id = p_event),
    (select count(*)::int from public.rsvps r
      where r.event_id = p_event and r.status = 'accepted'),
    (select count(*)::int from public.rsvps r
      where r.event_id = p_event and r.attended is true);
end;
$$;

grant execute on function public.event_funnel(uuid) to authenticated;
