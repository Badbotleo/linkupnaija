-- ============================================================================
-- LinkUpNaija — driver onboarding (Bolt/Uber style)
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

create table if not exists public.drivers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,

  -- Who they are
  full_name         text not null,
  phone             text not null,
  photo_url         text,              -- face photo, shown to riders
  id_type           text,              -- NIN / Driver's Licence / Voter's Card / Passport
  id_number         text,
  id_document_url   text,              -- scan/photo of the ID — NEVER shown to riders
  licence_expiry    date,

  -- What they drive
  vehicle_make      text,
  vehicle_model     text,
  vehicle_colour    text,
  vehicle_year      int,
  plate_number      text,
  vehicle_photo_url text,
  seats             int not null default 4,

  -- Where
  state             text,
  city              text,

  -- Review
  status            text not null default 'pending'
                    check (status in ('pending','approved','rejected','suspended')),
  admin_notes       text,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.users(id) on delete set null,

  rating            numeric(2,1),
  trips_completed   int not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists drivers_status_idx on public.drivers (status, created_at desc);
create index if not exists drivers_state_idx  on public.drivers (state) where status = 'approved';

-- A plate belongs to one driver.
create unique index if not exists drivers_plate_uniq
  on public.drivers (upper(replace(plate_number, ' ', '')))
  where plate_number is not null;

alter table public.drivers enable row level security;

-- Riders may see APPROVED drivers only, and only the safe columns — the ID
-- number and ID document must never reach a rider. Exposed through a view
-- rather than a policy, because a policy filters rows, not columns.
drop policy if exists "Drivers read own record" on public.drivers;
create policy "Drivers read own record"
  on public.drivers for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users create their own driver application" on public.drivers;
create policy "Users create their own driver application"
  on public.drivers for insert
  with check (user_id = auth.uid());

-- An applicant may edit their own details, but must not be able to approve
-- themselves — status changes are admin-only, enforced by the trigger below.
drop policy if exists "Drivers update own record" on public.drivers;
create policy "Drivers update own record"
  on public.drivers for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins delete drivers" on public.drivers;
create policy "Admins delete drivers"
  on public.drivers for delete
  using (public.is_admin());

create or replace function public.guard_driver_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only an admin can change a driver''s status.'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_driver_status_trg on public.drivers;
create trigger guard_driver_status_trg
  before update on public.drivers
  for each row execute function public.guard_driver_status();

-- What a rider is allowed to see about an approved driver.
create or replace view public.public_drivers as
  select id, user_id, full_name, photo_url,
         vehicle_make, vehicle_model, vehicle_colour, vehicle_year,
         plate_number, vehicle_photo_url, seats, state, city,
         rating, trips_completed
    from public.drivers
   where status = 'approved';

-- ----------------------------------------------------------------------------
-- Documents. Private bucket: these are government IDs, not avatars.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('driver-docs', 'driver-docs', false)
on conflict (id) do nothing;

drop policy if exists "Drivers upload own documents" on storage.objects;
create policy "Drivers upload own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Drivers read own documents" on storage.objects;
create policy "Drivers read own documents"
  on storage.objects for select
  using (
    bucket_id = 'driver-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "Drivers replace own documents" on storage.objects;
create policy "Drivers replace own documents"
  on storage.objects for update
  using (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Face and vehicle photos are shown to riders, so they live in a public
-- bucket, separate from the ID documents above.
insert into storage.buckets (id, name, public)
values ('driver-photos', 'driver-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read driver photos" on storage.objects;
create policy "Public read driver photos"
  on storage.objects for select
  using (bucket_id = 'driver-photos');

drop policy if exists "Drivers upload own photos" on storage.objects;
create policy "Drivers upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'driver-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Drivers replace own photos" on storage.objects;
create policy "Drivers replace own photos"
  on storage.objects for update
  using (
    bucket_id = 'driver-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
