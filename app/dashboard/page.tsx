import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileCard from "@/components/ProfileCard";
import ProfileCompletion from "@/components/ProfileCompletion";
import UserMessages from "@/components/UserMessages";
import PayoutRequest from "@/components/PayoutRequest";
import CategoryBadge from "@/components/CategoryBadge";
import WalletCard from "@/components/wallet/WalletCard";
import ReferralCard from "@/components/referral/ReferralCard";
import HostRings from "@/components/host/HostRings";
import { computeBadges, hostScore } from "@/lib/hostBadges";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { isProActive } from "@/lib/pro";
import type {
  EventRow,
  RsvpStatus,
  UserProfile,
  WalletTransaction,
  HostStats,
} from "@/lib/types";

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

  const [
    { data: profile },
    { data: hostingRaw },
    { data: myRsvpsRaw },
    { data: walletTxRaw },
    { data: referralRaw },
    { data: mySeriesRaw },
    { data: followedRaw },
    { data: myCirclesRaw },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("events")
      .select("id, title, category, state, date, time, price, rsvps(status)")
      .eq("host_id", user.id)
      .order("date", { ascending: true }),
    supabase
      .from("rsvps")
      .select("status, events(id, title, category, state, date, time)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("referrals")
      .select(
        "reward_amount, status, referred:users!referrals_referred_id_fkey(name)"
      )
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_series")
      .select("id, title, subscriber_count")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("series_subscriptions")
      .select("series:event_series(id, title)")
      .eq("user_id", user.id),
    supabase
      .from("circle_members")
      .select("last_read_at, circle:circles(id, name, category)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const mySeries = (mySeriesRaw ?? []) as {
    id: string;
    title: string;
    subscriber_count: number;
  }[];
  const followedSeries = ((followedRaw ?? []) as unknown as {
    series: { id: string; title: string } | null;
  }[])
    .map((f) => f.series)
    .filter((s): s is { id: string; title: string } => !!s);

  // Upcoming events from series the user follows.
  let followedEvents: {
    id: string;
    title: string;
    date: string;
    time: string;
    series_id: string;
  }[] = [];
  if (followedSeries.length) {
    const { data: fev } = await supabase
      .from("events")
      .select("id, title, date, time, series_id")
      .in("series_id", followedSeries.map((s) => s.id))
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .limit(10);
    followedEvents = (fev ?? []) as typeof followedEvents;
  }

  // My circles + unread post counts (posts newer than my last_read_at).
  const myCircleRows = (
    (myCirclesRaw ?? []) as unknown as {
      last_read_at: string;
      circle: { id: string; name: string; category: string | null } | null;
    }[]
  ).filter((c) => c.circle);
  const circleUnread = new Map<string, number>();
  if (myCircleRows.length) {
    const ids = myCircleRows.map((c) => c.circle!.id);
    const { data: recentPosts } = await supabase
      .from("circle_posts")
      .select("circle_id, created_at, user_id")
      .in("circle_id", ids)
      .order("created_at", { ascending: false })
      .limit(300);
    const lastRead = new Map(myCircleRows.map((c) => [c.circle!.id, c.last_read_at]));
    for (const p of (recentPosts ?? []) as {
      circle_id: string;
      created_at: string;
      user_id: string;
    }[]) {
      if (p.user_id === user.id) continue;
      const lr = lastRead.get(p.circle_id);
      if (lr && p.created_at > lr)
        circleUnread.set(p.circle_id, (circleUnread.get(p.circle_id) ?? 0) + 1);
    }
  }

  const walletTx = (walletTxRaw ?? []) as WalletTransaction[];
  const referralRows = (referralRaw ?? []) as unknown as {
    reward_amount: number;
    status: string;
    referred: { name: string | null } | null;
  }[];
  const referralCount = referralRows.length;
  const totalEarned = referralRows.reduce((s, r) => s + (r.reward_amount ?? 0), 0);
  const referredNames = referralRows.map(
    (r) => (r.referred?.name ?? "A friend").split(" ")[0]
  );

  const allHosting = (hostingRaw ?? []) as unknown as HostingEvent[];
  const today = new Date().toISOString().slice(0, 10);
  const hosting = allHosting.filter((e) => e.date >= today);
  const pastHosting = allHosting.filter((e) => e.date < today);
  const myRsvps = (myRsvpsRaw ?? []) as unknown as MyRsvp[];

  const attending = myRsvps.filter((r) => r.status === "accepted" && r.events);
  const pending = myRsvps.filter((r) => r.status === "pending" && r.events);
  const declined = myRsvps.filter((r) => r.status === "declined" && r.events);

  // Recent Memories — latest photos from events the user was part of (attended
  // or hosted). RLS lets accepted attendees + hosts read these galleries.
  const memoryEventIds = Array.from(
    new Set([
      ...attending.map((r) => r.events!.id),
      ...allHosting.map((e) => e.id),
    ])
  );
  let recentPhotos: { id: string; event_id: string; photo_url: string }[] = [];
  if (memoryEventIds.length) {
    const { data } = await supabase
      .from("event_photos")
      .select("id, event_id, photo_url")
      .in("event_id", memoryEventIds)
      .order("created_at", { ascending: false })
      .limit(6);
    recentPhotos = data ?? [];
  }

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

  const { data: hs } = await supabase
    .from("host_stats")
    .select("*")
    .eq("host_id", user.id)
    .maybeSingle();
  const hostStats = hs as HostStats | null;
  const hostBadges = computeBadges(hostStats, {
    awarded: p?.awarded_badges,
    revoked: p?.revoked_badges,
  });

  // Percentile among hosts in the same state.
  let hostPercentile: number | null = null;
  if (hostStats && p?.state) {
    const { data: peers } = await supabase
      .from("host_stats")
      .select("average_rating, total_events, safety_score, host:users!host_stats_host_id_fkey(state)")
      .limit(1000);
    const inState = ((peers ?? []) as unknown as {
      average_rating: number;
      total_events: number;
      safety_score: number | null;
      host: { state: string | null } | null;
    }[]).filter((x) => x.host?.state === p.state);
    if (inState.length > 0) {
      const my = hostScore(hostStats);
      const better = inState.filter((x) => hostScore(x as never) >= my).length;
      hostPercentile = Math.max(1, Math.round((100 * better) / inState.length));
    }
  }

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
        {/* Profile summary + wallet + referrals */}
        <div className="space-y-6 lg:col-span-1">
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

          {hostStats && hostStats.total_events > 0 && (
            <div>
              <HostRings
                stats={hostStats}
                badges={hostBadges}
                percentile={hostPercentile}
              />
              <Link
                href="/hosts/leaderboard"
                className="mt-2 block text-center text-sm font-semibold text-brand hover:underline"
              >
                View the host leaderboard →
              </Link>
            </div>
          )}

          <WalletCard balance={p?.wallet_balance ?? 0} transactions={walletTx} />

          <ReferralCard
            referralCode={p?.referral_code ?? null}
            referralCount={referralCount}
            totalEarned={totalEarned}
            referredNames={referredNames}
          />
        </div>

        {/* Lists */}
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-lg font-bold text-gray-900">Messages</h2>
            <UserMessages meId={user.id} />
          </section>

          {myCircleRows.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                My Circles
              </h2>
              <div className="space-y-2">
                {myCircleRows.map(({ circle }) => {
                  const unread = circleUnread.get(circle!.id) ?? 0;
                  return (
                    <Link
                      key={circle!.id}
                      href={`/circles/${circle!.id}`}
                      className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition hover:border-brand/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-900">
                          {circle!.name}
                        </p>
                        {circle!.category && (
                          <p className="text-xs text-gray-500">{circle!.category}</p>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
                          {unread > 9 ? "9+" : unread} new
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {mySeries.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                My Series
              </h2>
              <div className="space-y-2">
                {mySeries.map((s) => (
                  <Link
                    key={s.id}
                    href={`/series/${s.id}`}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition hover:border-brand/30"
                  >
                    <span className="font-bold text-gray-900">{s.title}</span>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
                      {s.subscriber_count}{" "}
                      {s.subscriber_count === 1 ? "follower" : "followers"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {followedSeries.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                Series I Follow
              </h2>
              {followedEvents.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No upcoming events from your series right now.
                </p>
              ) : (
                <div className="space-y-2">
                  {followedEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={`/events/${e.id}`}
                      className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition hover:border-brand/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-900">
                          {e.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatEventDate(e.date)} · {formatEventTime(e.time)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
                        Series
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {recentPhotos.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                Recent memories
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {recentPhotos.map((p) => (
                  <Link
                    key={p.id}
                    href={`/events/${p.event_id}`}
                    className="aspect-square overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photo_url}
                      alt="Event memory"
                      loading="lazy"
                      className="h-full w-full object-cover transition hover:opacity-90"
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

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
            emptyText="Ready to bring people together?"
            emptyCta
            ctaHref="/host"
            ctaLabel="Host your first event →"
            emptyEmoji="🎤"
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
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                    <LineIcon name="users" size={15} className="text-gray-400" />
                    {accepted} going
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
            emptyText="You haven't joined any events yet."
            emptyCta
            ctaHref="/events"
            ctaLabel="Browse what's happening →"
            emptyEmoji="🎟️"
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
  ctaHref = "/events",
  ctaLabel = "Explore events",
  emptyEmoji,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  emptyCta?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  emptyEmoji?: string;
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
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          {emptyEmoji && <p className="text-3xl">{emptyEmoji}</p>}
          <p className="mt-2 text-sm text-gray-600">{emptyText}</p>
          {emptyCta && (
            <Link href={ctaHref} className="btn-primary mt-4">
              {ctaLabel}
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
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <LineIcon name="calendar" size={14} className="shrink-0 text-gray-400" />
          {formatEventDate(event.date)} · {formatEventTime(event.time)}
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
