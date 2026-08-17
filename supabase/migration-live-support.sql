-- Live support: a visitor talks to Paddy, and can hand off to a human.
--
-- Answered in-house from /admin/support, not by a third-party widget. Two
-- tables rather than one, because a thread has state (open/closed, unread)
-- that a message doesn't, and an inbox needs to sort by it.
--
-- Safe to run twice.

-- ---------------------------------------------------------------- threads --
create table if not exists public.support_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  -- Logged-out visitors get support too: the widget mints a random id in
  -- localStorage so a thread survives a refresh without an account. Exactly
  -- one of user_id / guest_key is set.
  guest_key   text,
  subject     text,
  status      text not null default 'open'
              check (status in ('open', 'closed')),
  -- Denormalised so the inbox can sort without touching every message.
  last_message_at timestamptz not null default now(),
  -- Who spoke last. Drives the inbox's "needs a reply" filter, which is the
  -- only thing you actually want to look at when you open it.
  last_sender text not null default 'user'
              check (last_sender in ('user', 'admin')),
  created_at  timestamptz not null default now(),
  constraint support_thread_has_an_owner
    check (user_id is not null or guest_key is not null)
);

create index if not exists support_threads_inbox_idx
  on public.support_threads (status, last_message_at desc);
create index if not exists support_threads_user_idx
  on public.support_threads (user_id);
create unique index if not exists support_threads_guest_idx
  on public.support_threads (guest_key) where guest_key is not null;

-- --------------------------------------------------------------- messages --
create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.support_threads(id) on delete cascade,
  sender     text not null check (sender in ('user', 'admin')),
  -- Null for a guest, and for admin replies — the admin identity is implied.
  author_id  uuid references public.users(id) on delete set null,
  body       text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_idx
  on public.support_messages (thread_id, created_at);

-- Keep the thread's sort key honest without a second round trip from the app.
create or replace function public.touch_support_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_threads
     set last_message_at = new.created_at,
         last_sender     = new.sender,
         -- A reply on a closed thread reopens it. Closing is an admin action;
         -- a customer writing back is not "still closed".
         status = case when new.sender = 'user' then 'open' else status end
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch on public.support_messages;
create trigger support_messages_touch
  after insert on public.support_messages
  for each row execute function public.touch_support_thread();

-- -------------------------------------------------------------------- RLS --
alter table public.support_threads  enable row level security;
alter table public.support_messages enable row level security;

-- Threads ------------------------------------------------------------------
drop policy if exists "own thread readable" on public.support_threads;
create policy "own thread readable" on public.support_threads
  for select using (
    (user_id is not null and user_id = auth.uid()) or public.is_admin()
  );

drop policy if exists "start own thread" on public.support_threads;
create policy "start own thread" on public.support_threads
  for insert with check (
    (user_id is not null and user_id = auth.uid()) or public.is_admin()
  );

-- Only an admin closes or reopens a thread from the inbox. Users move status
-- implicitly, through the trigger above, which runs as definer.
drop policy if exists "admin manages threads" on public.support_threads;
create policy "admin manages threads" on public.support_threads
  for update using (public.is_admin()) with check (public.is_admin());

-- Messages -----------------------------------------------------------------
drop policy if exists "own messages readable" on public.support_messages;
create policy "own messages readable" on public.support_messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.support_threads t
       where t.id = support_messages.thread_id
         and t.user_id = auth.uid()
    )
  );

drop policy if exists "write to own thread" on public.support_messages;
create policy "write to own thread" on public.support_messages
  for insert with check (
    (
      sender = 'user'
      and exists (
        select 1 from public.support_threads t
         where t.id = support_messages.thread_id
           and t.user_id = auth.uid()
      )
    )
    or (sender = 'admin' and public.is_admin())
  );

-- Marking read is the only field either side updates.
drop policy if exists "admin marks read" on public.support_messages;
create policy "admin marks read" on public.support_messages
  for update using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- realtime --
-- Without this the inbox and the widget both poll, which is the thing
-- Realtime exists to avoid. Guarded: adding a table twice is an error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'support_threads'
  ) then
    alter publication supabase_realtime add table public.support_threads;
  end if;
end $$;
