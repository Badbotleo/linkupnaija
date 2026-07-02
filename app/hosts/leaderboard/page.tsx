import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import HostBadges from "@/components/host/HostBadges";
import { computeBadges, hostScore } from "@/lib/hostBadges";
import { NIGERIAN_STATES } from "@/lib/constants";
import type { HostStats } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host leaderboard" };

// host_stats rows come back flat, with the joined user under `host`.
type Row = HostStats & {
  host: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    state: string | null;
    awarded_badges: string[];
    revoked_badges: string[];
    featured_host: boolean;
  } | null;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { state?: string; rating?: string };
}) {
  const supabase = createClient();
  const minRating = Number(searchParams.rating) || 0;

  const { data } = await supabase
    .from("host_stats")
    .select(
      "*, host:users!host_stats_host_id_fkey(id, name, avatar_url, state, awarded_badges, revoked_badges, featured_host)"
    )
    .order("average_rating", { ascending: false })
    .limit(300);

  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.host);

  // Top-10%-per-state → Top Host badge.
  const byState = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.host!.state ?? "—";
    (byState.get(k) ?? byState.set(k, []).get(k)!).push(r);
  }
  const topHostIds = new Set<string>();
  for (const group of Array.from(byState.values())) {
    group.sort((a, b) => hostScore(b) - hostScore(a));
    const cut = Math.max(1, Math.ceil(group.length * 0.1));
    group.slice(0, cut).forEach((r) => topHostIds.add(r.host!.id));
  }

  let list = rows
    .filter((r) => Number(r.average_rating) >= minRating)
    .filter((r) => !searchParams.state || r.host!.state === searchParams.state)
    .sort((a, b) => hostScore(b) - hostScore(a));

  const featured = rows.find((r) => r.host!.featured_host) ?? null;
  list = list.slice(0, searchParams.state ? 10 : 30);

  const card = (r: Row, rank?: number) => {
    const badges = computeBadges(r, {
      awarded: r.host!.awarded_badges,
      revoked: r.host!.revoked_badges,
      isTopHost: topHostIds.has(r.host!.id),
    });
    return (
      <Link
        key={r.host!.id}
        href={`/u/${r.host!.id}`}
        className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-brand/30"
      >
        {rank != null && (
          <span className="w-6 shrink-0 text-center text-lg font-extrabold text-gray-400">
            {rank}
          </span>
        )}
        <Avatar name={r.host!.name} url={r.host!.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">
            {r.host!.name ?? "Host"}
          </p>
          <p className="text-xs text-gray-500">
            ⭐ {Number(r.average_rating).toFixed(1)} · {r.total_events} events
            {r.host!.state ? ` · ${r.host!.state}` : ""}
          </p>
          {badges.length > 0 && (
            <div className="mt-1.5">
              <HostBadges badges={badges} max={3} />
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="container-page max-w-2xl py-8">
      <h1 className="text-3xl font-extrabold text-gray-900">🏆 Host leaderboard</h1>
      <p className="mt-1 text-gray-600">The most-loved hosts across Nigeria.</p>

      {/* Featured host of the week */}
      {featured && (
        <div className="mt-6 rounded-2xl border-2 border-[#FAC775] bg-amber-50/40 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-600">
            ✨ Featured host of the week
          </p>
          <div className="mt-2">{card(featured)}</div>
        </div>
      )}

      {/* Filters */}
      <form className="mt-6 flex flex-wrap gap-2" method="get">
        <select name="state" defaultValue={searchParams.state ?? ""} className="input cursor-pointer sm:max-w-[12rem]">
          <option value="">All states</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="rating" defaultValue={searchParams.rating ?? ""} className="input cursor-pointer sm:max-w-[10rem]">
          <option value="">Any rating</option>
          <option value="4">4.0+ ⭐</option>
          <option value="4.5">4.5+ ⭐</option>
        </select>
        <button type="submit" className="btn-primary px-5">Apply</button>
      </form>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          No hosts match these filters yet.
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {list.map((r, i) => card(r, i + 1))}
        </ol>
      )}
    </div>
  );
}
