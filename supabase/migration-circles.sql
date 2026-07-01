-- ============================================================================
-- LinkUpNaija — Circles (community groups)
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
-- Depends on users, events, notifications.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- circles
-- ----------------------------------------------------------------------------
create table if not exists public.circles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  category        text,
  state           text,
  cover_image_url text,
  creator_id      uuid references public.users (id) on delete set null,
  is_private      boolean not null default false,
  member_count    integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists circles_category_idx on public.circles (category);
create index if not exists circles_state_idx on public.circles (state);
create index if not exists circles_members_idx on public.circles (member_count desc);

alter table public.circles enable row level security;
drop policy if exists "Circles are viewable by everyone" on public.circles;
create policy "Circles are viewable by everyone"
  on public.circles for select using (true);
drop policy if exists "Creators update their circles" on public.circles;
create policy "Creators update their circles"
  on public.circles for update using (creator_id = auth.uid());
drop policy if exists "Creators delete their circles" on public.circles;
create policy "Creators delete their circles"
  on public.circles for delete using (creator_id = auth.uid());
-- Inserts go through create_circle() (also adds the creator as admin).

-- ----------------------------------------------------------------------------
-- circle_members
-- ----------------------------------------------------------------------------
create table if not exists public.circle_members (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  status       text not null default 'active' check (status in ('active', 'pending')),
  last_read_at timestamptz not null default now(),
  joined_at    timestamptz not null default now(),
  unique (circle_id, user_id)
);
create index if not exists circle_members_circle_idx on public.circle_members (circle_id, status);
create index if not exists circle_members_user_idx on public.circle_members (user_id, status);

alter table public.circle_members enable row level security;
drop policy if exists "Memberships are viewable" on public.circle_members;
create policy "Memberships are viewable"
  on public.circle_members for select using (true);
-- Join: public circles as active, private circles as pending. (Creator seat is
-- created by create_circle().)
drop policy if exists "Users join circles" on public.circle_members;
create policy "Users join circles"
  on public.circle_members for insert
  with check (
    user_id = auth.uid()
    and (
      status = 'pending'
      or exists (select 1 from public.circles c where c.id = circle_id and not c.is_private)
    )
  );
drop policy if exists "Users leave or admins remove" on public.circle_members;
create policy "Users leave or admins remove"
  on public.circle_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.circles c where c.id = circle_members.circle_id and c.creator_id = auth.uid())
  );
drop policy if exists "Admins update memberships" on public.circle_members;
create policy "Admins update memberships"
  on public.circle_members for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.circles c where c.id = circle_members.circle_id and c.creator_id = auth.uid())
  );

-- Keep circles.member_count in sync with ACTIVE memberships.
create or replace function public.maintain_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      update public.circles set member_count = member_count + 1 where id = new.circle_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status <> 'active' and new.status = 'active' then
      update public.circles set member_count = member_count + 1 where id = new.circle_id;
    elsif old.status = 'active' and new.status <> 'active' then
      update public.circles set member_count = greatest(0, member_count - 1) where id = new.circle_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'active' then
      update public.circles set member_count = greatest(0, member_count - 1) where id = old.circle_id;
    end if;
  end if;
  return null;
end; $$;
drop trigger if exists maintain_member_count on public.circle_members;
create trigger maintain_member_count
  after insert or update or delete on public.circle_members
  for each row execute function public.maintain_member_count();

-- ----------------------------------------------------------------------------
-- circle_posts
-- ----------------------------------------------------------------------------
create table if not exists public.circle_posts (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  content     text,
  image_url   text,
  event_id    uuid references public.events (id) on delete set null,
  pinned      boolean not null default false,
  like_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists circle_posts_circle_idx on public.circle_posts (circle_id, created_at desc);

alter table public.circle_posts enable row level security;

-- Helper: is the current user an active member of a circle?
create or replace function public.is_circle_member(p_circle uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

drop policy if exists "Read posts of visible circles" on public.circle_posts;
create policy "Read posts of visible circles"
  on public.circle_posts for select
  using (
    exists (select 1 from public.circles c where c.id = circle_posts.circle_id and not c.is_private)
    or public.is_circle_member(circle_posts.circle_id)
  );
drop policy if exists "Members create posts" on public.circle_posts;
create policy "Members create posts"
  on public.circle_posts for insert
  with check (user_id = auth.uid() and public.is_circle_member(circle_id));
drop policy if exists "Authors or admins delete posts" on public.circle_posts;
create policy "Authors or admins delete posts"
  on public.circle_posts for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.circles c where c.id = circle_posts.circle_id and c.creator_id = auth.uid())
  );
