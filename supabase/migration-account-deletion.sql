-- Account deletion, the way Google Play requires it and the schema allows.
--
-- WHY NOTHING IS DELETED FROM public.users.
--
-- Fifty-one tables carry a foreign key to public.users with ON DELETE CASCADE,
-- among them events.host_id and rsvps.user_id. Deleting the row would take the
-- member's tickets, their hosted events, and then every OTHER member's ticket
-- to those events, because the cascade from events reaches their rsvps too. A
-- host closing their account would silently destroy the records of people who
-- had paid them. So the row stays and the person is erased from it instead.
--
-- WHAT A MEMBER GETS. Every piece of personal data goes: name, email, phone,
-- photos, bio, socials, bank details, emergency contacts. Their login is
-- revoked separately by the API route, which deletes the auth.users entry.
-- There is no foreign key between auth.users and public.users, so that
-- deletion does not cascade here.
--
-- WHAT SURVIVES. Tickets, payments, payouts and hosted events, with the person
-- detached and shown as a deleted member. That keeps hosts' sales history
-- honest and keeps our books reconcilable against Paystack, which holds its own
-- record of every charge whatever we do here.

alter table public.users
  add column if not exists deleted_at timestamptz;

comment on column public.users.deleted_at is
  'Set when the member deleted their account. The row is retained, emptied of
   personal data, because 51 tables cascade from it. Treat any row with this
   set as a deleted member: no profile, no contact, not signed in.';

create index if not exists users_deleted_at_idx
  on public.users (deleted_at)
  where deleted_at is not null;

/**
 * Erase one member in place. Idempotent: running it twice is harmless.
 *
 * SECURITY DEFINER because the caller is the member themselves and RLS would
 * otherwise stop them writing most of these columns. The function is therefore
 * careful to act only on the id it is given, and the API route is what proves
 * that id belongs to whoever is asking.
 */
create or replace function public.anonymise_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set
    -- email is NOT NULL, so it gets a tombstone rather than null. .invalid is
    -- reserved by RFC 2606 and can never resolve, so nothing will ever try to
    -- deliver to it or match it against a real address at signup.
    email                   = 'deleted+' || target::text || '@linkupnaija.invalid',
    name                    = null,
    avatar_url              = null,
    banner_url              = null,
    bio                     = null,
    phone                   = null,
    gender                  = null,
    state                   = null,
    instagram_url           = null,
    twitter_url             = null,
    facebook_url            = null,
    emergency_contact_name  = null,
    emergency_contact_phone = null,

    -- Money routing. Leaving these would let a payout reach someone who has
    -- asked to be forgotten, and they are the most sensitive data we hold.
    payout_bank              = null,
    payout_account_number    = null,
    payout_account_name      = null,
    paystack_subaccount_code = null,

    -- Identifiers that could re-link them to a person or a device.
    referral_code      = null,
    signup_viewer_key  = null,
    interests          = '{}',

    -- Verification state is meaningless once the contact details are gone,
    -- and leaving it true would let a re-signup inherit a verified badge.
    phone_verified     = false,
    phone_verified_at  = null,
    email_verified     = false,
    email_verified_at  = null,

    -- No lingering privileges on an account nobody can sign in to.
    is_admin           = false,
    is_team            = false,
    featured_host      = false,
    profile_visibility = 'private',
    profile_completed  = false,

    deleted_at = coalesce(deleted_at, now())
  where id = target;

  -- Things that would keep contacting them or keep them visible. These tables
  -- cascade from users, so they can be cleared outright: no other member's
  -- records depend on them.
  delete from public.push_subscriptions  where user_id = target;
  delete from public.native_push_tokens  where user_id = target;
  delete from public.email_preferences   where user_id = target;
  delete from public.scheduled_emails    where user_id = target;
  delete from public.profile_photos      where user_id = target;
  delete from public.email_verifications where user_id = target;
  delete from public.phone_verifications where user_id = target;

  -- Stop them appearing in other people's social surfaces.
  delete from public.connections   where requester_id = target or receiver_id = target;
  delete from public.profile_views where viewer_id = target or viewed_id = target;
end;
$$;

revoke all on function public.anonymise_user(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_user(uuid) to service_role;

comment on function public.anonymise_user(uuid) is
  'Erases a member in place, keeping the row because 51 tables cascade from it.
   service_role only: the API route establishes that the id is the caller''s own
   before calling this.';
