-- Friend counts on other people's profiles.
--
-- The connections table is readable only by the two people in it:
--
--   using (requester_id = auth.uid() or receiver_id = auth.uid())
--
-- which is right for the rows and wrong for the number. Counting someone
-- else's friends through that policy returns only the connection between you
-- and them, so every profile showed 0 or 1 — "1 friend" on a page where the
-- viewer was the one friend.
--
-- A count is public the way a follower count is public; the rows are not. So
-- this returns the number without exposing who.
--
-- Safe to run twice.

create or replace function public.friend_count(uid uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
    from public.connections
   where status = 'accepted'
     and (requester_id = uid or receiver_id = uid);
$$;

comment on function public.friend_count(uuid) is
  'Accepted-connection count for a user. SECURITY DEFINER: the count is public, the rows are not.';

-- Logged-out visitors see profiles too, so anon needs it as well.
grant execute on function public.friend_count(uuid) to anon, authenticated;
