-- Multiple ticket types per event.
--
-- SCHEMA CHANGE: one new table. Nothing existing is altered — events.price
-- stays exactly as it is and remains the source of truth for single-price
-- events, so every current event keeps working untouched.
--
-- Safe to run more than once.

create table if not exists public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  -- Naira, whole numbers. Same convention as events.price.
  price integer not null check (price >= 0),
  /** What you get — the host's own wording, e.g. "1 Malibu · 1 Shisha". */
  description text,
  /** How many people this admits. NULL when it isn't a table/group ticket. */
  admits integer check (admits is null or admits > 0),
  /** How many of this tier exist. NULL = unlimited. */
  quantity integer check (quantity is null or quantity >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_tiers_event_idx
  on public.ticket_tiers (event_id, is_active, sort_order);

alter table public.ticket_tiers enable row level security;

-- Anyone can read tiers for an event they can see — a price list nobody can
-- read is not a price list.
drop policy if exists "Anyone can read ticket tiers" on public.ticket_tiers;
create policy "Anyone can read ticket tiers"
  on public.ticket_tiers for select using (true);

-- Only the event's host manages its tiers. Written as a subquery on events so
-- there is no way to attach a tier to somebody else's event.
drop policy if exists "Hosts manage their ticket tiers" on public.ticket_tiers;
create policy "Hosts manage their ticket tiers"
  on public.ticket_tiers for all
  using (
    exists (
      select 1 from public.events e
      where e.id = ticket_tiers.event_id
        and (e.host_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = ticket_tiers.event_id
        and (e.host_id = auth.uid() or public.is_admin())
    )
  );
