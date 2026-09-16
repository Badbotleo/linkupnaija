-- Bring the giveaway draw forward to Sunday 21 September.
--
-- It was set to close the night before the picnic, 26 September, which is
-- thirteen days of holding a free ticket that has not been decided yet. That
-- is how somebody forgets they entered. A week is long enough to gather
-- entries and short enough to stay in mind, and it leaves winners six days to
-- plan rather than one evening.
--
-- 20:00 WAT, so the draw happens on a Sunday night when people are on their
-- phones rather than at nine in the morning.
--
-- Safe to run twice.

update public.ticket_tiers
   set closes_at = timestamptz '2026-09-21 20:00:00+01'
 where claim_code = 'potluck';


-- ------------------------------------------------------------ where we are --
-- Expect closes_at 2026-09-21 19:00 UTC, is_open true, draw_size 10.
select tier_name, claimed, drawn, draw_size, closes_at, is_open
  from public.claim_slots('potluck');
