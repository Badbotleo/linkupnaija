-- ============================================================================
-- LinkUpNaija — Ride requests ("hail a car")
--
-- The supply side already exists: car-hire operators register through
-- opportunities (type = 'car_hire'). This is the demand side — a rider asks
-- for a car, an admin matches it to an approved operator and confirms, and the
-- rider gets notified. Same request → confirm shape as venue reservations, so
-- it behaves the way the rest of the app already does.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.ride_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,

  pickup         text not null,
  dropoff        text not null,
  state          text,
  ride_date      date not null,
  ride_time      time not null,
  passengers     integer not null default 1 check (passengers between 1 and 60),
  vehicle_type   text not null default 'Sedan'
                 check (vehicle_type in ('Sedan', 'SUV', 'Bus', 'Luxury')),
  /** Optional: the link-up this ride is for. */
  event_id       uuid references public.events (id) on delete set null,
  contact_phone  text,
  notes          text,

  status         text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'declined', 'completed')),
  /** The approved car-hire operator an admin matched this to. */
  provider_id    uuid references public.opportunities (id) on delete set null,
  quoted_price   integer,
  admin_notes    text,

  created_at     timestamptz not null default now()
);

create index if not exists ride_requests_status_idx on public.ride_requests (status, created_at desc);
create index if not exists ride_requests_user_idx   on public.ride_requests (user_id, created_at desc);

alter table public.ride_requests enable row level security;

drop policy if exists "Users create their own ride requests" on public.ride_requests;
create policy "Users create their own ride requests"
  on public.ride_requests for insert with check (user_id = auth.uid());

drop policy if exists "Users read their own ride requests" on public.ride_requests;
create policy "Users read their own ride requests"
  on public.ride_requests for select using (user_id = auth.uid());

-- Riders may cancel while nobody has acted on it yet.
drop policy if exists "Users cancel their pending ride requests" on public.ride_requests;
create policy "Users cancel their pending ride requests"
  on public.ride_requests for delete
  using (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admins read all ride requests" on public.ride_requests;
create policy "Admins read all ride requests"
  on public.ride_requests for select using (public.is_admin());

drop policy if exists "Admins manage ride requests" on public.ride_requests;
create policy "Admins manage ride requests"
  on public.ride_requests for update using (public.is_admin());

-- Tell the rider as soon as a decision lands.
create or replace function public.handle_ride_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'declined') then
    insert into public.notifications (user_id, message, event_id)
    values (
      new.user_id,
      case
        when new.status = 'confirmed'
          then 'Your ride from ' || new.pickup || ' to ' || new.dropoff ||
               ' is confirmed! 🚗' ||
               coalesce(' Fare: ₦' || new.quoted_price::text || '.', '') ||
               ' The driver will contact you.'
        else 'Your ride request from ' || new.pickup || ' to ' || new.dropoff ||
             ' was declined.' || coalesce(' Reason: ' || new.admin_notes, '')
      end,
      new.event_id
    );
  end if;
  return new;
end; $$;

drop trigger if exists on_ride_status_change on public.ride_requests;
create trigger on_ride_status_change
  after update on public.ride_requests
  for each row execute function public.handle_ride_status_change();
