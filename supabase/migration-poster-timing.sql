-- When posters get scanned, and a returning-visitor number that can move.
--
-- The sheets are on keke tricycles and around University of Abuja now, so the
-- useful question stops being "how many" and becomes "when". A keke poster is
-- read by somebody sitting in traffic; a campus poster is read between
-- lectures. Those are different times of day, and knowing which is which is
-- what tells you when to post, and when to schedule the link-ups themselves.
--
-- No schema change: site_visits already stores created_at timestamptz. The
-- data has been there since the table was created; nothing was reading it.
--
-- Safe to run twice.


-- ------------------------------------------------------- returning, fixed --
-- The old definition made this permanently zero.
--
-- It called a visitor "returning" only if their FIRST EVER day predated the
-- reporting window. site_visits is about two weeks old and the window is
-- thirty days, so every visitor's first day falls inside it and every visitor
-- is counted as new. The number could not move, which is what made it look
-- broken. It was.
--
-- It is also not what anybody means by returning. A person who came on Monday
-- and again on Thursday came back, whether or not the report happens to start
-- before Monday. So: returning means seen on more than one distinct day, or
-- first seen before the window. New means everybody else.
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
  with per_key as (
    select
      v.viewer_key,
      min(v.visited_on)                as first_day,
      count(distinct v.visited_on)     as active_days
      from public.site_visits v
     group by v.viewer_key
  ),
  window_keys as (
    select distinct v.viewer_key
      from public.site_visits v
     where v.visited_on > (now() at time zone 'utc')::date - p_days
  )
  select
    count(*) filter (
      where k.active_days = 1
        and k.first_day > (now() at time zone 'utc')::date - p_days
    )::int,
    count(*) filter (
      where k.active_days > 1
         or k.first_day <= (now() at time zone 'utc')::date - p_days
    )::int
  from window_keys w
  join per_key k on k.viewer_key = w.viewer_key;
end;
$$;

grant execute on function public.site_visitor_split(int) to authenticated;


-- --------------------------------------------------------- scans by hour ---
-- Hours are Africa/Lagos, not UTC. created_at is timestamptz, so reading the
-- hour without converting would shift every scan an hour earlier and put the
-- evening rush at the wrong end of the chart.
--
-- Note what a "scan" is here: site_visits dedupes on (viewer_key, path,
-- visited_on), so this is the FIRST scan of a given sheet by a given phone on
-- a given day. Somebody scanning the same keke twice on one ride counts once,
-- which is the honest reading of when people notice a poster.
create or replace function public.site_poster_hours(p_days int default 30)
returns table (hour int, scans int)
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
  select
    extract(hour from v.created_at at time zone 'Africa/Lagos')::int as hour,
    count(*)::int                                                    as scans
    from public.site_visits v
   where v.visited_on > (now() at time zone 'utc')::date - p_days
     and v.path like '/p/%'
   group by 1
   order by 1;
end;
$$;

grant execute on function public.site_poster_hours(int) to authenticated;


-- -------------------------------------------------------- the scan log -----
-- At this volume a histogram is mostly empty buckets. Ten scans do not make a
-- distribution, but ten timestamps tell you plenty: whether the keke sheets
-- fire during the morning run, whether campus is a lunchtime thing, and
-- whether anybody scanned at 2am, which would mean somebody photographed the
-- poster and came back to it later.
create or replace function public.site_poster_recent(p_limit int default 40)
returns table (code text, at timestamptz, state text)
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
  select
    substring(v.path from 4) as code,
    v.created_at             as at,
    v.state                  as state
    from public.site_visits v
   where v.path like '/p/%'
   order by v.created_at desc
   limit p_limit;
end;
$$;

grant execute on function public.site_poster_recent(int) to authenticated;


-- --------------------------------------------------------------- check it --
-- Run this after the migration. It proves the returning fix rather than
-- asking you to trust it: the second number is how many people have come back
-- on a different day, and it should stop being zero.

select
  count(*)                                   as visitors_all_time,
  count(*) filter (where active_days > 1)    as came_back_another_day,
  min(first_day)                             as tracking_since
from (
  select viewer_key,
         min(visited_on)            as first_day,
         count(distinct visited_on) as active_days
    from public.site_visits
   group by viewer_key
) k;
