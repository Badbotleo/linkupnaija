-- Pro hosts pay half the platform fee: 5% instead of 10%.
--
-- The percentage now depends on WHO IS HOSTING, and the row that records it is
-- inserted by the BUYER's browser under a policy that only checks
-- `user_id = auth.uid()`. That was already loose — anyone could have posted a
-- transaction claiming platform_fee 0 and the payout maths would have believed
-- it — and a fee that varies makes it load-bearing. So the number stops being
-- something the client asserts and becomes something the database decides.
--
-- The client still sends a fee, and still computes the same one. This just
-- means it no longer matters if it lies.
--
-- Safe to run twice. Changes no existing rows.

create or replace function public.set_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_is_pro boolean;
begin
  -- security definer because the buyer cannot read the host's subscription
  -- columns, and must not be able to.
  select coalesce(u.is_pro, false)
         and (u.pro_expires_at is null or u.pro_expires_at > now())
    into host_is_pro
    from public.events e
    join public.users u on u.id = e.host_id
   where e.id = new.event_id;

  -- A missing event or host falls back to the standard rate rather than to
  -- zero. Failing open on a fee means failing toward not charging one.
  new.platform_fee := round(
    new.amount * (case when coalesce(host_is_pro, false) then 5 else 10 end) / 100.0
  );

  return new;
end;
$$;

drop trigger if exists transactions_platform_fee on public.transactions;
create trigger transactions_platform_fee
  before insert on public.transactions
  for each row execute function public.set_platform_fee();


-- ------------------------------------------------------------ where we are --
-- Run after. Every past sale keeps the fee it was recorded with; this only
-- shows which future sales are affected.

select count(*) filter (
         where coalesce(is_pro, false)
           and (pro_expires_at is null or pro_expires_at > now())
       ) as pro_members_today,
       count(*) as members_total
  from public.users;
