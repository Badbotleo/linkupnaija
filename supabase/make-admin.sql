-- ============================================================================
-- LinkUpNaija — grant admin to gleonard591@gmail.com
-- Run in Supabase: Dashboard → SQL Editor. Steps are independent.
-- ============================================================================

-- 1) First, check whether the user exists yet and their current status:
select email, is_admin
from public.users
where email = 'gleonard591@gmail.com';

--   • If a row comes back  → run step 2 to promote them.
--   • If NO row comes back → they haven't signed up yet. Have them sign up
--     first, then run step 2. (Nothing else to do now.)

-- 2) Promote them to admin:
update public.users
set is_admin = true
where email = 'gleonard591@gmail.com';

-- 3) (Optional) Verify it took effect:
-- select email, is_admin from public.users where email = 'gleonard591@gmail.com';
