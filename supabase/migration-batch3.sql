-- ============================================================================
-- LinkUpNaija — Batch 3 migration
-- Admin flag + platform-fee transactions.
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Admin flag
-- ----------------------------------------------------------------------------
alter table public.users add column if not exists is_admin boolean not null default false;

-- Helper used by RLS policies (security definer avoids RLS recursion on users).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

-- To make yourself an admin, run (with your email):
--   update public.users set is_admin = true where email = 'you@example.com';

-- ----------------------------------------------------------------------------
-- 2. Transactions (platform revenue from paid tickets)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid references public.events (id) on delete set null,
  user_id            uuid references public.users (id) on delete set null,
  amount             integer not null,       -- ticket price paid (₦)
  platform_fee       integer not null,       -- 10% of amount (₦)
  paystack_reference text,
  created_at         timestamptz not null default now()
);

create index if not exists transactions_created_idx on public.transactions (created_at desc);
create index if not exists transactions_event_idx   on public.transactions (event_id);

alter table public.transactions enable row level security;

-- Buyers record their own purchase; admins (and the buyer) can read.
drop policy if exists "Users record their own transactions" on public.transactions;
create policy "Users record their own transactions"
  on public.transactions for insert
  with check (user_id = auth.uid());

drop policy if exists "Admins read all transactions" on public.transactions;
create policy "Admins read all transactions"
  on public.transactions for select
  using (public.is_admin());

drop policy if exists "Users read their own transactions" on public.transactions;
create policy "Users read their own transactions"
  on public.transactions for select
  using (user_id = auth.uid());
