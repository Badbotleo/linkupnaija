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
  /** On the team but not an operator. Grants /admin/growth and nothing else. */
  is_team: boolean;
  /** Last page load while signed in. Drives "Online now" on profiles. */
  last_seen_at: string | null;
  name: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  pro_expires_at: string | null;
}

/**
 * The current user's id, roles, name/avatar and pro status — one lookup per
 * request.
 *
 * is_team rides along here rather than getting its own query. This runs on
 * every page for every signed-in visitor, so a second round trip to read one
 * boolean would be the most expensive column on the site.
 */
export const getCurrentUserMeta = cache(async (): Promise<UserMeta | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, is_admin, is_team, name, avatar_url, is_pro, pro_expires_at, last_seen_at")
    .eq("id", user.id)
    .single();
  /**
   * Stamp last_seen_at, at most once every two minutes.
   *
   * This helper already runs on every signed-in page render and is memoised
   * per request, so it is the one place that knows somebody is here without
   * adding a query. The throttle is the whole trick: without it, clicking
   * through ten pages is ten writes to the busiest table on the site, for a
   * number nobody reads to the second.
   *
   * Deliberately not awaited. Presence is the least important thing on any
   * page it appears on, and it must never be the reason one is slow. If the
   * write fails, the value is stale by two minutes and nothing else breaks,
   * so the rejection is swallowed rather than surfaced.
   */
  const seen = (data as UserMeta | null)?.last_seen_at;
  if (!seen || Date.now() - new Date(seen).getTime() > 120_000) {
    void supabase
      .from("users")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(
        () => {},
        () => {}
      );
  }

  return (
    (data as UserMeta | null) ?? {
      id: user.id,
      is_admin: false,
      is_team: false,
      last_seen_at: null,
      name: null,
      avatar_url: null,
      is_pro: false,
      pro_expires_at: null,
    }
  );
});
