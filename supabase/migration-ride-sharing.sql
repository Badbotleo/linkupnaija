-- ============================================================================
-- LinkUpNaija — Share a ride with your paddies
--
-- A rider can bring friends along on a ride request. Each companion gets their
-- own row so they can accept or decline, and the fare split is derived from
-- however many actually accepted rather than however many were invited.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.ride_companions (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null references public.ride_requests (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  status     text not null default 'invited'
             check (status in ('invited', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (ride_id, user_id)
);

create index if not exists ride_companions_ride_idx on public.ride_companions (ride_id);
create index if not exists ride_companions_user_idx on public.ride_companions (user_id, status);

alter table public.ride_companions enable row level security;

-- Who owns the ride this row hangs off?
create or replace function public.owns_ride(p_ride uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.ride_requests r
    where r.id = p_ride and r.user_id = auth.uid()
  );
$$;

-- The rider invites; the invitee and the rider can both see the row.
drop policy if exists "Rider invites companions" on public.ride_companions;
create policy "Rider invites companions"
  on public.ride_companions for insert
  with check (public.owns_ride(ride_id));

drop policy if exists "Rider and companion read" on public.ride_companions;
create policy "Rider and companion read"
  on public.ride_companions for select
  using (user_id = auth.uid() or public.owns_ride(ride_id) or public.is_admin());

-- Only the invitee changes their own answer.
drop policy if exists "Companion answers their invite" on public.ride_companions;
create policy "Companion answers their invite"
  on public.ride_companions for update
  using (user_id = auth.uid());

drop policy if exists "Rider removes companions" on public.ride_companions;
create policy "Rider removes companions"
  on public.ride_companions for delete
  using (public.owns_ride(ride_id));

-- Tell the paddy they've been added to a ride.
create or replace function public.handle_ride_companion_invite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pickup text;
  v_dropoff text;
  v_name text;
begin
  select r.pickup, r.dropoff, u.name
    into v_pickup, v_dropoff, v_name
    from public.ride_requests r
    join public.users u on u.id = r.user_id
   where r.id = new.ride_id;

  insert into public.notifications (user_id, message, event_id)
  values (
    new.user_id,
    coalesce(v_name, 'A friend') || ' added you to a ride from ' ||
    v_pickup || ' to ' || v_dropoff || '. 🚗 Split the fare?',
    null
  );
  return new;
end; $$;

drop trigger if exists on_ride_companion_invite on public.ride_companions;
create trigger on_ride_companion_invite
  after insert on public.ride_companions
  for each row execute function public.handle_ride_companion_invite();
