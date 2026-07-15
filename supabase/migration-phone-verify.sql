-- ============================================================================
-- LinkUpNaija — phone (OTP) verification
-- Adds a verified-number flag + a locked-down OTP store. The send/verify Edge
-- Functions use the service role; no direct client access to codes.
-- ============================================================================

alter table public.users
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;

create table if not exists public.phone_verifications (
  user_id      uuid primary key references public.users (id) on delete cascade,
  phone        text not null,
  code         text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  last_sent_at timestamptz not null default now()
);

-- RLS on with no policies = only the service role (Edge Functions) can touch it.
alter table public.phone_verifications enable row level security;
