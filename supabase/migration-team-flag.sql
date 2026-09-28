-- Somebody on the team who is not an operator.
--
-- Courage hosts most of what happens on this platform and should be able to
-- see what we are aiming at. The obvious way to do that is is_admin = true,
-- and it is the wrong way, because is_admin is not a view permission. It is
-- every permission:
--
--   the payments desk and every transaction
--   the support inbox, both threads and messages
--   every member's email and phone, via the users grants
--   write access to drivers, reservations, venue_owners and things_to_do
--   appearing to members as "LinkUpNaija Admin" in their messages
--
-- None of that is implied by "let him see the growth targets", and a flag
-- that grants forty things when you wanted one is how an account ends up
-- able to do something nobody decided it should.
--
-- So: a second flag that grants exactly one page. If more team surfaces
-- appear later they opt in to this explicitly, one at a time, rather than
-- inheriting it.
--
-- IT ALSO COUNTS AS STAFF FOR THE METRICS, which matters more than it looks.
-- /admin/growth measures "hosts who are not you", and a teammate's events are
-- not arm's-length supply any more than the founder's are. Courage is already
-- caught by the listing rule, since only platform accounts bulk-import
-- events, but naming it here means the next teammate is handled correctly on
-- the day they are added rather than whenever somebody notices.
--
-- Safe to run twice.


alter table public.users
  add column if not exists is_team boolean not null default false;

comment on column public.users.is_team is
  'On the team, but not an operator. Grants /admin/growth and nothing else; is_admin is the one that grants powers. Counted as staff in the growth metrics.';


-- ------------------------------------------------------------ deliberately --
-- NOT granted to anon. Whether somebody is on the team is not something an
-- event page needs, and migration-hide-emails.sql revoked the table and
-- granted twelve columns back precisely so that new columns are private until
-- somebody decides otherwise. This is that decision: no.


-- ------------------------------------------------------------- who to add --
-- Run this with the right address. Kept out of the file body on purpose, so
-- that re-running the migration never silently re-grants somebody who was
-- deliberately removed.
--
--   update public.users
--      set is_team = true
--    where lower(email) = lower('their@email.com');


-- ------------------------------------------------------------ where we are --
select
  name,
  is_admin,
  is_team
from public.users
where is_admin or is_team
order by is_admin desc, name;
