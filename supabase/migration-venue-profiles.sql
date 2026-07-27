-- ============================================================================
-- LinkUpNaija — Onboarded venue profiles
--
-- Venue discovery reads live from OpenStreetMap, which gives us coverage but
-- no photos, no pricing and no control. This table holds venues we've actually
-- onboarded: an admin-managed profile with a real picture and details, which
-- takes precedence over the OSM record when both exist.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default 'Restaurants',
  address       text,
  state         text,
  lat           double precision,
  lng           double precision,
  image_url     text,
  description   text,
  phone         text,
  website       text,
  price_range   text,                       -- e.g. "₦₦" or "₦5,000 - ₦20,000"
  capacity      integer,
  /** Links this profile to the OpenStreetMap node it enriches, when it has one. */
  osm_id        text unique,
  is_featured   boolean not null default false,
  is_active     boolean not null default true,
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists venues_active_idx   on public.venues (is_active, is_featured desc, name);
create index if not exists venues_category_idx on public.venues (category) where is_active;
create index if not exists venues_state_idx     on public.venues (state)   where is_active;

alter table public.venues enable row level security;

-- Anyone may read venues that are live; only admins write.
drop policy if exists "Active venues are public" on public.venues;
create policy "Active venues are public"
  on public.venues for select using (is_active or public.is_admin());

drop policy if exists "Admins insert venues" on public.venues;
create policy "Admins insert venues"
  on public.venues for insert with check (public.is_admin());

drop policy if exists "Admins update venues" on public.venues;
create policy "Admins update venues"
  on public.venues for update using (public.is_admin());

drop policy if exists "Admins delete venues" on public.venues;
create policy "Admins delete venues"
  on public.venues for delete using (public.is_admin());

-- Keep updated_at honest so the admin list can sort by "recently edited".
create or replace function public.touch_venue_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists touch_venue_updated_at on public.venues;
create trigger touch_venue_updated_at
  before update on public.venues
  for each row execute function public.touch_venue_updated_at();
