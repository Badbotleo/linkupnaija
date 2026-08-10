-- Poster frames for recap clips.
--
-- SCHEMA CHANGE: one nullable column. Nothing existing is altered, and a row
-- without a poster keeps working exactly as before — it just paints black
-- until the video arrives, which is what every row does today.
--
-- Safe to run more than once.

alter table public.event_recaps
  add column if not exists poster_url text;
