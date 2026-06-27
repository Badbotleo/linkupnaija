-- ============================================================================
-- LinkUpNaija — Batch 4 migration (all waves)
-- Profile views, messaging, payouts, gender, event_type, payout fields.
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on earlier migrations (is_admin(), notifications, rsvps.paid, etc.).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New columns
-- ----------------------------------------------------------------------------
alter table public.users add column if not exists gender text
  check (gender in ('male', 'female', 'prefer not to say'));
alter table public.users add column if not exists payout_bank text;
alter table public.users add column if not exists payout_account_number text;
alter table public.users add column if not exists payout_account_name text;
alter table public.users add column if not exists paystack_subaccount_code text;

-- General (public) vs private (link-only) events.
alter table public.events add column if not exists event_type text not null default 'general'
  check (event_type in ('general', 'private'));

-- ----------------------------------------------------------------------------
-- 2. Notifications: let users create their own (payment-success notifications)
-- ----------------------------------------------------------------------------
drop policy if exists "Users can create their own notifications" on public.notifications;
create policy "Users can create their own notifications"
  on public.notifications for insert with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. profile_views — who viewed whom (+ notify the viewed user)
-- ----------------------------------------------------------------------------
create table if not exists public.profile_views (
  id         uuid primary key default gen_random_uuid(),
  viewer_id  uuid not null references public.users (id) on delete cascade,
  viewed_id  uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists profile_views_viewed_idx
  on public.profile_views (viewed_id, created_at desc);

alter table public.profile_views enable row level security;

drop policy if exists "Users record profile views" on public.profile_views;
create policy "Users record profile views"
  on public.profile_views for insert
  with check (viewer_id = auth.uid() and viewer_id <> viewed_id);

drop policy if exists "Users see relevant profile views" on public.profile_views;
create policy "Users see relevant profile views"
  on public.profile_views for select
  using (viewed_id = auth.uid() or viewer_id = auth.uid());

-- Notify the viewed user. Pro members see the viewer's name; others get a teaser.
create or replace function public.handle_profile_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_name text;
  viewed_is_pro boolean;
begin
  select name into viewer_name from public.users where id = new.viewer_id;
  select (is_pro and (pro_expires_at is null or pro_expires_at > now()))
    into viewed_is_pro from public.users where id = new.viewed_id;

  insert into public.notifications (user_id, message, event_id)
  values (
    new.viewed_id,
    case
      when viewed_is_pro
        then coalesce(viewer_name, 'Someone') || ' viewed your profile'
      else 'Someone viewed your profile 👀 Upgrade to Pro to see who → /pro'
    end,
    null
  );
  return new;
end;
$$;

drop trigger if exists on_profile_view on public.profile_views;
create trigger on_profile_view
  after insert on public.profile_views
  for each row execute function public.handle_profile_view();

-- ----------------------------------------------------------------------------
-- 4. messages — admin ↔ user direct messaging
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.users (id) on delete cascade,
  receiver_id uuid not null references public.users (id) on delete cascade,
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists messages_pair_idx
  on public.messages (sender_id, receiver_id, created_at);
create index if not exists messages_receiver_idx
  on public.messages (receiver_id, read);

alter table public.messages enable row level security;

drop policy if exists "Users send messages" on public.messages;
create policy "Users send messages"
  on public.messages for insert with check (sender_id = auth.uid());

drop policy if exists "Users read their messages" on public.messages;
create policy "Users read their messages"
  on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin());

drop policy if exists "Recipients mark messages read" on public.messages;
create policy "Recipients mark messages read"
  on public.messages for update
  using (receiver_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. payouts — host payout requests
-- ----------------------------------------------------------------------------
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.users (id) on delete cascade,
  event_id     uuid references public.events (id) on delete set null,
  amount       integer not null,
  platform_fee integer not null,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'paid', 'declined')),
  created_at   timestamptz not null default now()
);
create index if not exists payouts_host_idx   on public.payouts (host_id);
create index if not exists payouts_status_idx on public.payouts (status, created_at desc);

alter table public.payouts enable row level security;

drop policy if exists "Hosts create their payout requests" on public.payouts;
create policy "Hosts create their payout requests"
  on public.payouts for insert with check (host_id = auth.uid());

drop policy if exists "Hosts read their payouts" on public.payouts;
create policy "Hosts read their payouts"
  on public.payouts for select using (host_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage payouts" on public.payouts;
create policy "Admins manage payouts"
  on public.payouts for update using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Realtime for messages
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Notify accepted attendees when a host deletes (cancels) an event.
--    Runs BEFORE DELETE so notifications (event_id = null) survive the cascade.
-- ----------------------------------------------------------------------------
create or replace function public.handle_event_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, message, event_id)
  select r.user_id,
         'The event "' || old.title || '" was cancelled by the host.',
         null
  from public.rsvps r
  where r.event_id = old.id and r.status = 'accepted';
  return old;
end;
$$;

drop trigger if exists on_event_deleted on public.events;
create trigger on_event_deleted
  before delete on public.events
  for each row execute function public.handle_event_deleted();

-- Hosts can read transactions for events they host (for payout totals).
drop policy if exists "Hosts read transactions for their events" on public.transactions;
create policy "Hosts read transactions for their events"
  on public.transactions for select
  using (
    exists (
      select 1 from public.events e
      where e.id = transactions.event_id and e.host_id = auth.uid()
    )
  );

-- Admins can delete events (e.g. clearing out expired events).
drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete using (public.is_admin());

-- NOTE: "Expired" events are derived from date < current_date (the feed already
-- hides them) — no status column or cron needed.
