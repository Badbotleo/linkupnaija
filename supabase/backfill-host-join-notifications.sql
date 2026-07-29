-- ============================================================================
-- One-off backfill: notify hosts about join requests that predate the
-- notify_host_of_join_request trigger (migration-notify-host-request.sql).
--
-- Uses the same message format as the trigger, skips self-hosted rows, and the
-- NOT EXISTS guard makes it safe to run more than once.
-- ============================================================================

insert into public.notifications (user_id, message, event_id, created_at)
select
  e.host_id,
  coalesce(g.name, 'Someone') || ' wants to join "' || e.title || '". Review the request.',
  r.event_id,
  r.created_at
from public.rsvps r
join public.events e on e.id = r.event_id
left join public.users g on g.id = r.user_id
where r.status = 'pending'
  and e.host_id <> r.user_id
  and not exists (
    select 1 from public.notifications n
     where n.user_id = e.host_id
       and n.event_id = r.event_id
       and n.message like '%' || coalesce(g.name, 'Someone') || ' wants to join%'
  );
