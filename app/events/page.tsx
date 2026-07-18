import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventsFilters from "@/components/EventsFilters";
import EventsList from "@/components/EventsList";
import EventsMapToggle from "@/components/events/EventsMapToggle";
import EventsTabs from "@/components/EventsTabs";
import EventsStories from "@/components/EventsStories";
import LocationMatch from "@/components/LocationMatch";
import { computeBadges, type Badge } from "@/lib/hostBadges";
import TournamentBanner from "@/components/tournament/TournamentBanner";
import type { EventRow, RsvpStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore events",
  description:
    "Browse upcoming hangouts, parties, picnics, book clubs and more across Nigeria. Filter by state and category, and find your next link-up.",
};

type FeedEvent = EventRow & {
  rsvps: { status: RsvpStatus }[];
  host: { rating_avg: number; rating_count: number } | null;
};

const PAGE_SIZE = 24;

const SELECT =
  "*, rsvps(status), host:users!events_host_id_fkey(rating_avg, rating_count)";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: {
    state?: string;
    category?: string;
    page?: string;
    series?: string;
    tab?: string;
  };
}) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const forYou = searchParams.tab === "foryou" && !!user;

  let feedEvents: (FeedEvent & {
    attendeeCount: number;
    hostRating: { avg: number; count: number } | null;
  })[] = [];
  let totalPages = 1;
  let error: { message: string } | null = null;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const acceptedCount = (e: FeedEvent) =>
    e.rsvps.filter((r) => r.status === "accepted").length;
  const decorate = (e: FeedEvent) => ({
    ...e,
    attendeeCount: acceptedCount(e),
    hostRating: e.host
      ? { avg: e.host.rating_avg, count: e.host.rating_count }
      : null,
  });

  if (forYou && user) {
    // --- Personalised ranking ------------------------------------------------
    const [{ data: me }, { data: attendedRows }, { data: connRows }] =
      await Promise.all([
        supabase.from("users").select("state").eq("id", user.id).single(),
        supabase
          .from("rsvps")
          .select("events(category)")
          .eq("user_id", user.id)
          .eq("status", "accepted"),
        supabase
          .from("connections")
          .select("requester_id, receiver_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`),
      ]);

    const myState = me?.state ?? null;
    const attendedCats = new Set(
      ((attendedRows ?? []) as unknown as { events: { category: string } | null }[])
        .map((r) => r.events?.category)
        .filter(Boolean) as string[]
    );
    const friendIds = ((connRows ?? []) as { requester_id: string; receiver_id: string }[]).map(
      (c) => (c.requester_id === user.id ? c.receiver_id : c.requester_id)
    );
    let friendEventIds = new Set<string>();
    if (friendIds.length) {
      const { data: fev } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("status", "accepted")
        .in("user_id", friendIds);
      friendEventIds = new Set(
        ((fev ?? []) as { event_id: string }[]).map((r) => r.event_id)
      );
    }

    const { data, error: e } = await supabase
      .from("events")
      .select(SELECT)
      .eq("event_type", "general")
      .gte("date", today)
      .order("created_at", { ascending: false })
      .limit(80);
    error = e;
    const candidates = ((data ?? []) as unknown as FeedEvent[]).map(decorate);

    const score = (e: (typeof candidates)[number]) => {
      let s = 0;
      if (myState && e.state === myState) s += 100;
      if (e.category && attendedCats.has(e.category)) s += 40;
      if (friendEventIds.has(e.id)) s += 60;
      const ageDays = (Date.now() - new Date(e.created_at).getTime()) / 86400000;
      s += Math.max(0, 20 - ageDays);
      if (e.max_attendees && e.attendeeCount / e.max_attendees >= 0.6) s += 25;
      return s;
    };
    feedEvents = candidates.sort((a, b) => score(b) - score(a)).slice(0, 24);
  } else {
    // --- Standard paginated feed --------------------------------------------
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("events")
      .select(SELECT, { count: "exact" })
      .eq("event_type", "general")
      .gte("date", today);
    if (searchParams.state) query = query.eq("state", searchParams.state);
    if (searchParams.category) query = query.eq("category", searchParams.category);
    if (searchParams.series === "1") query = query.not("series_id", "is", null);

    const { data, error: e, count } = await query
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .range(from, to);
    error = e;
    totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

    const now = Date.now();
    const activeFeatured = (ev: FeedEvent) =>
      ev.featured && !!ev.featured_until && new Date(ev.featured_until).getTime() > now;
    feedEvents = ((data ?? []) as unknown as FeedEvent[])
      .sort((a, b) => (activeFeatured(b) ? 1 : 0) - (activeFeatured(a) ? 1 : 0))
      .map(decorate);
  }

  // --- Social proof: which of the viewer's friends are going -----------------
  // Map event_id -> { count, names, avatars } for a "friends going" badge.
  const friendsGoing: Record<
    string,
    { count: number; names: string[]; avatars: (string | null)[] }
  > = {};
  if (user && feedEvents.length) {
    const { data: connRows } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    const friendIds = ((connRows ?? []) as { requester_id: string; receiver_id: string }[]).map(
      (c) => (c.requester_id === user.id ? c.receiver_id : c.requester_id)
    );
    if (friendIds.length) {
      const { data: fr } = await supabase
        .from("rsvps")
        .select("event_id, users(name, avatar_url)")
        .eq("status", "accepted")
        .in("user_id", friendIds)
        .in("event_id", feedEvents.map((e) => e.id));
      for (const row of (fr ?? []) as unknown as {
        event_id: string;
        users: { name: string | null; avatar_url: string | null } | null;
      }[]) {
        const g = (friendsGoing[row.event_id] ??= { count: 0, names: [], avatars: [] });
        g.count++;
        if (g.names.length < 3) {
          g.names.push(row.users?.name ?? "A friend");
          g.avatars.push(row.users?.avatar_url ?? null);
        }
      }
    }
  }

  // --- Trending: 5+ RSVPs in the last 24h among the shown events -------------
  let trendingIds: string[] = [];
  if (feedEvents.length) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("rsvps")
      .select("event_id")
      .in("event_id", feedEvents.map((e) => e.id))
      .gte("created_at", since);
    const counts = new Map<string, number>();
    for (const r of (recent ?? []) as { event_id: string }[]) {
      counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
    }
    trendingIds = Array.from(counts.entries())
      .filter(([, n]) => n >= 5)
      .map(([id]) => id);
  }

  // --- Host reputation badges for the hosts in the feed ----------------------
  const hostBadgesByHost: Record<string, Badge[]> = {};
  if (feedEvents.length) {
    const hostIds = Array.from(new Set(feedEvents.map((e) => e.host_id)));
    const { data: hsRows } = await supabase
      .from("host_stats")
      .select(
        "*, host:users!host_stats_host_id_fkey(awarded_badges, revoked_badges)"
      )
      .in("host_id", hostIds);
    for (const r of (hsRows ?? []) as unknown as (import("@/lib/types").HostStats & {
      host: { awarded_badges: string[]; revoked_badges: string[] } | null;
    })[]) {
      hostBadgesByHost[r.host_id] = computeBadges(r, {
        awarded: r.host?.awarded_badges,
        revoked: r.host?.revoked_badges,
      });
    }
  }

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams.state) params.set("state", searchParams.state);
    if (searchParams.category) params.set("category", searchParams.category);
    if (searchParams.series === "1") params.set("series", "1");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  return (
    <div className="container-page py-10">
      <TournamentBanner />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Upcoming link-ups
          </h1>
          <p className="mt-1 text-gray-600">
            Find your next hangout across Nigeria.
          </p>
        </div>
        <Link href="/host" className="btn-primary self-start sm:self-auto">
          + Host an event
        </Link>
      </div>

      <div className="mt-6">
        <Suspense fallback={null}>
          <EventsTabs />
        </Suspense>
      </div>

      {!forYou && !searchParams.state && (
        <div className="mt-5">
          <LocationMatch />
        </div>
      )}

      {!error && feedEvents.length > 0 && (
        <div className="mt-5">
          <EventsStories
            events={feedEvents.slice(0, 12).map((e) => ({
              id: e.id,
              title: e.title,
              category: e.category,
              cover_image_url: e.cover_image_url,
            }))}
          />
        </div>
      )}

      {!forYou && (
        <div className="mt-6 space-y-4">
          <Suspense fallback={null}>
            <EventsFilters />
          </Suspense>
        </div>
      )}

      {!error && feedEvents.length > 0 && (
        <div className="mt-4">
          <EventsMapToggle
            events={feedEvents.map((e) => ({
              id: e.id,
              title: e.title,
              state: e.state,
              category: e.category,
              date: e.date,
            }))}
          />
        </div>
      )}

      {error ? (
        <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          Could not load events: {error.message}.
        </p>
      ) : forYou && feedEvents.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          We don&apos;t have enough signal to recommend events yet. Join a few
          and check back!
        </p>
      ) : (
        <>
          <div className="mt-6">
            <EventsList
              events={feedEvents}
              stateFilter={searchParams.state}
              trendingIds={trendingIds}
              recommendedAll={forYou}
              hostBadgesByHost={hostBadgesByHost}
              friendsGoing={friendsGoing}
            />
          </div>

          {!forYou && totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-center gap-3"
              aria-label="Pagination"
            >
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn-outline py-2">
                  ← Previous
                </Link>
              ) : (
                <span className="btn-outline cursor-not-allowed py-2 opacity-40">
                  ← Previous
                </span>
              )}
              <span className="text-sm font-semibold text-gray-600">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="btn-outline py-2">
                  Next →
                </Link>
              ) : (
                <span className="btn-outline cursor-not-allowed py-2 opacity-40">
                  Next →
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
