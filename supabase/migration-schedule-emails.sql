-- Actually schedule the emails.
--
-- The functions are deployed. Nothing calls them. The schedules have sat
-- commented out in migration-retention.sql since it was written, so no event
-- reminder has ever gone out on its own: a guest with a link-up tomorrow
-- hears nothing, and nobody reports it, because an email that never arrives
-- leaves no trace.
--
-- USES THE ANON KEY, NOT THE SERVICE ROLE KEY.
--
-- The commented version stored the service role key in a database setting.
-- That key can read and write every row in the project regardless of RLS,
-- and it would then sit in pg_settings, in this file, and in your clipboard.
-- The edge functions only need the Authorization header to be a valid JWT so
-- verify_jwt lets them in; each one already has its own service role key
-- injected by Supabase for the work it does inside. The anon key is published
-- in the browser bundle on every page load, so putting it here gives nothing
-- away.
--
-- Verified: all three functions return 200 to an anon-key POST.
--
-- BEFORE RUNNING, replace PASTE_ANON_KEY_HERE below with the value of
-- NEXT_PUBLIC_SUPABASE_ANON_KEY. It is the same string already in your
-- .env.local and in Vercel, and it is safe to paste.
--
-- Safe to run twice.


create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Stored on the database rather than repeated in three job bodies, so a
-- rotated key is one update instead of three.
alter database postgres set app.settings.functions_url =
  'https://fxfynhxggursoyoumtjx.supabase.co/functions/v1';
alter database postgres set app.settings.invoke_key =
  'PASTE_ANON_KEY_HERE';


create or replace function public._invoke_fn(fn text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := current_setting('app.settings.functions_url') || '/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.invoke_key')),
    body    := '{}'::jsonb
  );
end;
$$;


-- pg_cron runs on UTC. Nigeria is UTC+1 all year, so 08:00 here is 09:00 in
-- Lagos, which is the hour these were always meant to send.
--
-- Unscheduled first: cron.schedule on an existing name updates it, but only
-- if the name matches exactly, and a half-renamed job would run twice.
select cron.unschedule('event-reminders-daily')
  where exists (select 1 from cron.job where jobname = 'event-reminders-daily');
select cron.unschedule('scheduled-emails-daily')
  where exists (select 1 from cron.job where jobname = 'scheduled-emails-daily');
select cron.unschedule('weekly-digest')
  where exists (select 1 from cron.job where jobname = 'weekly-digest');

-- 09:00 WAT daily. Reminders for link-ups happening tomorrow.
select cron.schedule('event-reminders-daily', '0 8 * * *',
  $$ select public._invoke_fn('send-event-reminders'); $$);

-- 09:30 WAT daily. Day-2 nudges, profile nudges, re-engagement.
select cron.schedule('scheduled-emails-daily', '30 8 * * *',
  $$ select public._invoke_fn('send-scheduled-emails'); $$);

-- 09:00 WAT Thursdays. "This week on LinkUpNaija".
select cron.schedule('weekly-digest', '0 8 * * 4',
  $$ select public._invoke_fn('weekly-digest'); $$);


-- ------------------------------------------------------------ where we are --
-- Three rows, all active.

select jobname, schedule, active from cron.job order by jobname;

-- And after the first run, this is where a failure shows up. status 200 is a
-- send; anything else means the function refused the call, and the most
-- likely reason is a key that was not pasted in.
--
--   select j.jobname, r.status, r.start_time, r.return_message
--     from cron.job_run_details r
--     join cron.job j on j.jobid = r.jobid
--    order by r.start_time desc
--    limit 20;
