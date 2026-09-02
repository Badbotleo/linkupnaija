-- Existing Pro members keep the gold badge until their term ends.
--
-- The badge now requires an approved government ID. Applying that to people
-- who already paid would take away, mid-subscription, something they bought
-- under different terms, and they would have done nothing wrong. New rules
-- apply to new terms.
--
-- Stamped once rather than inferred, because `pro_expires_at` alone cannot
-- tell a subscription bought yesterday from one bought today: both are simply
-- a future date. Recording the exemption at the moment of the change is the
-- only way to know who was already inside it.
--
-- After this runs the column is never written again by the app. Every
-- exemption expires on its own, the last one on the longest term outstanding,
-- and from then on the badge means an ID was checked. Nothing needs undoing.
--
-- Safe to run twice: the update only touches rows not already stamped.


alter table public.users
  add column if not exists badge_grandfathered_until timestamptz;

comment on column public.users.badge_grandfathered_until is
  'Set once on 2 Sep 2026 for members who were already Pro when the badge began requiring ID. They keep it until this moment passes. Never written by the app.';

update public.users
   set badge_grandfathered_until =
         coalesce(pro_expires_at, now() + interval '1 year')
 where coalesce(is_pro, false)
   and badge_grandfathered_until is null
   and (pro_expires_at is null or pro_expires_at > now());


-- ------------------------------------------------------------ where we are --
-- Run after. `grandfathered` is how many people keep the badge without an ID
-- check, and `longest_exemption` is when the last of them runs out. After that
-- date the badge means exactly one thing.

select
  count(*) filter (where badge_grandfathered_until is not null) as grandfathered,
  count(*) filter (
    where coalesce(is_pro, false)
      and (pro_expires_at is null or pro_expires_at > now())
  )                                                             as active_subscribers,
  max(badge_grandfathered_until)                                as longest_exemption
  from public.users;
