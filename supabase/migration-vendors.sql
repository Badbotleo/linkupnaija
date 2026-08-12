-- Vendors: the people a host hires to make an event happen.
--
-- SCHEMA CHANGE: two new tables and a storage bucket. Nothing existing is
-- altered. Safe to run more than once.
--
-- Enquiries stay ON PLATFORM by design. The same rule that keeps phone
-- numbers out of event descriptions applies here: a marketplace whose first
-- action is "here's my WhatsApp" is a directory, and neither side has any
-- record of what was agreed.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  -- The account that runs this vendor. Nullable so admin can list a vendor
  -- before they have signed up.
  owner_id uuid references public.users(id) on delete set null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 50),
  name text not null check (length(btrim(name)) between 2 and 80),
  category text not null,
  tagline text,
  about text,
  state text,
  /** Cheapest realistic job, in naira. The question every host opens with. */
  price_from integer check (price_from is null or price_from >= 0),
  logo_url text,
  /** Their work. Photos and clips, same handling as partner posters. */
  gallery_urls text[] not null default '{}',
  /** Vetted by us. Not the same as "has an account". */
  is_verified boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_browse_idx
  on public.vendors (is_active, category, state, sort_order);

create table if not exists public.vendor_inquiries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  host_id uuid not null references public.users(id) on delete cascade,
  /** The event it's for, when there is one. */
  event_id uuid references public.events(id) on delete set null,
  message text not null check (length(btrim(message)) between 10 and 2000),
  budget integer check (budget is null or budget >= 0),
  event_date date,
  guests integer check (guests is null or guests > 0),
  status text not null default 'new'
    check (status in ('new', 'replied', 'accepted', 'declined', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists vendor_inquiries_vendor_idx
  on public.vendor_inquiries (vendor_id, created_at desc);
create index if not exists vendor_inquiries_host_idx
  on public.vendor_inquiries (host_id, created_at desc);

alter table public.vendors enable row level security;
alter table public.vendor_inquiries enable row level security;

-- --- vendors ---------------------------------------------------------------
drop policy if exists "Anyone can read active vendors" on public.vendors;
create policy "Anyone can read active vendors"
  on public.vendors for select
  using (is_active or public.is_admin() or owner_id = auth.uid());

drop policy if exists "Owners and admins manage vendors" on public.vendors;
create policy "Owners and admins manage vendors"
  on public.vendors for all
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

-- --- enquiries -------------------------------------------------------------
-- Private to the two parties. An enquiry names a budget and a date; it is
-- nobody else's business.
drop policy if exists "Both sides read their inquiries" on public.vendor_inquiries;
create policy "Both sides read their inquiries"
  on public.vendor_inquiries for select
  using (
    host_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.vendors v
      where v.id = vendor_inquiries.vendor_id and v.owner_id = auth.uid()
    )
  );

drop policy if exists "Signed-in hosts can enquire" on public.vendor_inquiries;
create policy "Signed-in hosts can enquire"
  on public.vendor_inquiries for insert
  with check (host_id = auth.uid());

-- Only the vendor moves the status along.
drop policy if exists "Vendors update their inquiries" on public.vendor_inquiries;
create policy "Vendors update their inquiries"
  on public.vendor_inquiries for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.vendors v
      where v.id = vendor_inquiries.vendor_id and v.owner_id = auth.uid()
    )
  );

-- --- storage ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-assets', 'vendor-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public read vendor assets" on storage.objects;
create policy "Public read vendor assets"
  on storage.objects for select using (bucket_id = 'vendor-assets');

drop policy if exists "Signed-in upload vendor assets" on storage.objects;
create policy "Signed-in upload vendor assets"
  on storage.objects for insert
  with check (bucket_id = 'vendor-assets' and auth.uid() is not null);

drop policy if exists "Signed-in replace vendor assets" on storage.objects;
create policy "Signed-in replace vendor assets"
  on storage.objects for update
  using (bucket_id = 'vendor-assets' and auth.uid() is not null);
