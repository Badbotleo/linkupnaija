-- Where a venue is on Google.
--
-- venue_reviews is empty and will stay empty for a while: RateVenuePrompt
-- only asks after a confirmed reservation at a partner venue on a date that
-- has passed, which is the right gate and also means no ratings until the
-- booking side works. A venue page carrying no opinion at all is a venue page
-- nobody trusts, so until we have our own we show Google's.
--
-- ONLY THE ID LIVES HERE. Google's terms exempt place_id from the caching
-- restrictions and allow it to be stored indefinitely. Ratings and reviews
-- have no such exemption and must not be stored, so they are fetched when a
-- venue page renders and never written down. Do not be tempted to add a
-- rating or a review cache column to this table later: it would be against
-- the terms and it is also what makes the integration cheap, because the
-- expensive call only happens on a page somebody actually opened.

alter table public.venues
  add column if not exists google_place_id text;

comment on column public.venues.google_place_id is
  'Google Places place_id. Stored indefinitely, which Google permits for this field alone. Never store ratings or reviews.';

-- Read by the venue page for every visitor, signed in or not.
--
-- Column grants are additive and PostgREST rejects the ENTIRE select when it
-- names a column the role cannot read. The venue page reads this one in a
-- query of its own precisely so a database that has not run this migration
-- still renders, but the grants belong here regardless.
grant select (google_place_id) on public.venues to anon;
grant select (google_place_id) on public.venues to authenticated;

-- Admins fill it in through /api/admin/venue-places, which runs as the
-- signed-in admin, so the write needs a column grant as well. Row access is
-- still whatever the existing venues policies say: this grants nothing about
-- which rows, only about which column.
grant update (google_place_id) on public.venues to authenticated;
