-- Member email addresses are readable by anyone.
--
-- Verified 13 Sep 2026 with nothing but the anon key, which is published in
-- the browser bundle on every page load:
--
--   select email from public.users  ->  143 rows
--
-- Every member's address, to anybody who opens devtools. RLS is row level, so
-- a policy that correctly allows reading a member's public profile also hands
-- over every column on that row, and email is on that row.
--
-- Postgres grants ARE column level, which is the tool for this. The read
-- policy stays exactly as it is; anon simply loses the two columns it should
-- never have had.
--
-- WHAT STILL NEEDS DOING AFTER THIS. Logged-in members can still read every
-- address, because the admin panels select users(name, email, avatar_url) as
-- an ordinary authenticated user and revoking the column here would break
-- them. Closing that properly means moving those admin reads behind a
-- security definer function that checks is_admin() first. This migration
-- shuts the door that is open to the entire internet; the second one is a
-- smaller room.
--
-- Safe to run twice.


-- ------------------------------------------------------------- the columns --
-- Revoke on the table, then grant back everything except the two. A bare
-- "revoke select" would take the whole table and blank every public profile.
revoke select on public.users from anon;

grant select (
  id,
  name,
  state,
  avatar_url,
  created_at,
  bio,
  instagram_url,
  twitter_url,
  facebook_url,
  profile_completed,
  rating_avg,
  rating_count
) on public.users to anon;


-- ------------------------------------------------------------ where we are --
-- Run as the anon role, this should now fail rather than return rows.
--
--   set role anon;
--   select email from public.users limit 1;   -- permission denied
--   select name  from public.users limit 1;   -- still works
--   reset role;

select
  grantee,
  string_agg(privilege_type || ' ' || coalesce(column_name, '*'), ', ') as still_granted
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'users'
  and grantee = 'anon'
  and column_name in ('email', 'phone')
group by grantee;
-- Zero rows here is the pass condition.
