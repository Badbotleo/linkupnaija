-- Several photos or videos under one post, the way Instagram does it.
--
-- Three surfaces carry media today and none of them can carry more than one
-- piece per item:
--
--   circle_posts  has image_url AND video_url, one of each, so a night out
--                 becomes four separate posts in the circle feed.
--   event_photos  is one row per photo and images only; a clip from the same
--                 night is simply rejected.
--   event_recaps  is one row per clip, so six clips from one party are six
--                 cards in the reel rather than one you swipe.
--
-- Recaps need no column: several recaps already share an event_id, so the
-- reel can group them. The other two need somewhere to put an ordered list.
--
-- WHY JSONB AND NOT TWO ARRAYS. Order matters and type matters, and
-- text[] urls plus text[] types is two arrays that can drift out of step by
-- one and silently label a video as a photo. One array of objects cannot.

-- --------------------------------------------------------------------
-- Circle posts
-- --------------------------------------------------------------------

alter table public.circle_posts
  add column if not exists media jsonb;

comment on column public.circle_posts.media is
  'Ordered [{url, type}] where type is image|video. image_url and video_url still hold the FIRST item so older readers keep working.';

grant select (media) on public.circle_posts to anon;
grant select (media) on public.circle_posts to authenticated;
grant insert (media) on public.circle_posts to authenticated;
grant update (media) on public.circle_posts to authenticated;

-- --------------------------------------------------------------------
-- Event gallery
-- --------------------------------------------------------------------
--
-- One row per item stays: the gallery is a grid that people delete from
-- individually, and a carousel over it is a view, not a storage shape. It
-- only needs to stop assuming every row is a photo.
--
-- Defaulted to 'image' so every row already there is correct without a
-- backfill, and so a writer that has not been updated yet still produces a
-- valid row.

alter table public.event_photos
  add column if not exists media_type text not null default 'image';

alter table public.event_photos
  drop constraint if exists event_photos_media_type_check;

alter table public.event_photos
  add constraint event_photos_media_type_check
  check (media_type in ('image', 'video'));

comment on column public.event_photos.media_type is
  'image or video. Defaults to image, which is what every pre-existing row is.';

grant select (media_type) on public.event_photos to anon;
grant select (media_type) on public.event_photos to authenticated;
grant insert (media_type) on public.event_photos to authenticated;

-- Column grants are additive and PostgREST rejects the ENTIRE select when it
-- names a column the role cannot read, which is how every event page 404'd
-- for logged-out visitors once before. Both readers above select explicitly,
-- so the grants are not optional.
