-- Every event page said "Page not found" to everybody who was not logged in.
--
-- migration-hide-emails.sql did the right thing in the right shape: it revoked
-- SELECT on public.users from anon, because a column-level revoke does nothing
-- while a table-wide grant stands, and then granted twelve columns back. The
-- fault is in the list, not the method. It covered the columns a profile CARD
-- shows and missed most of what a profile PAGE shows, so ten public columns
-- were left behind:
--
--   is_pro, pro_expires_at, badge_grandfathered_until
--        the gold Pro badge, drawn on the event page, in the guest list and
--        beside every review
--   awarded_badges, revoked_badges
--        the rest of the badges. revoked is needed to take one away, so
--        without it a stranger would see badges that had been withdrawn
--   banner_url, gender, interests, phone_verified, featured_host
--        the public profile itself
--
-- Every one of these is public by design. They are drawn on pages anybody can
-- open, so the columns being readable tells a stranger nothing the page was
-- not already showing them. Leaving them out hid nothing. It only made the
-- queries fail.
--
-- moderation_status, last_login_at, revoked-in-the-other-direction fields and
-- everything in the payout and contact group stay exactly as they are. Those
-- are about a member rather than for the public, and no page shows them to a
-- stranger.
--
-- THE GUEST LIST WAS ALSO GONE, which is the part that costs money. The event
-- page reads gender and is_pro for each attendee, so for a logged-out visitor
-- that query failed too and "Who's going" rendered empty on every event.
-- Somebody arriving from an ad saw a link-up nobody appeared to be attending.
--
-- WHY THE WHOLE PAGE DIED RATHER THAN THE BADGE. PostgREST rejects the entire
-- query when a select names a column the role cannot read, so `event` came
-- back null and the page called notFound(). The page already carries a
-- fallback select for exactly this class of accident, written after a badge
-- feature 404'd the site on 2 Sep 2026, but it only catches 42703 ("column
-- does not exist"). This was 42501 ("permission denied"). Same outcome,
-- different code, so the net it was thrown into had a hole in it. The page
-- fix is in this commit too.
--
-- MEASURED, not guessed. Called with the anon key against three upcoming
-- events, every one of them returned no row and would have rendered 404:
--
--   primary  select -> 42703 column users_1.id_verified_at does not exist
--   fallback select -> 42501 permission denied for table users
--
-- This has been the experience of every logged-out visitor since that
-- migration ran, which includes everybody arriving from an Instagram ad.
--
-- paystack_subaccount_code is deliberately NOT granted. The public select
-- asked for it, but it is a payout routing identifier and a stranger has no
-- business reading it. It is only ever used to open a Paystack payment, which
-- requires a login, so the page now fetches it separately once somebody is
-- signed in.
--
-- Safe to run twice.


-- ------------------------------------------------------------- the ten back --
grant select (
  is_pro,
  pro_expires_at,
  badge_grandfathered_until,
  awarded_badges,
  revoked_badges,
  banner_url,
  gender,
  interests,
  phone_verified,
  featured_host
) on public.users to anon;


-- ------------------------------------------------------------ where we are --
-- Every column the anonymous role can read on users. Expect the twelve from
-- migration-hide-emails.sql plus the ten above, and nothing resembling email,
-- phone, referral_code, is_admin, moderation_status, last_login_at,
-- wallet_balance, payout_* or paystack_subaccount_code.
select column_name
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'users'
   and grantee = 'anon'
   and privilege_type = 'SELECT'
 order by column_name;
