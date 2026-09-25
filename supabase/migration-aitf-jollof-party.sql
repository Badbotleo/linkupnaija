-- AITF LinkUp Jollof Party, 3 and 6 October 2026.
--
-- Two nights, so two events. They are three days apart at the same venue,
-- which makes them two occasions rather than one long one: somebody picks the
-- Saturday or the Tuesday, and each night wants its own guest list and its own
-- group chat. If they turn out to be one party running across both dates,
-- delete the second entry from v_dates and re-run.
--
-- Deliberately NOT a series. events.series_id exists and /series/[id] renders
-- one, but a series carries a follow mechanic and a landing page of its own,
-- and two nights in the same week do not need either. Worth revisiting if this
-- becomes a monthly thing.
--
-- Same shape as migration-aitf-event.sql and for the same reasons:
--
--   Found by partner AND date, never by title. The title is the field most
--   likely to be reworded, and a lookup keyed on it stops matching the moment
--   somebody changes a word, so the re-run would insert a second event beside
--   the first instead of correcting it.
--
--   This file owns the copy. One v_copy variable feeds both the insert and
--   the update, so a re-run cannot leave the two saying different things.
--
-- THE FLYER HAS TO BE UPLOADED FIRST. Set v_flyer below to its public URL.
-- Until then each night falls back to the partner's cover, so the event is
-- never imageless, but it will be wearing the trade fair's artwork rather
-- than its own.
--
-- Safe to run twice.

do $$
declare
  v_host    uuid;
  v_partner uuid;
  v_cover   text;
  v_event   uuid;
  v_date    date;

  -- ------------------------------------------------------------ the flyer --
  -- Paste the public URL of the Jollof Party artwork between the quotes.
  -- Empty string means "not uploaded yet, use the partner cover".
  v_flyer   text := '';

  -- Both nights. Same everything else.
  v_dates   date[] := array[date '2026-10-03', date '2026-10-06'];

  v_copy    text := 'Jollof, music, and a room full of people you have not met yet.

Free to join, inside the Abuja International Trade Fair complex. Doors at 5pm.

What is happening: dance battle, rap battle, trivia challenge, best dressed, and a jollof eating challenge. There is a business pitch slot if you would rather leave with a contact than a trophy, plus a treasure hunt, music guessing, a guest performance, and a grand giveaway at the end.

Come on your own. Most people do, and by the second battle you will have talked to more strangers than you planned to.

Bring an appetite.';
begin

  -- ------------------------------------------------------------- who hosts --
  -- By email, so no UUID is pasted into a file that lives in the repo.
  -- Lowercased on both sides: Supabase stores what was typed at signup, and
  -- an address differing only in case would look like no account at all.
  select id into v_host
    from auth.users
   where lower(email) = lower('gabrieldivine45@gmail.com');

  if v_host is null then
    raise exception
      'No account for gabrieldivine45@gmail.com. Check the spelling, and check they have signed up.';
  end if;

  -- --------------------------------------------------- the partner, and art --
  select id, cover_url
    into v_partner, v_cover
    from public.partners
   where slug = 'aitf';

  if v_partner is null then
    raise exception 'No partner with slug aitf.';
  end if;

  if v_flyer is null or v_flyer = '' then
    v_flyer := v_cover;
    raise notice 'No flyer URL set, falling back to the partner cover. Set v_flyer and re-run once it is uploaded.';
  end if;

  -- -------------------------------------------------------------- the nights --
  foreach v_date in array v_dates loop

    select id into v_event
      from public.events
     where partner_id = v_partner
       and date = v_date;

    if v_event is null then
      insert into public.events (
        title, category, description, date, time, end_time,
        location, state, host_id, max_attendees, cover_image_url,
        price, event_type, partner_id, auto_confirm, auto_chat
      ) values (
        'AITF LinkUp Jollof Party',
        'Party',
        v_copy,
        v_date,
        '17:00',
        '22:00',
        'Abuja Chamber of Commerce and Industry Trade Fair Complex, Airport Road',
        'FCT - Abuja',
        v_host,
        100,
        v_flyer,
        0,             -- free participation, as the flyer says
        'general',
        v_partner,
        true,          -- free and open, so nobody waits on an approval
        true           -- and the group chat opens with it
      )
      returning id into v_event;
      raise notice 'Created % night.', v_date;
    else
      -- A re-run rewrites everything this file is responsible for, including
      -- the copy and the artwork, so fixing a typo here and running it again
      -- is the way to correct what is already live.
      update public.events
         set title           = 'AITF LinkUp Jollof Party',
             category        = 'Party',
             description     = v_copy,
             time            = '17:00',
             end_time        = '22:00',
             location        = 'Abuja Chamber of Commerce and Industry Trade Fair Complex, Airport Road',
             state           = 'FCT - Abuja',
             host_id         = v_host,
             max_attendees   = 100,
             cover_image_url = v_flyer,
             price           = 0,
             auto_confirm    = true,
             auto_chat       = true
       where id = v_event;
      raise notice 'Updated % night.', v_date;
    end if;

  end loop;
end $$;


-- ------------------------------------------------------------ where we are --
-- Expect two rows, 3 and 6 October, free, instant join, chat open, both
-- carrying the same cover. If cover_image_url matches the trade fair's own
-- cover, the flyer has not been uploaded yet.
select
  e.date,
  e.time,
  e.title,
  e.price,
  e.max_attendees,
  e.auto_confirm                  as instant_join,
  e.auto_chat                     as chat_opens,
  e.cover_image_url = p.cover_url as still_using_partner_cover,
  (select count(*) from public.rsvps r where r.event_id = e.id) as requests
from public.events e
join public.partners p on p.id = e.partner_id
where p.slug = 'aitf'
order by e.date;
