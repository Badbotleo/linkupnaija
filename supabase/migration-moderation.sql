-- ============================================================================
-- LinkUpNaija — Admin moderation: warn / restrict / block users, delete events
-- Run this in the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Moderation columns on users
--    active     — normal account
--    warned     — has received warnings (no restrictions, count tracked)
--    restricted — cannot create events or posts
--    blocked    — cannot create events or posts (strongest flag; shown on host page)
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active', 'warned', 'restricted', 'blocked')),
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists warning_count int not null default 0;

-- ----------------------------------------------------------------------------
-- 2. admin_moderate_user(p_user, p_action, p_reason)
--    Actions: 'warn' | 'restrict' | 'block' | 'clear'
--    users UPDATE RLS is own-row-only, so this is a definer (same pattern as
--    admin_feature_host). Notifies the user with the reason.
-- ----------------------------------------------------------------------------
create or replace function public.admin_moderate_user(
  p_user uuid, p_action text, p_reason text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_message text;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  if p_user = auth.uid() then raise exception 'cannot moderate yourself'; end if;

  if p_action = 'warn' then
    update public.users
      set moderation_status = case when moderation_status = 'active' then 'warned' else moderation_status end,
          warning_count = warning_count + 1,
          moderation_reason = p_reason,
          moderated_at = now()
    where id = p_user;
    v_message := '⚠️ Warning from the LinkUpNaija team'
      || coalesce(': ' || p_reason, '')
      || '. Repeated violations may restrict your account.';

  elsif p_action = 'restrict' then
    update public.users
      set moderation_status = 'restricted',
          moderation_reason = p_reason,
          moderated_at = now()
    where id = p_user;
    v_message := '🚫 Your account has been restricted'
      || coalesce(': ' || p_reason, '')
      || '. You can no longer create events or posts. Contact support@linkupnaija.com to appeal.';

  elsif p_action = 'block' then
    update public.users
      set moderation_status = 'blocked',
          moderation_reason = p_reason,
          moderated_at = now()
    where id = p_user;
    v_message := '⛔ Your account has been blocked'
      || coalesce(': ' || p_reason, '')
      || '. Contact support@linkupnaija.com to appeal.';

  elsif p_action = 'clear' then
    update public.users
      set moderation_status = 'active',
          moderation_reason = null,
          moderated_at = now()
    where id = p_user;
    v_message := '✅ Your account is in good standing again. Thanks for keeping LinkUpNaija safe.';

  else
    raise exception 'unknown action %', p_action;
  end if;

  insert into public.notifications (user_id, message) values (p_user, v_message);
end; $$;
grant execute on function public.admin_moderate_user(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. admin_delete_event(p_event, p_reason)
--    Events DELETE RLS is host-only; this definer lets admins remove
--    spam / terms-violating events and notifies the host why.
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_event(
  p_event uuid, p_reason text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_title text;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;

  select host_id, title into v_host, v_title from public.events where id = p_event;
  if v_host is null then raise exception 'event not found'; end if;

  delete from public.events where id = p_event;

  insert into public.notifications (user_id, message)
  values (
    v_host,
    '🗑️ Your event "' || v_title || '" was removed by the LinkUpNaija team'
      || coalesce(': ' || p_reason, '')
      || '. Events must follow our terms of service.'
  );
end; $$;
grant execute on function public.admin_delete_event(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Enforce restrictions at the database level.
--    Restricted/blocked users cannot create or edit events (edit is included
--    so a spammer can't rewrite an old event's title into spam).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select moderation_status into v_status from public.users where id = auth.uid();
  if v_status in ('restricted', 'blocked') then
    raise exception 'Your account is % and cannot create or edit content. Contact support@linkupnaija.com.', v_status;
  end if;
  return new;
end; $$;

drop trigger if exists events_moderation on public.events;
create trigger events_moderation
  before insert or update on public.events
  for each row execute function public.enforce_moderation();

-- Circle posts too, if the circles migration has been run.
do $$
begin
  if to_regclass('public.circle_posts') is not null then
    drop trigger if exists circle_posts_moderation on public.circle_posts;
    create trigger circle_posts_moderation
      before insert on public.circle_posts
      for each row execute function public.enforce_moderation();
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Realtime on events — lets the live activity ticker drop messages for an
--    event the moment an admin deletes it (DELETE payloads carry the PK).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
