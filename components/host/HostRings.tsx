"use client";

import { useEffect, useState } from "react";
import HostBadges from "./HostBadges";
import type { Badge } from "@/lib/hostBadges";
import type { HostStats } from "@/lib/types";

const R = 30;
const CIRC = 2 * Math.PI * R;

function Ring({
  pct,
  color,
  label,
  value,
  delay,
}: {
  pct: number | null;
  color: string;
  label: string;
  value: string;
  delay: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(pct ?? 0), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  const offset = CIRC * (1 - shown / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={R} fill="none" stroke="#EEECFB" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke={pct == null ? "#D1D5DB" : color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={pct == null ? CIRC : offset}
          transform="rotate(-90 38 38)"
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
        <text x="38" y="42" textAnchor="middle" className="fill-gray-900" fontSize="15" fontWeight="700">
          {value}
        </text>
      </svg>
      <span className="mt-1 text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

export default function HostRings({
  stats,
  badges = [],
  percentile,
}: {
  stats: HostStats;
  badges?: Badge[];
  percentile?: number | null;
}) {
  // Postgres numeric columns arrive as strings — coerce.
  const rating = Number(stats.average_rating) || 0;
  const attendance = stats.attendance_rate == null ? null : Number(stats.attendance_rate);
  const safety = stats.safety_score == null ? null : Number(stats.safety_score);
  const response = stats.avg_response_time_hours == null ? null : Number(stats.avg_response_time_hours);

  const responsePct =
    response == null
      ? null
      : Math.max(0, Math.min(100, Math.round(100 - (response - 1) * 20)));

  const rings = [
    { label: "Rating", pct: (rating / 5) * 100, value: rating.toFixed(1), color: "#534AB7" },
    { label: "Attendance", pct: attendance, value: attendance == null ? "—" : `${Math.round(attendance)}%`, color: "#1D9E75" },
    { label: "Felt safe", pct: safety, value: safety == null ? "—" : `${Math.round(safety)}%`, color: "#D85A30" },
    { label: "Responds", pct: responsePct, value: response == null ? "—" : `${Math.max(1, Math.round(response))}h`, color: "#FAC775" },
  ];

  const tips: string[] = [];
  if (stats.average_rating < 4.5)
    tips.push("Ask happy guests to leave a review to lift your rating.");
  if (stats.attendance_rate == null)
    tips.push("Mark who showed up in Manage Requests to unlock your attendance rate.");
  else if (stats.attendance_rate < 80)
    tips.push("Send reminders before events to boost attendance.");
  if (stats.avg_response_time_hours != null && stats.avg_response_time_hours > 2)
    tips.push("Approve requests faster to earn the ⚡ Quick Responder badge.");
  if (stats.safety_score != null && stats.safety_score < 90)
    tips.push("Prioritise safety so more guests feel comfortable.");

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">🏅 Your host scorecard</h2>
      </div>
      {badges.length > 0 && (
        <div className="mt-3">
          <HostBadges badges={badges} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {rings.map((r, i) => (
          <Ring key={r.label} {...r} delay={100 + i * 120} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-lg font-extrabold text-gray-900">{stats.total_events}</p>
          <p className="text-xs text-gray-500">Events hosted</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-lg font-extrabold text-gray-900">{stats.total_attendees}</p>
          <p className="text-xs text-gray-500">Total attendees</p>
        </div>
      </div>

      {percentile != null && percentile <= 50 && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-2.5 text-center text-sm font-semibold text-brand">
          🎉 You&apos;re in the top {percentile}% of hosts in your state
        </p>
      )}

      {tips.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            How to improve your score
          </p>
          <ul className="mt-2 space-y-1.5">
            {tips.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-brand" aria-hidden>→</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
