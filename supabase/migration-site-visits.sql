-- Site-wide visitor counts, so the admin analytics page can answer "how many
-- people came" without opening Google Analytics.
--
-- event_views already exists but only covers event pages, which is a fraction
-- of traffic — the home page alone took 3,018 views last month against 806
-- for the whole events section. This is the same shape, applied everywhere.
--
-- Nothing here identifies a person: a random id the browser keeps, and a path.
-- No IP, no user id, no referrer, no fingerprint.
--
-- Safe to run twice.

create table if not exists public.site_visits (
  id         uuid primary key default gen_random_uuid(),
  -- The same random localStorage key event_views uses, so a person who
  -- browses and then opens an event is one visitor, not two.
  viewer_key text not null,
  -- Normalised: /events/<uuid> is stored as /events/:id. Otherwise the top
  -- pages list is a hundred rows of one visit each and tells you nothing.
  path       text not null,
  visited_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

-- One row per person per page per day. Repeat visits within a day are the
-- same person still browsing, and counting them turns a busy afternoon into
-- fake growth.
create unique index if not exists site_visits_unique_day
  on public.site_visits (viewer_key, path, visited_on);
create index if not exists site_visits_day_idx
  on public.site_visits (visited_on);

alter table public.site_visits enable row level security;

-- Write-only. Counts come back through the function below, which checks you
-- are an admin first — the raw rows are nobody's business, including a
-- logged-in member's.
drop policy if exists "visits are write-only" on public.site_visits;
create policy "visits are write-only" on public.site_visits
  for insert with check (true);

-- ---------------------------------------------------------------- record --
create or replace function public.record_visit(p_key text, p_path text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.site_visits (viewer_key, path)
  values (p_key, left(p_path, 200))
  on conflict (viewer_key, path, visited_on) do nothing;
$$;

grant execute on function public.record_visit(text, text) to anon, authenticated;

-- --------------------------------------------------------------- traffic --
-- Visitors and page views over a window, for the admin analytics page.
--
-- "Visitors" counts distinct browsers, which is what GA calls users and what
-- anybody actually means by the word. "Views" counts rows, already deduped to
-- one per page per day, so it undercounts against GA's pageviews — a
-- deliberate trade for not inflating a quiet week.
create or replace function public.site_traffic(p_days int default 30)
returns table (visitors int, views int, days int)
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
    return;   -- no rows for anyone but an admin
  end if;

  return query
  select
    (select count(distinct v.viewer_key)::int from public.site_visits v
      where v.visited_on > (now() at time zone 'utc')::date - p_days),
    (select count(*)::int from public.site_visits v
      where v.visited_on > (now() at time zone 'utc')::date - p_days),
    p_days;
end;
$$;

grant execute on function public.site_traffic(int) to authenticated;

-- ------------------------------------------------------------- top pages --
create or replace function public.site_top_pages(p_days int default 30, p_limit int default 8)
returns table (path text, visitors int)
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
  select v.path, count(distinct v.viewer_key)::int as visitors
    from public.site_visits v
   where v.visited_on > (now() at time zone 'utc')::date - p_days
   group by v.path
   order by visitors desc
   limit p_limit;
end;
$$;

grant execute on function public.site_top_pages(int, int) to authenticated;
