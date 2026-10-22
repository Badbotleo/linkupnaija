-- A way to reach the organiser of a listing.
--
-- WHY. 32 of the 49 upcoming events are listings: events we promote on behalf
-- of somebody who mostly does not know we exist. They are the warmest host
-- leads on the platform, because we have already done them a favour. Then our
-- Instagram was disabled and the question "how do we contact them" had this
-- answer: 14 of 32 have an Instagram handle and nothing else, 18 have no
-- contact details at all, not even an organiser name. The one channel we
-- could reach any of them on is the one we lost.
--
-- Whoever added those 18 saw the event somewhere. That trail was never
-- recorded, so it is gone.
alter table public.events
  add column if not exists organiser_email text,
  add column if not exists organiser_phone text,
  /** Where the listing was found, so the trail back to a human survives. */
  add column if not exists source_url text,
  /** Set when somebody has actually been approached, so outreach is not
      repeated and silence is distinguishable from never having asked. */
  add column if not exists organiser_contacted_at timestamptz;

grant select (organiser_email, organiser_phone, source_url, organiser_contacted_at)
  on public.events to authenticated;
grant insert (organiser_email, organiser_phone, source_url)
  on public.events to authenticated;
grant update (organiser_email, organiser_phone, source_url)
  on public.events to authenticated;
