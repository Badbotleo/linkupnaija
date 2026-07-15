-- ============================================================================
-- LinkUpNaija — QR door check-in
-- Attendees carry a QR ticket (encodes /checkin/<rsvp_id>). The host scans it
-- with their phone camera, which opens the check-in page and calls this RPC to
-- mark attendance. Guarded so only the event's host can check people in.
-- Setting rsvps.attended fires the existing host-stats trigger.
-- ============================================================================

create or replace function public.check_in_attendee(p_rsvp uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event uuid; v_host uuid; v_name text; v_title text; v_was boolean;
begin
  select r.event_id, e.host_id, u.name, e.title, r.attended
    into v_event, v_host, v_name, v_title, v_was
  from public.rsvps r
  join public.events e on e.id = r.event_id
  join public.users  u on u.id = r.user_id
  where r.id = p_rsvp and r.status = 'accepted';

  if v_event is null then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found or not an accepted attendee.');
  end if;
  if v_host is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Only the host can check people in.');
  end if;

  update public.rsvps set attended = true where id = p_rsvp;

  return jsonb_build_object(
    'ok', true,
    'name', coalesce(v_name, 'Guest'),
    'title', v_title,
    'already', coalesce(v_was, false)
  );
end; $$;

grant execute on function public.check_in_attendee(uuid) to authenticated;
