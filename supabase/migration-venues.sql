-- ============================================================================
-- LinkUpNaija — Venues & Reservations migration
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

create table if not exists public.reservations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  venue_name       text not null,
  venue_address    text,
  venue_lat        double precision,
  venue_lng        double precision,
  event_name       text not null,
  event_type       text,
  date             date not null,
  time             time not null,
  group_size       integer not null default 1,
  special_requests text,
  contact_phone    text,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'declined', 'paid')),
  commission_amount integer,
  admin_notes      text,
  created_at       timestamptz not null default now()
);

create index if not exists reservations_status_idx on public.reservations (status, created_at desc);
create index if not exists reservations_user_idx   on public.reservations (user_id);

alter table public.reservations enable row level security;

-- Users create + read their own; admins read & manage all.
drop policy if exists "Users create their own reservations" on public.reservations;
create policy "Users create their own reservations"
  on public.reservations for insert with check (user_id = auth.uid());

drop policy if exists "Users read their own reservations" on public.reservations;
create policy "Users read their own reservations"
  on public.reservations for select using (user_id = auth.uid());

drop policy if exists "Admins read all reservations" on public.reservations;
create policy "Admins read all reservations"
  on public.reservations for select using (public.is_admin());

drop policy if exists "Admins manage reservations" on public.reservations;
create policy "Admins manage reservations"
  on public.reservations for update using (public.is_admin());

-- Notify the user when a reservation is confirmed or declined.
create or replace function public.handle_reservation_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'declined') then
    insert into public.notifications (user_id, message, event_id)
    values (
      new.user_id,
      case
        when new.status = 'confirmed'
          then 'Your reservation at "' || new.venue_name ||
               '" was confirmed! 🎉 A payment link will be sent shortly.'
        else 'Your reservation at "' || new.venue_name || '" was declined.' ||
             coalesce(' Reason: ' || new.admin_notes, '')
      end,
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_reservation_status_change on public.reservations;
create trigger on_reservation_status_change
  after update on public.reservations
  for each row execute function public.handle_reservation_status_change();
