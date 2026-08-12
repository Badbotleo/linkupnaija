-- LinkUpNaija × DEFCON, as a collaboration rather than a paid boost.
--
-- Rows only. Re-runnable — it re-dates the placement instead of stacking.
--
-- SEPARATE from events.featured on purpose. That flag is what a host pays
-- for; this is a partnership we chose. One flag for both would mean a paying
-- host could rank below one who didn't, with no way to tell them apart.

update public.partners
set is_collab = true,
    collab_until = now() + interval '90 days',
    collab_blurb = 'Rooftop nights in Abuja — music, games, competition, and tables from ₦50,000.',
    updated_at = now()
where slug = 'defcon';

-- Undo the shared-pool boost from defcon-feature.sql, so events.featured goes
-- back to meaning "a host paid for this" and nothing else.
update public.events
set featured = false, featured_until = null
where partner_id = (select id from public.partners where slug = 'defcon');

select slug, name, is_collab, collab_until, collab_blurb
from public.partners where slug = 'defcon';
