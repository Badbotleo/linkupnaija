import LineIcon from "../ui/LineIcon";
import type { Badge } from "@/lib/hostBadges";

/**
 * Host reputation badges.
 *
 * Line icons rather than emoji. On the leaderboard these stack under every
 * name, and a column of 👑🏆✅🛡️⚡ was the one place the app read as a
 * spreadsheet — emoji render differently on every OS, ignore the brand colour
 * and sit at a different optical weight to the line icons used everywhere
 * else. These inherit currentColor, so they take the pill's tone.
 */

const TONE: Record<Badge["tone"], string> = {
  gold: "bg-amber-50 text-amber-700",
  brand: "bg-brand-50 text-brand",
};

export default function HostBadges({
  badges,
  compact = false,
  max,
}: {
  badges: Badge[];
  /** Icon-only pills (for tight spots like event cards). */
  compact?: boolean;
  max?: number;
}) {
  const shown = max ? badges.slice(0, max) : badges;
  if (shown.length === 0) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        {shown.map((b) => (
          <span
            key={b.key}
            title={b.label}
            aria-label={b.label}
            role="img"
            className={`grid h-5 w-5 place-items-center rounded-full ${TONE[b.tone]}`}
          >
            <LineIcon name={b.icon} size={12} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((b) => (
        <span
          key={b.key}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${TONE[b.tone]}`}
        >
          <LineIcon name={b.icon} size={13} className="shrink-0" />
          {b.label}
        </span>
      ))}
    </div>
  );
}
