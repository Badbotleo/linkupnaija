-- Which ticket type a guest actually bought.
--
-- SCHEMA CHANGE: one nullable column on rsvps. Nothing else is touched — an
-- rsvp with no tier behaves exactly as it does today, and check_in_attendee
-- is deliberately left alone.
--
-- I nearly rewrote that function to return the tier and would have broken
-- the scanner: it takes `p_rsvp` and returns `title`/`already`, and my
-- version changed both. The client reads the tier in a second query instead,
-- which cannot break a function I can't see.
--
-- Safe to run more than once.

alter table public.rsvps
  add column if not exists tier_id uuid
  references public.ticket_tiers(id) on delete set null;

create index if not exists rsvps_tier_idx on public.rsvps (tier_id);
