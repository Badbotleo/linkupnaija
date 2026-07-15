import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getCurrentUserMeta } from "@/lib/supabase/auth";
import CategoryBadge from "@/components/CategoryBadge";
import AdminReservations from "@/components/admin/AdminReservations";
import AdminExpiredEvents from "@/components/admin/AdminExpiredEvents";
import AdminMessages from "@/components/admin/AdminMessages";
import AdminPayouts from "@/components/admin/AdminPayouts";
import AdminWalletCredit from "@/components/admin/AdminWalletCredit";
import AdminTournament from "@/components/admin/AdminTournament";
import AdminOpportunities from "@/components/admin/AdminOpportunities";
import AdminCorporate from "@/components/admin/AdminCorporate";
import AdminHosts, { type AdminHostRow } from "@/components/admin/AdminHosts";
import AdminModeration, {
  type ModUserRow,
  type ModEventRow,
  type ModSeriesRow,
  type ModReportRow,
} from "@/components/admin/AdminModeration";
import { hostScore } from "@/lib/hostBadges";
import { formatNaira } from "@/lib/paystack";
import { formatEventDate } from "@/lib/format";
import type {
  Transaction,
  ReservationWithUser,
  TournamentRegistration,
  Opportunity,
  CorporateAccount,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  state: string | null;
  created_at: string;
}
interface RecentEvent {
  id: string;
  title: string;
  category: string;
  state: string;
  price: number;
  created_at: string;
}

