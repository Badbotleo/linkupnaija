-- ID verification, which is what makes the gold badge worth anything.
--
-- Premium leads on a verified badge. A gold seal that means "paid" is a lie,
-- and on a platform where every link-up starts with a host letting a stranger
-- into a room, a trust signal that certifies nothing is worse than no signal:
-- hosts work it out within a month and it takes the platform's credibility
-- with it. So the badge is granted after a person checks a real document.
--
-- Reviewed by hand, deliberately. At this size that is a few minutes of work
-- per member, and being small is exactly what makes an honest version
-- possible. Swap in a provider (Dojah, Prembly, Smile ID) when the volume
-- makes hand review silly; the shape below does not change.
--
-- Safe to run twice.


-- ------------------------------------------------------------- the record --

create table if not exists public.id_verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  doc_type     text not null check (doc_type in ('nin','drivers_licence','voters_card','passport')),
  -- Storage paths, never public URLs. The bucket is private; these are only
  -- ever resolved through a signed URL created for an admin.
  doc_path     text not null,
  selfie_path  text,
  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  note         text,
  reviewed_by  uuid references public.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- One live submission per member. A member can try again after a rejection,
-- which is why this is partial rather than a plain unique on user_id.
create unique index if not exists id_verifications_one_open
  on public.id_verifications (user_id)
  where status = 'pending';

create index if not exists id_verifications_status_idx
  on public.id_verifications (status, created_at desc);

alter table public.id_verifications enable row level security;

-- A member may submit their own, and read their own status. They may NOT
-- read anybody else's, and they may not change status: approval is not a
-- thing the applicant gets to write.
drop policy if exists "Members submit their own ID" on public.id_verifications;
create policy "Members submit their own ID"
  on public.id_verifications for insert
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Members read their own ID status" on public.id_verifications;
create policy "Members read their own ID status"
  on public.id_verifications for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins review ID" on public.id_verifications;
create policy "Admins review ID"
  on public.id_verifications for update
  using (public.is_admin()) with check (public.is_admin());


-- ------------------------------------------------------------ the outcome --
-- Kept on users so every surface that already reads a profile can show the
-- badge without another query.

alter table public.users
  add column if not exists id_verified_at timestamptz;

comment on column public.users.id_verified_at is
  'When a person on the team approved a government ID for this member. Null means unverified. The gold badge requires this AND an active Premium subscription.';


-- --------------------------------------------------------------- reviewing --
-- Admin-only, and it writes both sides in one go so a review can never
-- half-apply: the submission is marked and the user stamped together.
create or replace function public.admin_review_id(
  p_verification uuid,
  p_approve      boolean,
  p_note         text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_admin
  ) then
    return false;
  end if;

  update public.id_verifications
     set status      = case when p_approve then 'approved' else 'rejected' end,
         note        = p_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_verification
   returning user_id into target;

  if target is null then
    return false;
  end if;

  -- Approval stamps the member. Rejection clears any previous stamp, because
  -- a badge that survives a failed re-check certifies nothing.
  update public.users
     set id_verified_at = case when p_approve then now() else null end
   where id = target;

  return true;
end;
$$;

grant execute on function public.admin_review_id(uuid, boolean, text) to authenticated;


-- ------------------------------------------------- revoking on a bad actor --
-- The badge has to be removable or the promise on the Premium page is false.
create or replace function public.admin_revoke_id_verification(p_user uuid)
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

  update public.users set id_verified_at = null where id = p_user;
  return true;
end;
$$;

grant execute on function public.admin_revoke_id_verification(uuid) to authenticated;





-- ------------------------------------------------------------- the bucket --
-- PRIVATE. Avatars and event covers live in public buckets because they are
-- meant to be seen; a government ID is the opposite, and putting one in a
-- public bucket means the URL is the only thing standing between a member's
-- NIN and anybody who guesses it.
--
-- Nothing here is world-readable. Members write their own folder and can read
-- it back; admins read everything; nobody else touches it.

insert into storage.buckets (id, name, public)
values ('id-docs', 'id-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "Members upload their own ID" on storage.objects;
create policy "Members upload their own ID"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'id-docs'
    -- Path must start with the uploader's own id: id-docs/<uid>/<file>
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members read their own ID" on storage.objects;
create policy "Members read their own ID"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'id-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Members replace their own ID" on storage.objects;
create policy "Members replace their own ID"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'id-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ------------------------------------------------------------ where we are --
-- Run after. Expect zeros: nobody has submitted anything yet.

select
  (select count(*) from public.id_verifications)                          as submissions,
  (select count(*) from public.id_verifications where status = 'pending') as awaiting_review,
  (select count(*) from public.users where id_verified_at is not null)    as verified_members;
