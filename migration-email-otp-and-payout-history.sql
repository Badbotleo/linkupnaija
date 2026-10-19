-- Email OTP as the payout gate, and a payout history a host can read.
--
-- WHY. Payouts were gated on users.phone_verified, which is set only by the
-- Termii SMS flow. A large share of Nigerian numbers sit on the networks' Do
-- Not Disturb list and the transactional route is not reaching them, so the
-- code is billed and never arrives. The host sees "Verify your phone number
-- before requesting a payout", has no way to satisfy it, and their money
-- stays on the platform. A gate nobody can pass is not a control, it is an
-- outage.
--
-- Email is the channel we already run reliably: Resend sends the welcome,
-- reminder and digest mail from the same project today.
--
-- WHAT THIS IS AND IS NOT WORTH. An email OTP proves the person asking for
-- the money can read the account's inbox. That is weaker than a phone check
-- and it is close to what signup already proved. It is kept because it still
-- stops a stolen session on its own from moving money, and because the real
-- controls on a payout are elsewhere and unchanged: the event must have
-- happened, a human approves every payout, and the bank account is resolved
-- against Paystack before a transfer goes out.

-- 1. The OTP store. Same shape as phone_verifications so the two flows read
--    the same way. One live code per user: a second request replaces the
--    first rather than leaving two valid codes alive.
create table if not exists public.email_verifications (
  user_id uuid primary key references public.users(id) on delete cascade,
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default now()
);

alter table public.email_verifications enable row level security;

-- No policies on purpose. Only the edge functions touch this table and they
-- hold the service role, which bypasses RLS. Any policy here would be a way
-- for a signed-in member to read their own live code out of the database,
-- which defeats the point of sending it to the inbox.
revoke all on public.email_verifications from anon, authenticated;

-- 2. The flag the payout gate reads.
alter table public.users
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_verified_at timestamptz;

-- Column grants are additive in PostgREST: a column with no grant makes the
-- WHOLE select fail with 42501, not just that column come back null.
grant select (email_verified, email_verified_at) on public.users to authenticated, anon;

-- 3. When a payout actually moved.
--
-- The table carried created_at and a status string and nothing else, so a
-- history page could say a payout was paid but never when. An admin flipping
-- the status is the only event that matters here, and it is not recorded
-- anywhere, including in the admin's own audit trail.
alter table public.payouts
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz;

create or replace function public.payouts_stamp_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.updated_at := now();
    -- Only the first time it lands on paid. A status corrected back and
    -- forth should not keep rewriting the date the money went out.
    if new.status = 'paid' and old.status <> 'paid' and new.paid_at is null then
      new.paid_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payouts_stamp_status on public.payouts;
create trigger payouts_stamp_status
  before update on public.payouts
  for each row execute function public.payouts_stamp_status();

grant select (paid_at, updated_at) on public.payouts to authenticated;

-- Backfill: rows already marked paid got there before the trigger existed.
-- created_at is the only date we hold for them, and a date that is at worst
-- early beats a column of blanks on every historical row.
update public.payouts
   set paid_at = created_at
 where status = 'paid' and paid_at is null;
