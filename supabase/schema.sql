-- ============================================================================
-- LinkUpNaija — Supabase schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- users (public profile, 1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  email       text not null,
  state       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       text not null,
  description    text not null default '',
  date           date not null,
  time           time not null,
  location       text not null,
  state          text not null,
  host_id        uuid not null references public.users (id) on delete cascade,
  max_attendees  integer,
  created_at     timestamptz not null default now()
);

create index if not exists events_state_idx on public.events (state);
create index if not exists events_category_idx on public.events (category);
create index if not exists events_date_idx on public.events (date);

-- ----------------------------------------------------------------------------
-- rsvps (a user joining an event)
-- ----------------------------------------------------------------------------
create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id) -- a user can only RSVP once per event
);

create index if not exists rsvps_event_idx on public.rsvps (event_id);
create index if not exists rsvps_user_idx on public.rsvps (user_id);

-- ----------------------------------------------------------------------------
-- Auto-create a public.users row whenever an auth user signs up.
-- name & state are read from the sign-up metadata when provided.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, state)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'state'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.users  enable row level security;
alter table public.events enable row level security;
alter table public.rsvps  enable row level security;

-- users: anyone can read profiles; you can insert/update only your own row.
drop policy if exists "Profiles are viewable by everyone" on public.users;
create policy "Profiles are viewable by everyone"
  on public.users for select using (true);

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update using (auth.uid() = id);

-- events: anyone can read; logged-in users can create events they host;
-- hosts can edit/delete their own events.
drop policy if exists "Events are viewable by everyone" on public.events;
create policy "Events are viewable by everyone"
  on public.events for select using (true);

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
  on public.events for insert with check (auth.uid() = host_id);

drop policy if exists "Hosts can update their events" on public.events;
create policy "Hosts can update their events"
  on public.events for update using (auth.uid() = host_id);

drop policy if exists "Hosts can delete their events" on public.events;
create policy "Hosts can delete their events"
  on public.events for delete using (auth.uid() = host_id);

-- rsvps: anyone can read attendee lists/counts; users manage their own RSVPs.
drop policy if exists "RSVPs are viewable by everyone" on public.rsvps;
create policy "RSVPs are viewable by everyone"
  on public.rsvps for select using (true);

drop policy if exists "Users can RSVP for themselves" on public.rsvps;
create policy "Users can RSVP for themselves"
  on public.rsvps for insert with check (auth.uid() = user_id);

drop policy if exists "Users can cancel their own RSVP" on public.rsvps;
create policy "Users can cancel their own RSVP"
  on public.rsvps for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- chat_messages — one private group chat per event (attendees + host only)
-- ----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  message    text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_event_idx
  on public.chat_messages (event_id, created_at);

alter table public.chat_messages enable row level security;

-- A user may take part in an event's chat if they have RSVP'd to it
-- OR they are the host of the event.
create or replace function public.can_access_event_chat(target_event uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.rsvps r
      where r.event_id = target_event and r.user_id = auth.uid()
    )
    or exists (
      select 1 from public.events e
      where e.id = target_event and e.host_id = auth.uid()
    );
$$;

drop policy if exists "Attendees can read event chat" on public.chat_messages;
create policy "Attendees can read event chat"
  on public.chat_messages for select
  using (public.can_access_event_chat(event_id));

drop policy if exists "Attendees can send messages" on public.chat_messages;
create policy "Attendees can send messages"
  on public.chat_messages for insert
  with check (
    user_id = auth.uid()
    and public.can_access_event_chat(event_id)
  );

-- Enable Supabase Realtime for chat_messages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
