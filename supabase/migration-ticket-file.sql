-- The actual ticket, attached to the payment, for events we do not issue.
--
-- Outsourced events already tracked WHETHER a ticket was delivered. The buyer
-- still had nothing in their hands: delivery happened on WhatsApp, or by
-- email, or by somebody's word, and the app could only say it had happened.
-- Somebody who paid through us and then lost the WhatsApp message had no
-- record at all.
--
-- So the file itself lands here, on the transaction, and shows up on the
-- buyer's Tickets page next to everything else they are holding.
--
-- PRIVATE BUCKET, not public like the rest.
--
-- Every other bucket in this project is public, and for posters and avatars
-- that is fine. A ticket is different: it admits somebody to a paid event, so
-- a leaked URL is a free entry and a buyer turned away at the door. This
-- bucket is private and read is granted per object to the person who paid for
-- it, checked against the transactions table.
--
-- Safe to run twice.


-- ------------------------------------------------------- the transaction ---
-- The PATH inside the bucket, not a URL. A signed URL expires, so storing one
-- would mean storing something that stops working; the path is what stays
-- true.
alter table public.transactions
  add column if not exists ticket_file_path text;
alter table public.transactions
  add column if not exists ticket_file_name text;

comment on column public.transactions.ticket_file_path is
  'Object path inside the private ticket-files bucket. Null until an admin attaches one.';
comment on column public.transactions.ticket_file_name is
  'What the buyer sees and downloads it as.';


-- ----------------------------------------------------------- the bucket ----
insert into storage.buckets (id, name, public)
values ('ticket-files', 'ticket-files', false)
on conflict (id) do nothing;

-- Admins put files in and take them out again.
drop policy if exists "Admins write ticket files" on storage.objects;
create policy "Admins write ticket files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-files' and public.is_admin());

drop policy if exists "Admins replace ticket files" on storage.objects;
create policy "Admins replace ticket files"
  on storage.objects for update to authenticated
  using (bucket_id = 'ticket-files' and public.is_admin());

drop policy if exists "Admins remove ticket files" on storage.objects;
create policy "Admins remove ticket files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-files' and public.is_admin());

-- The buyer reads exactly the object attached to a payment they made, and
-- nothing else in the bucket. This is what lets them sign their own URL
-- without the app holding a service key.
drop policy if exists "Buyers read their own ticket file" on storage.objects;
create policy "Buyers read their own ticket file"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.transactions t
        where t.user_id = auth.uid()
          and t.ticket_file_path = storage.objects.name
      )
    )
  );


-- ------------------------------------------------------------- the write ---
-- transactions has no admin UPDATE policy on purpose, so this goes through a
-- function like the other delivery writes. The only columns it can touch are
-- the ticket-file ones and the delivery flag; an amount is never reachable
-- from an admin screen by accident.
create or replace function public.admin_set_ticket_file(
  p_tx   uuid,
  p_path text,
  p_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  has_file boolean := nullif(btrim(coalesce(p_path, '')), '') is not null;
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return false;
  end if;

  update public.transactions
     set ticket_file_path = nullif(btrim(coalesce(p_path, '')), ''),
         ticket_file_name = nullif(btrim(coalesce(p_name, '')), ''),
         -- Attaching the ticket IS the delivery, and removing it undoes that.
         -- A row reading "delivered" with nothing attached is the state this
         -- whole migration exists to get rid of.
         delivered        = has_file,
         delivered_at     = case when has_file then now() else null end
   where id = p_tx;

  return found;
end;
$$;

grant execute on function public.admin_set_ticket_file(uuid, text, text) to authenticated;


-- ------------------------------------------------------------ where we are --
-- Outsourced sales, and whether the buyer can actually hold their ticket.

select
  e.title,
  count(*)                                          as sales,
  count(*) filter (where t.ticket_file_path is not null) as with_file,
  count(*) filter (where t.delivered and t.ticket_file_path is null) as marked_but_no_file
from public.transactions t
join public.events e on e.id = t.event_id
where e.tickets_outsourced
group by e.id, e.title
order by sales desc;
