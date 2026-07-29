-- ============================================================================
-- LinkUpNaija — Admin grants/revokes Pro
--
-- users has no admin UPDATE policy, and adding one would let an admin rewrite
-- ANY column on ANY user from the browser. A narrow SECURITY DEFINER function
-- is the smaller blast radius: it touches only the two Pro columns and checks
-- is_admin() itself.
-- Idempotent — safe to re-run.
-- ============================================================================

create or replace function public.admin_set_pro(p_user uuid, p_months integer)
returns table (id uuid, is_pro boolean, pro_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_months is null or p_months <= 0 then
    -- Revoke immediately.
    update public.users u
       set is_pro = false, pro_expires_at = null
     where u.id = p_user;
  else
    -- Extend from whichever is later: an existing unexpired term, or now.
    update public.users u
       set is_pro = true,
           pro_expires_at =
             greatest(coalesce(u.pro_expires_at, now()), now())
             + make_interval(months => p_months)
     where u.id = p_user;
  end if;

  return query
    select u.id, u.is_pro, u.pro_expires_at
      from public.users u
     where u.id = p_user;
end; $$;

revoke all on function public.admin_set_pro(uuid, integer) from public, anon;
grant execute on function public.admin_set_pro(uuid, integer) to authenticated;
