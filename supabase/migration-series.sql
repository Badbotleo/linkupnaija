-- ============================================================================
-- LinkUpNaija — Event Series (recurring events)
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, rsvps, notifications.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- event_series
-- ----------------------------------------------------------------------------
create table if not exists public.event_series (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references public.users (id) on delete cascade,
  title            text not null,
  description      text,
  category         text,
  state            text,
  location         text,
  frequency        text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  cover_image_url  text,
  subscriber_count integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists event_series_host_idx on public.event_series (host_id);

alter table public.event_series enable row level security;

drop policy if exists "Series are viewable by everyone" on public.event_series;
create policy "Series are viewable by everyone"
  on public.event_series for select using (true);

drop policy if exists "Hosts create their own series" on public.event_series;
create policy "Hosts create their own series"
  on public.event_series for insert with check (host_id = auth.uid());

drop policy if exists "Hosts update their own series" on public.event_series;
create policy "Hosts update their own series"
  on public.event_series for update using (host_id = auth.uid());

drop policy if exists "Hosts delete their own series" on public.event_series;
create policy "Hosts delete their own series"
  on public.event_series for delete using (host_id = auth.uid());

-- ----------------------------------------------------------------------------
-- events.series_id
-- ----------------------------------------------------------------------------
alter table public.events
  add column if not exists series_id uuid references public.event_series (id) on delete set null;
create index if not exists events_series_idx on public.events (series_id, date);

-- ----------------------------------------------------------------------------
-- series_subscriptions
-- ----------------------------------------------------------------------------
create table if not exists public.series_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  series_id  uuid not null references public.event_series (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, series_id)
);
create index if not exists series_subs_series_idx on public.series_subscriptions (series_id);
create index if not exists series_subs_user_idx on public.series_subscriptions (user_id);

alter table public.series_subscriptions enable row level security;

drop policy if exists "Users read own subscriptions" on public.series_subscriptions;
create policy "Users read own subscriptions"
  on public.series_subscriptions for select using (user_id = auth.uid());

drop policy if exists "Users subscribe themselves" on public.series_subscriptions;
create policy "Users subscribe themselves"
  on public.series_subscriptions for insert with check (user_id = auth.uid());

drop policy if exists "Users unsubscribe themselves" on public.series_subscriptions;
create policy "Users unsubscribe themselves"
  on public.series_subscriptions for delete using (user_id = auth.uid());

-- Keep event_series.subscriber_count in sync (public read of the count).
create or replace function public.maintain_subscriber_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.event_series set subscriber_count = subscriber_count + 1
     where id = new.series_id;
  elsif tg_op = 'DELETE' then
    update public.event_series set subscriber_count = greatest(0, subscriber_count - 1)
     where id = old.series_id;
  end if;
  return null;
end;
$$;

drop trigger if exists maintain_subscriber_count on public.series_subscriptions;
create trigger maintain_subscriber_count
  after insert or delete on public.series_subscriptions
  for each row execute function public.maintain_subscriber_count();

-- ----------------------------------------------------------------------------
-- When a new event is added to a series, notify every subscriber and auto-file
-- a pending join request for them (they still need host approval).
-- ----------------------------------------------------------------------------
create or replace function public.handle_series_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s_title text;
begin
  if new.series_id is not null then
    select title into s_title from public.event_series where id = new.series_id;

    insert into public.notifications (user_id, message, event_id)
    select ss.user_id,
           'New ' || coalesce(s_title, 'series') || ' event just dropped — '
             || to_char(new.date::date, 'Mon DD') || '. Join now →',
           new.id
    from public.series_subscriptions ss
    where ss.series_id = new.series_id
      and ss.user_id <> new.host_id;

    insert into public.rsvps (event_id, user_id, status)
    select new.id, ss.user_id, 'pending'
    from public.series_subscriptions ss
    where ss.series_id = new.series_id
      and ss.user_id <> new.host_id
    on conflict (event_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_series_event on public.events;
create trigger on_series_event
  after insert on public.events
  for each row execute function public.handle_series_event();
