import type { Badge } from "@/lib/hostBadges";

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
      <span className="inline-flex items-center gap-0.5">
        {shown.map((b) => (
          <span key={b.key} title={b.label} aria-label={b.label}>
            {b.emoji}
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
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand"
        >
          <span aria-hidden>{b.emoji}</span>
          {b.label}
        </span>
      ))}
    </div>
  );
}
