import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subscriberProof } from "@/lib/social-proof";
import AppHeader from "@/components/AppHeader";
import QuickActions from "@/components/dashboard/QuickActions";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import ProfileCard from "@/components/ProfileCard";
import ProfileCompletion from "@/components/ProfileCompletion";
import UserMessages from "@/components/UserMessages";
import PayoutRequest from "@/components/PayoutRequest";
import CategoryBadge from "@/components/CategoryBadge";
import EventCover from "@/components/EventCover";
import WalletCard from "@/components/wallet/WalletCard";
import ReferralCard from "@/components/referral/ReferralCard";
import HostRings from "@/components/host/HostRings";
import { computeBadges, hostScore } from "@/lib/hostBadges";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { isProActive } from "@/lib/pro";
import { formatNaira } from "@/lib/paystack";
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
      .select(
        "id, title, category, state, date, time, price, cover_image_url, rsvps(status)"
      )
      .eq("host_id", user.id)
      .order("date", { ascending: true }),
    supabase
      .from("rsvps")
      .select(
        "status, events(id, title, category, state, date, time, cover_image_url)"
      )
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
    unrecorded: number;
    status: string | null;
  }[] = [];
  if (paidEvents.length) {
    const paidIds = paidEvents.map((e) => e.id);
    const [{ data: txRows }, { data: payoutRows }, { data: paidRsvpRows }] =
      await Promise.all([
      supabase
        .from("transactions")
        .select("event_id, amount, platform_fee, fee_on_top")
        .in("event_id", paidIds),
      supabase
        .from("payouts")
        .select("event_id, status")
        .eq("host_id", user.id),
      supabase
        .from("rsvps")
        .select("event_id")
        .in("event_id", paidIds)
        .eq("paid", true),
    ]);
    const txns = (txRows ?? []) as {
      event_id: string | null;
      amount: number;
      platform_fee: number;
      fee_on_top?: boolean | null;
    }[];
    const payouts = (payoutRows ?? []) as {
      event_id: string | null;
      status: string;
    }[];
    const paidRsvps = (paidRsvpRows ?? []) as { event_id: string }[];

    payoutCards = paidEvents
      .map((e) => {
        const evTx = txns.filter((t) => t.event_id === e.id);
        const collected = evTx.reduce((s, t) => s + t.amount, 0);
        const platformFee = evTx.reduce((s, t) => s + t.platform_fee, 0);
        // Guests who paid but whose transaction never landed. Without this a
        // host just sees ₦0 and no reason — the money is gone from the
        // guest's account and invisible here.
        const unrecorded =
          paidRsvps.filter((r) => r.event_id === e.id).length - evTx.length;
        return {
          eventId: e.id,
          eventTitle: e.title,
          collected,
          platformFee,
          // Branching on the model each sale was written under, not on a
          // single global formula.
          //
          // Legacy rows: the buyer paid `amount` and our cut came out of it,
          // so the host is owed amount - fee. New rows: the buyer paid
          // amount + fee and the host is owed all of `amount`. Applying the
          // new formula to old rows would quietly overpay every host for
          // every sale already taken, including ones already paid out.
          due: evTx.reduce(
            (sum, t) => sum + (t.fee_on_top ? t.amount : t.amount - t.platform_fee),
            0
          ),
          unrecorded: unrecorded > 0 ? unrecorded : 0,
          status: payouts.find((p) => p.event_id === e.id)?.status ?? null,
        };
      })
      // Keep an event visible if money was taken but not recorded, even
      // though collected is 0 — that's exactly the case worth surfacing.
      .filter((c) => c.collected > 0 || c.unrecorded > 0);
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

  // --- What needs you ------------------------------------------------------
  //
  // The section this page never had. A dashboard should open with what is
  // waiting on a decision, and every one of these is already computable from
  // data fetched above: nothing new is queried.
  const pendingRequests = hosting.reduce(
    (n, e) => n + e.rsvps.filter((r) => r.status === "pending").length,
    0
  );
  const requestEvent = hosting.find((e) =>
    e.rsvps.some((r) => r.status === "pending")
  );
  const claimable = payoutCards.filter((c) => c.status === null && c.due > 0);
  const claimableTotal = claimable.reduce((n, c) => n + c.due, 0);

  const needsYou: {
    icon: string;
    tone: "brand" | "green" | "amber";
    title: string;
    sub: string;
    href: string;
  }[] = [];
  if (pendingRequests > 0) {
    needsYou.push({
      icon: "users",
      tone: "brand",
      title: `Review ${pendingRequests} join request${
        pendingRequests === 1 ? "" : "s"
      }`,
      sub: requestEvent ? `For ${requestEvent.title}` : "On your link-ups",
      href: requestEvent ? `/events/${requestEvent.id}` : "/dashboard",
    });
  }
  if (claimableTotal > 0) {
    needsYou.push({
      icon: "ticket",
      tone: "green",
      title: `Withdraw ${formatNaira(claimableTotal)}`,
      sub: `From ${claimable.length} finished link-up${
        claimable.length === 1 ? "" : "s"
      }`,
      href: "#payouts",
    });
  }
  // Only when there is money it would actually block. Nagging somebody with
  // nothing to withdraw about their bank details is how a list like this
  // stops being read.
  if (claimableTotal > 0 && !p?.payout_account_number) {
    needsYou.push({
      icon: "shield",
      tone: "amber",
      title: "Add your payout details",
      sub: "Needed to send you ticket money",
      href: "/profile/edit",
    });
  }

  // --- Next up -------------------------------------------------------------
  //
  // The page could say you were hosting three link-ups and never which one
  // was first. Hosting and attending are merged, because the diary does not
  // care which side of it you are on.
  const upcoming = [
    ...hosting.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
      state: e.state,
      category: e.category,
      cover: e.cover_image_url,
      role: "Hosting",
      going: e.rsvps.filter((r) => r.status === "accepted").length as number | null,
    })),
    ...attending.map((r) => ({
      id: r.events!.id,
      title: r.events!.title,
      date: r.events!.date,
      time: r.events!.time,
      state: r.events!.state,
      category: r.events!.category,
      cover: r.events!.cover_image_url,
      role: "Going",
      going: null as number | null,
    })),
  ].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const nextUp = upcoming[0] ?? null;

  const daysAway = nextUp
    ? Math.round(
        (new Date(`${nextUp.date}T00:00:00`).getTime() -
          new Date(`${today}T00:00:00`).getTime()) /
          86400000
      )
    : 0;
  const whenLabel =
    daysAway <= 0 ? "today" : daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;

  return (
    <div>
      <AppHeader
        title={p?.name ? `Hi, ${p.name.split(" ")[0]}` : "Your dashboard"}
        subtitle="Everything you're part of, in one place"
        action={
          <Link href="/host" className="btn-primary rounded-full px-4 py-2 text-sm">
            Host
          </Link>
        }
      />

      <div className="container-page max-w-[760px] py-4">

      {/* 1 - NEEDS YOU.
          Eleven stacked sections used to open this page, and none of them said
          what was waiting on the reader. On a phone the left column stacked
          first, so a host scrolled past four cards about themselves before
          reaching anything they could act on.

          Renders nothing at all when there is nothing to do, which is the only
          way a list like this stays worth reading. */}
      {needsYou.length > 0 && (
        <section>
          <SectionLabel>Needs you</SectionLabel>
          <div className="divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
            {needsYou.map((n) => (
              <Link
                key={n.title}
                href={n.href}
                className="flex items-center gap-3 px-4 py-3.5 transition-transform duration-150 active:scale-[0.995]"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    n.tone === "brand"
                      ? "bg-brand/[0.10] text-brand"
                      : n.tone === "green"
                        ? "bg-naija/[0.12] text-naija"
                        : "bg-amber-400/[0.16] text-amber-600"
                  }`}
                >
                  <LineIcon name={n.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-gray-900 dark:text-white">
                    {n.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-gray-500">
                    {n.sub}
                  </span>
                </span>
                <LineIcon name="chevronRight" size={16} className="shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 2 - NEXT UP. One card, the next thing in the diary. */}
      {nextUp && (
        <section>
          <SectionLabel>Next up</SectionLabel>
          {/* The host's own flyer, not a brand-coloured slab.
              A flat gradient says "an event exists"; the artwork says which
              one, and it is the thing the host actually made. The scrim is
              what keeps the copy readable over whatever they uploaded, since
              a cover can be any colour at all. */}
          <Link
            href={`/events/${nextUp.id}`}
            className="relative block overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-700 p-5 text-white shadow-[var(--e2)] transition-transform duration-150 active:scale-[0.99]"
          >
            {/* The absolute lives on a wrapper, not on EventCover.
                EventCover hardcodes `relative` into its own wrapper and
                appends whatever className it is given, so the string ends up
                "relative … absolute", and Tailwind emits .relative AFTER
                .absolute. Later rule wins: the element computes to relative,
                the h-full has no sized parent to resolve against on a card
                whose height comes from its content, and next/image fill
                paints nothing. The base gradient showed through and the card
                looked exactly as it did before the change. */}
            <span className="absolute inset-0 block" aria-hidden>
              <EventCover
                url={nextUp.cover}
                category={nextUp.category}
                title={nextUp.title}
                className="h-full w-full"
              />
            </span>
            {/* Dark enough to read on, light enough to still see the flyer. */}
            <span
              className="absolute inset-0 bg-gradient-to-t from-[#1A1040]/95 via-[#1A1040]/72 to-[#1A1040]/30"
              aria-hidden
            />
            <div className="relative flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]">
                {nextUp.role}
              </span>
              <span className="text-[13px] font-semibold text-white/75">
                {whenLabel}
              </span>
            </div>
            <p className="relative mt-2.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] drop-shadow">
              {nextUp.title}
            </p>
            <dl className="relative mt-2.5 space-y-1 text-[14px] text-white/85">
              <div className="flex items-center gap-2">
                <LineIcon name="calendar" size={14} className="shrink-0 text-white/55" />
                {formatEventDate(nextUp.date)}
                {nextUp.time ? ` \u00b7 ${formatEventTime(nextUp.time)}` : ""}
              </div>
              {nextUp.state && (
                <div className="flex items-center gap-2">
                  <LineIcon name="pin" size={14} className="shrink-0 text-white/55" />
                  {nextUp.state}
                </div>
              )}
              {nextUp.going !== null && (
                <div className="flex items-center gap-2">
                  <LineIcon name="users" size={14} className="shrink-0 text-white/55" />
                  {nextUp.going} going
                </div>
              )}
            </dl>
          </Link>
        </section>
      )}

      {/* 3 - YOUR LINK-UPS. Ninth on this page before today. */}
      <SectionLabel>Your link-ups</SectionLabel>
      <div>
          {/* Five stacked headings became one switchable list. */}
          <DashboardTabs
            tabs={[
              { id: "hosting", label: "Hosting", count: hosting.length },
              { id: "attending", label: "Going", count: attending.length },
              { id: "pending", label: "Pending", count: pending.length },
              { id: "past", label: "Past", count: pastHosting.length },
              { id: "declined", label: "Declined", count: declined.length },
            ]}
          >
            <div key="hosting">
          <Section
            title="Link-ups I'm hosting"
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
            </div>
            <div key="past">
          {pastHosting.length > 0 && (
            <Section
              title="Past link-ups"
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
            </div>
            <div key="attending">
          <Section
            title="Link-ups I'm attending"
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
            </div>
            <div key="pending">
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
            </div>
            <div key="declined">
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
          </DashboardTabs>
      </div>

      {/* 4 - MESSAGES. Kept, but after the link-ups rather than before them. */}
      <SectionLabel>Messages</SectionLabel>
      <UserMessages meId={user.id} />

      {/* 5 - YOUR GROUPS.
          "My Circles", "My Series" and "Series I Follow" were three headings
          answering one question: what am I part of. The kind becomes a label
          on the row instead of a heading above it. */}
      {(myCircleRows.length > 0 ||
        mySeries.length > 0 ||
        followedSeries.length > 0) && (
        <>
          <SectionLabel>Your groups</SectionLabel>
          <div className="divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
            {myCircleRows.map(({ circle }) => {
              const unread = circleUnread.get(circle!.id) ?? 0;
              return (
                <GroupRow
                  key={circle!.id}
                  href={`/circles/${circle!.id}`}
                  name={circle!.name}
                  kind={circle!.category ? `Circle \u00b7 ${circle!.category}` : "Circle"}
                  badge={unread > 0 ? `${unread > 9 ? "9+" : unread} new` : null}
                />
              );
            })}
            {mySeries.map((se) => (
              <GroupRow
                key={se.id}
                href={`/series/${se.id}`}
                name={se.title}
                kind="Series you run"
                badge={subscriberProof(se.subscriber_count, "follower")}
              />
            ))}
            {followedSeries.map((se) => (
              <GroupRow
                key={se.id}
                href={`/series/${se.id}`}
                name={se.title}
                kind="Series you follow"
                badge={null}
              />
            ))}
          </div>

          {/* Upcoming dates from series you follow, which is the reason to
              follow one. Rolled in here rather than given its own heading. */}
          {followedEvents.length > 0 && (
            <div className="mt-2 divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
              {followedEvents.map((e) => (
                <GroupRow
                  key={e.id}
                  href={`/events/${e.id}`}
                  name={e.title}
                  kind={`${formatEventDate(e.date)} \u00b7 ${formatEventTime(e.time)}`}
                  badge="From a series"
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* 6 - PAYOUTS. Anchored, because "Withdraw" up in Needs you links here. */}
      {payoutCards.length > 0 && (
        <div id="payouts">
          <SectionLabel>Payouts</SectionLabel>
          <div className="space-y-3">
            {payoutCards.map((c) => (
              <PayoutRequest
                key={c.eventId}
                hostId={user.id}
                eventId={c.eventId}
                eventTitle={c.eventTitle}
                collected={c.collected}
                unrecorded={c.unrecorded}
                platformFee={c.platformFee}
                due={c.due}
                phoneVerified={!!profile?.phone_verified}
                status={c.status}
              />
            ))}
          </div>
        </div>
      )}

      {/* 7 - MONEY. Wallet and referrals were two full cards about the same
          subject, stacked apart. */}
      <SectionLabel>Money</SectionLabel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WalletCard balance={p?.wallet_balance ?? 0} transactions={walletTx} />
        <ReferralCard
          referralCode={p?.referral_code ?? null}
          referralCount={referralCount}
          totalEarned={totalEarned}
          referredNames={referredNames}
        />
      </div>

      {/* 8 - YOU. Last, deliberately. Nobody opens a dashboard to read their
          own bio, and this sat above everything actionable. */}
      <SectionLabel>You</SectionLabel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      </div>

      {p && (
        <div className="mt-4">
          <ProfileCompletion items={completionItems} />
        </div>
      )}

      {/* 9 - MEMORIES. */}
      {recentPhotos.length > 0 && (
        <>
          <SectionLabel>Recent memories</SectionLabel>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {recentPhotos.map((ph) => (
              <Link
                key={ph.id}
                href={`/events/${ph.event_id}`}
                className="aspect-square overflow-hidden rounded-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ph.photo_url}
                  alt="Event memory"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Shortcuts stay, at the bottom. They are a way to start something,
          which is not the question this screen opens on. */}
      <div className="mt-8">
        <QuickActions />
      </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
      {children}
    </h2>
  );
}

function GroupRow({
  href,
  name,
  kind,
  badge,
}: {
  href: string;
  name: string;
  kind: string;
  badge: string | null;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-gray-900 dark:text-white">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-gray-500">
          {kind}
        </span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-brand/[0.10] px-2.5 py-1 text-[12px] font-bold text-brand">
          {badge}
        </span>
      )}
      <LineIcon name="chevronRight" size={16} className="shrink-0 text-gray-400" />
    </Link>
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
      className="flex flex-col gap-3 surface p-4 transition hover:border-brand/30 sm:flex-row sm:items-center sm:justify-between"
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
    accepted: "bg-naija-100 text-naija-700",
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
