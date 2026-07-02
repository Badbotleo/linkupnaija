-- ============================================================================
-- LinkUpNaija — Real attendance tracking
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on migration-host-stats.sql.
--
-- Hosts mark who actually showed up (rsvps.attended). host_stats.attendance_rate
-- is then computed from real check-ins instead of the safety-checkin proxy.
-- ============================================================================

-- null = not yet marked, true = showed up, false = no-show.
alter table public.rsvps add column if not exists attended boolean;

-- Recompute now uses rsvps.attended for the attendance rate.
create or replace function public.recompute_host_stats(p_host uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events int;
  v_attendees int;
  v_rating numeric;
  v_reviews int;
  v_attendance numeric;
  v_response numeric;
  v_safety numeric;
begin
  if p_host is null then return; end if;
  select count(*) into v_events from public.events where host_id = p_host;
  if v_events = 0 then
    delete from public.host_stats where host_id = p_host;
    return;
  end if;

  select count(*) into v_attendees
  from public.rsvps r join public.events e on e.id = r.event_id
  where e.host_id = p_host and r.status = 'accepted';

  select coalesce(avg(rating), 0), count(*) into v_rating, v_reviews
  from public.reviews where host_id = p_host;

  select avg(extract(epoch from (r.decided_at - r.created_at)) / 3600.0)
    into v_response
  from public.rsvps r join public.events e on e.id = r.event_id
  where e.host_id = p_host and r.decided_at is not null;

  -- Attendance = showed-up / marked, over past accepted RSVPs the host graded.
  select case when count(*) filter (where r.attended is not null) > 0
              then 100.0 * count(*) filter (where r.attended is true)
                   / count(*) filter (where r.attended is not null)
              else null end
    into v_attendance
  from public.rsvps r
  join public.events e on e.id = r.event_id
  where e.host_id = p_host and e.date < current_date and r.status = 'accepted';

  select case when count(*) filter (where felt_safe is not null) > 0
              then 100.0 * count(*) filter (where felt_safe = 'yes')
                   / count(*) filter (where felt_safe is not null)
              else null end
    into v_safety
  from public.reviews where host_id = p_host;

  insert into public.host_stats (
    host_id, total_events, total_attendees, average_rating, review_count,
    attendance_rate, avg_response_time_hours, safety_score, updated_at
  )
  values (
    p_host, v_events, v_attendees, round(v_rating, 2), v_reviews,
    round(v_attendance, 0), round(v_response, 1), round(v_safety, 0), now()
  )
  on conflict (host_id) do update set
    total_events = excluded.total_events,
    total_attendees = excluded.total_attendees,
    average_rating = excluded.average_rating,
    review_count = excluded.review_count,
    attendance_rate = excluded.attendance_rate,
    avg_response_time_hours = excluded.avg_response_time_hours,
    safety_score = excluded.safety_score,
    updated_at = now();
end;
$$;

-- Refresh all hosts with the new attendance logic.
do $$
declare h uuid;
begin
  for h in select distinct host_id from public.events loop
    perform public.recompute_host_stats(h);
  end loop;
end $$;
