-- A notification you cannot tap.
--
-- The notifications page links a row only when it carries an event_id.
-- Everything else renders as text you read and then have to act on from
-- memory. A friend request was the worst of them: "X sent you a friend
-- request", and to answer it you closed the page, found People in the menu,
-- and looked for the name you had just read.
--
-- The table is id, user_id, message, event_id, read, created_at. No type, no
-- actor, nowhere to say where a row points. So every notification that is not
-- about an event was a dead end by construction, and matching on the message
-- text in the UI would be a guess that breaks the first time somebody edits a
-- string or an emoji.
--
-- A link column fixes this one and every future one. The page prefers it and
-- falls back to the event, so nothing that works today stops working.
--
-- ALREADY RUN on 16 Sep 2026. This file was clobbered to two bytes before it
-- was committed, so the repository briefly had no record of what the database
-- had been given. Rewritten from the applied state rather than re-derived:
-- notifications.link exists, handle_connection_change() sets it, and the
-- backlog update has already happened.
--
-- Safe to run twice.


-- ----------------------------------------------------------------- the link --
alter table public.notifications
  add column if not exists link text;

comment on column public.notifications.link is
  'Where tapping this notification goes, as a site-relative path. Preferred over event_id. Null means there is nowhere useful to send them.';


-- ------------------------------------------------------- friend requests ----
-- Replaces handle_connection_change() from migration-connections.sql, in
-- place. Same name, same signature, same two messages and the same `return
-- new`, so the two existing triggers (on_connection_insert and
-- on_connection_update) pick it up without being touched.
--
-- Deliberately NOT a new trigger. Adding one alongside those two would have
-- sent every friend request twice, which is the kind of thing that reads fine
-- in a diff and is obvious the moment somebody gets two notifications.
--
--   a request  -> /friends, which is where it is accepted or declined
--   an accept  -> the new friend's profile, because what you want after
--                 "we are friends now" is to look at them, not at a list
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
    insert into public.notifications (user_id, message, link)
    values (new.receiver_id, who || ' sent you a friend request 👋', '/friends');
  elsif tg_op = 'UPDATE'
      and new.status = 'accepted'
      and old.status is distinct from 'accepted' then
    select coalesce(name, 'Someone') into who from public.users where id = new.receiver_id;
    insert into public.notifications (user_id, message, link)
    values (new.requester_id, who || ' accepted your friend request 🤝', '/u/' || new.receiver_id);
  end if;
  return new;
end;
$$;


-- ------------------------------------------------------------- the backlog --
-- Requests already sitting unread are the ones somebody is most likely to
-- open next, and they would stay dead without this. Matched on the wording
-- the old trigger wrote, which is the one moment that guess is safe: it is
-- describing rows that already exist rather than predicting new ones.
update public.notifications
   set link = '/friends'
 where link is null
   and event_id is null
   and message like '%sent you a friend request%';


-- ------------------------------------------------------------ where we are --
-- Every notification that now has somewhere to go, newest first.

select
  case
    when link is not null then link
    when event_id is not null then '/events/' || event_id
    else '(nowhere)'
  end as goes_to,
  count(*) as notifications,
  count(*) filter (where not read) as unread
from public.notifications
group by 1
order by 2 desc;
