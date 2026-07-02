import HostBadges from "./HostBadges";
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
  const rows = [
    { icon: "⭐", label: "Rating", value: `${stats.average_rating.toFixed(1)}/5 (${stats.review_count} review${stats.review_count === 1 ? "" : "s"})` },
    { icon: "📅", label: "Events hosted", value: String(stats.total_events) },
    { icon: "👥", label: "Total attendees", value: String(stats.total_attendees) },
    { icon: "✅", label: "Attendance rate", value: pct(stats.attendance_rate) },
    {
      icon: "⚡",
      label: "Response time",
      value:
        stats.avg_response_time_hours == null
          ? "—"
          : `Usually within ${Math.max(1, Math.round(stats.avg_response_time_hours))}h`,
    },
    { icon: "🛡️", label: "Felt safe", value: pct(stats.safety_score) },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">🏅 Host scorecard</h2>
      </div>
      {badges.length > 0 && (
        <div className="mt-3">
          <HostBadges badges={badges} />
        </div>
      )}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-gray-50 px-4 py-3">
            <dt className="text-xs font-medium text-gray-500">
              {r.icon} {r.label}
            </dt>
            <dd className="mt-0.5 font-bold text-gray-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