drop policy if exists "Admins update posts" on public.circle_posts;
create policy "Admins update posts"
  on public.circle_posts for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.circles c where c.id = circle_posts.circle_id and c.creator_id = auth.uid())
  );

-- Notify circle members when an EVENT is shared to the circle.
create or replace function public.handle_circle_event_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare c_name text;
begin
  if new.event_id is not null then
    select name into c_name from public.circles where id = new.circle_id;
    insert into public.notifications (user_id, message, event_id)
    select m.user_id,
           'New event shared in ' || coalesce(c_name, 'a circle') || ' 🎉',
           new.event_id
    from public.circle_members m
    where m.circle_id = new.circle_id
      and m.status = 'active'
      and m.user_id <> new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists on_circle_event_post on public.circle_posts;
create trigger on_circle_event_post
  after insert on public.circle_posts
  for each row execute function public.handle_circle_event_post();

-- ----------------------------------------------------------------------------
-- circle_post_likes
-- ----------------------------------------------------------------------------
create table if not exists public.circle_post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.circle_posts (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists circle_post_likes_post_idx on public.circle_post_likes (post_id);

alter table public.circle_post_likes enable row level security;
drop policy if exists "Likes are viewable" on public.circle_post_likes;
create policy "Likes are viewable" on public.circle_post_likes for select using (true);
drop policy if exists "Users like posts" on public.circle_post_likes;
create policy "Users like posts" on public.circle_post_likes for insert with check (user_id = auth.uid());
drop policy if exists "Users unlike posts" on public.circle_post_likes;
create policy "Users unlike posts" on public.circle_post_likes for delete using (user_id = auth.uid());

create or replace function public.maintain_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.circle_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.circle_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end; $$;
drop trigger if exists maintain_like_count on public.circle_post_likes;
create trigger maintain_like_count
  after insert or delete on public.circle_post_likes
  for each row execute function public.maintain_like_count();

-- ----------------------------------------------------------------------------
-- circle_post_comments (max 2 levels via parent_id)
-- ----------------------------------------------------------------------------
create table if not exists public.circle_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.circle_posts (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  parent_id  uuid references public.circle_post_comments (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists circle_comments_post_idx on public.circle_post_comments (post_id, created_at);

alter table public.circle_post_comments enable row level security;
drop policy if exists "Comments are viewable" on public.circle_post_comments;
create policy "Comments are viewable" on public.circle_post_comments for select using (true);
drop policy if exists "Users comment" on public.circle_post_comments;
create policy "Users comment" on public.circle_post_comments for insert with check (user_id = auth.uid());
drop policy if exists "Users delete own comments" on public.circle_post_comments;
create policy "Users delete own comments" on public.circle_post_comments for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- create_circle() — create a circle and seat the creator as an active admin.
-- ----------------------------------------------------------------------------
create or replace function public.create_circle(
  p_name text,
  p_description text,
  p_category text,
  p_state text,
  p_cover text,
  p_private boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name required'; end if;

  insert into public.circles (name, description, category, state, cover_image_url, creator_id, is_private)
  values (trim(p_name), p_description, p_category, p_state, p_cover, me, coalesce(p_private, false))
  returning id into new_id;

  insert into public.circle_members (circle_id, user_id, role, status)
  values (new_id, me, 'admin', 'active');

  return new_id;
end;
$$;
grant execute on function public.create_circle(text, text, text, text, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Seed starter circles so the platform doesn't feel empty (system-owned).
-- ----------------------------------------------------------------------------
insert into public.circles (name, description, category, state, is_private)
select v.name, v.description, v.category, v.state, false
from (values
  ('Abuja Foodies 🍽️', 'For everyone who lives to eat in Abuja — share spots, meetups and food events.', 'Dinner', 'FCT - Abuja'),
  ('Lagos Book Lovers 📚', 'Readers of Lagos: book clubs, swaps and author meetups.', 'Book Club', 'Lagos'),
  ('FCT Hikers 🌿', 'Weekend hikes and outdoor adventures around the FCT.', 'Hiking', 'FCT - Abuja'),
  ('Naija Game Night Squad 🎮', 'Board games, FIFA nights and everything gaming across Nigeria.', 'Game Night', null),
  ('Abuja Young Professionals 💼', 'Network, grow and connect with young professionals in Abuja.', 'Networking', 'FCT - Abuja'),
  ('Lagos Weekend Vibes 🌙', 'Your go-to for the best weekend link-ups in Lagos.', 'Party', 'Lagos')
) as v(name, description, category, state)
where not exists (select 1 from public.circles c where c.name = v.name);
