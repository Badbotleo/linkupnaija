-- The AITF link-up, with vendor spaces you request rather than buy.
--
-- The partner page has a hero worth sending to ACCI and an empty "What's
-- coming up" directly underneath it. This fills it.
--
-- The event is NOT the trade fair. The fair is ACCI's, it runs twelve days,
-- and nobody RSVPs to a twelve day fair. What somebody RSVPs to is walking it
-- with other people instead of alone, which is the only thing this platform
-- actually sells.
--
-- TWO WAYS IN, both free, both requests. They are ticket_tiers rows, which is
-- the only mechanism that already knows how to cap a count and close on a
-- date. Nothing new was added to the schema.
--
--   Coming along   no cap, walk the fair with the group
--   Vendor space   4, closes a week out, a table on our stand
--
-- Coming along is INSTANT, and the group chat opens with it. Walking a trade
-- fair with people is the thing being offered, and a queue in front of it is
-- friction for no gain. Vendor space is a REQUEST, because four tables have
-- to be allocated by a person. That split needs migration-tier-approval.sql,
-- which moves approval onto the tier and adds events.auto_chat. RUN THAT
-- FIRST, or the columns this file sets will not exist.
--
-- WHY TWO TIERS AND NOT ONE. RsvpButton only renders the picker at
-- tiers.length > 1, so a lone vendor tier would be invisible and every guest
-- would silently land on it. The "Coming along" row is what makes the vendor
-- row selectable, and it is the honest default besides.
--
-- CHECK THESE FOUR BEFORE RUNNING. Everything else is derived.
--   the date       26 Sept 2026, the fair's first Saturday
--   the meeting    10:00 at the main gate
--   the spaces     4
--   requests close 19 Sept 2026, a week out, so you can plan the stand
--
-- The event carries the fair's own name. "Trade Fair Link Up" was our
-- framing, and nobody searches for it. Somebody looking for this types
-- "trade fair", so the title is what they would type.
--
-- SAFE TO RUN TWICE, AND IT CONVERGES.
--
-- The first version of this file sold the vendor space for N20,000 and left
-- auto_confirm on. That version was run. A guard that skips when a row already
-- exists cannot repair its own earlier output, so the fields this file
-- declares are now written every time rather than only on the first run. Event
-- copy, date and artwork are still left alone once created, because those are
-- yours to edit on the page.


do $$
declare
  v_host    uuid;
  v_partner uuid;
  v_event   uuid;
  v_cover   text;
  v_gallery text[];

  -- One copy of the copy. Written once here so the insert and the re-run
  -- update cannot say different things.
  v_copy    text := 'Over 100,000 people pass through the Abuja International Trade Fair. Most of them walk it alone.

We are going as a group. Meet at the gate, move through the stands together, stop for food when your feet start complaining. Traders, makers, and a lot of things you did not know you needed.

Selling something? Ask for a vendor space on our stand when you request to join. You bring the product, we bring the foot traffic.

Come for the bargains, leave with people you actually know.

