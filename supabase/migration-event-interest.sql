-- ============================================================================
-- LinkUpNaija — "Interested" on event cards
-- A lightweight save, separate from an RSVP: no host approval, no payment.
-- Idempotent — safe to re-run.
-- ============================================================================
create table if not exists public.event_interests (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_interests_user_idx on public.event_interests (user_id, created_at desc);

alter table public.event_interests enable row level security;

drop policy if exists "Interest counts are public" on public.event_interests;
create policy "Interest counts are public"
  on public.event_interests for select using (true);

drop policy if exists "Users mark their own interest" on public.event_interests;
create policy "Users mark their own interest"
  on public.event_interests for insert with check (auth.uid() = user_id);

drop policy if exists "Users remove their own interest" on public.event_interests;
create policy "Users remove their own interest"
  on public.event_interests for delete using (auth.uid() = user_id);
