-- Friends in common, on a public profile.
--
-- A profile answers "who is this person" with counts and badges. The question
-- somebody actually has is "do I know them", and the strongest answer is the
-- people you both know. The page already shows the link-ups you were both at,
-- which is readable through ordinary RLS; this is the other half.
--
-- WHY A FUNCTION AT ALL. RLS on connections only exposes rows the viewer is
-- part of, which is correct and must stay that way: reading another member's
-- friend list is exactly what the policy exists to prevent. So a direct query
-- for "their friends" returns one row when you are the friend and none
-- otherwise, and the intersection can never be computed in the client.
--
-- WHY IT IS SAFE TO DEFINE AWAY THAT POLICY HERE. The result is intersected
-- with the CALLER'S OWN friends before anything is returned. Every row that
-- comes back is somebody already connected to auth.uid(), whose name and
-- avatar the caller can read through /friends today. Nothing about the
-- profile owner's other friends leaves the function: a person connected to
-- them and not to you is counted nowhere and returned never.
--
-- Depends on nothing but connections and users. Safe to re-run.

create or replace function public.mutual_friends(uid uuid)
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
-- Pinned, because a SECURITY DEFINER function that resolves unqualified
-- names through the caller's search_path is how a definer function gets
-- turned into somebody else's privilege.
set search_path = public, pg_temp
as $$
  with me as (
    -- Mine. auth.uid() rather than a parameter: a caller must never be able
    -- to ask for the intersection of two people who are not them.
    select case
             when c.requester_id = auth.uid() then c.receiver_id
             else c.requester_id
           end as friend_id
      from public.connections c
     where c.status = 'accepted'
       and (c.requester_id = auth.uid() or c.receiver_id = auth.uid())
  ),
  theirs as (
    select case
             when c.requester_id = uid then c.receiver_id
             else c.requester_id
           end as friend_id
      from public.connections c
     where c.status = 'accepted'
       and (c.requester_id = uid or c.receiver_id = uid)
  )
  select u.id, u.name, u.avatar_url
    from public.users u
   where u.id in (select friend_id from me)
     and u.id in (select friend_id from theirs)
     -- Neither of the two people being compared is their own mutual friend.
     and u.id <> auth.uid()
     and u.id <> uid
   order by u.name nulls last
   limit 24;
$$;

-- Anonymous visitors have no auth.uid(), so `me` is empty and the function
-- returns nothing for them. Granted anyway so the page makes one call rather
-- than branching on whether somebody is signed in.
grant execute on function public.mutual_friends(uuid) to anon;
grant execute on function public.mutual_friends(uuid) to authenticated;

-- Explicitly revoked from public so the grants above are the whole list.
revoke all on function public.mutual_friends(uuid) from public;

comment on function public.mutual_friends(uuid) is
  'People connected to BOTH the caller and uid. SECURITY DEFINER because RLS on connections hides the second half; safe because the result is intersected with the caller''s own friends, so nothing about uid''s other connections is exposed.';
