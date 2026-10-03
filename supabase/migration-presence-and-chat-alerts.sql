-- Two things the platform could not tell you: who is around, and that
-- somebody has spoken in a group chat you are not currently looking at.
--
-- Safe to run twice.


-- ============================================================ 1 · PRESENCE ==
--
-- users.last_login_at already existed and cannot answer this. It moves once,
-- at sign-in, so somebody who logged in during August and has used the app
-- every day since still reads as "August". Last seen has to follow activity,
-- not authentication.
--
-- WRITTEN FROM THE APP, THROTTLED, NOT FROM A TRIGGER. Every signed-in page
-- render already loads the viewer's own row through getCurrentUserMeta, and
-- that is the natural place to stamp it. The app only writes when the stored
-- value is more than two minutes old, so a member clicking through ten pages
-- causes one update rather than ten.
alter table public.users
  add column if not exists last_seen_at timestamptz;

comment on column public.users.last_seen_at is
  'Last time this member loaded a page while signed in. Updated by the app at most once every two minutes. Public: profiles show "Online now" or "Last seen ...".';

create index if not exists users_last_seen_idx
  on public.users (last_seen_at desc nulls last);

-- Seeded from last_login_at so nobody reads as never-seen on day one. A login
-- IS a sighting; it is just a stale one.
update public.users
   set last_seen_at = last_login_at
 where last_seen_at is null
   and last_login_at is not null;

-- PUBLIC, DELIBERATELY, unlike the rest of what migration-hide-emails.sql
-- held back. A profile page shows this to anyone, including somebody not
-- logged in, so the column has to be readable by anon or the page simply
-- cannot render it. Nothing is exposed that the page is not already showing
-- on purpose.
grant select (last_seen_at) on public.users to anon;


-- ====================================================== 2 · CHAT NOTICES ==
--
-- chat_messages has had realtime since it shipped, so a group chat updates
-- live for anybody sitting on that event page. Everybody else gets nothing,
-- which means the chat only works for people already looking at it.
--
-- ONE UNREAD NOTIFICATION PER CHAT, NOT ONE PER MESSAGE. This is the whole
-- design. Twelve people in a group chat sending twenty messages between them
-- is 240 notification rows under the naive version, and a notifications page
-- that is nothing but one conversation. Instead: if a recipient already has
-- an unread notice for this event's chat, the existing row is updated in
-- place with the newer text and timestamp. They get one line that stays
-- current until they read it.
--
-- Only ACCEPTED attendees and the host are told, and never the sender.
-- Pending and declined requests are not in the room.
create or replace function public.notify_event_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev        record;
  who       text;
  preview   text;
  recipient uuid;
  existing  uuid;
begin
  select id, title, host_id into ev
    from public.events where id = new.event_id;
  if ev.id is null then
    return null;
  end if;

  select coalesce(name, 'Someone') into who
    from public.users where id = new.user_id;

  -- Trimmed to something that fits on one line in a list. The notification is
  -- a doorbell, not the conversation.
  preview := left(coalesce(new.message, ''), 80);
  if length(coalesce(new.message, '')) > 80 then
    preview := preview || '...';
  end if;

  -- Accepted guests plus the host, minus the sender. Wrapped in a subquery
  -- and filtered once at the end rather than filtering each arm of the union,
  -- which is easier to read and impossible to get half right.
  for recipient in
    select uid from (
      select r.user_id as uid
        from public.rsvps r
       where r.event_id = new.event_id
         and r.status = 'accepted'
      union
      select ev.host_id
    ) people
    where uid is not null
      and uid <> new.user_id
  loop
    select id into existing
      from public.notifications
     where user_id = recipient
       and event_id = new.event_id
       and not read
       and link like '%tab=chat'
     limit 1;

    if existing is not null then
      update public.notifications
         set message    = who || ' in ' || ev.title || ': ' || preview,
             created_at = now()
       where id = existing;
    else
      insert into public.notifications (user_id, message, event_id, link)
      values (
        recipient,
        who || ' in ' || ev.title || ': ' || preview,
        new.event_id,
        '/events/' || new.event_id || '?tab=chat'
      );
    end if;
  end loop;

  return null;
end;
$$;

-- AFTER, so the message is committed before anybody is told about it, and
-- so a failure in here can never stop somebody sending a message.
drop trigger if exists chat_messages_notify on public.chat_messages;
create trigger chat_messages_notify
  after insert on public.chat_messages
  for each row execute function public.notify_event_chat();


-- ------------------------------------------------------------ where we are --
select
  (select count(*) from public.users where last_seen_at is not null) as members_with_last_seen,
  (select count(*) from public.users
    where last_seen_at > now() - interval '5 minutes')               as online_right_now,
  (select count(*) from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
    where c.relname = 'chat_messages'
      and t.tgname = 'chat_messages_notify')                         as chat_trigger_installed;
