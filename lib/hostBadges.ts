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

export function computeBadges(
  stats: HostStats | null | undefined,
  opts: {
    awarded?: string[];
    revoked?: string[];
    isTopHost?: boolean;
  } = {}
): Badge[] {
  const keys = new Set<string>();
  if (stats && stats.total_events > 0) {
    keys.add("new_host");
    if (stats.total_events >= 3 && stats.average_rating >= 4) keys.add("verified");
    if (
      stats.total_events >= 10 &&
      stats.average_rating >= 4.8 &&
      (stats.attendance_rate ?? 0) >= 90
    )
      keys.add("elite");
    if (
      stats.avg_response_time_hours != null &&
      stats.avg_response_time_hours <= 2
    )
      keys.add("quick_responder");
    if (stats.total_events >= 5 && stats.safety_score === 100)
      keys.add("safety_champion");
  }
  if (opts.isTopHost) keys.add("top_host");

  for (const k of opts.awarded ?? []) keys.add(k);
  for (const k of opts.revoked ?? []) keys.delete(k);

  return ORDER.filter((k) => keys.has(k)).map((k) => BADGE_CATALOG[k]);
}

/** A composite score for ranking hosts on the leaderboard (0–100-ish). */
export function hostScore(stats: HostStats): number {
  const rating = (stats.average_rating / 5) * 60; // up to 60
  const volume = Math.min(stats.total_events, 20) * 1.5; // up to 30
  const safety = ((stats.safety_score ?? 70) / 100) * 10; // up to 10
  return Math.round(rating + volume + safety);
}
