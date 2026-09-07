-- Premium subscriptions leave a record.
--
-- GoProButton took ₦4,999 through Paystack, set users.is_pro, and threw the
-- reference away. Nothing was written anywhere. The only evidence a
-- subscription was ever paid for is the receipt in an inbox, which means no
-- list of who subscribed, no renewal history, nothing to reconcile against
-- Paystack, and no way to answer "did this person actually pay" except by
-- trusting a boolean that an admin can also set by hand.
--
-- transactions was the wrong home for it: that table is ticket sales, its
-- rows carry an event_id, and the platform-fee trigger fires on every insert.
-- A subscription is a different thing and gets its own table.
--
-- Safe to run twice.


create table if not exists public.premium_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  amount             integer not null,
  paystack_reference text,
  -- What the subscription was extended to at the moment of paying, so a
  -- renewal history can be read back without recomputing it from durations.
  expires_at         timestamptz,
  created_at         timestamptz not null default now()
);

-- Paystack references are unique, so a double-submit cannot bill twice into
-- the record. Partial, because a hand-granted subscription has no reference.
create unique index if not exists premium_payments_reference_idx
  on public.premium_payments (paystack_reference)
  where paystack_reference is not null;

create index if not exists premium_payments_user_idx
  on public.premium_payments (user_id, created_at desc);

alter table public.premium_payments enable row level security;

-- A member records their own payment and can read it back. Admins read all.
-- Nobody updates or deletes: this is a ledger, and a ledger you can edit is
-- a note.
drop policy if exists "Members record their own subscription" on public.premium_payments;
create policy "Members record their own subscription"
  on public.premium_payments for insert
  with check (user_id = auth.uid());

drop policy if exists "Members read their own subscription" on public.premium_payments;
create policy "Members read their own subscription"
  on public.premium_payments for select
  using (user_id = auth.uid() or public.is_admin());


-- ------------------------------------------------------------ where we are --
-- Run after. Expect 0 rows and the count of people currently marked Premium.
-- Any gap between them is subscriptions taken before this existed, including
-- the ₦4,999 paid on 6 September, which cannot be recovered from here and
-- has to be read off Paystack.

select
  (select count(*) from public.premium_payments)                     as recorded,
  (select count(*) from public.users
    where coalesce(is_pro, false)
      and (pro_expires_at is null or pro_expires_at > now()))         as active_premium;
