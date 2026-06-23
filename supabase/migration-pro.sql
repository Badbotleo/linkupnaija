-- ============================================================================
-- LinkUpNaija — Pro subscription migration
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

alter table public.users add column if not exists is_pro         boolean not null default false;
alter table public.users add column if not exists pro_expires_at timestamptz;

-- (Users update their own row via the existing
--  "Users can update their own profile" policy, so the Go Pro flow can set
--  is_pro / pro_expires_at after a successful Paystack payment.)
