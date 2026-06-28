-- ============================================================================
-- LinkUpNaija — FC26 Tournament registrations
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

create table if not exists public.tournament_registrations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null,
  phone             text not null,
  state             text,
  psn_id            text,
  payment_reference text,
  paid              boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists tournament_reg_created_idx
  on public.tournament_registrations (created_at desc);

alter table public.tournament_registrations enable row level security;

-- Anyone can register (the registration is gated by a Paystack payment in the
-- UI). Only admins can read the rows (they contain personal contact details).
drop policy if exists "Anyone can register for the tournament" on public.tournament_registrations;
create policy "Anyone can register for the tournament"
  on public.tournament_registrations for insert
  with check (true);

drop policy if exists "Admins read tournament registrations" on public.tournament_registrations;
create policy "Admins read tournament registrations"
  on public.tournament_registrations for select
  using (public.is_admin());

-- Public spots-filled count without exposing any personal data.
create or replace function public.count_tournament_registrations()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.tournament_registrations where paid = true;
$$;

grant execute on function public.count_tournament_registrations() to anon, authenticated;
