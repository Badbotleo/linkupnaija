-- Video posts in circles. Stored alongside image_url so a post can carry
-- text, a picture or a clip.
alter table public.circle_posts
  add column if not exists video_url text;
