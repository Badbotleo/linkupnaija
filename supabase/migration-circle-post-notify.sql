-- Tell circle members when somebody posts.
--
-- THE SILENCE HAS A CAUSE. There is exactly one notification trigger on
-- circle_posts, handle_circle_event_post, and it fires only when the post
-- carries an event_id. So sharing an event tells the circle; posting a
-- photo, a thought, or anything else tells nobody at all.
--
-- Measured on 17 Oct 2026: seven circles, 47 memberships, 25 posts ever, and
-- the most recent post in ANY circle was 28 September. Nineteen days of
-- total silence. A member has no way to learn that anything happened, so
-- there is never a reason to open the tab, so nothing happens. This is the
-- loop that is missing, not the discovery.
--
-- Replaces the event trigger rather than running beside it, or an event
-- share would fire two notifications for one post.

create or replace function public.handle_circle_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c_name text;
  poster text;
  body   text;
begin
  select name into c_name from public.circles where id = new.circle_id;
  select coalesce(nullif(trim(name), ''), 'Somebody')
    into poster from public.users where id = new.user_id;

  -- Says who and where, because "New activity" is a notification people
  -- learn to ignore. An event share keeps its own wording and its event_id,
  -- so tapping it still lands on the event rather than the circle.
  if new.event_id is not null then
    insert into public.notifications (user_id, message, event_id, link)
    select m.user_id,
           poster || ' shared an event in ' || coalesce(c_name, 'your circle'),
           new.event_id,
           '/circles/' || new.circle_id::text
    from public.circle_members m
    where m.circle_id = new.circle_id
      and m.status = 'active'
      and m.user_id <> new.user_id;
  else
    insert into public.notifications (user_id, message, link)
    select m.user_id,
           poster || ' posted in ' || coalesce(c_name, 'your circle'),
           -- Straight to the post, not the circle's first page. A fragment
           -- only lands if the post is still near the top, which it stops
           -- being as soon as a few more arrive.
           '/circles/' || new.circle_id::text || '/posts/' || new.id::text
    from public.circle_members m
    where m.circle_id = new.circle_id
      and m.status = 'active'
      and m.user_id <> new.user_id;
  end if;

  return new;
end; $$;

-- The old trigger goes, and its function with it, so there is one path and
-- no chance of a post notifying twice.
drop trigger if exists on_circle_event_post on public.circle_posts;
drop function if exists public.handle_circle_event_post();

drop trigger if exists on_circle_post on public.circle_posts;
create trigger on_circle_post
  after insert on public.circle_posts
  for each row execute function public.handle_circle_post();

comment on function public.handle_circle_post is
  'Notifies active circle members of any new post, not only event shares. Links to the post itself.';
