-- Public or private profile.
--
-- WHAT PRIVATE MEANS HERE. Not invisible, and not a locked door. A private
-- member still appears where they have chosen to appear: on the guest list
-- of an event they joined, in a circle they posted in, in a chat they are
-- part of. What stops is the part they never opted into, which is a stranger
-- reading their bio, their socials, their rating, their badges and when they
-- were last online, from a profile page they can reach by guessing a URL.
--
-- So a private profile shows a name, a photo, a state and a way to connect.
-- Somebody they have accepted sees everything, because they asked and were
-- let in. That is the whole model: the connection IS the permission.
--
-- WHY IT MATTERS MORE THAN THE NUMBERS SUGGEST. There are 23 accepted
-- connections across 319 members, so for most people "connections only" is
-- close to "nobody". That is the correct behaviour for somebody who asked
-- for privacy, and it is worth saying plainly in the settings copy rather
-- than letting them discover it.

alter table public.users
  add column if not exists profile_visibility text not null default 'public';

alter table public.users
  drop constraint if exists users_profile_visibility_check;
alter table public.users
  add constraint users_profile_visibility_check
  check (profile_visibility in ('public', 'private'));

-- PostgREST refuses the whole select when a named column has no grant, so
-- this is granted explicitly or every page reading a profile breaks.
grant select (profile_visibility) on public.users to anon, authenticated;
grant update (profile_visibility) on public.users to authenticated;

/**
 * Is the viewer allowed past a private profile?
 *
 * Self, an admin, or an accepted connection in either direction. Pending
 * does NOT count: 125 of the 148 connections on this platform are pending,
 * and treating a request nobody answered as consent would make the setting
 * meaningless for almost everybody.
 */
create or replace function public.may_see_profile(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    case
      when p_target is null then false
      when auth.uid() = p_target then true
      when (select profile_visibility from public.users where id = p_target)
           is distinct from 'private' then true
      when auth.uid() is null then false
      when public.is_admin() then true
      else exists (
        select 1 from public.connections c
         where c.status = 'accepted'
           and ((c.requester_id = auth.uid() and c.receiver_id = p_target)
             or (c.receiver_id = auth.uid() and c.requester_id = p_target))
      )
    end;
$$;

grant execute on function public.may_see_profile(uuid) to anon, authenticated;
