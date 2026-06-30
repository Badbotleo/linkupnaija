import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileCard from "@/components/ProfileCard";
import ProfileCompletion from "@/components/ProfileCompletion";
import UserMessages from "@/components/UserMessages";
import PayoutRequest from "@/components/PayoutRequest";
import CategoryBadge from "@/components/CategoryBadge";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { isProActive } from "@/lib/pro";
import type { EventRow, RsvpStatus, UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your dashboard" };

type HostingEvent = EventRow & { rsvps: { status: RsvpStatus }[] };
type MyRsvp = { status: RsvpStatus; events: EventRow | null };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const [{ data: profile }, { data: hostingRaw }, { data: myRsvpsRaw }] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("events")
        .select("id, title, category, state, date, time, price, rsvps(status)")
        .eq("host_id", user.id)
        .order("date", { ascending: true }),
      supabase
        .from("rsvps")
        .select(
          "status, events(id, title, category, state, date, time)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const allHosting = (hostingRaw ?? []) as unknown as HostingEvent[];
  const today = new Date().toISOString().slice(0, 10);
  const hosting = allHosting.filter((e) => e.date >= today);
  const pastHosting = allHosting.filter((e) => e.date < today);
  const myRsvps = (myRsvpsRaw ?? []) as unknown as MyRsvp[];

  const attending = myRsvps.filter((r) => r.status === "accepted" && r.events);
  const pending = myRsvps.filter((r) => r.status === "pending" && r.events);
  const declined = myRsvps.filter((r) => r.status === "declined" && r.events);

  // Payouts for the host's paid events.
  const paidEvents = allHosting.filter((e) => e.price > 0);
  let payoutCards: {
    eventId: string;
    eventTitle: string;
    collected: number;
    platformFee: number;
    due: number;
    status: string | null;
  }[] = [];
  if (paidEvents.length) {
    const paidIds = paidEvents.map((e) => e.id);
    const [{ data: txRows }, { data: payoutRows }] = await Promise.all([
      supabase
        .from("transactions")
        .select("event_id, amount, platform_fee")
        .in("event_id", paidIds),
      supabase
        .from("payouts")
        .select("event_id, status")
        .eq("host_id", user.id),
    ]);
    const txns = (txRows ?? []) as {
      event_id: string | null;
      amount: number;
      platform_fee: number;
    }[];
    const payouts = (payoutRows ?? []) as {
      event_id: string | null;
      status: string;
    }[];
    payoutCards = paidEvents
      .map((e) => {
        const evTx = txns.filter((t) => t.event_id === e.id);
        const collected = evTx.reduce((s, t) => s + t.amount, 0);
        const platformFee = evTx.reduce((s, t) => s + t.platform_fee, 0);
        return {
          eventId: e.id,
          eventTitle: e.title,
          collected,
          platformFee,
          due: collected - platformFee,
          status: payouts.find((p) => p.event_id === e.id)?.status ?? null,
        };
      })
      .filter((c) => c.collected > 0);
  }

  const p = profile as UserProfile | null;

  const completionItems = p
    ? [
        { label: "Avatar", done: !!p.avatar_url },
        { label: "Bio", done: !!p.bio },
        { label: "Instagram", done: !!p.instagram_url },
        { label: "Payout details", done: !!p.payout_account_number },
        { label: "Gender", done: !!p.gender },
      ]
    : [];

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold text-gray-900">Your dashboard</h1>

      {p && (
        <div className="mt-6">
          <ProfileCompletion items={completionItems} />
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Profile summary */}
        <div className="lg:col-span-1">
          {p && (
            <ProfileCard
              showEdit
              isPro={isProActive(p.is_pro, p.pro_expires_at)}
              rating={{ avg: p.rating_avg, count: p.rating_count }}
              profile={{
                id: p.id,
                name: p.name,
                state: p.state,
                avatar_url: p.avatar_url,
                bio: p.bio,
                instagram_url: p.instagram_url,
                twitter_url: p.twitter_url,
                facebook_url: p.facebook_url,
              }}
            />
          )}
        </div>

        {/* Lists */}
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-lg font-bold text-gray-900">Messages</h2>
            <UserMessages meId={user.id} />
          </section>

          {payoutCards.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900">Payouts</h2>
              <div className="space-y-3">
                {payoutCards.map((c) => (
                  <PayoutRequest
                    key={c.eventId}
                    hostId={user.id}
                    eventId={c.eventId}
                    eventTitle={c.eventTitle}
                    collected={c.collected}
                    platformFee={c.platformFee}
                    due={c.due}
                    status={c.status}
                  />
                ))}
              </div>
            </section>
          )}

          <Section
            title="Events I'm hosting"
            count={hosting.length}
            emptyText="You haven't hosted any events yet."
            emptyCta
          >
            {hosting.map((e) => {
              const accepted = e.rsvps.filter(
                (r) => r.status === "accepted"
              ).length;
              const pendingCount = e.rsvps.filter(
                (r) => r.status === "pending"
              ).length;
              return (
                <EventRowCard key={e.id} event={e}>
                  <span className="text-sm font-semibold text-gray-700">
                    👥 {accepted} going
                  </span>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {pendingCount} pending
                    </span>
                  )}
                </EventRowCard>
              );
            })}
          </Section>

          {pastHosting.length > 0 && (
            <Section
              title="Past events"
              count={pastHosting.length}
              emptyText=""
            >
              {pastHosting.map((e) => (
                <EventRowCard key={e.id} event={e}>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                    Expired
                  </span>
                </EventRowCard>
              ))}
            </Section>
          )}

          <Section
            title="Events I'm attending"
            count={attending.length}
            emptyText="No accepted events yet — explore and request to join one!"
            emptyCta
          >
            {attending.map((r) => (
              <EventRowCard key={r.events!.id} event={r.events!}>
                <StatusPill status="accepted" />
              </EventRowCard>
            ))}
          </Section>

          <Section
            title="Pending requests"
            count={pending.length}
            emptyText="No pending requests."
          >
            {pending.map((r) => (
              <EventRowCard key={r.events!.id} event={r.events!}>
                <StatusPill status="pending" />
              </EventRowCard>
            ))}
          </Section>

          <Section
            title="Declined"
            count={declined.length}
            emptyText="Nothing here."
          >
            {declined.map((r) => (
              <EventRowCard key={r.events!.id} event={r.events!}>
                <StatusPill status="declined" />
              </EventRowCard>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  emptyText,
  emptyCta = false,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  emptyCta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
          {count}
        </span>
      </h2>
      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
          <p>{emptyText}</p>
          {emptyCta && (
            <Link href="/events" className="btn-outline mt-4">
              Explore events
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function EventRowCard({
  event,
  children,
}: {
  event: EventRow;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition hover:border-brand/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <CategoryBadge category={event.category} />
          <span className="text-xs font-semibold text-brand">
            {event.state}
          </span>
        </div>
        <p className="mt-1.5 truncate font-bold text-gray-900">{event.title}</p>
        <p className="text-sm text-gray-500">
          📅 {formatEventDate(event.date)} · {formatEventTime(event.time)}
        </p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </Link>
  );
}

function StatusPill({ status }: { status: RsvpStatus }) {
  const map: Record<RsvpStatus, string> = {
    accepted: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    declined: "bg-red-100 text-red-700",
  };
  const label: Record<RsvpStatus, string> = {
    accepted: "✓ Going",
    pending: "⏳ Pending",
    declined: "Declined",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}
