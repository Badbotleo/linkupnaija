-- Database-authored copy still said "Pro".
--
-- Two user-facing strings are written by Postgres, not by the app: the
-- monthly host-limit error and the profile-view notification. Renaming the
-- tier in the UI left the database telling members to upgrade to something no
-- longer called that, and pointing at /pro.
--
-- Both functions are reproduced below in full and unchanged except for the
-- wording. That matters: `create or replace` replaces the whole body, so a
-- half-remembered version would quietly drop the parts not retyped. The
-- host-limit one keeps its UTC month boundary, its check_violation errcode
-- and its created_at counting; the profile-view one keeps its Premium branch.
--
-- HostForm matches on /Upgrade to (Pro|Premium)/ so its upgrade link works
-- whether or not this has run.
--
-- Safe to run twice.


-- ---------------------------------------------------------- hosting limit --

create or replace function public.enforce_host_event_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_limit  constant int := 2;   -- keep in sync with FREE_HOST_LIMIT in lib/pro.ts
  is_pro_now  boolean;
  used        int;
begin
  -- Premium members are unlimited. An expired subscription counts as free.
  select coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    into is_pro_now
    from public.users u
   where u.id = new.host_id;

  if coalesce(is_pro_now, false) then
    return new;
  end if;

  -- Count on created_at, not the event date: otherwise someone could host
  -- four, delete one, and host again — or schedule everything into next month
  -- to dodge the window entirely.
  select count(*)
    into used
    from public.events e
   where e.host_id = new.host_id
     and e.created_at >= date_trunc('month', now() at time zone 'utc');

  if used >= free_limit then
    raise exception
      'Free members can host % events per month. Upgrade to Premium for unlimited hosting.',
      free_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;


-- ------------------------------------------------------ profile-view teaser --

create or replace function public.handle_profile_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_name text;
  viewed_is_pro boolean;
begin
  select name into viewer_name from public.users where id = new.viewer_id;
  select (is_pro and (pro_expires_at is null or pro_expires_at > now()))
    into viewed_is_pro from public.users where id = new.viewed_id;

  insert into public.notifications (user_id, message, event_id)
  values (
    new.viewed_id,
    case
      when viewed_is_pro
        then coalesce(viewer_name, 'Someone') || ' viewed your profile'
      else 'Someone viewed your profile 👀 Get Premium to see who → /premium'
    end,
    null
  );
  return new;
end;
$$;


-- ------------------------------------------------------------ where we are --
-- Run after. Both should report true.

select
  (select position('Upgrade to Premium' in prosrc) > 0
     from pg_proc where proname = 'enforce_host_event_limit') as limit_says_premium,
  (select position('/premium' in prosrc) > 0
     from pg_proc where proname = 'handle_profile_view')      as notice_links_premium;
