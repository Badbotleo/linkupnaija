-- Tell a hosted event apart from a listing we copied in.
--
-- Measured 13 Sep 2026 across all 208 events, by whether an event ever
-- received a single join request:
--
--                    free  got req    paid  got req
--   bulk accounts      77    29%       105     3%
--   everyone else      19    53%         7    29%
--
-- Read the paid column. An event somebody actually hosted here gets a request
-- 29% of the time when it costs money. A listing we copied in gets one 3% of
-- the time. Price is not the variable, provenance is, and 105 aggregated paid
-- listings are half the catalogue sitting in the worst-performing cell.
--
-- The feed sorts by date and nothing else, so those 105 outrank a real host
-- whenever they happen to fall sooner. Six organic hosts compete with 182
-- listings on date order alone and lose.
--
-- WHY A COLUMN AND NOT A HOST LIST. "Is the host_id Courage or the
-- LinkUpNaija account" is true today and wrong the moment Courage hosts
-- something of his own, or a second seeding account appears. The fact worth
-- storing is about the EVENT, not about who typed it.
--
-- NOTHING IS HIDDEN BY THIS. It is a sort key. Every listing stays in the
-- feed, in date order, below the events people actually hosted. A feed of six
-- would look abandoned, and the listings are what stop that.
--
-- Safe to run twice.


-- --------------------------------------------------------------- the column --
alter table public.events
  add column if not exists is_listing boolean not null default false;

comment on column public.events.is_listing is
  'True when we added this from elsewhere rather than a host posting it here. Sorts below hosted events. Not hidden, not a quality judgement.';

create index if not exists events_listing_date_idx
  on public.events (is_listing, date);


-- ------------------------------------------------------------ the backfill --
-- The two seeding accounts, by what they have already posted. This is the one
-- moment the host-based guess is correct, because it is describing the past
-- rather than predicting the future.
--
-- Deliberately narrow: only events by an account with 20+ events to its name.
-- A host with a handful is a real host however they were invited.
with seeders as (
  select host_id
    from public.events
   group by host_id
  having count(*) >= 20
)
update public.events e
   set is_listing = true
  from seeders s
 where e.host_id = s.host_id
   and e.is_listing = false;


-- ------------------------------------------------------------ where we are --
-- Two rows. The hosted one should carry the far better request rate, which is
-- the entire reason for the column.

select
  case when e.is_listing then 'copied in' else 'hosted here' end as kind,
  count(*)                                                        as events,
  count(*) filter (where e.date >= current_date)                  as upcoming,
  count(distinct r.event_id)                                      as ever_requested,
  round(100.0 * count(distinct r.event_id) / nullif(count(*), 0)) as pct
from public.events e
left join public.rsvps r on r.event_id = e.id
group by 1
order by 1;
