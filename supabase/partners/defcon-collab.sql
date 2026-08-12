-- LinkUpNaija × DEFCON, as a collaboration rather than a paid boost.
--
-- Rows only. Re-runnable — it re-dates the placement instead of stacking.
--
-- SEPARATE from events.featured on purpose. That flag is what a host pays
-- for; this is a partnership we chose. One flag for both would mean a paying
-- host could rank below one who didn't, with no way to tell them apart.
--
-- Copy and colours come from DEFCON's own SUMMER GAMES artwork: the strapline
-- is theirs verbatim, and the palette is the flyer's warm amber and deep red
-- rather than the flat red I first read off the menu sheet.

update public.partners
set is_collab = true,
    collab_until = now() + interval '90 days',
    -- Their strapline, word for word.
    collab_blurb = 'No rules. No limits. Just vibes.',
    tagline      = 'Rooftop nights in Abuja. Free entry, tables from ₦50,000.',
    brand_color  = '#B32A22',   -- the deep red of the SUMMER GAMES ball
    accent_color = '#E8A15C',   -- the warm amber the artwork sits in
    updated_at   = now()
where slug = 'defcon';

-- Undo the shared-pool boost from defcon-feature.sql, so events.featured goes
-- back to meaning "a host paid for this" and nothing else.
update public.events
set featured = false, featured_until = null
where partner_id = (select id from public.partners where slug = 'defcon');

select slug, name, is_collab, collab_until, collab_blurb, brand_color, accent_color
from public.partners where slug = 'defcon';
