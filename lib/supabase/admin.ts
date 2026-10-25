import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client that runs as `service_role` and bypasses RLS.
 *
 * SERVER ONLY. Importing this into a client component leaks the key to the
 * browser, which hands anyone the whole database.
 *
 * The trap this file exists to avoid: building a client with the service-role
 * key and then attaching the caller's JWT. PostgREST resolves the role from
 * the Authorization header it is given, so the caller's token wins and every
 * query runs as `authenticated` with RLS on, while the code reads as though it
 * were privileged. That silently broke email and phone OTP for months.
 *
 * So: never pass a user token to this client. Use it for work the platform is
 * doing on its own authority, and use the normal server client to find out who
 * is asking.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in the Vercel project settings; it must never appear in NEXT_PUBLIC_* or in a committed file."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
