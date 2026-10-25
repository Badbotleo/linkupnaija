-- ============================================================================
-- LinkUpNaija — transport operators: login, fleet, commission, ride payment
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- Closes the four gaps that stopped a car hire company being a real partner:
--
--   1. No login.      An operator lived in `opportunities`, which has no
--                     user_id, so nobody could sign in and see their own work.
--   2. No fleet.      `drivers` assumes one person, one car. A company with
--                     twenty cars had to pretend to be twenty people.
--   3. No commission. Nothing on a ride recorded what LinkUpNaija earned.
--   4. No payment.    Rides never reached Paystack, so the fare was settled
--                     off-platform and our cut depended on someone remembering.
--
-- The money design mirrors ticketing: the rider pays the fare plus a booking
-- fee, Paystack splits the charge as it is collected, the operator's fare
-- lands in their own subaccount and never passes through our hands.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The operator: a business, with a login.
-- ----------------------------------------------------------------------------
create table if not exists public.operators (
  id                uuid primary key default gen_random_uuid(),

  -- The login. Nullable because an application exists before the account does:
  -- a company applies, we approve, then we invite them and attach the user.
  user_id           uuid unique references public.users (id) on delete set null,

  business_name     text not null,
  contact_name      text,
  phone             text,
  email             text,
  state             text,
  city              text,

  -- Who we are actually contracting with.
  rc_number         text,                       -- CAC registration number
  tin               text,                       -- Tax Identification Number

  -- Payout. The subaccount is what makes the split possible: Paystack sends
  -- the fare here directly, so we are never holding the operator's money.
  subaccount_code   text,
  payout_bank       text,
  payout_account_number text,
  payout_account_name   text,

  -- Commission, stored per operator rather than as a global constant, because
  -- the first partner's rate should not silently become everyone's rate.
  commission_percent numeric(5,2) not null default 5.00
                     check (commission_percent >= 0 and commission_percent <= 100),

  status            text not null default 'pending'
                    check (status in ('pending','approved','rejected','suspended')),
  admin_notes       text,

  -- The documents they uploaded with the application: CAC, TIN, insurance,
  -- vehicle papers. Metadata only; the files themselves live in the private
  -- `operator-docs` bucket under a folder named for this row's id.
  documents         jsonb not null default '[]'::jsonb,

  approved_at       timestamptz,
  approved_by       uuid references public.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists operators_status_idx on public.operators (status, created_at desc);
create index if not exists operators_state_idx  on public.operators (state) where status = 'approved';

-- One business per login.
create unique index if not exists operators_user_uniq
  on public.operators (user_id) where user_id is not null;

-- ----------------------------------------------------------------------------
-- 2. The fleet. A vehicle belongs to the company, not to a driver, which is
--    the whole difference between this and the `drivers` table.
-- ----------------------------------------------------------------------------
create table if not exists public.operator_vehicles (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null references public.operators (id) on delete cascade,

  make           text,
  model          text,
  colour         text,
  year           int,
  plate_number   text not null,
  seats          int not null default 4 check (seats between 1 and 60),

  -- Must match a class in lib/fares.ts or the fare estimate means nothing.
  vehicle_class  text not null default 'Sedan'
                 check (vehicle_class in ('Sedan','SUV','Bus','Luxury')),

  photo_url      text,

  -- Expiry dates, not just document URLs: a certificate that lapses mid-term
  -- is the failure mode here, and a date can be checked by a query.
  insurance_expiry    date,
  roadworthiness_expiry date,
  licence_expiry      date,

  status         text not null default 'active'
                 check (status in ('active','inactive','grounded')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists operator_vehicles_op_idx
  on public.operator_vehicles (operator_id, status);

-- A plate exists once across the whole platform, same rule as `drivers`.
create unique index if not exists operator_vehicles_plate_uniq
  on public.operator_vehicles (upper(replace(plate_number, ' ', '')));

-- ----------------------------------------------------------------------------
-- 3. Drivers can now belong to a company. Null still means an independent
--    driver who signed up for themselves, which keeps every existing row valid.
-- ----------------------------------------------------------------------------
alter table public.drivers
  add column if not exists operator_id uuid references public.operators (id) on delete set null;

alter table public.drivers
  add column if not exists vehicle_id uuid references public.operator_vehicles (id) on delete set null;

create index if not exists drivers_operator_idx
  on public.drivers (operator_id) where operator_id is not null;

-- ----------------------------------------------------------------------------
-- 4. Commission and payment on the ride itself.
--
--    Both the rate and the cash amount are stored. The rate alone would mean
--    a future rate change silently rewrites what past trips earned.
-- ----------------------------------------------------------------------------
alter table public.ride_requests
  add column if not exists operator_id        uuid references public.operators (id) on delete set null,
  add column if not exists commission_percent numeric(5,2),
  add column if not exists commission_amount  integer,           -- ₦, what we earned
  add column if not exists operator_amount    integer,           -- ₦, the fare they quoted
  add column if not exists rider_total        integer,           -- ₦, what the rider was charged
  add column if not exists paystack_reference text,
  add column if not exists payment_status     text not null default 'unpaid'
                          check (payment_status in ('unpaid','paid','refunded','failed')),
  add column if not exists paid_at            timestamptz;

create unique index if not exists ride_requests_paystack_ref_uniq
  on public.ride_requests (paystack_reference) where paystack_reference is not null;

create index if not exists ride_requests_operator_idx
  on public.ride_requests (operator_id, status, created_at desc);

-- ----------------------------------------------------------------------------
-- 5. Who is an operator? Used by every policy below.
-- ----------------------------------------------------------------------------
-- Is this the platform acting, rather than a person?
--
-- `is_admin()` reads auth.uid(), which is NULL for the service role, so an
-- admin check alone would have blocked our own server routes from recording a
-- payment. The money triggers below have to let the platform through, and
-- nobody else.
create or replace function public.is_platform()
returns boolean
language sql
stable
as $$
  select
    public.is_admin()
    or coalesce(
         nullif(current_setting('request.jwt.claim.role', true), ''),
         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
         current_user
       ) in ('service_role', 'postgres', 'supabase_admin');
$$;

create or replace function public.operator_id_for_current_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.operators
  where user_id = auth.uid() and status = 'approved'
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 6. Row level security.
-- ----------------------------------------------------------------------------
alter table public.operators         enable row level security;
alter table public.operator_vehicles enable row level security;

-- Operators read their own record; admins read everything. Nobody else sees a
-- business's bank details.
drop policy if exists "Operators read own record" on public.operators;
create policy "Operators read own record"
  on public.operators for select
  using (user_id = auth.uid() or public.is_admin());

-- An operator may correct their own contact details. Status, commission and
-- subaccount are admin territory, enforced by the trigger below rather than
-- by the policy, because a policy cannot see which column changed.
drop policy if exists "Operators update own record" on public.operators;
create policy "Operators update own record"
  on public.operators for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins insert operators" on public.operators;
create policy "Admins insert operators"
  on public.operators for insert
  with check (public.is_admin());

drop policy if exists "Admins delete operators" on public.operators;
create policy "Admins delete operators"
  on public.operators for delete
  using (public.is_admin());

-- An operator manages their own fleet.
drop policy if exists "Operators read own vehicles" on public.operator_vehicles;
create policy "Operators read own vehicles"
  on public.operator_vehicles for select
  using (operator_id = public.operator_id_for_current_user() or public.is_admin());

drop policy if exists "Operators add own vehicles" on public.operator_vehicles;
create policy "Operators add own vehicles"
  on public.operator_vehicles for insert
  with check (operator_id = public.operator_id_for_current_user() or public.is_admin());

drop policy if exists "Operators update own vehicles" on public.operator_vehicles;
create policy "Operators update own vehicles"
  on public.operator_vehicles for update
  using (operator_id = public.operator_id_for_current_user() or public.is_admin())
  with check (operator_id = public.operator_id_for_current_user() or public.is_admin());

drop policy if exists "Operators delete own vehicles" on public.operator_vehicles;
create policy "Operators delete own vehicles"
  on public.operator_vehicles for delete
  using (operator_id = public.operator_id_for_current_user() or public.is_admin());

-- An operator sees the rides assigned to them, and may quote on them. They
-- must never see another operator's work, nor every rider on the platform.
drop policy if exists "Operators read assigned rides" on public.ride_requests;
create policy "Operators read assigned rides"
  on public.ride_requests for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or operator_id = public.operator_id_for_current_user()
  );

drop policy if exists "Operators quote assigned rides" on public.ride_requests;
create policy "Operators quote assigned rides"
  on public.ride_requests for update
  using (operator_id = public.operator_id_for_current_user() or public.is_admin())
  with check (operator_id = public.operator_id_for_current_user() or public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. An operator must not approve themselves, set their own commission, or
--    repoint their payout subaccount. A policy filters rows, not columns, so
--    this needs a trigger.
-- ----------------------------------------------------------------------------
create or replace function public.operators_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform() then
    return new;
  end if;

  if new.status            is distinct from old.status
  or new.commission_percent is distinct from old.commission_percent
  or new.subaccount_code    is distinct from old.subaccount_code
  or new.user_id            is distinct from old.user_id
  or new.approved_at        is distinct from old.approved_at
  or new.approved_by        is distinct from old.approved_by then
    raise exception 'Only an admin can change status, commission, payout or ownership.';
  end if;

  return new;
end;
$$;

drop trigger if exists operators_guard on public.operators;
create trigger operators_guard
  before update on public.operators
  for each row execute function public.operators_guard_privileged_columns();

-- Likewise, an operator must not rewrite what a ride earned us, nor mark it
-- paid. They may quote a price and move the ride through its own states.
create or replace function public.rides_guard_money_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform() then
    return new;
  end if;

  if new.commission_percent is distinct from old.commission_percent
  or new.commission_amount  is distinct from old.commission_amount
  or new.payment_status     is distinct from old.payment_status
  or new.paystack_reference is distinct from old.paystack_reference
  or new.paid_at            is distinct from old.paid_at
  or new.rider_total        is distinct from old.rider_total
  or new.operator_id        is distinct from old.operator_id then
    raise exception 'Payment and commission fields are set by the platform, not by a client.';
  end if;

  return new;
end;
$$;

drop trigger if exists rides_money_guard on public.ride_requests;
create trigger rides_money_guard
  before update on public.ride_requests
  for each row execute function public.rides_guard_money_columns();

-- ----------------------------------------------------------------------------
-- 8. Operator documents. A private bucket: these are CAC certificates, bank
--    details and government IDs, not cover photos.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('operator-docs', 'operator-docs', false)
on conflict (id) do nothing;

-- No client-side insert policy on purpose. Uploads go through the server route
-- with the service role, which checks file type and size first. A public form
-- that can write straight to storage is free hosting for whoever finds it.
drop policy if exists "Operators read own documents" on storage.objects;
create policy "Operators read own documents"
  on storage.objects for select
  using (
    bucket_id = 'operator-docs'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.operator_id_for_current_user()::text
    )
  );

-- ----------------------------------------------------------------------------
-- 9. What a ride costs, computed in one place so the app and the admin screen
--    can never disagree about the split.
-- ----------------------------------------------------------------------------
create or replace function public.quote_ride_split(
  p_fare integer,
  p_commission_percent numeric default 5.00
)
returns table (fare integer, commission integer, rider_total integer)
language sql
immutable
as $$
  select
    p_fare,
    ceil(p_fare * p_commission_percent / 100.0)::integer,
    p_fare + ceil(p_fare * p_commission_percent / 100.0)::integer;
$$;

-- Note: this deliberately excludes Paystack's own charge. That is added at
-- checkout from the live fee rules, not stored here, because Paystack's
-- pricing is theirs to change and a stale constant would quietly short us.

-- ----------------------------------------------------------------------------
-- 10. What a rider is allowed to know about the company collecting them.
--
--     A policy filters rows, not columns, so this is a view. The payout bank
--     details, CAC number, TIN and uploaded documents stay on the table and
--     never leave it. The subaccount code does ship to the browser, because
--     Paystack's split needs it at checkout and it only ever directs money
--     TOWARDS the operator — the same trade already made for event hosts.
-- ----------------------------------------------------------------------------
create or replace view public.operators_public
with (security_invoker = false) as
  select
    id,
    business_name,
    state,
    city,
    commission_percent,
    subaccount_code
  from public.operators
  where status = 'approved';

grant select on public.operators_public to authenticated;
