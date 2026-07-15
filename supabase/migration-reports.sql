-- ============================================================================
-- LinkUpNaija — user reporting of events & users
-- Community-driven moderation: any signed-in user can flag an event or person,
-- and reports surface in the admin Moderation panel.
-- ============================================================================

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.users (id) on delete cascade,
  target_type  text not null check (target_type in ('event', 'user')),
  target_id    uuid not null,
  reason       text not null,
  details      text,
  status       text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Anyone signed in can file a report as themselves.
drop policy if exists "Users create their own reports" on public.reports;
create policy "Users create their own reports"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- Only admins can read or triage reports.
drop policy if exists "Admins read reports" on public.reports;
create policy "Admins read reports"
  on public.reports for select using (public.is_admin());

drop policy if exists "Admins update reports" on public.reports;
create policy "Admins update reports"
  on public.reports for update using (public.is_admin());
