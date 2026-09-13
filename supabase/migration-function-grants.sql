-- Audit of every security definer function written on 13 Sep 2026.
--
-- Prompted by draw_claim_winners, which was callable by anyone holding the
-- anon key. Three faults stacked there: a NULL comparison that made the host
-- check evaluate to null instead of true, Postgres granting EXECUTE to PUBLIC
-- by default, and Supabase separately granting it to anon by name. The
-- question this file answers is whether the same is true of the other twelve.
--
-- MOSTLY NO, and for a reason worth writing down. Every other guard is shaped
--
--   if not exists (select 1 from users u where u.id = auth.uid() and u.is_admin)
--
-- and a comparison against a null auth.uid() makes the row not match, so the
-- EXISTS is false and the guard fails CLOSED. The broken one was the only
-- guard written as `a <> b` in an IF, where null means the IF never fires and
-- it fails OPEN. Same null, opposite outcome, entirely because of shape.
--
-- Confirmed against the live database rather than by reading:
--
--   admin_set_ticket_file   anon -> returns false, no row touched   OK
--   owns_venue              anon -> false                           OK
--   venue_is_claimed        anon -> false                           public on purpose
--   tier_seats_sold         anon -> 0                               counts only
--   payout_hold_days        anon -> 0                               a constant
--   profile_score           anon -> 45 for a named member           LEAK, fixed below
--
-- payout_hold_days returning 0 is correct, not a missing setting: the check
-- reads `ev.date + 0 >= today`, which allows a payout the day after the
-- link-up, exactly as its own error message says.
--
-- enforce_payout_integrity's `ev.host_id <> new.host_id` is the same shape as
-- the bug, but payouts.host_id is NOT NULL and the RLS insert policy is
-- `host_id = auth.uid()`, so neither side can be null by the time it runs.
--
-- Safe to run twice.


-- ------------------------------------------------------- the one real leak --
-- profile_score(uuid) takes ANY member's id and returns how complete their
-- profile is, and an anonymous caller could ask it about a named person. It
-- is not sensitive in itself, but it is one member's data answered to the
-- whole internet, and nothing outside the database needs it: the draw calls
-- it internally as a definer, and the claim page works out its own gaps from
-- the row it already has.
revoke execute on function public.profile_score(uuid) from public;
revoke execute on function public.profile_score(uuid) from anon;
revoke execute on function public.profile_score(uuid) from authenticated;


-- ------------------------------------------------------ defence in depth --
-- admin_set_ticket_file already refuses a stranger and returns false without
-- touching a row, which is verified above. There is still no reason for the
-- anonymous role to be able to call a function whose name begins with admin.
revoke execute on function public.admin_set_ticket_file(uuid, text, text) from public;
revoke execute on function public.admin_set_ticket_file(uuid, text, text) from anon;
grant  execute on function public.admin_set_ticket_file(uuid, text, text) to authenticated;

-- owns_venue answers about the caller, so it tells an anonymous visitor
-- nothing, but only logged-in people can own anything.
revoke execute on function public.owns_venue(uuid) from public;
revoke execute on function public.owns_venue(uuid) from anon;
grant  execute on function public.owns_venue(uuid) to authenticated;


-- ------------------------------------------------------------ left public --
-- Deliberately, and each for a reason:
--
--   claim_slots       the claim page counts entries for logged-out visitors
--   venue_is_claimed  the venue page decides whether to invite a claim
--   tier_seats_sold   "4 left" on a public event page
--   payout_hold_days  returns the constant 0


-- ------------------------------------------------- rsvps: the payment columns --
-- Separate finding, same audit. The read policy on rsvps is
--
--   create policy "RSVPs are viewable by everyone" on public.rsvps
--     for select using (true);
--
-- which is right for the product: an event page shows who is coming, and it
-- has to do that for somebody who has not logged in. But a row-level policy
-- hands over every COLUMN on the row, and these three ride along:
--
--   payment_reference  a Paystack transaction id. Seven rows carry one, and
--                      an anonymous visitor could read all seven.
--   paid_at            when they paid
--   payment_due_at     what they still owe and by when
--
-- None of the three is a key and none of them can charge anybody, but they
-- are somebody's payment record answered to the open internet, and nothing
-- public needs them: payment_reference is read by /admin/payments and the
-- host's own buyers page, both behind a login, and the other two are not read
-- by the app at all.
--
-- paid is deliberately NOT revoked. The event page selects it on every load,
-- including for logged-out visitors, so taking it away would blank the
-- busiest page on the site to close a boolean.
revoke select (payment_reference, paid_at, payment_due_at)
  on public.rsvps from anon;


-- ------------------------------------------------------------ still open --
-- NOT fixed here, because it is a policy change rather than a grant and it
-- deserves its own look: a declined request is readable by anyone, so "this
-- person asked to come and was turned down" is public. Nothing in the product
-- renders it, and hiding it means narrowing the select policy rather than
-- revoking a column, which is the kind of change that quietly breaks a count
-- somewhere. Worth doing, worth doing carefully.


-- ------------------------------------------------------------ where we are --
-- Every definer function still reachable by anon or PUBLIC. Each row should
-- be one of the four named above; anything else is worth a second look.

select
  p.proname          as function,
  a.grantee,
  a.privilege_type
from information_schema.routine_privileges a
join pg_proc p on p.proname = a.routine_name
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where a.routine_schema = 'public'
  and a.grantee in ('anon', 'PUBLIC')
  and p.prosecdef
group by p.proname, a.grantee, a.privilege_type
order by p.proname;
