-- ============================================================================
-- LinkUpNaija — Opportunities (service-provider submissions)
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on is_admin() from an earlier migration.
-- ============================================================================

create table if not exists public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('car_hire', 'photographer', 'venue')),
  business_name text not null,
  contact_name  text,
  phone         text,
  email         text,
  details       jsonb not null default '{}'::jsonb,
  state         text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

create index if not exists opportunities_type_idx
  on public.opportunities (type, status, created_at desc);

alter table public.opportunities enable row level security;

-- Anyone can submit a provider application; only admins read/manage them.
drop policy if exists "Anyone can submit an opportunity" on public.opportunities;
create policy "Anyone can submit an opportunity"
  on public.opportunities for insert with check (true);

drop policy if exists "Admins read opportunities" on public.opportunities;
create policy "Admins read opportunities"
  on public.opportunities for select using (public.is_admin());

drop policy if exists "Admins manage opportunities" on public.opportunities;
create policy "Admins manage opportunities"
  on public.opportunities for update using (public.is_admin());
