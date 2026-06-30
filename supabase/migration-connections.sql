-- ============================================================================
-- LinkUpNaija — Friend / connection system
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, rsvps, notifications from earlier migrations.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- connections
-- ----------------------------------------------------------------------------
create table if not exists public.connections (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users (id) on delete cascade,
  receiver_id  uuid not null references public.users (id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  unique (requester_id, receiver_id),
  check (requester_id <> receiver_id)
);

create index if not exists connections_requester_idx
  on public.connections (requester_id, status);
create index if not exists connections_receiver_idx
  on public.connections (receiver_id, status);

alter table public.connections enable row level security;

drop policy if exists "Connections visible to involved users" on public.connections;
create policy "Connections visible to involved users"
  on public.connections for select
  using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users send their own requests" on public.connections;
create policy "Users send their own requests"
  on public.connections for insert
  with check (requester_id = auth.uid());

drop policy if exists "Involved users update connections" on public.connections;
create policy "Involved users update connections"
  on public.connections for update
  using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Involved users delete connections" on public.connections;
create policy "Involved users delete connections"
  on public.connections for delete
  using (requester_id = auth.uid() or receiver_id = auth.uid());

-- ----------------------------------------------------------------------------
-- rsvps.companion_id — links two RSVPs created via "attend with a friend".
-- ----------------------------------------------------------------------------
alter table public.rsvps
  add column if not exists companion_id uuid references public.users (id) on delete set null;

-- ----------------------------------------------------------------------------
-- Notifications on friend request / acceptance (SECURITY DEFINER trigger).
-- ----------------------------------------------------------------------------
create or replace function public.handle_connection_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
begin
  if tg_op = 'INSERT' then
    select coalesce(name, 'Someone') into who from public.users where id = new.requester_id;
    insert into public.notifications (user_id, message)
    values (new.receiver_id, who || ' sent you a friend request 👋');
  elsif tg_op = 'UPDATE'
      and new.status = 'accepted'
      and old.status is distinct from 'accepted' then
    select coalesce(name, 'Someone') into who from public.users where id = new.receiver_id;
    insert into public.notifications (user_id, message)
    values (new.requester_id, who || ' accepted your friend request 🤝');
  end if;
  return new;
end;
$$;

drop trigger if exists on_connection_insert on public.connections;
create trigger on_connection_insert
  after insert on public.connections
  for each row execute function public.handle_connection_change();

drop trigger if exists on_connection_update on public.connections;
create trigger on_connection_update
  after update on public.connections
  for each row execute function public.handle_connection_change();

-- ----------------------------------------------------------------------------
-- notify_friend() — lets a user create an in-app notification for an accepted
-- connection (used by "Invite a friend to this event"). SECURITY DEFINER so it
-- can write a notification row for another user; guarded so you can only notify
-- someone you're actually connected to.
-- ----------------------------------------------------------------------------
create or replace function public.notify_friend(
  p_friend uuid,
  p_message text,
  p_event uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = auth.uid() and c.receiver_id = p_friend)
        or (c.receiver_id = auth.uid() and c.requester_id = p_friend))
  ) then
    raise exception 'not connected';
  end if;
  -- Prepend the caller's name so the recipient sees who it's from.
  select coalesce(name, 'A friend') into who from public.users where id = auth.uid();
  insert into public.notifications (user_id, message, event_id)
  values (p_friend, left(who || ' ' || p_message, 300), p_event);
end;
$$;

grant execute on function public.notify_friend(uuid, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- join_with_friend() — create two linked pending RSVPs (caller + a connected
-- friend) for an event, and notify the friend. SECURITY DEFINER so it can
-- insert an RSVP on the friend's behalf; guarded by the accepted connection.
-- ----------------------------------------------------------------------------
create or replace function public.join_with_friend(
  p_event uuid,
  p_friend uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ev_title text;
  my_name text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = me and c.receiver_id = p_friend)
        or (c.receiver_id = me and c.requester_id = p_friend))
  ) then
    raise exception 'not connected';
  end if;

  select title into ev_title from public.events where id = p_event;
  select coalesce(name, 'A friend') into my_name from public.users where id = me;

  insert into public.rsvps (event_id, user_id, status, companion_id)
  values (p_event, me, 'pending', p_friend)
  on conflict (event_id, user_id)
  do update set companion_id = excluded.companion_id;

  insert into public.rsvps (event_id, user_id, status, companion_id)
  values (p_event, p_friend, 'pending', me)
  on conflict (event_id, user_id)
  do update set companion_id = excluded.companion_id;

  insert into public.notifications (user_id, message, event_id)
  values (
    p_friend,
    my_name || ' wants to attend "' || coalesce(ev_title, 'an event') || '" with you 🤝',
    p_event
  );
end;
$$;

grant execute on function public.join_with_friend(uuid, uuid) to authenticated;
