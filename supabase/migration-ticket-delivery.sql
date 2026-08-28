-- Ticket earnings, and delivery tracking for tickets we don't issue ourselves.
--
-- Most link-ups are ours end to end: somebody pays, the QR appears in their
-- account, delivery is not a question anybody needs to ask. Some are not. When
-- the actual ticket comes from the host or a partner, the payment landing in
-- our account and the buyer holding a ticket are two separate events, and the
-- gap between them is where somebody pays and gets nothing.
--
-- So delivery is only a question for outsourced events, and the schema says so
-- rather than making every row carry a state that means nothing.
--
-- Safe to run twice.

-- ------------------------------------------------------------- the event ---
-- Outsourced is a property of the EVENT, not of each payment. Whoever issues
-- the ticket issues all of them.
alter table public.events
  add column if not exists tickets_outsourced boolean not null default false;

comment on column public.events.tickets_outsourced is
  'Tickets are issued by the host or a partner, not by us. Makes delivery a tracked step.';

-- ------------------------------------------------------- the transaction ---
alter table public.transactions
  add column if not exists delivered    boolean not null default false;
alter table public.transactions
  add column if not exists delivered_at timestamptz;
alter table public.transactions
  add column if not exists delivery_note text;

comment on column public.transactions.delivered is
  'Outsourced tickets only. Meaningless where we issue the ticket ourselves.';
comment on column public.transactions.delivery_note is
  'Whatever proves it: an external reference, a name at the door, a WhatsApp timestamp.';


-- ------------------------------------------------------------------ RLS ----
-- transactions has no admin UPDATE policy, only insert-by-buyer and
-- select-by-admin-or-buyer. Rather than opening the table to admin writes,
-- these go through functions: the only columns anybody can change are the
-- delivery ones, so no route here can rewrite an amount.
create or replace function public.admin_set_ticket_delivered(
  p_tx uuid,
  p_delivered boolean,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return false;
  end if;

  update public.transactions
     set delivered     = p_delivered,
         -- Cleared on un-delivering, so the timestamp can never describe a
         -- state the row is not in.
         delivered_at  = case when p_delivered then now() else null end,
         delivery_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_tx;

  return found;
end;
$$;

grant execute on function public.admin_set_ticket_delivered(uuid, boolean, text) to authenticated;


create or replace function public.admin_set_event_outsourced(
  p_event uuid,
  p_outsourced boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return false;
  end if;

  update public.events
     set tickets_outsourced = p_outsourced
   where id = p_event;

  return found;
end;
$$;

grant execute on function public.admin_set_event_outsourced(uuid, boolean) to authenticated;


-- ------------------------------------------------------------ where we are --
-- Run after. Changes nothing.
--
--   owed_to_hosts is the number that matters at payout: what was collected
--   minus what we kept. undelivered counts only outsourced tickets, because
--   that is the only place the question applies.

select
  count(*)                                          as payments,
  coalesce(sum(t.amount), 0)                        as collected,
  coalesce(sum(t.platform_fee), 0)                  as platform_earned,
  coalesce(sum(t.amount - t.platform_fee), 0)       as owed_to_hosts,
  count(*) filter (
    where e.tickets_outsourced and not t.delivered
  )                                                 as undelivered_outsourced
from public.transactions t
left join public.events e on e.id = t.event_id;
