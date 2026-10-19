-- Referral withdrawals that an admin can actually see and pay.
--
-- WHAT WAS WRONG. request_wallet_withdrawal() debited the member's balance,
-- wrote a 'withdrawal' row into wallet_transactions, and told them it was
-- "being processed". Nothing processed it. There is no admin screen anywhere
-- that reads wallet_transactions: grep the whole admin directory for
-- "withdrawal" and it returns nothing. AdminPayouts covers the `payouts`
-- table, which is host ticket money and a different thing entirely.
--
-- So the money left the member's visible balance and no one was ever told to
-- send it. Two people are sitting in that hole right now, both for N3,000:
-- Patience Nasamu asked on 18 September and Jamani Samuel on 26 September.
-- Patience has since asked again, by hand, through support, which is the only
-- channel that was ever going to work.
--
-- THE STATUS LIVES ON THE LEDGER ROW, not in a new table. The debit is the
-- request: one row, one withdrawal, no way for a separate table to drift out
-- of step with the balance it is supposed to explain.

alter table public.wallet_transactions
  add column if not exists status text,
  add column if not exists settled_at timestamptz,
  add column if not exists settled_by uuid references public.users(id);

-- Only withdrawals carry a status. A referral credit is not pending
-- anything, and giving every row a default would invent a queue out of the
-- entire ledger.
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_status_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_status_check
  check (status is null or status in ('pending', 'paid', 'declined'));

grant select (status, settled_at, settled_by) on public.wallet_transactions
  to authenticated;

-- The two already in the hole. They were requested, they were never settled,
-- and until they carry a status no screen can list them.
update public.wallet_transactions
   set status = 'pending'
 where reference = 'withdrawal'
   and type = 'debit'
   and status is null;

-- Every new request starts as a request.
create or replace function public.request_wallet_withdrawal(p_amount integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me  uuid := auth.uid();
  bal integer;
  open_count integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_amount < 3000 then raise exception 'minimum withdrawal is ₦3,000'; end if;

  -- One open request at a time. Without this, a member who thinks the first
  -- one was lost asks again, and the second debit takes money for a payment
  -- the first request already covers. Patience was one tap from doing exactly
  -- that.
  select count(*) into open_count
    from public.wallet_transactions
   where user_id = me and reference = 'withdrawal' and status = 'pending';
  if open_count > 0 then
    raise exception 'You already have a withdrawal being processed.';
  end if;

  select wallet_balance into bal from public.users where id = me for update;
  if bal < p_amount then raise exception 'insufficient wallet balance'; end if;

  perform set_config('app.wallet_op', 'on', true);
  update public.users set wallet_balance = wallet_balance - p_amount where id = me;
  insert into public.wallet_transactions (user_id, amount, type, reason, reference, status)
  values (me, p_amount, 'debit', 'Withdrawal request', 'withdrawal', 'pending');
  insert into public.notifications (user_id, message)
  values (me, 'Your withdrawal request of ₦' || p_amount || ' is being processed.');
end;
$$;

-- Settle one, as an admin.
--
-- Declining REFUNDS the balance. A declined withdrawal that leaves the money
-- debited is theft by filing error: the member cannot spend it, cannot see
-- it, and has no row explaining where it went.
create or replace function public.admin_settle_withdrawal(p_tx uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tx record;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  if p_status not in ('paid', 'declined') then
    raise exception 'status must be paid or declined';
  end if;

  select * into tx from public.wallet_transactions where id = p_tx for update;
  if tx.id is null then raise exception 'no such transaction'; end if;
  if tx.reference <> 'withdrawal' or tx.type <> 'debit' then
    raise exception 'that is not a withdrawal';
  end if;
  if tx.status <> 'pending' then
    raise exception 'that withdrawal is already %', tx.status;
  end if;

  update public.wallet_transactions
     set status = p_status, settled_at = now(), settled_by = auth.uid()
   where id = p_tx;

  if p_status = 'declined' then
    perform set_config('app.wallet_op', 'on', true);
    update public.users
       set wallet_balance = wallet_balance + tx.amount
     where id = tx.user_id;
    insert into public.wallet_transactions (user_id, amount, type, reason, reference)
    values (tx.user_id, tx.amount, 'credit', 'Withdrawal returned', 'refund');
    insert into public.notifications (user_id, message)
    values (tx.user_id,
            'Your ₦' || tx.amount || ' withdrawal could not be sent, so it is back in your wallet. Email support@linkupnaija.com and we will sort it.');
  else
    insert into public.notifications (user_id, message)
    values (tx.user_id, '₦' || tx.amount || ' has been sent to your bank. 🎉');
  end if;
end;
$$;

revoke all on function public.admin_settle_withdrawal(uuid, text) from public, anon;
grant execute on function public.admin_settle_withdrawal(uuid, text) to authenticated;
