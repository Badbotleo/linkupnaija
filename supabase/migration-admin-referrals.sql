-- An admin cannot see the referral table.
--
-- The read policy is:
--
--   using (referrer_id = auth.uid() or referred_id = auth.uid())
--
-- which is right for a member and leaves nobody able to read the whole thing.
-- So "who has referred the most people" is a question the product cannot
-- answer about itself, and Invite & earn pays rewards nobody can audit.
--
-- Every other table of this kind already carries the admin clause; this one
-- was written without it. Adding it rather than replacing the member rule,
-- because a member reading their own referrals is correct and stays.
--
-- Safe to run twice.

drop policy if exists "Users read their referrals" on public.referrals;
create policy "Users read their referrals"
  on public.referrals for select
  using (
    referrer_id = auth.uid()
    or referred_id = auth.uid()
    or public.is_admin()
  );


-- ------------------------------------------------------------ where we are --
-- The leaderboard the admin page is about to render. Empty is a fine answer
-- and means nobody has completed a referral yet, which is itself worth
-- knowing about a feature that is shipped and linked in the menu.

select
  u.name,
  count(*)                                          as referred,
  count(*) filter (where r.status = 'completed')    as completed,
  sum(r.reward_amount) filter (where r.status = 'completed') as rewarded
from public.referrals r
join public.users u on u.id = r.referrer_id
group by u.id, u.name
order by completed desc, referred desc
limit 20;
