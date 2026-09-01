-- The platform fee moves from the host's side to the buyer's, at 9%.
--
-- A host who lists at ₦10,000 now receives ₦10,000 and the buyer pays
-- ₦10,900. Before this the buyer paid ₦10,000 and the host received ₦9,000.
--
-- THE DANGEROUS PART IS THE ROWS THAT ALREADY EXIST.
--
-- Under the old model `amount` is what the buyer paid and the host is owed
-- `amount - platform_fee`. Under the new one `amount` is the host's price and
-- the host is owed all of it. Those two readings of the same column differ by
-- the fee, so flipping the payout formula globally would silently overpay
-- every host for every sale already taken, including the ones already paid
-- out. Money that has moved cannot be un-moved by a deploy.
--
-- So each row records which model it was written under. Existing rows are
-- false, meaning fee-inclusive; the trigger stamps true from here on. Every
-- payout read branches on it, and history keeps the arithmetic it was sold
-- under.
--
-- This supersedes migration-pro-half-fee.sql. Pro no longer halves anything,
-- because hosts now keep 100% either way.
--
-- Safe to run twice.


-- ------------------------------------------------- which model wrote this --

alter table public.transactions
  add column if not exists fee_on_top boolean not null default false;

comment on column public.transactions.fee_on_top is
  'true: buyer paid amount + platform_fee and the host is owed the full amount. false (legacy): buyer paid amount and the host is owed amount - platform_fee.';


-- --------------------------------------------------------- the new charge --
-- 9% of the ticket subtotal, added on top, the same for everybody.
--
-- The Pro branch is gone rather than commented out. It halved a fee the host
-- no longer pays, so keeping it would mean charging Pro hosts' guests less
-- for the same ticket, which is a different product decision and not this one.
create or replace function public.set_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.platform_fee := round(new.amount * 9 / 100.0);
  new.fee_on_top := true;
  return new;
end;
$$;

drop trigger if exists transactions_platform_fee on public.transactions;
create trigger transactions_platform_fee
  before insert on public.transactions
  for each row execute function public.set_platform_fee();


-- ------------------------------------------------------ admin totals read --
-- owed_to_hosts summed `amount - platform_fee` for every row. That is still
-- right for legacy rows and wrong for new ones, so it branches too.
create or replace function public.admin_ticket_totals()
returns table (
  gross           bigint,
  platform_earned bigint,
  owed_to_hosts   bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(sum(t.amount), 0)::bigint                       as gross,
    coalesce(sum(t.platform_fee), 0)::bigint                 as platform_earned,
    coalesce(
      sum(case when t.fee_on_top then t.amount
               else t.amount - t.platform_fee end), 0
    )::bigint                                                as owed_to_hosts
  from public.transactions t
  where exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  );
$$;

grant execute on function public.admin_ticket_totals() to authenticated;


-- ------------------------------------------------------------ where we are --
-- Run after. Every existing sale should be fee_on_top = false, and the two
-- owed figures should differ by exactly the fees on the new rows (zero today).

select count(*)                                  as sales_total,
       count(*) filter (where fee_on_top)        as new_model,
       count(*) filter (where not fee_on_top)    as legacy_model,
       coalesce(sum(amount), 0)                  as gross,
       coalesce(sum(case when fee_on_top then amount
                         else amount - platform_fee end), 0) as owed_to_hosts
  from public.transactions;
