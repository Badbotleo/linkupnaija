import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import {
  MILESTONES,
  METRICS,
  currentMilestone,
  previousMilestone,
  verdict,
  type Milestone,
  type Verdict,
} from "@/lib/growth-plan";

export const dynamic = "force-dynamic";

/**
 * The 3-year plan, marked.
 *
 * The plan is a fourteen page PDF of checkboxes, and nothing in it was ever
 * checked against the database. This page does the one thing that makes a
 * target a target: it says, out loud, whether you hit it.
 *
 * ONLY THE MILESTONE YOU CAN STILL AFFECT. It shows the next one due and, if
 * one has already passed, what actually happened on that date. A wall of six
 * milestones is a wall nobody reads, and the Year 3 column is not a thing you
 * can act on this week.
 *
 * EVERY NUMBER IS MEASURED HERE, not typed in, except Instagram followers,
 * which the database has no way of knowing. That one is shown with its target
 * and no verdict rather than being quietly dropped, because a metric that
 * disappears when it is inconvenient is worse than one you have to check by
 * hand.
 *
 * The trailing window is 30 days everywhere. The plan says "monthly" without
 * defining it, and calendar months would make the first of the month look
 * like a collapse every time.
 */

const DAY = 86_400_000;

function naira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n.toLocaleString()}`;
}

function fmt(n: number, isNaira?: boolean): string {
  return isNaira ? naira(n) : n.toLocaleString();
}

const VERDICT_STYLE: Record<Verdict, { chip: string; bar: string; word: string }> = {
  hit: {
    chip: "bg-naija-50 text-naija-600",
    bar: "bg-naija-500",
    word: "Hit",
  },
  close: {
    chip: "bg-amber-50 text-amber-700",
    bar: "bg-amber-400",
    word: "Close",
  },
  behind: {
    chip: "bg-red-50 text-red-600",
    bar: "bg-red-400",
    word: "Behind",
  },
};

export default async function AdminGrowthPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/growth");

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) notFound();

  const since = new Date(Date.now() - 30 * DAY).toISOString();

  const [usersRes, eventsRes, rsvpsRes, txRes, premiumRes] = await Promise.all([
    supabase.from("users").select("id, is_pro, pro_expires_at"),
    supabase.from("events").select("id, created_at, host_id, state, is_listing"),
    supabase.from("rsvps").select("user_id, created_at"),
    supabase.from("transactions").select("amount, created_at"),
    supabase.from("premium_payments").select("amount, created_at"),
  ]);

  const users = (usersRes.data ?? []) as { is_pro: boolean | null; pro_expires_at: string | null }[];
  const events = (eventsRes.data ?? []) as {
    created_at: string;
    host_id: string;
    state: string | null;
    is_listing: boolean | null;
  }[];
  const rsvps = (rsvpsRes.data ?? []) as { user_id: string; created_at: string }[];
  const tx = (txRes.data ?? []) as { amount: number | null; created_at: string }[];
  const premium = (premiumRes.data ?? []) as { amount: number | null; created_at: string }[];

  const nowIso = new Date().toISOString();

  // Hosted only. 181 of the events on this platform are admin listings, and
  // counting them as supply is how the one target that looks met gets met.
  const hosted = events.filter((e) => !e.is_listing);
  const hostedRecent = hosted.filter((e) => e.created_at >= since);

  const actual: Record<string, number> = {
    mau: new Set(rsvps.filter((r) => r.created_at >= since).map((r) => r.user_id)).size,
    revenue:
      tx.filter((t) => t.created_at >= since).reduce((a, t) => a + (t.amount ?? 0), 0) +
      premium.filter((p) => p.created_at >= since).reduce((a, p) => a + (p.amount ?? 0), 0),
    eventsPerMonth: hostedRecent.length,
    activeHosts: new Set(hostedRecent.map((e) => e.host_id)).size,
    proSubscribers: users.filter(
      (u) => u.is_pro && (!u.pro_expires_at || u.pro_expires_at > nowIso)
    ).length,
    cities: new Set(events.map((e) => e.state).filter(Boolean)).size,
    instagramFollowers: 0,
  };

  // How concentrated the supply is. Not a plan target, because the plan never
  // considered it, and it is the number that decides whether any of the
  // others are reachable.
  const perHost = new Map<string, number>();
  for (const e of hostedRecent) perHost.set(e.host_id, (perHost.get(e.host_id) ?? 0) + 1);
  const ranked = Array.from(perHost.values()).sort((a, b) => b - a);
  const top3 = ranked.slice(0, 3).reduce((a, b) => a + b, 0);
  const concentration = hostedRecent.length ? Math.round((top3 / hostedRecent.length) * 100) : 0;

  const target = currentMilestone();
  const passed = previousMilestone();
  const daysLeft = Math.ceil(
    (new Date(`${target.due}T23:59:59`).getTime() - Date.now()) / DAY
  );

  const measurable = METRICS.filter((m) => m.measurable);
  const hits = measurable.filter(
    (m) => verdict(actual[m.key], target[m.key] as number) === "hit"
  ).length;

  return (
    <div className="pb-24">
      <AppHeader title="Growth plan" back />

      <div className="mx-auto max-w-3xl px-4">
        {/* ------------------------------------------------ where we stand -- */}
        <div className="mt-4 rounded-3xl bg-gray-900 p-6 text-white">
          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-white/50">
            Next milestone
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[32px] font-extrabold leading-none">{target.label}</h2>
            <p className="text-[15px] font-semibold text-white/70">
              due {new Date(`${target.due}T12:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="mt-3 text-[15px] leading-snug text-white/75">
            {hits} of {measurable.length} measurable targets met.{" "}
            {daysLeft > 0
              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left.`
              : "The date has passed."}
          </p>
        </div>

        {/* ------------------------------------------------- the scorecard -- */}
        <h2 className="mb-3 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
          Against {target.label}
        </h2>

        <div className="space-y-3">
          {METRICS.map((m) => {
            const t = target[m.key] as number;
            const a = actual[m.key];
            const v = verdict(a, t);
            const style = VERDICT_STYLE[v];
            const ratio = t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 100;

            return (
              <div
                key={m.key}
                className="rounded-2xl border border-gray-200 p-4 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                      {m.name}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-gray-500">
                      {m.note}
                    </p>
                  </div>
                  {m.measurable ? (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${style.chip}`}
                    >
                      {style.word}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-500">
                      By hand
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[26px] font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {m.measurable ? fmt(a, m.naira) : "—"}
                  </span>
                  <span className="text-[15px] font-semibold text-gray-400">
                    of {fmt(t, m.naira)}
                  </span>
                  {m.measurable && t > 0 && (
                    <span className="ml-auto text-[15px] font-bold tabular-nums text-gray-500">
                      {Math.round((a / t) * 100)}%
                    </span>
                  )}
                </div>

                {m.measurable && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${style.bar}`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ------------------------------------------- the one they missed -- */}
        <h2 className="mb-2 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
          Not in the plan
        </h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-amber-600">
              <LineIcon name="activity" size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-gray-900">
                Top 3 hosts made {concentration}% of the last 30 days of events
              </p>
              <p className="mt-1 text-[13px] leading-snug text-gray-700">
                The plan counts events and hosts separately and never asks how
                many people the events come from. Every target above depends on
                this number falling: if three people stop, the supply stops with
                them, and no amount of demand fixes it.
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- what passed -- */}
        {passed && (
          <>
            <h2 className="mb-2 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
              {passed.label} has been and gone
            </h2>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
              <p className="text-[13px] leading-snug text-gray-500">
                Due {new Date(`${passed.due}T12:00:00`).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}. Measured now, not then, so this is where you ended up
                rather than where you were on the day.
              </p>
              <div className="mt-3 space-y-1.5">
                {measurable.map((m) => {
                  const t = passed[m.key] as number;
                  const a = actual[m.key];
                  const v = verdict(a, t);
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="truncate text-gray-600 dark:text-white/70">{m.name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">
                        {fmt(a, m.naira)}{" "}
                        <span className="font-semibold text-gray-400">
                          / {fmt(t, m.naira)}
                        </span>{" "}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${VERDICT_STYLE[v].chip}`}>
                          {VERDICT_STYLE[v].word}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ------------------------------------------------- the whole arc -- */}
        <h2 className="mb-2 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
          Every milestone
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-white/10">
                <th className="px-3 py-2.5 font-bold text-gray-500">Metric</th>
                {MILESTONES.map((m) => (
                  <th
                    key={m.label}
                    className={`px-3 py-2.5 text-right font-bold ${m.label === target.label ? "text-brand" : "text-gray-500"}`}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((row) => (
                <tr key={row.key} className="border-b border-gray-100 last:border-0 dark:border-white/5">
                  <td className="px-3 py-2.5 font-semibold text-gray-700 dark:text-white/80">
                    {row.name}
                  </td>
                  {MILESTONES.map((m) => (
                    <td
                      key={m.label}
                      className={`px-3 py-2.5 text-right tabular-nums ${m.label === target.label ? "font-bold text-gray-900 dark:text-white" : "text-gray-500"}`}
                    >
                      {fmt(m[row.key] as number, row.naira)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[13px] leading-snug text-gray-500">
          Targets live in{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10">
            lib/growth-plan.ts
          </code>
          . Changing one is a commit, so a moved goalpost leaves a trace.
        </p>

        <Link
          href="/admin/analytics"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 text-[14px] font-bold text-gray-700 transition hover:bg-gray-200"
        >
          <LineIcon name="trending" size={16} />
          Full analytics
        </Link>
      </div>
    </div>
  );
}
