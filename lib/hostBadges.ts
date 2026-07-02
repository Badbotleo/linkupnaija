import type { HostStats } from "./types";

export interface Badge {
  key: string;
  label: string;
  emoji: string;
}

// The full catalogue (also used by admin award/revoke UI).
export const BADGE_CATALOG: Record<string, Badge> = {
  elite: { key: "elite", label: "LinkUpNaija Elite", emoji: "👑" },
  top_host: { key: "top_host", label: "Top Host", emoji: "🏆" },
  verified: { key: "verified", label: "Verified Host", emoji: "✅" },
  safety_champion: { key: "safety_champion", label: "Safety Champion", emoji: "🛡️" },
  quick_responder: { key: "quick_responder", label: "Quick Responder", emoji: "⚡" },
  new_host: { key: "new_host", label: "New Host", emoji: "🌟" },
};

// Display priority (highest-status first).
const ORDER = [
  "elite",
  "top_host",
  "verified",
  "safety_champion",
  "quick_responder",
  "new_host",
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

    keys.add("new_host");
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
