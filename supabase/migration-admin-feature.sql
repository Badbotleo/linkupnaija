-- Let admins feature any event.
--
-- SCHEMA CHANGE: one added RLS policy on events. Nothing existing is dropped
-- or altered — hosts keep exactly the rights they have.
--
-- Why it was needed: the events UPDATE policy scopes to the host, so an admin
-- pressing "Feature" on somebody else's event matched zero rows. Postgres
-- reports that as SUCCESS with nothing changed, not as an error, which is why
-- the panel looked like it worked and didn't.
--
-- Safe to run more than once.

drop policy if exists "Admins can update any event" on public.events;
create policy "Admins can update any event"
  on public.events for update
  using (public.is_admin())
  with check (public.is_admin());
