-- ============================================================================
-- LinkUpNaija — Let a declined guest ask again
--
-- Cancelling deletes the rsvp row, but a DECLINED one stays, so asking again
-- tripped the (event_id, user_id) unique constraint:
--   duplicate key value violates unique constraint "rsvps_event_id_user_id_key"
--
-- The client now upserts, which needs an UPDATE policy. This one is deliberately
-- narrow — your own row, only while it is declined, and only back to pending —
-- so nobody can flip themselves to accepted.
-- Idempotent — safe to re-run.
-- ============================================================================

drop policy if exists "Users can re-request after a decline" on public.rsvps;
create policy "Users can re-request after a decline"
  on public.rsvps for update
  using (auth.uid() = user_id and status = 'declined')
  with check (auth.uid() = user_id and status = 'pending');
