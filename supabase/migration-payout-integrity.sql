-- A payout cannot be requested early, and cannot be requested for more than
-- the event actually took.
--
-- Two holes, both reachable by anybody who can open dev tools.
--
-- 1. NOTHING STOPPED A PAYOUT BEFORE THE EVENT HAPPENED. A host could list an
--    event for next month, sell tickets today, request the money today, and
--    never turn up. The product offered the payout card the moment the price
--    was above zero, with no reference to the date.
--
-- 2. THE AMOUNT WAS WHATEVER THE BROWSER SAID. PayoutRequest inserts a figure
--    it calculated client-side, and the RLS policy only checked that the row
--    belonged to the requester. A tampered request for ten times the takings
--    would sit in the admin queue displaying its own claimed number, because
--    the admin screen shows the requested amount rather than recomputing it.
--
-- Both are fixed here rather than in the app, because a check that lives in
-- the browser is a suggestion. The client-side changes are cosmetic: they
-- explain the rule, they do not enforce it.
--
-- Safe to run twice.


-- How long after an event a host must wait, for complaints to arrive before
-- the money leaves. Zero means "the day after the event". Raise it if guests
-- start reporting no-shows after the fact.
create or replace function public.payout_hold_days()
returns int language sql immutable as $$ select 0 $$;


create or replace function public.enforce_payout_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev            record;
  real_amount   integer;
  real_fee      integer;
  already       int;
begin
  if new.event_id is null then
    raise exception 'A payout must name the event it is for.'
      using errcode = 'check_violation';
  end if;

  select id, host_id, date, title into ev
    from public.events where id = new.event_id;

  if ev.id is null then
    raise exception 'That event does not exist.' using errcode = 'check_violation';
  end if;

  -- The requester must be the host. RLS checks host_id = auth.uid(); it does
  -- not check that the host owns the event named in the row.
  if ev.host_id <> new.host_id then
    raise exception 'You can only request a payout for your own link-up.'
      using errcode = 'check_violation';
  end if;

  -- Nigeria is UTC+1 with no DST, so the host's "today" is the only one that
  -- matters here.
  if ev.date + public.payout_hold_days() >=
     (now() at time zone 'Africa/Lagos')::date then
    raise exception
      'A payout can be requested the day after the link-up has happened.'
      using errcode = 'check_violation';
  end if;

  -- One open request per event. Without this, ten taps is ten payouts.
  select count(*) into already
    from public.payouts
   where event_id = new.event_id
     and status in ('pending', 'approved', 'paid');
  if already > 0 then
    raise exception 'There is already a payout for this link-up.'
      using errcode = 'check_violation';
  end if;

  -- Recomputed, never accepted. The branch matches the app's: sales taken
  -- before the fee moved onto the buyer had our cut removed from the ticket
  -- price, and newer ones add it on top, so one formula would misstate one of
  -- the two.
  select
    coalesce(sum(case when coalesce(fee_on_top, false)
                      then amount
                      else amount - platform_fee end), 0),
    coalesce(sum(platform_fee), 0)
    into real_amount, real_fee
    from public.transactions
   where event_id = new.event_id;

  if real_amount <= 0 then
    raise exception 'There is nothing to pay out on this link-up.'
      using errcode = 'check_violation';
  end if;

  new.amount       := real_amount;
  new.platform_fee := real_fee;
  -- A request always starts as a request, whatever was posted.
  new.status       := 'pending';

  return new;
end;
$$;

drop trigger if exists payout_integrity on public.payouts;
create trigger payout_integrity
  before insert on public.payouts
  for each row execute function public.enforce_payout_integrity();


-- ------------------------------------------------------------ where we are --
-- Run after. Any row where requested and recomputed disagree was created
-- before this trigger existed and is worth looking at by hand.

select
  p.id,
  e.title,
  e.date,
  p.status,
  p.amount as requested,
  coalesce((select sum(case when coalesce(t.fee_on_top, false)
                            then t.amount
                            else t.amount - t.platform_fee end)
              from public.transactions t
             where t.event_id = p.event_id), 0) as recomputed
from public.payouts p
left join public.events e on e.id = p.event_id
order by p.created_at desc;
