-- Who actually runs a listed event.
--
-- `is_listing` has existed on events since the beginning and 181 rows carry
-- it, but nothing in the app has ever set it: listings were created outside
-- the product and the flag was flipped by hand in SQL afterwards. The host
-- form offers no way to say "this is somebody else's event", so an admin
-- adding one has to either claim it or go and edit the database.
--
-- That claim is the real problem. A listing created through the form becomes
-- an event hosted by the admin account, so guests RSVP believing we are
-- running it, the organiser is not credited anywhere, and the growth
-- dashboard counts it as a hosted event — which is the number the business
-- plan rests on.
--
-- These two columns let a listing carry its organiser. The name shows on the
-- event, and the Instagram handle is what AdminInstagram tags when it builds
-- the post, which is the whole point: the post lands in the organiser's
-- notifications and they reshare it to their own following.
--
-- Nullable, with no default. A hosted event has no organiser other than its
-- host, and an empty string is not the same as "nobody said".

alter table public.events
  add column if not exists organiser_name text,
  add column if not exists organiser_instagram text;

comment on column public.events.organiser_name is
  'For is_listing events: who actually runs it. Null on hosted events.';
comment on column public.events.organiser_instagram is
  'For is_listing events: the handle to tag, stored WITHOUT the leading @.';

-- Anonymous visitors read events, so they have to be able to read the credit
-- on one. Column grants are additive and the table already grants select on
-- the rest; without this the two new columns are invisible to a logged-out
-- visitor and PostgREST rejects the ENTIRE select that names them, which is
-- how the event page 404'd for strangers once before.
grant select (organiser_name, organiser_instagram) on public.events to anon;
grant select (organiser_name, organiser_instagram) on public.events to authenticated;

-- A sanity check rather than a constraint: a handle with an @ in it would
-- produce "@@blackboyafrika" everywhere it is printed. Stored bare, printed
-- with the @.
update public.events
   set organiser_instagram = ltrim(organiser_instagram, '@')
 where organiser_instagram like '@%';
