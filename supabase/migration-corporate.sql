-- ============================================================================
-- LinkUpNaija — Corporate / B2B
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, notifications, is_admin().
-- ============================================================================

create table if not exists public.corporate_accounts (
  id               uuid primary key default gen_random_uuid(),
  company_name     text not null,
  contact_name     text,
  email            text not null,
  phone            text,
  industry         text,
  company_size     text,
  state            text,
  plan             text check (plan in ('starter', 'professional', 'enterprise')),
  event_type       text,
  attendees        integer,
  date_range       text,
  budget_range     text,
  requirements     text,
  notes            text,
  status           text not null default 'new'
                   check (status in ('new', 'contacted', 'proposal_sent', 'confirmed', 'completed')),
  payment_received boolean not null default false,
  event_id         uuid references public.events (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists corporate_status_idx
  on public.corporate_accounts (status, created_at desc);

alter table public.corporate_accounts enable row level security;

-- Anyone can submit an inquiry; only admins read/manage them.
drop policy if exists "Anyone can submit a corporate inquiry" on public.corporate_accounts;
create policy "Anyone can submit a corporate inquiry"
  on public.corporate_accounts for insert with check (true);

drop policy if exists "Admins read corporate accounts" on public.corporate_accounts;
create policy "Admins read corporate accounts"
  on public.corporate_accounts for select using (public.is_admin());

drop policy if exists "Admins manage corporate accounts" on public.corporate_accounts;
create policy "Admins manage corporate accounts"
  on public.corporate_accounts for update using (public.is_admin());

-- Corporate flag on events (for the "Corporate Event 🏢" badge + branding).
alter table public.events
  add column if not exists is_corporate boolean not null default false;

-- Notify all admins when a new corporate inquiry lands.
create or replace function public.handle_corporate_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, message)
  select u.id,
         '🏢 New corporate inquiry from ' || new.company_name
  from public.users u
  where u.is_admin = true;
  return new;
end;
$$;

drop trigger if exists on_corporate_inquiry on public.corporate_accounts;
create trigger on_corporate_inquiry
  after insert on public.corporate_accounts
  for each row execute function public.handle_corporate_inquiry();
