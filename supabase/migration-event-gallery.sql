-- ============================================================================
-- LinkUpNaija — up to 5 pictures per event
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- cover_image_url stays the single headline image, so nothing that reads it
-- has to change. gallery_urls holds the EXTRA pictures beyond the cover.
-- ============================================================================

alter table public.events
  add column if not exists gallery_urls text[] not null default '{}';

-- Four extras plus the cover is the five the host was promised. Enforced here
-- as well as in the form, because the form is only a courtesy — anyone can
-- POST straight to the REST API.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_gallery_max'
  ) then
    alter table public.events
      add constraint events_gallery_max
      check (array_length(gallery_urls, 1) is null or array_length(gallery_urls, 1) <= 4);
  end if;
end $$;

comment on column public.events.gallery_urls is
  'Extra pictures beyond cover_image_url. Max 4, so 5 images total per event.';
