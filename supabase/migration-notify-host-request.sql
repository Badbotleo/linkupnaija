-- ============================================================================
-- LinkUpNaija — Notify the host when someone asks to join
--
-- The host was never told about a new request. Every existing rsvp trigger is
-- AFTER UPDATE and notifies the GUEST about the host's decision; nothing fired
-- when the request arrived. And the client can't fill the gap either, because
-- notifications' insert policy is (user_id = auth.uid()), so a guest cannot
-- write a row addressed to the host. Hence a SECURITY DEFINER trigger.
--
-- Fires on INSERT, and also on the declined -> pending transition, since
-- re-sending a request upserts (which resolves to an UPDATE, not an INSERT).
-- Idempotent — safe to re-run.
-- ============================================================================

create or replace function public.notify_host_of_join_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_host  uuid;
  v_title text;
  v_name  text;
begin
  -- Only brand-new pending requests, or one re-opened after a decline.
  if new.status <> 'pending' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'pending' then
    return new;  -- nothing changed that the host needs to hear about again
  end if;

  select e.host_id, e.title into v_host, v_title
    from public.events e where e.id = new.event_id;

  -- No host row, or the host is joining their own event: nothing to send.
  if v_host is null or v_host = new.user_id then
    return new;
  end if;

  select u.name into v_name from public.users u where u.id = new.user_id;

  insert into public.notifications (user_id, message, event_id)
  values (
    v_host,
    coalesce(v_name, 'Someone') || ' wants to join "' || v_title ||
    '". Review the request.',
    new.event_id
  );

  return new;
end; $$;

drop trigger if exists on_join_request_notify_host on public.rsvps;
create trigger on_join_request_notify_host
  after insert or update of status on public.rsvps
  for each row execute function public.notify_host_of_join_request();
