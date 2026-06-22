-- ============================================================================
-- LinkUpNaija — Group chat migration
-- Run this in Supabase: Dashboard → SQL Editor → New query → Run.
-- (Safe to re-run; everything is idempotent.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- chat_messages — one private group chat per event
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

-- Read: only attendees/host of that event can read its messages.
drop policy if exists "Attendees can read event chat" on public.chat_messages;
create policy "Attendees can read event chat"
  on public.chat_messages for select
  using (public.can_access_event_chat(event_id));

-- Insert: must be sending as yourself AND be an attendee/host of the event.
drop policy if exists "Attendees can send messages" on public.chat_messages;
create policy "Attendees can send messages"
  on public.chat_messages for insert
  with check (
    user_id = auth.uid()
    and public.can_access_event_chat(event_id)
  );

-- ----------------------------------------------------------------------------
-- Enable Supabase Realtime for chat_messages
-- ----------------------------------------------------------------------------
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
