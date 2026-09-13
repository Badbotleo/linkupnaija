/**
 * A small per-IP limiter for the routes that cost money to call.
 *
 * /api/chat and /api/vibe-match both spend real Anthropic credit on every
 * request and both have to stay open, because Paddy answers people who have
 * not logged in and the search box works before you sign up. So they cannot be
 * closed with auth; they can only be made expensive to abuse.
 *
 * IN MEMORY, AND HONEST ABOUT IT. On Vercel each lambda keeps its own map, so
 * a determined attacker spreading requests across cold starts gets more than
 * the stated limit. This is a speed bump, not a wall: it stops a loop in
 * somebody's terminal running up a bill overnight, which is the realistic
 * threat, and it costs no database round trip on the happy path. A shared
 * counter in Postgres or Redis is the real answer if this ever matters more.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Best effort. Vercel sets x-forwarded-for; local dev sets nothing. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns null when the caller may proceed, or the seconds they must wait.
 *
 * Sweeps expired entries on the way through rather than on a timer, so a
 * long-lived instance cannot accumulate a bucket per IP forever.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): number | null {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [k, b] of Array.from(buckets.entries())) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (hit.count >= limit) {
    return Math.ceil((hit.resetAt - now) / 1000);
  }
  hit.count += 1;
  return null;
}
