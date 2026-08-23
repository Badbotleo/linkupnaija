-- More of what GA gives you: where traffic comes from, where visitors are,
-- new against returning, and a daily trend.
--
-- Run migration-site-visits.sql first. Safe to run twice.

-- Referrer host only — "tiktok.com", never the full URL.
--
-- The full referrer can carry a search query, a private group's path, or a
-- session id somebody pasted. The host is the entire useful signal for
-- acquisition and none of the risk: it's what told us TikTok was 946 of 1,536
-- new users last month.
alter table public.site_visits
  add column if not exists source text;

-- Resolved on the edge from the same header the events feed already uses.
-- Never asked for, never prompted — this is the country-level guess Vercel
-- attaches to the request, not the browser's location API.
alter table public.site_visits
  add column if not exists state text;

comment on column public.site_visits.source is
  'Referrer HOST only, e.g. tiktok.com. Never a full URL.';
comment on column public.site_visits.state is
  'Edge-geo state, same source as the feed scope. Not the browser location API.';

create index if not exists site_visits_source_idx
  on public.site_visits (visited_on, source);

-- record_visit gains the two fields. Both optional, so an older client that
-- doesn't send them keeps working.
create or replace function public.record_visit(
  p_key   text,
  p_path  text,
  p_source text default null,
  p_state  text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.site_visits (viewer_key, path, source, state)
  values (p_key, left(p_path, 200), left(p_source, 120), left(p_state, 60))
  on conflict (viewer_key, path, visited_on) do nothing;
$$;

grant execute on function public.record_visit(text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------- new/return --
-- The retention number. A visitor is "new" on the first day we ever saw their
-- key and "returning" on any later day — which is the only honest way to read
-- it from a table that stores one row per person per page per day.
create or replace function public.site_visitor_split(p_days int default 30)
returns table (new_visitors int, returning_visitors int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return;
  end if;

  return query
  with first_seen as (
    select viewer_key, min(visited_on) as first_day
      from public.site_visits
     group by viewer_key
  ),
  window_keys as (
    select distinct v.viewer_key
      from public.site_visits v
     where v.visited_on > (now() at time zone 'utc')::date - p_days
  )
  select
    count(*) filter (
      where f.first_day > (now() at time zone 'utc')::date - p_days
    )::int,
    count(*) filter (
      where f.first_day <= (now() at time zone 'utc')::date - p_days
    )::int
  from window_keys w
  join first_seen f on f.viewer_key = w.viewer_key;
end;
$$;

grant execute on function public.site_visitor_split(int) to authenticated;

-- ------------------------------------------------------------------ daily --
create or replace function public.site_daily(p_days int default 14)
returns table (day date, visitors int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return;
  end if;

  return query
  select v.visited_on, count(distinct v.viewer_key)::int
    from public.site_visits v
   where v.visited_on > (now() at time zone 'utc')::date - p_days
   group by v.visited_on
   order by v.visited_on;
end;
$$;

grant execute on function public.site_daily(int) to authenticated;

-- ----------------------------------------------------------------- source --
create or replace function public.site_sources(p_days int default 30, p_limit int default 8)
returns table (source text, visitors int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return;
  end if;

  return query
  select coalesce(v.source, 'direct'), count(distinct v.viewer_key)::int as n
    from public.site_visits v
   where v.visited_on > (now() at time zone 'utc')::date - p_days
   group by 1
   order by n desc
   limit p_limit;
end;
$$;

grant execute on function public.site_sources(int, int) to authenticated;

-- ------------------------------------------------------------------ state --
create or replace function public.site_states(p_days int default 30, p_limit int default 8)
returns table (state text, visitors int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return;
  end if;

  return query
  select coalesce(v.state, 'unknown'), count(distinct v.viewer_key)::int as n
    from public.site_visits v
   where v.visited_on > (now() at time zone 'utc')::date - p_days
   group by 1
   order by n desc
   limit p_limit;
end;
$$;

grant execute on function public.site_states(int, int) to authenticated;
