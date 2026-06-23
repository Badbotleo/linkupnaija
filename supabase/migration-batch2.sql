-- ============================================================================
-- LinkUpNaija — Batch 2 migration
-- Notifications, reviews/ratings, paid events, featured events.
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NEW COLUMNS
-- ----------------------------------------------------------------------------
-- Host rating aggregate (kept up to date by a trigger on reviews).
alter table public.users  add column if not exists rating_avg   numeric(3,2) not null default 0;
alter table public.users  add column if not exists rating_count integer      not null default 0;

-- Paid + featured events.
alter table public.events add column if not exists price          integer     not null default 0; -- in Naira
alter table public.events add column if not exists featured       boolean     not null default false;
alter table public.events add column if not exists featured_until timestamptz;

-- Payment tracking on RSVPs.
alter table public.rsvps  add column if not exists payment_reference text;
alter table public.rsvps  add column if not exists paid             boolean not null default false;

create index if not exists events_featured_idx on public.events (featured_until);

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATIONS
-- ----------------------------------------------------------------------------
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
-- (No insert policy: notifications are created by the security-definer trigger below.)

-- When a host accepts/declines a request, notify the requester.
create or replace function public.handle_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_title text;
begin
  if new.status is distinct from old.status
     and new.status in ('accepted', 'declined') then
    select title into ev_title from public.events where id = new.event_id;
    insert into public.notifications (user_id, message, event_id)
    values (
      new.user_id,
      case
        when new.status = 'accepted'
          then 'Your request to join "' || coalesce(ev_title, 'an event') || '" was accepted! 🎉'
        else 'Your request to join "' || coalesce(ev_title, 'an event') || '" was declined.'
      end,
      new.event_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_rsvp_status_change on public.rsvps;
create trigger on_rsvp_status_change
  after update on public.rsvps
  for each row execute function public.handle_rsvp_status_change();

-- Realtime for the notification bell.
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

-- ----------------------------------------------------------------------------
-- 3. REVIEWS & RATINGS
-- ----------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  reviewer_id uuid not null references public.users (id) on delete cascade,
  host_id     uuid not null references public.users (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  review_text text,
  created_at  timestamptz not null default now(),
  unique (event_id, reviewer_id) -- one review per attendee per event
);

create index if not exists reviews_host_idx  on public.reviews (host_id);
create index if not exists reviews_event_idx on public.reviews (event_id);

alter table public.reviews enable row level security;

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Reviews are viewable by everyone"
  on public.reviews for select using (true);

-- Only accepted attendees of a *past* event may review its host.
drop policy if exists "Attendees can review past events" on public.reviews;
create policy "Attendees can review past events"
  on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = reviews.event_id
        and e.host_id = reviews.host_id
        and e.date < current_date
    )
    and exists (
      select 1 from public.rsvps r
      where r.event_id = reviews.event_id
        and r.user_id = auth.uid()
        and r.status = 'accepted'
    )
  );

drop policy if exists "Reviewers can update their review" on public.reviews;
create policy "Reviewers can update their review"
  on public.reviews for update using (reviewer_id = auth.uid());

-- Keep users.rating_avg / rating_count in sync with reviews.
create or replace function public.refresh_host_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.host_id, old.host_id);
  update public.users u set
    rating_count = (select count(*) from public.reviews r where r.host_id = target),
    rating_avg = coalesce(
      (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.host_id = target),
      0
    )
  where u.id = target;
  return null;
end;
$$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_host_rating();
