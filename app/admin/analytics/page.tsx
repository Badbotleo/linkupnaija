import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

/**
 * The numbers that say whether this is working.
 *
 * Built from what the database already holds — no new tracking, no third
 * party. Deliberately opinionated about which numbers appear: a dashboard
 * that shows forty metrics is a dashboard nobody reads, and the ones here
 * were chosen because each has a decision attached to it.
 *
 * The funnel leads, because signups are not the problem and requests are.
 */

const DAY = 86_400_000;

function pct(a: number, b: number): string {
  if (!b) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

export default async function AdminAnalyticsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/analytics");

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) notFound();

  const today = new Date().toISOString().slice(0, 10);

  // Everything is small enough to aggregate in memory — 116 events and a few
  // thousand users. Doing it here rather than in SQL keeps the whole page
  // readable and avoids a migration for a view that would need changing every
  // time a question changes.
  const [
    usersRes,
    eventsRes,
    rsvpsRes,
    txRes,
    trafficRes,
    pagesRes,
    splitRes,
    sourcesRes,
    statesRes,
    dailyRes,
  ] = await Promise.all([
    supabase.from("users").select("id, created_at, state"),
    supabase
      .from("events")
      .select("id, created_at, state, category, host_id, date, price, event_type"),
    supabase.from("rsvps").select("id, status, attended, event_id, created_at"),
    supabase.from("transactions").select("amount, platform_fee"),
    // Site-wide visitors, the GA-style number. Returns nothing until
    // migration-site-visits.sql has been run, and nothing to non-admins.
    supabase.rpc("site_traffic", { p_days: 30 }),
    supabase.rpc("site_top_pages", { p_days: 30, p_limit: 8 }),
    supabase.rpc("site_visitor_split", { p_days: 30 }),
    supabase.rpc("site_sources", { p_days: 30, p_limit: 8 }),
    supabase.rpc("site_states", { p_days: 30, p_limit: 8 }),
    supabase.rpc("site_daily", { p_days: 14 }),
  ]);

  const users = usersRes.data ?? [];
  const events = (eventsRes.data ?? []).filter(
    (e) => e.event_type === "general"
  );
  const rsvps = rsvpsRes.data ?? [];
  const tx = txRes.data ?? [];

  // Null when the migration hasn't run — the section says so rather than
  // rendering a confident zero, which would read as "nobody came".
  const traffic =
    (Array.isArray(trafficRes.data) ? trafficRes.data[0] : trafficRes.data) as
      | { visitors: number; views: number; days: number }
      | undefined;
  const topPages = (pagesRes.data ?? []) as { path: string; visitors: number }[];
  const split =
    (Array.isArray(splitRes.data) ? splitRes.data[0] : splitRes.data) as
      | { new_visitors: number; returning_visitors: number }
      | undefined;
  const sources = (sourcesRes.data ?? []) as { source: string; visitors: number }[];
  const visitorStates = (statesRes.data ?? []) as { state: string; visitors: number }[];
  const daily = (dailyRes.data ?? []) as { day: string; visitors: number }[];

  const now = Date.now();
  const since = (days: number) => now - days * DAY;
  const inWindow = (iso: string | null, from: number, to = now) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };

  // --- growth ---------------------------------------------------------------
  const newUsers7 = users.filter((u) => inWindow(u.created_at, since(7))).length;
  const newUsersPrev7 = users.filter((u) =>
    inWindow(u.created_at, since(14), since(7))
  ).length;
  const newEvents7 = events.filter((e) => inWindow(e.created_at, since(7))).length;
  const newEventsPrev7 = events.filter((e) =>
    inWindow(e.created_at, since(14), since(7))
  ).length;

  // --- the funnel -----------------------------------------------------------
  const accepted = rsvps.filter((r) => r.status === "accepted");
  const attended = rsvps.filter((r) => r.attended === true);
  const hostIds = new Set(events.map((e) => e.host_id));

  const funnel = [
    { label: "Signed up", n: users.length, hint: "Accounts created" },
    { label: "Hosted an event", n: hostIds.size, hint: "Unique hosts" },
    { label: "Asked to join", n: rsvps.length, hint: "Requests sent, all time" },
    { label: "Approved", n: accepted.length, hint: "Host said yes" },
    { label: "Turned up", n: attended.length, hint: "Scanned at the door" },
  ];

  // --- rooms ----------------------------------------------------------------
  const perEvent = new Map<string, number>();
  accepted.forEach((r) =>
    perEvent.set(r.event_id, (perEvent.get(r.event_id) ?? 0) + 1)
  );
  // Array.from, not spread: tsconfig targets ES5, where spreading a Map
  // iterator does not compile.
  const sizes = Array.from(perEvent.values()).sort((a, b) => a - b);
  const medianRoom = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const upcoming = events.filter((e) => e.date >= today);
  const emptyUpcoming = upcoming.filter((e) => !perEvent.has(e.id)).length;

  // --- supply vs demand -----------------------------------------------------
  const usersByState = new Map<string, number>();
  users.forEach((u) => {
    if (u.state) usersByState.set(u.state, (usersByState.get(u.state) ?? 0) + 1);
  });
  const eventsByState = new Map<string, number>();
  upcoming.forEach((e) => {
    const k = e.state ?? "unset";
    eventsByState.set(k, (eventsByState.get(k) ?? 0) + 1);
  });
  const states = Array.from(
    new Set(
      Array.from(usersByState.keys()).concat(Array.from(eventsByState.keys()))
    )
  )
    .map((s) => ({
      state: s,
      users: usersByState.get(s) ?? 0,
      events: eventsByState.get(s) ?? 0,
    }))
    .sort((a, b) => b.users - a.users || b.events - a.events)
    .slice(0, 8);

  // --- categories -----------------------------------------------------------
  const byCategory = new Map<string, number>();
  upcoming.forEach((e) =>
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1)
  );
  const categories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // --- hosts ----------------------------------------------------------------
  const perHost = new Map<string, number>();
  events.forEach((e) =>
    perHost.set(e.host_id, (perHost.get(e.host_id) ?? 0) + 1)
  );
  const hostCounts = Array.from(perHost.values()).sort((a, b) => b - a);
  const topHostShare = hostCounts.length
    ? Math.round(
        (hostCounts.slice(0, 3).reduce((a, b) => a + b, 0) / events.length) * 100
      )
    : 0;

  // --- money ----------------------------------------------------------------
  const gross = tx.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const fees = tx.reduce((sum, t) => sum + (t.platform_fee ?? 0), 0);

  const topFunnel = Math.max(funnel[0].n, 1);

  return (
    <div className="pb-12">
      <AppHeader title="Analytics" back />
      <div className="container-page max-w-4xl pt-5">
        {/* --- headline numbers --- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Visitors · 30d"
            value={traffic ? traffic.visitors.toLocaleString("en-NG") : "—"}
            sub={
              traffic
                ? `${traffic.views.toLocaleString("en-NG")} page views`
                : "run migration-site-visits.sql"
            }
          />
          <Stat
            label="Members"
            value={users.length.toLocaleString("en-NG")}
            delta={newUsers7}
            prev={newUsersPrev7}
            sub="new in 7 days"
          />
          <Stat
            label="Events"
            value={events.length.toLocaleString("en-NG")}
            delta={newEvents7}
            prev={newEventsPrev7}
            sub="new in 7 days"
          />
          <Stat
            label="Upcoming"
            value={upcoming.length.toLocaleString("en-NG")}
            sub={`${emptyUpcoming} with nobody going`}
            warn={emptyUpcoming > upcoming.length / 2}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Ticket sales"
            value={formatNaira(gross)}
            sub={`${formatNaira(fees)} platform fees`}
          />
          <Stat
            label="Visitor → member"
            value={
              traffic && traffic.visitors
                ? pct(newUsers7, traffic.visitors)
                : "—"
            }
            sub="signups vs 30d visitors"
          />
        </div>

        {/* --- audience --- */}
        <Section
          title="Who's coming back"
          hint="New means we'd never seen that browser before this window."
        >
          {!split || split.new_visitors + split.returning_visitors === 0 ? (
            <p className="text-[13px] text-gray-500">
              Not enough traffic recorded yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Mini label="New" value={String(split.new_visitors)} />
                <Mini
                  label="Returning"
                  value={String(split.returning_visitors)}
                />
                <Mini
                  label="Return rate"
                  value={pct(
                    split.returning_visitors,
                    split.new_visitors + split.returning_visitors
                  )}
                  warn={
                    split.new_visitors + split.returning_visitors > 50 &&
                    split.returning_visitors /
                      (split.new_visitors + split.returning_visitors) <
                      0.1
                  }
                />
              </div>
              {daily.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Visitors per day · last {daily.length}
                  </p>
                  {/* Bars rather than a chart library. Fourteen numbers do not
                      need a dependency, and a sparkline you can't read on a
                      phone is decoration. */}
                  <div className="flex h-20 items-end gap-1">
                    {daily.map((d) => {
                      const peak = Math.max(...daily.map((x) => x.visitors), 1);
                      return (
                        <div
                          key={d.day}
                          title={`${d.day}: ${d.visitors}`}
                          className="flex-1 rounded-t bg-brand/70"
                          style={{
                            height: `${Math.max(4, (d.visitors / peak) * 100)}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                    <span>{daily[0]?.day.slice(5)}</span>
                    <span>{daily[daily.length - 1]?.day.slice(5)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        {/* --- where they come from --- */}
        <Section
          title="Where visitors come from"
          hint="Referring site, last 30 days. Only the host is stored — never a full URL."
        >
          {sources.length === 0 ? (
            <p className="text-[13px] text-gray-500">
              Nothing recorded yet. Sources start counting after this deploy.
            </p>
          ) : (
            <div className="space-y-2">
              {sources.map((sc) => (
                <div key={sc.source} className="flex items-center gap-3">
                  <p className="w-32 shrink-0 truncate text-[13px] font-semibold text-gray-700">
                    {sc.source}
                  </p>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand/60"
                      style={{
                        width: `${(sc.visitors / (sources[0].visitors || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-600">
                    {sc.visitors}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* --- where they are --- */}
        <Section
          title="Where visitors are"
          hint="From the same edge signal the feed uses — not the browser location prompt."
        >
          {visitorStates.length === 0 ? (
            <p className="text-[13px] text-gray-500">Nothing recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visitorStates.map((v) => (
                <span
                  key={v.state}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-700"
                >
                  {v.state}
                  <span className="ml-1.5 tabular-nums text-gray-400">
                    {v.visitors}
                  </span>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* --- top pages --- */}
        <Section
          title="Where visitors land"
          hint="Unique browsers per page, last 30 days. Your own admin visits aren't counted."
        >
          {topPages.length === 0 ? (
            <p className="text-[13px] text-gray-500">
              No traffic recorded yet.{" "}
              {traffic
                ? "Visits start counting from the first page load after deploy."
                : "Run migration-site-visits.sql to switch this on."}
            </p>
          ) : (
            <div className="space-y-2">
              {topPages.map((p2) => (
                <div key={p2.path} className="flex items-center gap-3">
                  <p className="w-40 shrink-0 truncate text-[13px] font-semibold text-gray-700">
                    {p2.path}
                  </p>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand/60"
                      style={{
                        width: `${(p2.visitors / (topPages[0].visitors || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-600">
                    {p2.visitors}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* --- the funnel --- */}
        <Section
          title="Where people stop"
          hint="Every stage as a share of signups. This is the one that matters."
        >
          <div className="space-y-3">
            {funnel.map((f, idx) => (
              <div key={f.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-semibold text-gray-900">
                    {f.label}
                  </p>
                  <p className="shrink-0 text-[15px] font-extrabold tabular-nums text-gray-900">
                    {f.n.toLocaleString("en-NG")}
                    <span className="ml-2 text-[12px] font-semibold text-gray-400">
                      {pct(f.n, topFunnel)}
                    </span>
                  </p>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.max(f.n > 0 ? 2 : 0, (f.n / topFunnel) * 100)}%`,
                      opacity: 1 - idx * 0.14,
                    }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{f.hint}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- rooms --- */}
        <Section
          title="How full a room gets"
          hint="An event nobody joins is the failure mode this platform has."
        >
          <div className="grid grid-cols-3 gap-3">
            <Mini label="Median room" value={String(medianRoom)} />
            <Mini
              label="Biggest room"
              value={String(sizes.length ? sizes[sizes.length - 1] : 0)}
            />
            <Mini
              label="Rooms of 5+"
              value={String(sizes.filter((s) => s >= 5).length)}
            />
          </div>
        </Section>

        {/* --- supply vs demand --- */}
        <Section
          title="Where people are vs where events are"
          hint="A state with members and no events is a state losing them."
        >
          <div className="space-y-2">
            {states.map((s) => (
              <div key={s.state} className="flex items-center gap-3">
                <p className="w-28 shrink-0 truncate text-[13px] font-semibold text-gray-700">
                  {s.state}
                </p>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand/60"
                      style={{ width: `${(s.users / (states[0].users || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-gray-500">
                    {s.users}
                  </span>
                </div>
                <div className="flex w-24 shrink-0 items-center gap-1.5">
                  <span
                    className={`text-[12px] font-bold tabular-nums ${
                      s.events === 0 && s.users > 5
                        ? "text-[#FF6B5E]"
                        : "text-gray-600"
                    }`}
                  >
                    {s.events}
                  </span>
                  <span className="text-[11px] text-gray-400">events</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* --- categories --- */}
        <Section
          title="What hosts are putting on"
          hint="Upcoming events by category."
        >
          <div className="flex flex-wrap gap-2">
            {categories.map(([c, n]) => (
              <span
                key={c}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-700"
              >
                {c}
                <span className="ml-1.5 tabular-nums text-gray-400">{n}</span>
              </span>
            ))}
          </div>
        </Section>

        {/* --- concentration --- */}
        <Section
          title="Host concentration"
          hint="If a handful of hosts carry everything, losing one is an outage."
        >
          <div className="grid grid-cols-3 gap-3">
            <Mini label="Hosts" value={String(hostIds.size)} />
            <Mini label="Top 3 make" value={`${topHostShare}%`} warn={topHostShare > 60} />
            <Mini
              label="Hosted once"
              value={String(hostCounts.filter((n) => n === 1).length)}
            />
          </div>
        </Section>

        <p className="mt-8 text-[12px] leading-snug text-gray-400">
          Everything here is computed live from the database on each load. No
          third-party analytics, no tracking added — these are the same rows
          the app already writes.
        </p>

        <Link href="/admin" className="btn-outline mt-6 inline-flex">
          Back to admin
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-gray-900">
        {title}
      </h2>
      <p className="mt-0.5 text-[13px] text-gray-500">{hint}</p>
      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {children}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  delta,
  prev,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  prev?: number;
  warn?: boolean;
}) {
  // Week on week, and only when there's a previous week to compare with —
  // "+100%" off a base of one is noise dressed as a trend.
  const trend =
    delta !== undefined && prev !== undefined && prev > 0
      ? Math.round(((delta - prev) / prev) * 100)
      : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-[24px] font-extrabold leading-none tabular-nums text-gray-900">
        {value}
      </p>
      {delta !== undefined && (
        <p className="mt-1.5 flex items-center gap-1 text-[12px]">
          <span className="font-bold tabular-nums text-gray-700">+{delta}</span>
          {trend !== null && (
            <span
              className={`font-bold ${
                trend >= 0 ? "text-naija-700" : "text-[#FF6B5E]"
              }`}
            >
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
            </span>
          )}
        </p>
      )}
      {sub && (
        <p
          className={`mt-0.5 text-[11px] leading-snug ${
            warn ? "font-semibold text-[#FF6B5E]" : "text-gray-400"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <p
        className={`text-[20px] font-extrabold tabular-nums ${
          warn ? "text-[#FF6B5E]" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-gray-500">{label}</p>
    </div>
  );
}
