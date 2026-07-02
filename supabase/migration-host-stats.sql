-- ============================================================================
-- LinkUpNaija — Host reputation scorecard
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, rsvps, reviews, safety_checkins.
-- ============================================================================

-- Badge / feature columns on users (admin overrides + host of the week).
alter table public.users add column if not exists featured_host boolean not null default false;
alter table public.users add column if not exists awarded_badges text[] not null default '{}';
alter table public.users add column if not exists revoked_badges text[] not null default '{}';

-- Record when an RSVP was decided, so we can measure host response time.
alter table public.rsvps add column if not exists decided_at timestamptz;

-- ----------------------------------------------------------------------------
-- host_stats
-- ----------------------------------------------------------------------------
create table if not exists public.host_stats (
  id                     uuid primary key default gen_random_uuid(),
  host_id                uuid not null unique references public.users (id) on delete cascade,
  total_events           integer not null default 0,
  total_attendees        integer not null default 0,
  average_rating         numeric not null default 0,
  review_count           integer not null default 0,
  attendance_rate        numeric,               -- % (null = no data yet)
  avg_response_time_hours numeric,              -- hours (null = no data yet)
  safety_score           numeric,               -- % felt safe (null = no data)
  updated_at             timestamptz not null default now()
);
create index if not exists host_stats_rating_idx on public.host_stats (average_rating desc);

alter table public.host_stats enable row level security;
drop policy if exists "Host stats are viewable by everyone" on public.host_stats;
create policy "Host stats are viewable by everyone"
  on public.host_stats for select using (true);
-- Writes only via the SECURITY DEFINER recompute function below.

-- ----------------------------------------------------------------------------
-- Recompute a host's stats from scratch (cheap; called by triggers).
-- ----------------------------------------------------------------------------
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

  -- Attendance = checked-in / accepted for past events (via safety check-ins).
  select case when count(*) > 0
              then 100.0 * count(*) filter (where sc.checked_in_at is not null) / count(*)
              else null end
    into v_attendance
  from public.rsvps r
  join public.events e on e.id = r.event_id
  left join public.safety_checkins sc on sc.event_id = r.event_id and sc.user_id = r.user_id
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

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
create or replace function public.trg_reviews_hoststats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_host_stats(coalesce(new.host_id, old.host_id));
  return null;
end; $$;
drop trigger if exists reviews_hoststats on public.reviews;
create trigger reviews_hoststats
  after insert or update or delete on public.reviews
  for each row execute function public.trg_reviews_hoststats();

create or replace function public.trg_events_hoststats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_host_stats(coalesce(new.host_id, old.host_id));
  return null;
end; $$;
drop trigger if exists events_hoststats on public.events;
create trigger events_hoststats
  after insert or delete on public.events
  for each row execute function public.trg_events_hoststats();

-- Stamp decided_at when a host accepts/declines a request.
create or replace function public.trg_rsvp_decided()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('accepted', 'declined')
     and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end; $$;
drop trigger if exists rsvp_decided on public.rsvps;
create trigger rsvp_decided
  before update on public.rsvps
  for each row execute function public.trg_rsvp_decided();

create or replace function public.trg_rsvp_hoststats()
returns trigger language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  select host_id into h from public.events where id = coalesce(new.event_id, old.event_id);
  perform public.recompute_host_stats(h);
  return null;
end; $$;
drop trigger if exists rsvp_hoststats on public.rsvps;
create trigger rsvp_hoststats
  after insert or update or delete on public.rsvps
  for each row execute function public.trg_rsvp_hoststats();

-- ----------------------------------------------------------------------------
-- Admin controls (users UPDATE RLS is own-row-only, so these are definers).
-- ----------------------------------------------------------------------------
create or replace function public.admin_feature_host(p_host uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  update public.users set featured_host = false where featured_host = true;
  update public.users set featured_host = true where id = p_host;
end; $$;
grant execute on function public.admin_feature_host(uuid) to authenticated;

create or replace function public.admin_set_badges(
  p_host uuid, p_awarded text[], p_revoked text[]
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  update public.users
    set awarded_badges = coalesce(p_awarded, '{}'),
        revoked_badges = coalesce(p_revoked, '{}')
  where id = p_host;
end; $$;
grant execute on function public.admin_set_badges(uuid, text[], text[]) to authenticated;

-- Backfill for existing hosts.
do $$
declare h uuid;
begin
  for h in select distinct host_id from public.events loop
    perform public.recompute_host_stats(h);
  end loop;
end $$;
