-- Poster scans, broken out by code, for the admin analytics page.
--
-- The /p/<code> routes already land in site_visits like any other path, so
-- they turn up inside site_top_pages — but only if a code out-ranks the feed
-- and the home page, which it never will early on. Buried under /events at
-- rank nine is the same as not measured.
--
-- This is the whole point of the codes existing: abj1 against abj3 is the A/B
-- between the two poster hooks, and Abuja against Lagos is which city is
-- worth printing more of.
--
-- Counts DISTINCT viewer keys, same as site_top_pages, so one person scanning
-- the same poster twice on their way past is one scan. That is the honest
-- number for "how many people did this sheet bring in".
--
-- Admin-gated in the function body, matching every other site_* reader, since
-- site_visits itself is write-only and has no select policy at all.
--
-- Safe to run twice.

create or replace function public.site_poster_scans(p_days int default 30)
returns table (
  code       text,
  scans      int,
  first_seen date,
  last_seen  date
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.users u
     where u.id = auth.uid() and u.is_admin
  ) then
    return;
  end if;

  return query
  select
    substring(v.path from 4)               as code,
    count(distinct v.viewer_key)::int      as scans,
    min(v.visited_on)                      as first_seen,
    max(v.visited_on)                      as last_seen
    from public.site_visits v
   where v.visited_on > (now() at time zone 'utc')::date - p_days
     and v.path like '/p/%'
   group by 1
   order by scans desc, code;
end;
$$;

grant execute on function public.site_poster_scans(int) to authenticated;
