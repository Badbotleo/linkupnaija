-- Partner pages. DEFCON is the first; the point is that the second costs
-- nothing but a row.
--
-- SCHEMA CHANGE: one new table, plus one nullable column on events. Nothing
-- existing is altered and events without a partner behave exactly as now.
--
-- Safe to run more than once.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  -- The URL: /partners/defcon
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 40),
  name text not null check (length(btrim(name)) between 1 and 80),
  tagline text,
  about text,
  logo_url text,
  cover_url text,
  /**
   * The partner's own colours, so their page looks like them rather than like
   * a LinkUpNaija page with their name on it. Hex, validated — a bad value
   * would otherwise land straight in a style attribute.
   */
  brand_color text check (brand_color is null or brand_color ~* '^#[0-9a-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~* '^#[0-9a-f]{6}$'),
  /** Their socials. Public links only — no phone numbers, see below. */
  instagram text,
  tiktok text,
  website text,
  /**
   * The account that manages this partner, once they have one. Nullable so a
   * page can exist before they sign up.
   */
  owner_id uuid references public.users(id) on delete set null,
  state text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_active_idx
  on public.partners (is_active, sort_order);

-- Events belong to a partner, optionally. Nullable and ON DELETE SET NULL:
-- removing a partner must never delete their events.
alter table public.events
  add column if not exists partner_id uuid
  references public.partners(id) on delete set null;

create index if not exists events_partner_idx on public.events (partner_id);

alter table public.partners enable row level security;

drop policy if exists "Anyone can read active partners" on public.partners;
create policy "Anyone can read active partners"
  on public.partners for select
  using (is_active or public.is_admin());

-- Admins manage partners; the partner's own account may edit its page.
drop policy if exists "Admins and owners manage partners" on public.partners;
create policy "Admins and owners manage partners"
  on public.partners for all
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

-- --- partner assets bucket -------------------------------------------------
-- Logos and covers the partner supplies. Public: they're brand marks meant to
-- be seen, and a signed URL on every page view would be cost for nothing.
insert into storage.buckets (id, name, public)
values ('partner-assets', 'partner-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public read partner assets" on storage.objects;
create policy "Public read partner assets"
  on storage.objects for select
  using (bucket_id = 'partner-assets');

drop policy if exists "Admins upload partner assets" on storage.objects;
create policy "Admins upload partner assets"
  on storage.objects for insert
  with check (bucket_id = 'partner-assets' and public.is_admin());

drop policy if exists "Admins replace partner assets" on storage.objects;
create policy "Admins replace partner assets"
  on storage.objects for update
  using (bucket_id = 'partner-assets' and public.is_admin());

drop policy if exists "Admins delete partner assets" on storage.objects;
create policy "Admins delete partner assets"
  on storage.objects for delete
  using (bucket_id = 'partner-assets' and public.is_admin());
