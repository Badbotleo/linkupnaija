import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getCurrentUserMeta } from "@/lib/supabase/auth";
import CategoryBadge from "@/components/CategoryBadge";
import AdminReservations from "@/components/admin/AdminReservations";
import AdminExpiredEvents from "@/components/admin/AdminExpiredEvents";
import AdminMessages from "@/components/admin/AdminMessages";
import AdminPayouts from "@/components/admin/AdminPayouts";
import AdminTournament from "@/components/admin/AdminTournament";
import AdminOpportunities from "@/components/admin/AdminOpportunities";
import { formatNaira } from "@/lib/paystack";
import { formatEventDate } from "@/lib/format";
import type {
  Transaction,
  ReservationWithUser,
  TournamentRegistration,
  Opportunity,
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
