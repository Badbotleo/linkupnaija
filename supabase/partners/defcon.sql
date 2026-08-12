-- DEFCON partner page + the ticket types from their menu.
--
-- Rows only — no schema changes. Safe to run more than once.
--
-- The copy below is DEFCON's own wording, taken from their SUMMER GAMES
-- listing and their menu, reorganised. Nothing about them is invented here.
-- The two colours ARE estimates, read off the flyer artwork: replace them
-- with the real brand values when DEFCON confirms them. They're taken from
-- the logo itself (red keyline, cream letterforms) rather than the flyer
-- background, so they should be close.

-- 1. The partner ------------------------------------------------------------
insert into public.partners (slug, name, tagline, about, state, brand_color, accent_color, sort_order)
values (
  'defcon',
  'DEFCON',
  'Rooftop nights in Abuja. Free entry, tables from 50k.',
  E'DEFCON runs rooftop nights in Abuja. Good music, games, competition, and a crowd that knows how to have a good time.\n\nThe night opens with games and social vibes before the energy takes over. Bring your friends. Meet new people. Play, compete, catch a vibe.\n\nEntry is free. Combo packs and tables are booked through whichever night you want to attend.',
  'FCT - Abuja',
  '#E4373C',   -- read off the logo artwork: the red keyline
  '#EFEADA',   -- the cream letterform fill
  0
)
on conflict (slug) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  about = excluded.about,
  state = excluded.state,
  brand_color = excluded.brand_color,
  accent_color = excluded.accent_color,
  updated_at = now();

-- 2. Attach their existing event -------------------------------------------
update public.events
set partner_id = (select id from public.partners where slug = 'defcon')
where id = '385b3f25-ec95-41e6-badc-ee4628708090';

-- 3. The menu, as ticket types ---------------------------------------------
-- Cleared first so re-running doesn't stack duplicates.
delete from public.ticket_tiers
where event_id = '385b3f25-ec95-41e6-badc-ee4628708090';

insert into public.ticket_tiers (event_id, name, price, admits, description, sort_order)
values
  -- Combo packs. No reserved seats, so `admits` stays null: these are drinks
  -- packages, not tables, and claiming they admit anybody would be wrong.
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Combo Lite',   15000, null,
   '1 beer & soft drink · event pack small chops · 1 bottled water', 0),
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Combo Chill',  20000, null,
   '2 beers · 1 shawarma · 1 bottled water', 1),
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Combo Vibes',  30000, null,
   '1 cocktail or mocktail (or 4 beers) · peppered goat meat · 1 bottled water', 2),

  -- Tables. These do admit a set number, which is what people compare on.
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Lite Table',    50000, 2,
   E'1 Gordon\'s big · 1 plate peppered goat meat · 2 bottled water · 2 soft drinks · ice, cups & tissue · reserved table seating', 3),
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Bronze Table', 120000, 4,
   '1 Malibu · 1 regular shisha · 1 plate peppered goat meat · 2 event packs (small chops) · 4 bottled water · 4 soft drinks / mixers · ice, cups & tissue · reserved table seating', 4),
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Silver Table', 180000, 6,
   '1 Sky vodka · 1 premium flavour shisha · 2 cocktails or mocktails · 1 mixed grill (beef, chicken, snail) · 6 bottled water · 4 soft drinks / mixers · ice, cups & tissue · reserved premium seating', 5),
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Gold Table',   280000, 8,
   E'1 Bacardi gold · 1 Lord\'s gin · 3 cocktails or mocktails · premium flavour shisha + refill · 1 mixed grill (beef, chicken, snail) · 2 event packs small chops · 8 bottled water · 6 soft drinks / mixers · ice, cups & tissue · reserved premium seating', 6),
  ('385b3f25-ec95-41e6-badc-ee4628708090', 'Premium Table',380000, 10,
   '1 Ciroc · 1 Malibu · 4 cocktails or mocktails · premium flavour shisha + refill · 1 mixed grill (beef, chicken, snail) · 4 event packs small chops · 10 bottled water · 8 soft drinks / mixers · ice, cups & tissue · reserved premium seating', 7);

-- 4. Check ------------------------------------------------------------------
select p.slug, p.name, count(t.id) as ticket_types,
       min(t.price) as cheapest, max(t.price) as dearest
from public.partners p
left join public.events e on e.partner_id = p.id
left join public.ticket_tiers t on t.event_id = e.id
where p.slug = 'defcon'
group by p.slug, p.name;
