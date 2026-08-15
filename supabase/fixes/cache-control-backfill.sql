-- Stop re-serving the same 117MB eighty times a day.
--
-- ROWS ONLY, no schema change. Safe to run more than once.
--
-- Supabase defaults uploads to Cache-Control: max-age=3600. Every visitor
-- therefore re-downloaded every video hourly. Measured on this project:
--
--   stored:  116.7 MB
--   egress:  18 GB against a 5 GB quota
--   ratio:   ~154x
--
-- The header is baked into storage.objects.metadata at upload time, so
-- fixing the code only helps FUTURE uploads. This updates what's already
-- there. Paths carry a timestamp and a random suffix, so the bytes behind a
-- given URL never change — there is nothing a long cache can serve stale.

update storage.objects
set metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{cacheControl}',
      '"max-age=31536000"'
    )
where bucket_id in (
        'things-to-do', 'event-recaps', 'event-covers',
        'partner-assets', 'avatars'
      )
  and coalesce(metadata->>'cacheControl', '') <> 'max-age=31536000';

-- What each bucket now serves, and how much of it.
select bucket_id,
       metadata->>'cacheControl' as cache_control,
       count(*) as objects,
       pg_size_pretty(sum((metadata->>'size')::bigint)) as total
from storage.objects
where bucket_id in (
  'things-to-do', 'event-recaps', 'event-covers', 'partner-assets', 'avatars'
)
group by 1, 2
order by 1;