export default async function AdminPage() {
  // Auth is validated once per request and shared with the Navbar via cache().
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/admin");

  const me = await getCurrentUserMeta();
  if (!me?.is_admin) notFound(); // hide the page from non-admins

  const supabase = createClient();
  const [
    { count: userCount },
    { count: eventCount },
    { data: txns },
    { data: recentUsers },
    { data: recentEvents },
    { data: reservationRows },
    { data: expiredRows },
    { data: allUsers },
    { data: payoutRows },
    { data: tournamentRows },
    { data: opportunityRows },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("amount, platform_fee"),
    supabase
      .from("users")
      .select("id, name, email, state, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("events")
      .select("id, title, category, state, price, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("reservations")
      .select("*, users(name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, title, category, state, date")
      .lt("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("users")
      .select("id, name, email")
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("payouts")
      .select(
        "id, amount, platform_fee, status, users:users!payouts_host_id_fkey(name, payout_bank, payout_account_number), events:events!payouts_event_id_fkey(title)"
      )
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false }),
    supabase
      .from("tournament_registrations")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const tournamentRegs = (tournamentRows ?? []) as TournamentRegistration[];
  const opportunities = (opportunityRows ?? []) as unknown as Opportunity[];

  const messageUsers = (allUsers ?? []) as {
    id: string;
    name: string | null;
    email: string;
  }[];

  // Safety flags: hosts with 2+ "did not feel safe" reviews.
  const { data: unsafeRows } = await supabase
    .from("reviews")
    .select("host_id, host:users!reviews_host_id_fkey(name)")
    .eq("felt_safe", "no");
  const safetyCounts = new Map<string, { name: string | null; count: number }>();
  for (const r of (unsafeRows ?? []) as unknown as {
    host_id: string;
    host: { name: string | null } | null;
  }[]) {
    const cur = safetyCounts.get(r.host_id) ?? { name: r.host?.name ?? null, count: 0 };
    cur.count++;
    safetyCounts.set(r.host_id, cur);
  }
  const flaggedHosts = Array.from(safetyCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([host_id, v]) => ({ host_id, name: v.name, count: v.count }));

  // Moderation data — queried separately so the page still renders if
  // migration-moderation.sql hasn't been run yet.
  const [{ data: modUserRows }, { data: modEventRows }, { data: modSeriesRows }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, moderation_status, warning_count, moderation_reason")
        .neq("id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("events")
        .select("id, title, category, state, created_at, host:users!events_host_id_fkey(id, name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("event_series")
        .select("id, title, category, state, frequency, host:users!event_series_host_id_fkey(id, name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
  const modUsers = (modUserRows ?? []) as unknown as ModUserRow[];
  const modEvents = (modEventRows ?? []) as unknown as ModEventRow[];
  const modSeries = (modSeriesRows ?? []) as unknown as ModSeriesRow[];

  // Open user reports, with target labels resolved for display.
  const { data: reportRows } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, created_at, reporter:users!reports_reporter_id_fkey(name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  const rawReports = (reportRows ?? []) as unknown as {
    id: string;
    target_type: "event" | "user";
    target_id: string;
    reason: string;
    details: string | null;
    created_at: string;
    reporter: { name: string | null } | null;
  }[];
  // Resolve target labels (event titles / user names) in two batched lookups.
  const eventTargetIds = rawReports.filter((r) => r.target_type === "event").map((r) => r.target_id);
  const userTargetIds = rawReports.filter((r) => r.target_type === "user").map((r) => r.target_id);
  const [{ data: evTitles }, { data: usrNames }] = await Promise.all([
    eventTargetIds.length
      ? supabase.from("events").select("id, title").in("id", eventTargetIds)
      : Promise.resolve({ data: [] }),
    userTargetIds.length
      ? supabase.from("users").select("id, name").in("id", userTargetIds)
      : Promise.resolve({ data: [] }),
  ]);
  const labelMap = new Map<string, string>();
  for (const e of (evTitles ?? []) as { id: string; title: string }[]) labelMap.set(e.id, e.title);
  for (const u of (usrNames ?? []) as { id: string; name: string | null }[])
    labelMap.set(u.id, u.name ?? "Unnamed user");
  const modReports: ModReportRow[] = rawReports.map((r) => ({
    id: r.id,
    target_type: r.target_type,
    target_id: r.target_id,
    target_label: labelMap.get(r.target_id) ?? "(deleted)",
    reason: r.reason,
    details: r.details,
    reporter_name: r.reporter?.name ?? null,
    created_at: r.created_at,
  }));

  const { data: corporateRows } = await supabase
    .from("corporate_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  const corporate = (corporateRows ?? []) as CorporateAccount[];

  const { data: hostStatRows } = await supabase
    .from("host_stats")
    .select(
      "host_id, average_rating, total_events, safety_score, host:users!host_stats_host_id_fkey(name, featured_host, awarded_badges, revoked_badges)"
    )
    .limit(100);
  const adminHosts: AdminHostRow[] = (
    (hostStatRows ?? []) as unknown as {
      host_id: string;
      average_rating: number;
      total_events: number;
      safety_score: number | null;
      host: {
        name: string | null;
        featured_host: boolean;
        awarded_badges: string[];
        revoked_badges: string[];
      } | null;
    }[]
  )
    .map((r) => ({
      host_id: r.host_id,
      name: r.host?.name ?? null,
      average_rating: r.average_rating,
      total_events: r.total_events,
      safety_score: r.safety_score,
      featured_host: !!r.host?.featured_host,
      awarded_badges: r.host?.awarded_badges ?? [],
      revoked_badges: r.host?.revoked_badges ?? [],
    }))
    .sort(
      (a, b) =>
        hostScore({
          average_rating: b.average_rating,
          total_events: b.total_events,
          safety_score: b.safety_score,
        } as never) -
        hostScore({
          average_rating: a.average_rating,
          total_events: a.total_events,
          safety_score: a.safety_score,
        } as never)
    );
  const payouts = (payoutRows ?? []) as unknown as {
    id: string;
    amount: number;
    platform_fee: number;
    status: string;
    users: {
      name: string | null;
      payout_bank: string | null;
      payout_account_number: string | null;
    } | null;
    events: { title: string | null } | null;
  }[];

  const reservations = (reservationRows ?? []) as unknown as ReservationWithUser[];
  const expiredEvents = (expiredRows ?? []) as {
    id: string;
    title: string;
    category: string;
    state: string;
    date: string;
  }[];

  const transactions = (txns ?? []) as Pick<
    Transaction,
    "amount" | "platform_fee"
  >[];
  const ticketSales = transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const platformRevenue = transactions.reduce(
    (sum, t) => sum + (t.platform_fee ?? 0),
    0
  );

  const stats = [
    { label: "Total users", value: (userCount ?? 0).toLocaleString(), emoji: "👥" },
    { label: "Total events", value: (eventCount ?? 0).toLocaleString(), emoji: "🗓️" },
    { label: "Ticket sales", value: formatNaira(ticketSales), emoji: "🎟️" },
    { label: "Platform revenue", value: formatNaira(platformRevenue), emoji: "💰" },
  ];

  return (
    <div className="container-page py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-extrabold text-gray-900">Admin dashboard</h1>
        <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
          ADMIN
        </span>
      </div>
      <p className="mt-1 text-gray-600">Platform overview at a glance.</p>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
          >
            <span className="text-2xl">{s.emoji}</span>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {s.value}
            </p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Reservations */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          Reservations
          {reservations.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {reservations.length} pending
            </span>
          )}
        </h2>
        <AdminReservations initialReservations={reservations} />
      </section>

      {/* Tournament */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          🎮 FC26 Tournament
          {tournamentRegs.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
              {tournamentRegs.length}
            </span>
          )}
        </h2>
        <AdminTournament registrations={tournamentRegs} />
      </section>

      {/* Opportunities */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          Opportunities
          {opportunities.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
              {opportunities.length}
            </span>
          )}
        </h2>
        <AdminOpportunities initial={opportunities} />
      </section>

      {/* Expired events */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          Expired events
          {expiredEvents.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
              {expiredEvents.length}
            </span>
          )}
        </h2>
        <AdminExpiredEvents initialEvents={expiredEvents} />
      </section>

      {/* Payouts */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          Payout requests
          {payouts.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {payouts.length}
            </span>
          )}
        </h2>
        <AdminPayouts initialPayouts={payouts} />
      </section>

      {/* Hosts */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          🏅 Hosts
          {adminHosts.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
              {adminHosts.length}
            </span>
          )}
        </h2>
        <AdminHosts initial={adminHosts} />
      </section>

      {/* Corporate */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          🏢 Corporate
          {corporate.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
              {corporate.length}
            </span>
          )}
        </h2>
        <AdminCorporate initial={corporate} adminId={user.id} />
      </section>

      {/* Moderation */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          🛡️ Moderation
          {modUsers.filter((u) => u.moderation_status && u.moderation_status !== "active").length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
              {modUsers.filter((u) => u.moderation_status !== "active").length} flagged
            </span>
          )}
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Warn, restrict or block spammers, and delete events that violate the terms.
        </p>
        <AdminModeration
          users={modUsers.map((u) => ({
            ...u,
            moderation_status: u.moderation_status ?? "active",
            warning_count: u.warning_count ?? 0,
          }))}
          events={modEvents}
          series={modSeries}
          reports={modReports}
        />
      </section>

      {/* Safety flags */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          🛟 Safety flags
          {flaggedHosts.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
              {flaggedHosts.length}
            </span>
          )}
        </h2>
        {flaggedHosts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
            No hosts flagged for safety concerns.
          </p>
        ) : (
          <ul className="space-y-2">
            {flaggedHosts.map((h) => (
              <li
                key={h.host_id}
                className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3"
              >
                <span className="font-semibold text-gray-900">
                  {h.name ?? "Unnamed host"}
                </span>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                  {h.count} &quot;didn&apos;t feel safe&quot; reviews
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Wallet credits */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          💰 Credit a wallet
        </h2>
        <AdminWalletCredit users={messageUsers} />
      </section>

      {/* Messages */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Messages</h2>
        <AdminMessages adminId={user.id} users={messageUsers} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Recent signups */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-gray-900">Recent signups</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
            {(recentUsers as RecentUser[] | null)?.length ? (
              <ul className="divide-y divide-gray-50">
                {(recentUsers as RecentUser[]).map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                      {(u.name ?? u.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {u.name ?? "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatEventDate(u.created_at.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                No users yet.
              </p>
            )}
          </div>
        </section>

        {/* Recent events */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-gray-900">Recent events</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
            {(recentEvents as RecentEvent[] | null)?.length ? (
              <ul className="divide-y divide-gray-50">
                {(recentEvents as RecentEvent[]).map((e) => (
                  <li key={e.id} className="px-4 py-3">
                    <Link
                      href={`/events/${e.id}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {e.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <CategoryBadge category={e.category} />
                          <span className="text-xs text-gray-400">{e.state}</span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-gray-600">
                        {e.price > 0 ? formatNaira(e.price) : "Free"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                No events yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
