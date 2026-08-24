-- Attendance and the group chat stop being the same thing.
--
-- On a free event with instant join, a guest is going the moment they tap —
-- no waiting, which is what impulse traffic needs. The host still decides who
-- gets into the chat.
--
-- That split is the point. A stranger in a crowd is fine; a stranger in the
-- group chat is the thing people actually worry about, and it's where "the
-- host approves every guest" is doing real work. So the friction moves off
-- the guest's critical path and stays exactly where it protects the room.
--
-- Safe to run twice.

alter table public.rsvps
  add column if not exists chat_approved boolean not null default false;

comment on column public.rsvps.chat_approved is
  'Host let this attendee into the group chat. Separate from attending.';

-- ---------------------------------------------------------------- backfill --
-- Everybody already accepted keeps the chat they are already in.
--
-- Without this, adding a column that defaults to false would silently remove
-- every current attendee from every conversation they are part of — the
-- migration would read as a feature and land as an outage.
update public.rsvps
   set chat_approved = true
 where status = 'accepted'
   and chat_approved = false;

-- ------------------------------------------------------------------- gate --
-- Chat now needs the flag, not just the status.
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
        and r.chat_approved
    )
    or exists (
      select 1 from public.events e
      where e.id = target_event and e.host_id = auth.uid()
    );
$$;

-- --------------------------------------------------------------- triggers --
-- A host approving somebody by hand is approving them fully — they looked at
-- the person and said yes, and making them say it twice is the friction this
-- work exists to remove. So a status moving to 'accepted' by UPDATE grants
-- the chat with it.
--
-- Auto-confirm is different: nobody looked. That path sets 'accepted' on
-- INSERT and deliberately leaves chat_approved alone, so the host still has a
-- decision to make about the room.
create or replace function public.grant_chat_on_manual_accept()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.chat_approved := true;
  end if;
  return new;
end;
$$;

drop trigger if exists rsvps_grant_chat on public.rsvps;
create trigger rsvps_grant_chat
  before update of status on public.rsvps
  for each row execute function public.grant_chat_on_manual_accept();

-- ------------------------------------------------------------------- RLS ---
-- Only the event's host may move somebody into the chat. The existing host
-- update policy already covers this column, but a guest can update their own
-- row too (that's how reservations work), so chat_approved is pinned here:
-- a guest can never grant it to themselves.
drop policy if exists "Guests cannot self-approve chat" on public.rsvps;
create policy "Guests cannot self-approve chat"
  on public.rsvps for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and chat_approved = (
      select r.chat_approved from public.rsvps r where r.id = rsvps.id
    )
  );
