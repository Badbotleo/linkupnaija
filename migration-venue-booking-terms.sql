-- Booking terms on the venue, before anybody asks for them.
--
-- WHAT HAPPENED. The Curiosities Book Club asked Luna Cafe for a date. Luna
-- replied with a perfectly ordinary policy: pre-order seven or eight items,
-- or use the set menu, or leave a N100,000 non-refundable deposit. The host
-- took it badly and called it "too many policies".
--
-- The policies are not the problem. Any cafe giving a room to twenty people
-- on a Saturday needs one of those three things, and Luna's are mild. The
-- problem is WHERE he found out: after introducing himself, in a reply, as a
-- surprise. The same three lines printed on the venue page before he ever
-- made contact would have read as a venue that knows what it is doing.
--
-- A reservation request that goes out with no idea what it is agreeing to is
-- a complaint being scheduled for later, and it happened to us on the first
-- booking anybody tried.
--
-- SO: terms live on the venue, in public, and the request names which option
-- the group picked. The venue stops having to explain itself one email at a
-- time, the host stops being ambushed, and the agreed amount is on the row
-- the commission is calculated from.

alter table public.venues
  -- Some venues simply do not take group bookings, and offering a button
  -- that leads to "no" is worse than offering nothing.
  add column if not exists accepts_reservations boolean not null default true,
  /**
   * The options a group can choose from, in the venue's own words.
   *
   * [{ "label": "Pre-order",
   *    "detail": "Pre-order seven or eight items from the regular menu and
   *               deposit for them in advance.",
   *    "amount": null }]
   *
   * JSONB rather than three columns, because Luna offered three and the next
   * venue will offer one or five. `amount` is kobo-free naira or null when
   * the option has no fixed figure.
   */
  add column if not exists booking_options jsonb not null default '[]'::jsonb,
  -- How much warning they need. "Two days" is the single most common reason
  -- a request gets declined, and it is knowable in advance.
  add column if not exists booking_notice_days integer,
  -- Anything that does not fit an option: parking, noise, closing time.
  add column if not exists booking_note text,
  /**
   * Our cut of a confirmed booking, as a percentage.
   *
   * AdminReservations asks a human to type a commission into a box on every
   * single confirmation, which is a number invented under time pressure with
   * nothing to check it against. Agreeing it once with the venue and storing
   * it here makes the figure on the reservation a calculation rather than a
   * guess. Null means nothing has been agreed yet, and the admin types it as
   * before.
   */
  add column if not exists commission_rate numeric(5,2);

alter table public.venues
  drop constraint if exists venues_commission_rate_check;
alter table public.venues
  add constraint venues_commission_rate_check
  check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 50));

alter table public.venues
  drop constraint if exists venues_booking_options_is_array;
alter table public.venues
  add constraint venues_booking_options_is_array
  check (jsonb_typeof(booking_options) = 'array');

-- PostgREST rejects the WHOLE select when it names a column with no grant,
-- so every new column has to be granted explicitly or the venue page stops
-- loading entirely rather than losing one field.
grant select (accepts_reservations, booking_options, booking_notice_days,
              booking_note, commission_rate)
  on public.venues to anon, authenticated;

-- Which of the options the group actually chose, carried on the request so
-- the venue is not reading minds and the admin is not asking.
alter table public.reservations
  add column if not exists chosen_option text,
  add column if not exists quoted_amount integer;

grant select (chosen_option, quoted_amount) on public.reservations to authenticated;
grant insert (chosen_option, quoted_amount) on public.reservations to authenticated;

/**
 * Owners publish their own terms. They do not set our commission.
 *
 * The guard is a denylist, so the four booking columns are editable by an
 * owner the moment they exist, which is what we want: the venue is the only
 * party that knows its own deposit. commission_rate is the exception and has
 * to be added to the locked list, or a venue could quietly set our fee to
 * zero on its own record.
 */
create or replace function public.guard_venue_owner_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  locked text;
begin
  -- Only an OWNER editing their own venue is what this exists for, and the
  -- test has to be that narrow.
  --
  -- The first version said "not an admin", which would have broken venue
  -- reviews outright. refresh_venue_rating() is security definer, but a
  -- BEFORE UPDATE trigger still fires inside it, and auth.uid() there is
  -- still the guest who left the review. So every review by a non-admin
  -- would have updated venues.rating, hit this guard, and been rejected.
  if not public.owns_venue(old.id) then
    return new;
  end if;

  locked := case
    when new.name        is distinct from old.name        then 'name'
    when new.category    is distinct from old.category    then 'category'
    when new.state       is distinct from old.state       then 'state'
    when new.lat         is distinct from old.lat         then 'lat'
    when new.lng         is distinct from old.lng         then 'lng'
    when new.is_featured is distinct from old.is_featured then 'is_featured'
    when new.is_active   is distinct from old.is_active   then 'is_active'
    when new.created_by  is distinct from old.created_by  then 'created_by'
    -- Ours, not theirs.
    when new.commission_rate is distinct from old.commission_rate
      then 'the LinkUpNaija commission'
    else null
  end;

  if locked is not null then
    raise exception
      'Only LinkUpNaija can change %. Message us if it is wrong.', locked
      using errcode = 'insufficient_privilege';
  end if;

  -- updated_at is touch_venue_updated_at's job, and it already runs first.
  return new;
end;
$$;