Free to join. Bring cash, plenty of stands still do not take transfers.';
begin

  -- ------------------------------------------------------------- who hosts --
  -- By email, so no UUID is pasted into a file that lives in the repo.
  -- Lowercased on both sides: Supabase stores what was typed at signup, and
  -- an address that differs only in case would look like no account at all.
  select id into v_host
    from auth.users
   where lower(email) = lower('gabrieldivine45@gmail.com');

  if v_host is null then
    raise exception
      'No account for gabrieldivine45@gmail.com. Check the spelling, and check they have signed up.';
  end if;

  -- ----------------------------------------------- the partner, and its art --
  -- The graphics are already uploaded against the partner row. Reading them
  -- from there rather than pasting six storage URLs means re-uploading a
  -- poster updates the event too, and there is one place to be wrong.
  select id, cover_url, poster_urls
    into v_partner, v_cover, v_gallery
    from public.partners
   where slug = 'aitf';

  if v_partner is null then
    raise exception 'No partner with slug aitf.';
  end if;

  -- The logo is deliberately not a gallery tile. It renders as the partner's
  -- mark already, and a wordmark on a white field between four photographs
  -- reads as a missing image. Add it to v_gallery if you disagree.

  -- ------------------------------------------------------------- the event --
  -- Found by partner and date, NOT by title. The title is the one field
  -- most likely to be reworded, and a lookup keyed on it stops matching the
  -- moment it changes: the re-run would insert a second event beside the
  -- first rather than rename the one that is there. Partner plus date is
  -- what actually identifies this link-up.
  select id into v_event
    from public.events
   where partner_id = v_partner
     and date = date '2026-09-26';

  if v_event is null then
    insert into public.events (
      title, category, description, date, time, end_time,
      location, state, host_id, max_attendees, cover_image_url,
      price, event_type, gallery_urls, partner_id, auto_confirm, auto_chat
    ) values (
      'Abuja International Trade Fair',
      'Market / Trade Fair',
      v_copy,
      date '2026-09-26',
      '10:00',
      '15:00',
      'Main gate, Abuja International Trade Fair Complex, Airport Road',
      'FCT - Abuja',
      v_host,
      40,
      v_cover,
      0,
      'general',
      coalesce(v_gallery, '{}'),
      v_partner,
      true,          -- anyone can walk in; the vendor tier holds itself back
      true           -- and the group chat opens with it
    )
    returning id into v_event;
    raise notice 'Event created.';
  else
    -- Re-run rewrites what this file is responsible for, and that now
    -- includes the description. The copy named a vendor count that also
    -- lived in ticket_tiers.quantity, so changing the cap left the prose
    -- lying. The count is gone from the sentence and the tier row shows it
    -- instead, but the copy already saved has to be corrected once.
    --
    -- Which means THIS FILE OWNS THE COPY. Edit the description here and
    -- re-run, not on the page, or the next run will overwrite you. Title,
    -- date, time and capacity are still left alone.
    update public.events
       set cover_image_url = v_cover,
           gallery_urls    = coalesce(v_gallery, '{}'),
           price           = 0,
           auto_confirm    = true,
           auto_chat       = true,
           host_id         = v_host,
           title           = 'Abuja International Trade Fair',
           description     = v_copy
     where id = v_event;
    raise notice 'Event already existed. Host, artwork, price and approval refreshed.';
  end if;

  -- -------------------------------------------------------------- the tiers --
  -- Free, both of them. The tier stock trigger caps on quantity and closes on
  -- closes_at regardless of price, so a zero costs nothing in enforcement.
  --
  -- Written every run, not skipped when present. This is what repairs the
  -- N20,000 vendor space the first version of this file created.
  update public.ticket_tiers
     set price       = 0,
         quantity    = null,
         admits      = 1,
         sort_order  = 0,
         is_active   = true,
         closes_at   = null,
         requires_approval = false,
         description = 'Walk the fair with the group. Nothing to bring but cash and comfortable shoes.'
   where event_id = v_event and name = 'Coming along';

  if not found then
    insert into public.ticket_tiers (
      event_id, name, price, description, admits, quantity, sort_order, is_active
    ) values (
      v_event, 'Coming along', 0,
      'Walk the fair with the group. Nothing to bring but cash and comfortable shoes.',
      1, null, 0, true
    );
  end if;

  update public.ticket_tiers
     set price       = 0,
         quantity    = 4,
         admits      = 2,
         sort_order  = 1,
         is_active   = true,
         closes_at   = timestamptz '2026-09-19 23:59:00+01',
         requires_approval = true,
         description = 'A table on the LinkUpNaija stand for the day, plus your name on this page and in the group chat. Bring your own display and your own float. Confirmed once we allocate the stand.'
   where event_id = v_event and name = 'Vendor space';

  if not found then
    insert into public.ticket_tiers (
      event_id, name, price, description, admits, quantity, sort_order,
      is_active, closes_at, requires_approval
    ) values (
      v_event, 'Vendor space', 0,
      'A table on the LinkUpNaija stand for the day, plus your name on this page and in the group chat. Bring your own display and your own float. Confirmed once we allocate the stand.',
      2, 4, 1, true,
      timestamptz '2026-09-19 23:59:00+01',
      true
    );
  end if;

end $$;


-- ------------------------------------------------------------ where we are --
-- One event on the partner, two free tiers, the vendor one capped.

select
  e.title,
  e.date,
  e.time,
  e.auto_confirm                           as auto_approves,
  e.auto_chat                              as chat_opens,
  t.requires_approval                      as by_request,
  u.email                                  as host,
  array_length(e.gallery_urls, 1)          as gallery_pictures,
  p.name                                   as partner,
  t.name                                   as tier,
  t.quantity                               as spaces,
  public.tier_seats_sold(t.id)             as requested,
  t.closes_at
from public.events e
join public.partners p on p.id = e.partner_id
join auth.users u on u.id = e.host_id
left join public.ticket_tiers t on t.event_id = e.id
where p.slug = 'aitf'
order by e.date, t.sort_order;
