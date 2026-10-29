-- Posters for the Things to do video cards.
--
-- THE BUG THIS FIXES. A video card has nothing to draw between getting its
-- src and decoding its first frame, because things_to_do carried no poster
-- and nothing captured one at upload. Browsers fill that gap with their own
-- media placeholder — the grey video glyph — so on a slow connection the
-- shelf showed a row of broken-looking icons rather than the footage.
--
-- event_recaps already solved this and this column mirrors it exactly, so
-- both admins can share the same capture-on-upload code path.
--
-- Nullable, with no backfill. Every existing row keeps working and simply
-- has no poster until it is next saved; a NOT NULL here would reject every
-- row already in the table. To backfill the old ones, open each in the admin
-- and re-pick its file, or leave them — the dark card they fall back to is
-- not broken, just plainer.

alter table public.things_to_do
  add column if not exists poster_url text;

comment on column public.things_to_do.poster_url is
  'First frame of a video card, captured in the browser at upload. Null for images, and for videos uploaded before this column existed.';
