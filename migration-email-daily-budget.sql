-- A daily send budget, so bulk mail cannot starve a verification code.
--
-- THE PROBLEM. Resend's free tier allows 3,000 emails a month but only 100 a
-- day. At 319 members the monthly figure is comfortable, about 1,700, and
-- the daily one is impossible: the Tuesday digest tries to send 319 in one
-- pass and stops dead at 100.
--
-- WORSE THAN "THE DIGEST DOES NOT ARRIVE". Every kind of mail draws from the
-- same hundred. A verification code is what stands between a host and their
-- payout, and it is now the only route since SMS was dropped. If a digest
-- eats the day's allowance first, that host cannot verify and cannot get
-- paid, and nothing tells us: the function simply starts returning
-- 429 daily_quota_exceeded. That already happened once.
--
-- So two rules, in order of importance:
--
--   1. Transactional mail always has room. Bulk may never touch the last
--      RESERVE sends of the day, whatever is queued.
--   2. Bulk spreads across days and resumes where it stopped, rather than
--      sending to whoever happened to sort first and dropping the rest.

create table if not exists public.email_quota_day (
  day   date primary key,
  used  integer not null default 0,
  bulk  integer not null default 0
);

alter table public.email_quota_day enable row level security;
-- No policies: only the edge functions touch this, with the service role.
revoke all on public.email_quota_day from anon, authenticated;

/**
 * Who has already had the current digest.
 *
 * Without this the job cannot resume: on day two it would re-read the same
 * user list, send to the same first eighty, and the last members would never
 * receive anything at all.
 */
alter table public.email_preferences
  add column if not exists last_digest_sent_at timestamptz;

/**
 * Ask for n sends; get back how many you may actually make.
 *
 * Atomic on purpose. Two functions can run at once -- the daily scheduled
 * job overlaps the weekly digest every Tuesday -- and two readers both
 * seeing "40 left" would send 80 between them and silently lose half.
 *
 * p_bulk = true keeps the caller out of the reserve. A transactional send
 * passes false and may use the whole cap.
 *
 * Returns 0 rather than raising when there is nothing left. A caller that
 * gets 0 should stop quietly and try again tomorrow, not fail.
 */
create or replace function public.claim_email_budget(
  p_want integer,
  p_bulk boolean default true,
  -- Overridable so a paid plan does not need a code change: raise the cap
  -- and the reserve stops mattering.
  p_cap integer default 100,
  p_reserve integer default 30
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  used_now integer;
  room integer;
  granted integer;
begin
  if p_want is null or p_want <= 0 then return 0; end if;

  insert into public.email_quota_day (day) values (today)
  on conflict (day) do nothing;

  -- FOR UPDATE, so concurrent callers queue rather than race.
  select used into used_now from public.email_quota_day
   where day = today for update;

  room := case when p_bulk
               then p_cap - p_reserve - used_now
               else p_cap - used_now
          end;
  granted := least(p_want, greatest(room, 0));

  if granted > 0 then
    update public.email_quota_day
       set used = used + granted,
           bulk = bulk + case when p_bulk then granted else 0 end
     where day = today;
  end if;

  return granted;
end;
$$;

/**
 * Record a send that happened outside a claim.
 *
 * The OTP functions must never wait on a budget check before sending
 * somebody their code, so they send first and tell the ledger afterwards.
 * The count can therefore run slightly ahead of a claim, which is the safe
 * direction: it makes bulk more cautious, never less.
 */
create or replace function public.note_email_sent(p_count integer default 1)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if p_count is null or p_count <= 0 then return; end if;
  insert into public.email_quota_day (day, used) values (today, p_count)
  on conflict (day) do update set used = public.email_quota_day.used + p_count;
end;
$$;

revoke all on function public.claim_email_budget(integer, boolean, integer, integer)
  from public, anon, authenticated;
revoke all on function public.note_email_sent(integer)
  from public, anon, authenticated;
