import HostBadges from "./HostBadges";
import LineIcon from "@/components/ui/LineIcon";
import type { Badge } from "@/lib/hostBadges";
import type { HostStats } from "@/lib/types";

export default function HostScorecard({
  stats,
  badges = [],
}: {
  stats: HostStats;
  badges?: Badge[];
}) {
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
  // Our own glyphs, not the keyboard's.
  //
  // These six were typed emoji, so the scorecard rendered in whatever
  // Apple, Google or Samsung draws, at a different weight and colour on
  // every device, next to a product drawn in one line style. The sweep
  // took emoji off every other heading and missed this card.
  const rows = [
    { icon: "star", label: "Rating", value: `${Number(stats.average_rating).toFixed(1)}/5 (${stats.review_count} review${Number(stats.review_count) === 1 ? "" : "s"})` },
    { icon: "calendar", label: "Events hosted", value: String(stats.total_events) },
    { icon: "users", label: "Total attendees", value: String(stats.total_attendees) },
    { icon: "check", label: "Attendance rate", value: pct(stats.attendance_rate) },
    {
      icon: "zap",
      label: "Response time",
      value:
        stats.avg_response_time_hours == null
          ? "—"
          : `Usually within ${Math.max(1, Math.round(stats.avg_response_time_hours))}h`,
    },
    { icon: "shield", label: "Felt safe", value: pct(stats.safety_score) },
  ];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">Host scorecard</h2>
      </div>
      {badges.length > 0 && (
        <div className="mt-3">
          <HostBadges badges={badges} />
        </div>
      )}
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-gray-50 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <LineIcon name={r.icon} size={13} className="shrink-0" />
              {r.label}
            </dt>
            <dd className="mt-0.5 font-bold tabular-nums text-gray-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
