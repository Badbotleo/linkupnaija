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
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text,
  email             text not null,
  state             text,
  avatar_url        text,
  bio               text,
  instagram_url     text,
  twitter_url       text,
  facebook_url      text,
  phone             text,
  profile_completed boolean not null default false,
  created_at        timestamptz not null default now()
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
  host_id         uuid not null references public.users (id) on delete cascade,
  max_attendees   integer,
  cover_image_url text,
  created_at      timestamptz not null default now()
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
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id) -- a user can only request once per event
);

create index if not exists rsvps_event_idx on public.rsvps (event_id);
create index if not exists rsvps_user_idx on public.rsvps (user_id);
create index if not exists rsvps_status_idx on public.rsvps (event_id, status);

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

drop policy if exists "Users can request to join" on public.rsvps;
create policy "Users can request to join"
  on public.rsvps for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Hosts can manage requests for their events" on public.rsvps;
create policy "Hosts can manage requests for their events"
  on public.rsvps for update
  using (
    exists (
      select 1 from public.events e
      where e.id = rsvps.event_id and e.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = rsvps.event_id and e.host_id = auth.uid()
    )
  );

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
      where r.event_id = target_event
        and r.user_id = auth.uid()
        and r.status = 'accepted'
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

-- ----------------------------------------------------------------------------
-- Avatar storage bucket + policies (public read, owner-only write).
-- Files live under a folder named after the user's id: "<uid>/...".
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Event cover storage bucket + policies (public read, owner-only write).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

drop policy if exists "Event covers are publicly readable" on storage.objects;
create policy "Event covers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-covers');

drop policy if exists "Users can upload event covers" on storage.objects;
create policy "Users can upload event covers"
  on storage.objects for insert
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their event covers" on storage.objects;
create policy "Users can update their event covers"
  on storage.objects for update
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their event covers" on storage.objects;
create policy "Users can delete their event covers"
  on storage.objects for delete
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Batch 2: notifications, reviews/ratings, paid + featured events
-- (See supabase/migration-batch2.sql for the standalone migration.)
-- ============================================================================

alter table public.users  add column if not exists rating_avg   numeric(3,2) not null default 0;
alter table public.users  add column if not exists rating_count integer      not null default 0;
alter table public.events add column if not exists price          integer     not null default 0;
alter table public.events add column if not exists featured       boolean     not null default false;
alter table public.events add column if not exists featured_until timestamptz;
alter table public.rsvps  add column if not exists payment_reference text;
alter table public.rsvps  add column if not exists paid             boolean not null default false;

create index if not exists events_featured_idx on public.events (featured_until);

-- notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  message    text not null,
  event_id   uuid references public.events (id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications for select using (user_id = auth.uid());
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update using (user_id = auth.uid());

create or replace function public.handle_rsvp_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev_title text;
begin
  if new.status is distinct from old.status
     and new.status in ('accepted', 'declined') then
    select title into ev_title from public.events where id = new.event_id;
    insert into public.notifications (user_id, message, event_id)
    values (
      new.user_id,
      case when new.status = 'accepted'
        then 'Your request to join "' || coalesce(ev_title, 'an event') || '" was accepted! 🎉'
        else 'Your request to join "' || coalesce(ev_title, 'an event') || '" was declined.'
      end,
      new.event_id
    );
  end if;
  return new;
end; $$;

drop trigger if exists on_rsvp_status_change on public.rsvps;
create trigger on_rsvp_status_change
  after update on public.rsvps
  for each row execute function public.handle_rsvp_status_change();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- reviews
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  reviewer_id uuid not null references public.users (id) on delete cascade,
  host_id     uuid not null references public.users (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  review_text text,
  created_at  timestamptz not null default now(),
  unique (event_id, reviewer_id)
);
create index if not exists reviews_host_idx  on public.reviews (host_id);
create index if not exists reviews_event_idx on public.reviews (event_id);
alter table public.reviews enable row level security;

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Reviews are viewable by everyone"
  on public.reviews for select using (true);

drop policy if exists "Attendees can review past events" on public.reviews;
create policy "Attendees can review past events"
  on public.reviews for insert with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = reviews.event_id and e.host_id = reviews.host_id
        and e.date < current_date
    )
    and exists (
      select 1 from public.rsvps r
      where r.event_id = reviews.event_id and r.user_id = auth.uid()
        and r.status = 'accepted'
    )
  );

