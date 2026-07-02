"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { BADGE_CATALOG } from "@/lib/hostBadges";

export interface AdminHostRow {
  host_id: string;
  name: string | null;
  average_rating: number;
  total_events: number;
  safety_score: number | null;
  featured_host: boolean;
  awarded_badges: string[];
  revoked_badges: string[];
}

const BADGE_KEYS = Object.keys(BADGE_CATALOG);

export default function AdminHosts({ initial }: { initial: AdminHostRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function feature(host_id: string) {
    setBusy(host_id);
    const { error } = await supabase.rpc("admin_feature_host", { p_host: host_id });
    if (error) toast.error(error.message);
    else {
      setRows((prev) => prev.map((r) => ({ ...r, featured_host: r.host_id === host_id })));
      toast.success("Featured host set ✨");
      router.refresh();
    }
    setBusy(null);
  }

  async function setBadges(row: AdminHostRow, awarded: string[], revoked: string[]) {
    setBusy(row.host_id);
    const { error } = await supabase.rpc("admin_set_badges", {
      p_host: row.host_id,
      p_awarded: awarded,
      p_revoked: revoked,
    });
    if (error) toast.error(error.message);
    else {
      setRows((prev) =>
        prev.map((r) =>
          r.host_id === row.host_id ? { ...r, awarded_badges: awarded, revoked_badges: revoked } : r
        )
      );
      toast.success("Badges updated");
    }
    setBusy(null);
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
        No hosts yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const lowSafety = r.safety_score != null && r.safety_score < 60;
        return (
          <li
            key={r.host_id}
            className={`rounded-xl border p-4 ${lowSafety ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/u/${r.host_id}`} className="font-bold text-gray-900 hover:text-brand">
                  {r.name ?? "Host"}
                </Link>
                <p className="text-xs text-gray-500">
                  ⭐ {r.average_rating.toFixed(1)} · {r.total_events} events ·{" "}
                  <span className={lowSafety ? "font-bold text-red-600" : ""}>
                    🛡️ {r.safety_score == null ? "—" : `${Math.round(r.safety_score)}%`}
                  </span>
                  {lowSafety && " ⚠ low safety"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === r.host_id}
                onClick={() => feature(r.host_id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  r.featured_host ? "bg-[#FAC775] text-[#1A1040]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {r.featured_host ? "★ Featured" : "Feature"}
              </button>
            </div>

            {/* Award / revoke badges */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {BADGE_KEYS.map((k) => {
                const awarded = r.awarded_badges.includes(k);
                const revoked = r.revoked_badges.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={busy === r.host_id}
                    onClick={() => {
                      // cycle: none → awarded → revoked → none
                      let a = r.awarded_badges.filter((x) => x !== k);
                      let v = r.revoked_badges.filter((x) => x !== k);
                      if (!awarded && !revoked) a = [...a, k];
                      else if (awarded) v = [...v, k];
                      setBadges(r, a, v);
                    }}
                    title={awarded ? "Awarded (tap to revoke)" : revoked ? "Revoked (tap to clear)" : "Tap to award"}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      awarded
                        ? "bg-brand text-white"
                        : revoked
                          ? "bg-red-100 text-red-600 line-through"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {BADGE_CATALOG[k].emoji} {BADGE_CATALOG[k].label}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
