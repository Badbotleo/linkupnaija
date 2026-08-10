import type { HostStats } from "./types";

export interface Badge {
  key: string;
  label: string;
  /** A LineIcon name — see components/ui/LineIcon.tsx. */
  icon: string;
  /** "gold" for the two status badges, "brand" for the earned ones. */
  tone: "gold" | "brand";
}

/**
 * The full catalogue (also used by the admin award/revoke UI).
 *
 * These were emoji — 👑 🏆 ✅ 🛡️ ⚡ — and on the host leaderboard, where five
 * of them sit in a row under every name, that was the one place the app most
 * looked like a spreadsheet. Emoji render differently on every OS, don't take
 * the brand colour, and never match the line icons used everywhere else.
 *
 * Now LineIcon glyphs, which inherit currentColor and sit on the same optical
 * weight as the rest of the interface. Two tones only: gold for the two
 * status badges, brand purple for the earned ones. No new colours — both are
 * already in the kit.
 */
export const BADGE_CATALOG: Record<string, Badge> = {
  elite: { key: "elite", label: "LinkUpNaija Elite", icon: "star", tone: "gold" },
  top_host: { key: "top_host", label: "Top Host", icon: "trophy", tone: "gold" },
  verified: { key: "verified", label: "Verified Host", icon: "check", tone: "brand" },
  safety_champion: { key: "safety_champion", label: "Safety Champion", icon: "shield", tone: "brand" },
  quick_responder: { key: "quick_responder", label: "Quick Responder", icon: "zap", tone: "brand" },
};

// Display priority (highest-status first).
const ORDER = [
  "elite",
  "top_host",
  "verified",
  "safety_champion",
  "quick_responder",
];

// Postgres `numeric` columns come back from Supabase as strings — coerce.
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);

export function computeBadges(
  stats: HostStats | null | undefined,
  opts: {
    awarded?: string[];
    revoked?: string[];
    isTopHost?: boolean;
  } = {}
): Badge[] {
  const keys = new Set<string>();
  if (stats && Number(stats.total_events) > 0) {
    const events = Number(stats.total_events);
    const rating = num(stats.average_rating) ?? 0;
    const attendance = num(stats.attendance_rate) ?? 0;
    const response = num(stats.avg_response_time_hours);
    const safety = num(stats.safety_score);

    // "New Host" used to be added here for anyone with at least one event —
    // unconditionally, and never removed, so every host on the platform wore
    // it forever. Read down a feed it announced that nobody established is
    // here. Removed rather than time-limited: the upside was never worth it.
    // An `awarded` list containing "new_host" is now simply ignored, because
    // ORDER no longer contains it.
    if (events >= 3 && rating >= 4) keys.add("verified");
    if (events >= 10 && rating >= 4.8 && attendance >= 90) keys.add("elite");
    if (response != null && response <= 2) keys.add("quick_responder");
    if (events >= 5 && safety === 100) keys.add("safety_champion");
  }
  if (opts.isTopHost) keys.add("top_host");

  for (const k of opts.awarded ?? []) keys.add(k);
  for (const k of opts.revoked ?? []) keys.delete(k);

  return ORDER.filter((k) => keys.has(k)).map((k) => BADGE_CATALOG[k]);
}

/** A composite score for ranking hosts on the leaderboard (0–100-ish). */
export function hostScore(stats: HostStats): number {
  const rating = ((num(stats.average_rating) ?? 0) / 5) * 60; // up to 60
  const volume = Math.min(Number(stats.total_events) || 0, 20) * 1.5; // up to 30
  const safety = ((num(stats.safety_score) ?? 70) / 100) * 10; // up to 10
  return Math.round(rating + volume + safety);
}
