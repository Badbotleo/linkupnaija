-- Native push tokens, alongside the web ones.
--
-- push_subscriptions holds the Web Push shape: an endpoint URL plus the
-- p256dh and auth keys the browser hands out. A native token is none of
-- those. FCM and APNs give a single opaque string and the send path is a
-- different API entirely, so forcing it into the endpoint column would mean
-- every sender has to guess which kind of row it is looking at.
--
-- Separate table, one row per device, keyed on the token so reinstalling an
-- app replaces its row instead of accumulating dead ones.
create table if not exists public.native_push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token      text not null,
  -- 'ios' or 'android'. The send path differs, so it is not cosmetic.
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (token)
);

create index if not exists native_push_tokens_user_idx
  on public.native_push_tokens (user_id);

alter table public.native_push_tokens enable row level security;

-- A member manages their own devices and sees nobody else's.
drop policy if exists "own native push tokens" on public.native_push_tokens;
create policy "own native push tokens" on public.native_push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.native_push_tokens to authenticated;
