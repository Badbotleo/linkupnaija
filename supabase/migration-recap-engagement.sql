-- Likes and comments on past-event recaps.
--
-- SCHEMA CHANGE. Two new tables and their policies. Nothing existing is
-- altered. Safe to run more than once. Requires migration-event-recaps.sql.
--
-- Decisions baked in here, so they're visible rather than buried in a client:
--   * Anyone can READ likes and comments, including logged-out visitors.
--     The whole point of this shelf is convincing someone who hasn't signed
--     up, and a comment thread they can't see convinces nobody.
--   * Only signed-in people can like or comment.
--   * One like per person per recap, enforced by a unique constraint rather
--     than by hoping the client behaves.
--   * You can delete your own comment; admins can delete any.

create table if not exists public.recap_likes (
  id uuid primary key default gen_random_uuid(),
  recap_id uuid not null references public.event_recaps(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- The database is what stops double-liking, not the UI.
  unique (recap_id, user_id)
);

create index if not exists recap_likes_recap_idx on public.recap_likes (recap_id);

create table if not exists public.recap_comments (
  id uuid primary key default gen_random_uuid(),
  recap_id uuid not null references public.event_recaps(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists recap_comments_recap_idx
  on public.recap_comments (recap_id, created_at desc);

alter table public.recap_likes enable row level security;
alter table public.recap_comments enable row level security;

-- --- likes -----------------------------------------------------------------
drop policy if exists "Anyone can read recap likes" on public.recap_likes;
create policy "Anyone can read recap likes"
  on public.recap_likes for select using (true);

drop policy if exists "Signed-in can like" on public.recap_likes;
create policy "Signed-in can like"
  on public.recap_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Own likes can be removed" on public.recap_likes;
create policy "Own likes can be removed"
  on public.recap_likes for delete
  using (auth.uid() = user_id);

-- --- comments --------------------------------------------------------------
drop policy if exists "Anyone can read recap comments" on public.recap_comments;
create policy "Anyone can read recap comments"
  on public.recap_comments for select using (true);

drop policy if exists "Signed-in can comment" on public.recap_comments;
create policy "Signed-in can comment"
  on public.recap_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Own comments can be removed" on public.recap_comments;
create policy "Own comments can be removed"
  on public.recap_comments for delete
  using (auth.uid() = user_id or public.is_admin());
