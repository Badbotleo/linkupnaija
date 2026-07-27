-- ----------------------------------------------------------------------------
-- Circle post reposts
--
-- A repost is just another row in circle_posts that points at the original via
-- repost_of, so it inherits every existing RLS policy, the feed query, likes
-- and comments for free. repost_count on the ORIGINAL is kept by a trigger,
-- mirroring how like_count works.
-- ----------------------------------------------------------------------------

alter table public.circle_posts
  add column if not exists repost_of uuid references public.circle_posts (id) on delete cascade;

alter table public.circle_posts
  add column if not exists repost_count integer not null default 0;

-- One repost per person per post: makes the button a clean toggle and stops
-- double taps creating duplicates.
create unique index if not exists circle_posts_one_repost_per_user
  on public.circle_posts (user_id, repost_of)
  where repost_of is not null;

create index if not exists circle_posts_repost_of_idx
  on public.circle_posts (repost_of)
  where repost_of is not null;

create or replace function public.maintain_repost_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.repost_of is not null then
    update public.circle_posts
      set repost_count = repost_count + 1
      where id = new.repost_of;
  elsif tg_op = 'DELETE' and old.repost_of is not null then
    update public.circle_posts
      set repost_count = greatest(0, repost_count - 1)
      where id = old.repost_of;
  end if;
  return null;
end; $$;

drop trigger if exists maintain_repost_count on public.circle_posts;
create trigger maintain_repost_count
  after insert or delete on public.circle_posts
  for each row execute function public.maintain_repost_count();

-- Backfill in case rows already exist (no-op on a fresh install).
update public.circle_posts p
  set repost_count = coalesce(c.n, 0)
  from (
    select repost_of, count(*)::int as n
    from public.circle_posts
    where repost_of is not null
    group by repost_of
  ) c
  where p.id = c.repost_of and p.repost_count is distinct from c.n;
