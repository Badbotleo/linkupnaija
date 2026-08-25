-- Minimum wallet withdrawal goes from ₦1,000 to ₦3,000.
--
-- The floor is enforced here, in the database, not in the withdrawal button.
-- request_wallet_withdrawal is granted to authenticated, so anybody can call
-- it directly with whatever amount they like; changing only the constant in
-- WalletCard.tsx would leave the real rule at ₦1,000.
--
-- At the current ₦500 referral reward this is 6 completed referrals, not 5.
-- Raising the reward to ₦600 would make it 5 exactly, but that is a change to
-- what every past and future referral pays, so it is deliberately NOT bundled
-- in here.
--
-- Balances already sitting between ₦1,000 and ₦3,000 are untouched and stay
-- spendable in-app; only the cash-out floor moves. Nobody loses money, but
-- somebody who could have withdrawn yesterday cannot today, which is worth an
-- announcement rather than a silent deploy.
--
-- Safe to run twice.

create or replace function public.request_wallet_withdrawal(p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  bal integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_amount < 3000 then raise exception 'minimum withdrawal is ₦3,000'; end if;

  select wallet_balance into bal from public.users where id = me for update;
  if bal < p_amount then raise exception 'insufficient wallet balance'; end if;

  perform set_config('app.wallet_op', 'on', true);
  update public.users set wallet_balance = wallet_balance - p_amount where id = me;
  insert into public.wallet_transactions (user_id, amount, type, reason, reference)
  values (me, p_amount, 'debit', 'Withdrawal request', 'withdrawal');
  insert into public.notifications (user_id, message)
  values (me, 'Your withdrawal request of ₦' || p_amount || ' is being processed.');
end;
$$;

grant execute on function public.request_wallet_withdrawal(integer) to authenticated;


-- ------------------------------------------------------------- who this hits --
-- Read this before announcing. Everyone below the new floor who was above the
-- old one is somebody who could withdraw yesterday and cannot today.

select
  count(*) filter (where wallet_balance >= 1000 and wallet_balance < 3000) as newly_blocked,
  count(*) filter (where wallet_balance >= 3000)                          as can_still_withdraw
from public.users;
