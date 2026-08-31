-- Did the poster scan turn into an account?
--
-- Scans have been countable since migration-poster-analytics. What they could
-- not tell you is the only thing that decides whether printing more sheets is
-- worth it: 468 visits and 6 scans are interesting, six scans that produced
-- three members is a reason to print another two hundred, and six that
-- produced none is a reason to change the poster.
--
-- The join did not exist. site_visits stores an anonymous viewer_key and
-- nothing else about who anybody is, which is deliberate and stays that way.
-- So a user row gets one nullable column recording the viewer_key of the
-- browser the account was created in, and that is the whole bridge.
--
-- Safe to run twice.


-- ------------------------------------------------------------ the bridge --

alter table public.users
  add column if not exists signup_viewer_key text;

comment on column public.users.signup_viewer_key is
  'Anonymous browser key this account was created in. Links a signup back to a poster scan. Never set on an account older than 3 days.';

create index if not exists users_signup_viewer_key_idx
  on public.users (signup_viewer_key)
  where signup_viewer_key is not null;


-- Claimed by the client on the first authenticated page load after signup.
--
-- Not written at the signup call itself, because email signup has no session
-- until the confirmation link is clicked, and Google lands through a separate
-- callback. Doing it on the next authenticated page view covers every route
-- into an account with one code path.
--
-- Two guards make it safe to call on every page load forever:
--
--   * it only ever writes when the column is null, so the FIRST browser wins
--     and the number cannot drift as somebody signs in from other devices;
--   * it refuses on accounts older than three days. Without that, the 43
--     people who joined before this column existed would be stamped with
--     whichever browser they happened to open next, and every one of them
--     would be counted as a poster signup. Better to attribute nobody than to
--     invent attribution.
create or replace function public.claim_signup_key(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or length(p_key) > 64 then
    return;
  end if;

  update public.users u
     set signup_viewer_key = p_key
   where u.id = auth.uid()
     and u.signup_viewer_key is null
     and u.created_at > now() - interval '3 days';
end;
$$;

grant execute on function public.claim_signup_key(text) to authenticated;


-- --------------------------------------------------------------- the read --
-- Scans and the accounts they produced, per poster code.
--
-- Admin-gated in the body like every other site_* reader, because site_visits
-- has no select policy at all.
create or replace function public.site_poster_funnel(p_days int default 30)
returns table (code text, scans int, signups int)
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
  with scanned as (
    select substring(v.path from 4) as code,
           v.viewer_key,
           min(v.created_at)        as first_scan
      from public.site_visits v
     where v.path like '/p/%'
       and v.visited_on > (now() at time zone 'utc')::date - p_days
     group by 1, 2
  )
  select s.code,
         count(distinct s.viewer_key)::int as scans,
         -- created_at >= first_scan, so an existing member who happens to
         -- scan a poster is not counted as the poster having recruited them.
         count(distinct u.id)::int         as signups
    from scanned s
    left join public.users u
      on u.signup_viewer_key = s.viewer_key
     and u.created_at >= s.first_scan
   group by s.code
   order by scans desc, code;
end;
$$;

grant execute on function public.site_poster_funnel(int) to authenticated;


-- ------------------------------------------------------------ where we are --
-- Run after. Expect 0 signups today: the column starts null for everybody and
-- only fills as NEW accounts are created from here on. Scans should match
-- what site_poster_scans already reports.

select * from public.site_poster_funnel(30);
