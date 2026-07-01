-- ============================================================================
-- LinkUpNaija — Wallet + Referral program
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, notifications, is_admin().
--
-- Money integrity: wallet_balance lives on users, but the users UPDATE policy
-- lets a user edit their own row — so a client could otherwise inflate their
-- balance. A BEFORE UPDATE trigger reverts any wallet_balance change that isn't
-- made by one of the SECURITY DEFINER wallet functions below (which flag the
-- transaction). All ledger writes go through those functions only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columns on users
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists wallet_balance integer not null default 0;
alter table public.users
  add column if not exists referral_code text;

create unique index if not exists users_referral_code_uidx
  on public.users (referral_code);

-- Auto-assign a unique 8-char referral code on signup.
create or replace function public.set_referral_code()
returns trigger
language plpgsql
as $$
declare
  code text;
begin
  if new.referral_code is null then
    loop
      code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      exit when not exists (select 1 from public.users where referral_code = code);
    end loop;
    new.referral_code := code;
  end if;
  return new;
end;
$$;

drop trigger if exists set_referral_code on public.users;
create trigger set_referral_code
  before insert on public.users
  for each row execute function public.set_referral_code();

-- Backfill existing users (md5 of id keeps them distinct).
update public.users
set referral_code = upper(substr(md5(id::text), 1, 8))
where referral_code is null;

-- ----------------------------------------------------------------------------
-- Guard: only SECURITY DEFINER wallet functions may change wallet_balance.
-- ----------------------------------------------------------------------------
create or replace function public.guard_wallet_balance()
returns trigger
language plpgsql
as $$
begin
  if new.wallet_balance is distinct from old.wallet_balance
     and coalesce(current_setting('app.wallet_op', true), '') <> 'on' then
    new.wallet_balance := old.wallet_balance; -- ignore unauthorised change
  end if;
  return new;
end;
$$;

drop trigger if exists guard_wallet_balance on public.users;
create trigger guard_wallet_balance
  before update on public.users
  for each row execute function public.guard_wallet_balance();

-- ----------------------------------------------------------------------------
-- wallet_transactions (immutable ledger)
-- ----------------------------------------------------------------------------
create table if not exists public.wallet_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  amount     integer not null,                    -- always positive (₦)
  type       text not null check (type in ('credit', 'debit')),
  reason     text,
  reference  text,
  created_at timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx
  on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;
drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions"
  on public.wallet_transactions for select using (user_id = auth.uid());
-- No client insert/update/delete: only the SECURITY DEFINER functions write.

-- ----------------------------------------------------------------------------
-- referrals
-- ----------------------------------------------------------------------------
create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.users (id) on delete cascade,
  referred_id   uuid not null references public.users (id) on delete cascade unique,
  status        text not null default 'pending' check (status in ('pending', 'completed')),
  reward_amount integer not null default 0,
  created_at    timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id);

alter table public.referrals enable row level security;
drop policy if exists "Users read their referrals" on public.referrals;
create policy "Users read their referrals"
  on public.referrals for select
  using (referrer_id = auth.uid() or referred_id = auth.uid());
-- No client writes: complete_referral() creates rows.

-- ============================================================================
-- Wallet functions (SECURITY DEFINER — the only writers of the ledger/balance)
-- ============================================================================

-- Admin: credit any user's wallet with a reason.
create or replace function public.admin_credit_wallet(
  p_user uuid,
  p_amount integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  perform set_config('app.wallet_op', 'on', true);
  update public.users set wallet_balance = wallet_balance + p_amount where id = p_user;
  insert into public.wallet_transactions (user_id, amount, type, reason, reference)
  values (p_user, p_amount, 'credit', coalesce(p_reason, 'Admin credit'), 'admin');
  insert into public.notifications (user_id, message)
  values (p_user, '₦' || p_amount || ' has been added to your LinkUpNaija wallet! 💰');
end;
$$;
grant execute on function public.admin_credit_wallet(uuid, integer, text) to authenticated;

-- Spend wallet balance (e.g. towards an event ticket). Balance-checked.
create or replace function public.redeem_wallet(
  p_amount integer,
  p_reason text,
  p_event uuid default null
)
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
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  select wallet_balance into bal from public.users where id = me for update;
  if bal < p_amount then raise exception 'insufficient wallet balance'; end if;

  perform set_config('app.wallet_op', 'on', true);
  update public.users set wallet_balance = wallet_balance - p_amount where id = me;
  insert into public.wallet_transactions (user_id, amount, type, reason, reference)
  values (me, p_amount, 'debit', coalesce(p_reason, 'Wallet payment'),
          case when p_event is null then null else p_event::text end);
end;
$$;
grant execute on function public.redeem_wallet(integer, text, uuid) to authenticated;

-- Request a withdrawal (min ₦1,000). Holds the funds; admin settles via payout.
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
  if p_amount < 1000 then raise exception 'minimum withdrawal is ₦1,000'; end if;

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

-- Complete a referral once the referred user verifies their email. Idempotent:
-- only the first call per referred user pays out. Called by the referred user.
create or replace function public.complete_referral(p_ref_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  referrer uuid;
  reward integer := 500;
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
