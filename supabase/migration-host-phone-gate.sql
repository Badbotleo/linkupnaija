-- Hosting a link-up requires a verified phone number.
--
-- Hosts take money through Paystack and put strangers in a room together.
-- That is the one place on the platform where a real number is worth what it
-- costs to check; attendees are covered by the host approving them, which is
-- free and already the product's promise.
--
-- Enforced HERE, not in the form. Events are inserted straight from the
-- browser in HostForm.tsx with the anon key, so a check in the UI is a
-- suggestion: anyone can post an insert of their own. RLS is the only place
-- this rule cannot be walked around.
--
-- ------------------------------------------------------------ who it hits --
-- At the time of writing: 12 hosts, 0 verified, because no SMS provider was
-- configured and verifying was impossible. A flat rule would have locked out
-- every host on the platform to solve a problem none of them caused.
--
-- So the rule is about the FIRST event. Anybody already hosting keeps
-- hosting; the next person to try needs a verified number. That protects the
-- supply side while closing the door behind it.
--
-- Do not run this until sending actually works: TERMII_API_KEY set, sender ID
-- approved, and OTP_TEST_MODE removed. With test mode on, phone-send-otp
-- returns the code in its own response, so anybody can verify any number and
-- this gate is theatre.
--
-- Safe to run twice.

-- The check lives in a function so the policy does not select from the table
-- it is guarding, and so the rule is stated once for both the policy and the
-- app.
create or replace function public.may_host()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((select u.phone_verified from public.users u where u.id = auth.uid()), false)
    -- Grandfathered: already hosts here.
    or exists (select 1 from public.events e where e.host_id = auth.uid());
$$;

comment on function public.may_host() is
  'Verified phone, or already hosts. Used by the events insert policy and by the host form.';

grant execute on function public.may_host() to authenticated;

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
  on public.events for insert
  with check (auth.uid() = host_id and public.may_host());


-- ---------------------------------------------------------------- rollback --
-- If SMS breaks and hosting stops, put the old policy back. Nothing else in
-- this file needs undoing; may_host() is harmless on its own.

/*
drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
  on public.events for insert with check (auth.uid() = host_id);
*/


-- ------------------------------------------------------------ before/after --
-- Read this first. It changes nothing.
--
--   grandfathered   : keep hosting regardless
--   newly_blocked   : signed up, no events, no verified number. These are the
--                     people who will now meet the gate.

select
  count(*) filter (
    where exists (select 1 from public.events e where e.host_id = u.id)
  ) as grandfathered,
  count(*) filter (
    where not exists (select 1 from public.events e where e.host_id = u.id)
      and u.phone_verified is not true
  ) as newly_blocked
from public.users u;
