-- Site admins can set any circle's cover.
--
-- The only update policy on circles is "Creators update their circles", so a
-- circle whose creator has gone quiet is stuck with whatever cover it started
-- with — usually none, which is why five of six were falling back to drawn
-- art. Support has no way to fix a circle picture at all.
--
-- A function rather than a wider RLS policy on purpose. Broadening the policy
-- to is_admin would let an admin edit every column on the table, including the
-- name, privacy and creator, when the actual need is one field. This grants
-- exactly the one field.
--
-- Safe to run twice.

create or replace function public.admin_set_circle_cover(
  p_circle uuid,
  p_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users u
     where u.id = auth.uid() and u.is_admin
  ) then
    -- False rather than an exception: the caller shows a refusal message, and
    -- a non-admin should not learn whether the circle exists.
    return false;
  end if;

  update public.circles
     set cover_image_url = nullif(p_url, '')
   where id = p_circle;

  return found;
end;
$$;

grant execute on function public.admin_set_circle_cover(uuid, text) to authenticated;
