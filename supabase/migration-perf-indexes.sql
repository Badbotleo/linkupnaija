-- ============================================================================
-- LinkUpNaija — Performance indexes
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- Adds indexes for the hottest query paths that were doing sequential scans:
--   • the public events feed  (filter event_type + date, then state/category)
--   • the dashboard "events I'm hosting" list (filter host_id)
--   • the navbar unread-messages badge (filter receiver_id where not read)
-- ============================================================================

-- Events feed: WHERE event_type = 'general' AND date >= today ORDER BY date.
create index if not exists events_type_date_idx
  on public.events (event_type, date);

-- Dashboard: WHERE host_id = :me  (was unindexed → full table scan).
create index if not exists events_host_idx
  on public.events (host_id);

-- Navbar badge: count messages WHERE receiver_id = :me AND read = false.
-- Partial index keeps it tiny (only unread rows) and very fast.
create index if not exists messages_unread_idx
  on public.messages (receiver_id)
  where read = false;

-- Help Postgres pick the new indexes immediately.
analyze public.events;
analyze public.messages;
