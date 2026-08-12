-- Feature DEFCON's events — same mechanism as the paid event boost.
--
-- Rows only. Re-runnable: it re-dates the placement rather than stacking.
--
-- Time-boxed on purpose. `featured_until` means the placement expires by
-- itself; a boost with no end date is one somebody has to remember to switch
-- off, and nobody ever does. Re-run this to extend it.

update public.events
set featured = true,
    featured_until = greatest(
      -- Never end the boost before the event happens.
      (date + interval '1 day')::timestamptz,
      now() + interval '60 days'
    )
where partner_id = (select id from public.partners where slug = 'defcon')
  and date >= current_date;

-- What's now featured, and until when.
select e.title, e.date, e.featured, e.featured_until, p.name as partner
from public.events e
left join public.partners p on p.id = e.partner_id
where e.featured = true and e.featured_until > now()
order by e.date;
