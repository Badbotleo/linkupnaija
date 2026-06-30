-- ============================================================================
-- LinkUpNaija — Retention / lifecycle emails
-- Run in Supabase: Dashboard → SQL Editor → New query → Run. (Idempotent.)
--
-- Adds:
--   • scheduled_emails   — tracks every lifecycle email (welcome, nudges, etc.)
--   • email_preferences  — per-user opt-outs + unsubscribe token
--   • users.last_login_at
--   • unsubscribe_by_token() RPC (used by the public /unsubscribe page)
--   • pg_cron schedules for the email Edge Functions
--   • auth.users trigger that fires the welcome-sequence on email confirmation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- last_login_at
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists last_login_at timestamptz;

create index if not exists users_last_login_idx
  on public.users (last_login_at);

-- ----------------------------------------------------------------------------
-- scheduled_emails
-- ----------------------------------------------------------------------------
create table if not exists public.scheduled_emails (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  email_type    text not null,            -- welcome | day2_events | profile_nudge | host_nudge | reengagement
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  status        text not null default 'pending'
                check (status in ('pending', 'sent', 'skipped', 'failed')),
  created_at    timestamptz not null default now()
);

-- One row per (user, email_type). Lifecycle emails (welcome, nudges) are
-- one-shot; the recurring "reengagement" row is upserted in place, with its
-- sent_at refreshed each send and a cooldown enforced in the function. A full
-- (non-partial) unique index is required so PostgREST upserts can target it.
create unique index if not exists scheduled_emails_user_type_uidx
  on public.scheduled_emails (user_id, email_type);

create index if not exists scheduled_emails_due_idx
  on public.scheduled_emails (status, scheduled_for);

create index if not exists scheduled_emails_user_idx
  on public.scheduled_emails (user_id, email_type, sent_at desc);

alter table public.scheduled_emails enable row level security;
-- No public policies: only the service role (Edge Functions) touches this table.

-- ----------------------------------------------------------------------------
-- email_preferences
-- ----------------------------------------------------------------------------
create table if not exists public.email_preferences (
  user_id               uuid primary key references public.users (id) on delete cascade,
  weekly_digest_enabled boolean not null default true,
  welcome_emails_enabled boolean not null default true,
  unsubscribe_token     uuid not null default gen_random_uuid(),
  created_at            timestamptz not null default now()
);

create unique index if not exists email_prefs_token_uidx
  on public.email_preferences (unsubscribe_token);

alter table public.email_preferences enable row level security;

-- Users manage their own preferences from /profile/edit.
drop policy if exists "Users read own email prefs" on public.email_preferences;
create policy "Users read own email prefs"
  on public.email_preferences for select using (auth.uid() = user_id);

drop policy if exists "Users insert own email prefs" on public.email_preferences;
create policy "Users insert own email prefs"
  on public.email_preferences for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own email prefs" on public.email_preferences;
create policy "Users update own email prefs"
  on public.email_preferences for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Public unsubscribe (used by the one-click link in emails — no auth required).
-- SECURITY DEFINER so it can flip the flag for the row matching the token only.
-- ----------------------------------------------------------------------------
create or replace function public.unsubscribe_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit boolean;
begin
  update public.email_preferences
     set weekly_digest_enabled = false
   where unsubscribe_token = p_token;
  get diagnostics hit = row_count;
  return hit;
end;
$$;

grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;

-- ============================================================================
-- SCHEDULING (pg_cron + pg_net)
-- ----------------------------------------------------------------------------
-- Run this block ONCE, after replacing the two placeholders below.
-- Note: Nigeria is UTC+1 (WAT); 08:00 UTC = 09:00 WAT.
-- ============================================================================
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- -- Store project URL + service key so we don't paste them into every job.
-- -- (Set once; read back with current_setting.)
-- alter database postgres set app.settings.functions_url =
--   'https://<PROJECT_REF>.functions.supabase.co';
-- alter database postgres set app.settings.service_role_key =
--   '<SERVICE_ROLE_KEY>';
--
-- -- Helper to POST to an Edge Function.
-- create or replace function public._invoke_fn(fn text)
-- returns void language plpgsql as $$
-- begin
--   perform net.http_post(
--     url     := current_setting('app.settings.functions_url') || '/' || fn,
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
--     body    := '{}'::jsonb
--   );
-- end; $$;
--
-- -- Daily 09:00 WAT — event reminders for events happening tomorrow.
-- select cron.schedule('event-reminders-daily', '0 8 * * *',
--   $$ select public._invoke_fn('send-event-reminders'); $$);
--
-- -- Daily 09:30 WAT — process scheduled follow-ups + re-engagement.
-- select cron.schedule('scheduled-emails-daily', '30 8 * * *',
--   $$ select public._invoke_fn('send-scheduled-emails'); $$);
--
-- -- Thursdays 09:00 WAT — weekly digest.
-- select cron.schedule('weekly-digest', '0 8 * * 4',
--   $$ select public._invoke_fn('weekly-digest'); $$);

-- ============================================================================
-- WELCOME TRIGGER
-- ----------------------------------------------------------------------------
-- Fire the welcome-sequence the moment a user confirms their email. Requires
-- pg_net and the app.settings.* values above. Run ONCE after the block above.
-- ============================================================================
--
-- create or replace function public.handle_user_confirmed()
-- returns trigger language plpgsql security definer as $$
-- begin
--   if old.email_confirmed_at is null and new.email_confirmed_at is not null then
--     perform net.http_post(
--       url     := current_setting('app.settings.functions_url') || '/welcome-sequence',
--       headers := jsonb_build_object(
--         'Content-Type','application/json',
--         'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
--       body    := jsonb_build_object('user_id', new.id)
--     );
--   end if;
--   return new;
-- end; $$;
--
-- drop trigger if exists on_user_confirmed on auth.users;
-- create trigger on_user_confirmed
--   after update of email_confirmed_at on auth.users
--   for each row execute function public.handle_user_confirmed();