drop policy if exists "Reviewers can update their review" on public.reviews;
create policy "Reviewers can update their review"
  on public.reviews for update using (reviewer_id = auth.uid());

create or replace function public.refresh_host_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  target := coalesce(new.host_id, old.host_id);
  update public.users u set
    rating_count = (select count(*) from public.reviews r where r.host_id = target),
    rating_avg = coalesce(
      (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.host_id = target), 0)
  where u.id = target;
  return null;
end; $$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_host_rating();

-- ============================================================================
-- Batch 3: admin flag + platform-fee transactions
-- (See supabase/migration-batch3.sql for the standalone migration.)
-- ============================================================================

alter table public.users add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid references public.events (id) on delete set null,
  user_id            uuid references public.users (id) on delete set null,
  amount             integer not null,
  platform_fee       integer not null,
  paystack_reference text,
  created_at         timestamptz not null default now()
);
create index if not exists transactions_created_idx on public.transactions (created_at desc);
create index if not exists transactions_event_idx   on public.transactions (event_id);
alter table public.transactions enable row level security;

drop policy if exists "Users record their own transactions" on public.transactions;
create policy "Users record their own transactions"
  on public.transactions for insert with check (user_id = auth.uid());

drop policy if exists "Admins read all transactions" on public.transactions;
create policy "Admins read all transactions"
  on public.transactions for select using (public.is_admin());

drop policy if exists "Users read their own transactions" on public.transactions;
create policy "Users read their own transactions"
  on public.transactions for select using (user_id = auth.uid());

-- ============================================================================
-- Venues: reservation requests
-- (See supabase/migration-venues.sql for the standalone migration.)
-- ============================================================================

create table if not exists public.reservations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  venue_name       text not null,
  venue_address    text,
  venue_lat        double precision,
  venue_lng        double precision,
  event_name       text not null,
  event_type       text,
  date             date not null,
  time             time not null,
  group_size       integer not null default 1,
  special_requests text,
  contact_phone    text,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'declined', 'paid')),
  commission_amount integer,
  admin_notes      text,
  created_at       timestamptz not null default now()
);
create index if not exists reservations_status_idx on public.reservations (status, created_at desc);
create index if not exists reservations_user_idx   on public.reservations (user_id);
alter table public.reservations enable row level security;

drop policy if exists "Users create their own reservations" on public.reservations;
create policy "Users create their own reservations"
  on public.reservations for insert with check (user_id = auth.uid());

drop policy if exists "Users read their own reservations" on public.reservations;
create policy "Users read their own reservations"
  on public.reservations for select using (user_id = auth.uid());

drop policy if exists "Admins read all reservations" on public.reservations;
create policy "Admins read all reservations"
  on public.reservations for select using (public.is_admin());

drop policy if exists "Admins manage reservations" on public.reservations;
create policy "Admins manage reservations"
  on public.reservations for update using (public.is_admin());

create or replace function public.handle_reservation_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'declined') then
    insert into public.notifications (user_id, message, event_id)
    values (
      new.user_id,
      case when new.status = 'confirmed'
        then 'Your reservation at "' || new.venue_name || '" was confirmed! 🎉 A payment link will be sent shortly.'
        else 'Your reservation at "' || new.venue_name || '" was declined.' || coalesce(' Reason: ' || new.admin_notes, '')
      end,
      null
    );
  end if;
  return new;
end; $$;

drop trigger if exists on_reservation_status_change on public.reservations;
create trigger on_reservation_status_change
  after update on public.reservations
  for each row execute function public.handle_reservation_status_change();
