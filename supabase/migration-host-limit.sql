-- ============================================================================
-- LinkUpNaija — free members host 4 events per calendar month, Pro unlimited
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- The /host page already refuses to render the form past the limit, but that
-- is only a courtesy: anyone can POST straight to the REST API with their own
-- token. This trigger is the actual enforcement.
-- ============================================================================

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
  -- Pro members are unlimited. Expired Pro counts as free.
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
      'Free members can host % events per month. Upgrade to Pro for unlimited hosting.',
      free_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_host_event_limit_trg on public.events;

create trigger enforce_host_event_limit_trg
  before insert on public.events
  for each row
  execute function public.enforce_host_event_limit();

-- Counting per host per month is the hot path for this trigger.
create index if not exists events_host_created_idx
  on public.events (host_id, created_at desc);
