import { cache } from "react";
import { createClient } from "./server";

// Request-level memoisation. React's cache() dedupes these across the whole
// server render of a single request, so the layout (Navbar) and the page being
// rendered share ONE getUser() network round-trip and ONE is_admin lookup,
// instead of each calling them again. This is the main fix for the slow /admin
// load: getUser() validates the session against Supabase Auth over the network
// (slowest with OAuth sessions), and we were doing it 3x per request.

/** The authenticated user, validated against Supabase Auth — once per request. */
export const getSessionUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export interface UserMeta {
  id: string;
  is_admin: boolean;
  name: string | null;
  avatar_url: string | null;
}

/** The current user's id + admin flag + name/avatar — one lookup per request. */
export const getCurrentUserMeta = cache(async (): Promise<UserMeta | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, is_admin, name, avatar_url")
    .eq("id", user.id)
    .single();
  return (
    (data as UserMeta | null) ?? {
      id: user.id,
      is_admin: false,
      name: null,
      avatar_url: null,
    }
  );
});
