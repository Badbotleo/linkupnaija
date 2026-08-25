-- Referral reward goes from ₦500 to ₦600, each side.
--
-- This is the other half of migration-withdrawal-minimum.sql. At ₦500 the new
-- ₦3,000 withdrawal floor was six referrals; at ₦600 it is five, which is what
-- the invite copy across the app now promises.
--
-- Both sides are paid: the referrer and the person who joined. So a completed
-- referral costs ₦1,200, not ₦600.
--
-- Past referrals are NOT topped up. Everyone already paid keeps their ₦500 and
-- the new rate applies from the next completion onward. Back-paying the
-- difference is a real decision about real money and is deliberately left out
-- of a rate change; the query at the bottom prices it if you want it.
--
-- Safe to run twice.

create or replace function public.complete_referral(p_ref_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  referrer uuid;
  reward integer := 600;
begin
  if me is null or p_ref_code is null then return; end if;
  if exists (select 1 from public.referrals where referred_id = me) then return; end if;

  select id into referrer from public.users
   where referral_code = upper(p_ref_code) and id <> me;
  if referrer is null then return; end if;

  insert into public.referrals (referrer_id, referred_id, status, reward_amount)
  values (referrer, me, 'completed', reward);

  perform set_config('app.wallet_op', 'on', true);
  update public.users set wallet_balance = wallet_balance + reward where id = referrer;
  update public.users set wallet_balance = wallet_balance + reward where id = me;

  insert into public.wallet_transactions (user_id, amount, type, reason, reference) values
    (referrer, reward, 'credit', 'Referral bonus', 'referral'),
    (me,       reward, 'credit', 'Welcome referral bonus', 'referral');

  insert into public.notifications (user_id, message) values
    (referrer, 'Your referral bonus of ₦' || reward || ' has been added to your LinkUpNaija wallet!'),
    (me,       'Your referral bonus of ₦' || reward || ' has been added to your LinkUpNaija wallet!');
end;
$$;

grant execute on function public.complete_referral(text) to authenticated;


-- ------------------------------------------------------ what this costs you --
-- Run before announcing. Changes nothing.
--
--   already_paid    : referrals completed at the old rate
--   backpay_if_topped_up : what it would cost to bring them all to ₦600,
--                          counting both sides of each referral

select
  count(*)                        as already_paid,
  count(*) * (600 - 500) * 2      as backpay_if_topped_up
from public.referrals
where status = 'completed'
  and reward_amount = 500;
