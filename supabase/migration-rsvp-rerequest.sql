-- ============================================================================
-- LinkUpNaija — Let a guest re-send a join request
--
-- Cancelling deletes the rsvp row, but a request that was declined (or one the
-- client re-sends) leaves it, so inserting again tripped:
--   duplicate key value violates unique constraint "rsvps_event_id_user_id_key"
--
-- The client upserts, which needs an UPDATE policy. A first pass scoped it to
-- status = 'declined', which was wrong: in practice the conflicting row is
-- almost always 'pending', so the upsert then failed with
--   42501 new row violates row-level security policy (USING expression)
-- i.e. the same wall, a different brick.
--
-- The rule we actually want: you may re-open YOUR OWN request as long as it
-- hasn't already been accepted, and the only status you may write is
-- 'pending'. That covers declined -> pending and the harmless pending ->
-- pending, while still making it impossible to accept yourself or to touch an
-- accepted row (cancelling an accepted spot goes through DELETE, which has its
-- own policy).
-- Idempotent — safe to re-run.
-- ============================================================================

drop policy if exists "Users can re-request after a decline" on public.rsvps;
drop policy if exists "Users can re-send their own join request" on public.rsvps;

create policy "Users can re-send their own join request"
  on public.rsvps for update
  using (auth.uid() = user_id and status <> 'accepted')
  with check (auth.uid() = user_id and status = 'pending');
