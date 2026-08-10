"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { detectLeaks, LEAK_LABELS, type Leak } from "@/lib/external-links";
import { formatEventDate } from "@/lib/format";

/**
 * Listings that route people off the platform to sign up.
 *
 * "Register: waterlightsave.africa/…", "WhatsApp HIKE to 070…", "exact venue
 * shared after payment". Someone reads the listing, leaves, and never makes an
 * account, never joins the group chat, and has no reason to come back.
 *
 * This panel REPORTS ONLY. There is no delete, no hide and no downrank here,
 * deliberately — the point is to see the size and shape of the problem before
 * anyone decides what the policy should be. Every row links to the event so a
 * decision can be made one at a time.
 */

interface Row {
  id: string;
  title: string;
  description: string | null;
  date: string;
  state: string | null;
  category: string;
  price: number | null;
}

type Scope = "upcoming" | "all";

export default function AdminOffPlatform() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let query = supabase
      .from("events")
      .select("id, title, description, date, state, category, price")
      .order("date", { ascending: true });
    if (scope === "upcoming")
      query = query.gte("date", new Date().toISOString().slice(0, 10));

    const { data, error: e } = await query;
    // Surfaced rather than rendered as "0 flagged" — an empty panel that
    // actually means "the query failed" is how you conclude a problem went
    // away when it didn't.
    if (e) {
      setError(e.message);
      setRows([]);
      return;
    }
    const all = (data ?? []) as Row[];
    setTotal(all.length);
    setRows(all.filter((r) => detectLeaks(r.description).length > 0));
  }, [supabase, scope]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load events: {error}
      </div>
    );
  }

  if (!rows) return <p className="text-sm text-gray-500">Checking listings…</p>;

  const byKind: Record<string, number> = {};
  for (const r of rows)
    for (const l of detectLeaks(r.description))
      byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
  const kindCounts = Object.entries(byKind).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            <span className="text-2xl font-extrabold text-gray-900">
              {rows.length}
            </span>{" "}
            of {total} {scope === "upcoming" ? "upcoming" : "total"} listings
            send people elsewhere to sign up
            {total > 0 && (
              <span className="font-semibold">
                {" "}
                ({Math.round((rows.length / total) * 100)}%)
              </span>
            )}
            .
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Detection only — nothing here is hidden or removed.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full bg-gray-100 p-1">
          {(["upcoming", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
                scope === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {kindCounts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {kindCounts.map(([kind, n]) => (
            <span
              key={kind}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
            >
              {n} · {LEAK_LABELS[kind as Leak["kind"]]}
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No listings currently route people off the platform.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-gray-200 p-4 transition hover:border-brand/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={`/events/${r.id}`}
                  target="_blank"
                  className="font-bold text-gray-900 hover:text-brand"
                >
                  {r.title}
                </Link>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatEventDate(r.date)}
                  {r.state ? ` · ${r.state}` : ""}
                  {r.price ? ` · ₦${r.price.toLocaleString()}` : " · free"}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {detectLeaks(r.description).map((l) => (
                  <li key={l.kind} className="text-xs text-gray-600">
                    <span className="font-bold text-amber-700">
                      {LEAK_LABELS[l.kind]}
                    </span>
                    {" — "}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
                      {l.evidence}
                    </code>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
