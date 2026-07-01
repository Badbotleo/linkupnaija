-- ============================================================================
-- LinkUpNaija — Smart notifications + Safety features
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, rsvps, connections, messages, notifications, reviews.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profile: emergency contact
-- ----------------------------------------------------------------------------
alter table public.users add column if not exists emergency_contact_name text;
alter table public.users add column if not exists emergency_contact_phone text;

-- ----------------------------------------------------------------------------
-- Reviews: "Did you feel safe?"
-- ----------------------------------------------------------------------------
alter table public.reviews
  add column if not exists felt_safe text
  check (felt_safe in ('yes', 'no', 'somewhat'));

-- ----------------------------------------------------------------------------
-- safety_checkins
-- ----------------------------------------------------------------------------
create table if not exists public.safety_checkins (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,
  event_id              uuid not null references public.events (id) on delete cascade,
  trusted_contact_name  text,
  trusted_contact_phone text,
  shared_at             timestamptz,
  prompted_at           timestamptz,
  checked_in_at         timestamptz,
  created_at            timestamptz not null default now(),
  unique (user_id, event_id)
);
create index if not exists safety_checkins_user_idx on public.safety_checkins (user_id);
create index if not exists safety_checkins_event_idx on public.safety_checkins (event_id);

alter table public.safety_checkins enable row level security;
drop policy if exists "Users read own checkins" on public.safety_checkins;
create policy "Users read own checkins"
  on public.safety_checkins for select using (user_id = auth.uid());
drop policy if exists "Users create own checkins" on public.safety_checkins;
create policy "Users create own checkins"
  on public.safety_checkins for insert with check (user_id = auth.uid());
drop policy if exists "Users update own checkins" on public.safety_checkins;
create policy "Users update own checkins"
  on public.safety_checkins for update using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- blocked_users
-- ----------------------------------------------------------------------------
create table if not exists public.blocked_users (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocked_blocker_idx on public.blocked_users (blocker_id);
create index if not exists blocked_blocked_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;
drop policy if exists "Users read own blocks" on public.blocked_users;
create policy "Users read own blocks"
  on public.blocked_users for select using (blocker_id = auth.uid());
drop policy if exists "Users create own blocks" on public.blocked_users;
create policy "Users create own blocks"
  on public.blocked_users for insert with check (blocker_id = auth.uid());
drop policy if exists "Users remove own blocks" on public.blocked_users;
create policy "Users remove own blocks"
  on public.blocked_users for delete using (blocker_id = auth.uid());

-- Helper: is there a block in either direction between two users?
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Enforce blocks: no friend requests or messages between blocked users.
create or replace function public.enforce_block_connection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.requester_id, new.receiver_id) then
    raise exception 'You cannot connect with this user.';
  end if;
  return new;
end; $$;
drop trigger if exists enforce_block_connection on public.connections;
create trigger enforce_block_connection
  before insert on public.connections
  for each row execute function public.enforce_block_connection();

create or replace function public.enforce_block_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.sender_id, new.receiver_id) then
    raise exception 'You cannot message this user.';
  end if;
  return new;
end; $$;
drop trigger if exists enforce_block_message on public.messages;
create trigger enforce_block_message
  before insert on public.messages
  for each row execute function public.enforce_block_message();

-- ----------------------------------------------------------------------------
-- notification_flags — dedup for one-shot smart notifications.
-- ----------------------------------------------------------------------------
create table if not exists public.notification_flags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  key        text not null,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.notification_flags enable row level security;
-- No policies: only SECURITY DEFINER functions/triggers write here.

-- ----------------------------------------------------------------------------
-- "Your squad is going": when an RSVP is accepted, notify friends (not yet
-- attending) once if 2+ of their friends are now going to the same event.
-- ----------------------------------------------------------------------------
create or replace function public.handle_squad_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_title text;
  ev_date date;
  fid uuid;
  cnt int;
  names text;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select title, date into ev_title, ev_date from public.events where id = new.event_id;

    -- Each accepted friend of the newly-accepted attendee.
    for fid in
      select case when c.requester_id = new.user_id then c.receiver_id else c.requester_id end
      from public.connections c
      where c.status = 'accepted'
        and (c.requester_id = new.user_id or c.receiver_id = new.user_id)
    loop
      -- Skip friends already attending, or already notified for this event.
      if exists (
        select 1 from public.rsvps r
        where r.event_id = new.event_id and r.user_id = fid and r.status = 'accepted'
      ) then continue; end if;
      if exists (
        select 1 from public.notification_flags nf
        where nf.user_id = fid and nf.key = 'squad:' || new.event_id
      ) then continue; end if;

      -- How many of THIS friend's friends are going?
      select count(*) into cnt
      from public.rsvps r
      join public.connections c2 on c2.status = 'accepted'
        and ((c2.requester_id = fid and c2.receiver_id = r.user_id)
          or (c2.receiver_id = fid and c2.requester_id = r.user_id))
      where r.event_id = new.event_id and r.status = 'accepted';

      if cnt >= 2 then
        select string_agg(n, ' and ') into names from (
          select u.name as n
          from public.rsvps r
          join public.connections c3 on c3.status = 'accepted'
            and ((c3.requester_id = fid and c3.receiver_id = r.user_id)
              or (c3.receiver_id = fid and c3.requester_id = r.user_id))
          join public.users u on u.id = r.user_id
          where r.event_id = new.event_id and r.status = 'accepted'
          order by u.name
          limit 2
        ) t;

        insert into public.notifications (user_id, message, event_id)
        values (
          fid,
          '👥 ' || coalesce(names, 'Your friends') || ' are going to "' || coalesce(ev_title, 'an event')
            || '" this ' || to_char(ev_date, 'Dy') || '. Join them →',
          new.event_id
        );
        insert into public.notification_flags (user_id, key)
        values (fid, 'squad:' || new.event_id)
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists on_squad_notification on public.rsvps;
create trigger on_squad_notification
  after update on public.rsvps
  for each row execute function public.handle_squad_notification();
