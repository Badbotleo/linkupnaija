import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { getVisitorState } from "@/lib/visitor-geo";
import { scopeState } from "@/lib/geo-scope";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventsFilters from "@/components/EventsFilters";
import EventsList from "@/components/EventsList";
import { dedupeEvents } from "@/lib/content-guards";
import {
  filterByKind,
  shouldFilterByKind,
  professionalCategoriesFilter,
} from "@/lib/event-kind";
import EventsMapToggle from "@/components/events/EventsMapToggle";
import EventsTabs from "@/components/EventsTabs";
import SearchPill from "@/components/events/SearchPill";
import FeaturedCarousel from "@/components/events/FeaturedCarousel";
import EventsStories from "@/components/EventsStories";
import LocationMatch from "@/components/LocationMatch";
import { computeBadges, type Badge } from "@/lib/hostBadges";
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

/**
 * Events pinned to the top of "Been and gone", in this order.
 *
 * The past tab is sorted newest-first, which is right for a feed and wrong
 * for a shop window: the best-documented nights — the ones with real photos
 * and a recap worth scrolling — sink as soon as anything newer happens. These
 * two are the showcase, so they stay first regardless of date.
 *
 * Fetched separately and prepended, not sorted within the page, or they'd
 * only appear once pagination happened to reach them.
 *
 * To change the showcase, change these ids.
 */
const PINNED_PAST = [
  "ad7c044a-2833-4120-88d9-27079a96c448", // DenimFest
  "b21c7b91-d465-436d-9430-1b9c3031b4b1", // 🍖 Kilishi Festival
] as const;

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
    q?: string;
    /** "all" opts out of the automatic state scope. */
    scope?: string;
  };
}) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const forYou = searchParams.tab === "foryou" && !!user;
  // "Been and gone" — link-ups that already happened. People kept asking
  // where an event went the day after; it went nowhere, it just fell off a
  // feed that only ever looked forwards.
  const past = searchParams.tab === "past";
  const visitorState = getVisitorState();
  // Set when a state scope found nothing and we widened to the whole country.
  let scopeRelaxed = false;
  // The state the feed narrowed to, if any — needed at render to say so.
  let autoScope: string | null = null;
  // Professional events stay reachable, just not in the default feed.
  const work = searchParams.tab === "work";

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
    // "For you" is a recommendation feed, so it follows the same default:
    // hangouts unless they asked otherwise. Filtered in JS because this
    // branch isn't paginated.
    feedEvents = filterByKind(
      candidates,
      work ? "professional" : shouldFilterByKind(searchParams) ? "hangout" : null
    )
      .sort((a, b) => score(b) - score(a))
      .slice(0, 24);
  } else {
    // --- Standard paginated feed --------------------------------------------
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("events")
      .select(SELECT, { count: "exact" })
      .eq("event_type", "general");
    query = past ? query.lt("date", today) : query.gte("date", today);
    // Pinned events are fetched separately below; excluding them here stops
    // the same card rendering twice on page one.
    if (past && page === 1) {
      query = query.not("id", "in", `(${PINNED_PAST.join(",")})`);
    }
    if (searchParams.state) query = query.eq("state", searchParams.state);

    // Scope a dense state to itself. A Lagos visitor seeing an Abuja party is
    // being shown something they can't attend, and with 34 of 69 upcoming
    // events in Abuja that was most of the feed. Only applies where the state
    // can carry a feed on its own — see lib/geo-scope.
    const autoState = scopeState({
      visitorState,
      explicitState: searchParams.state,
      query: searchParams.q,
      // An explicit "everywhere" survives navigation; without it the link out
      // of the scope would just re-scope on the next render.
      showAll: searchParams.scope === "all",
    });
    autoScope = autoState;
    if (autoState) query = query.eq("state", autoState);
    if (searchParams.category) query = query.eq("category", searchParams.category);
    if (searchParams.q?.trim()) {
      // Searched server-side rather than filtering the current page, so a
      // search reaches every event and not just the 24 already loaded.
      // Commas and parens would break PostgREST's or() syntax.
      const term = searchParams.q.trim().replace(/[(),]/g, " ");
      query = query.or(
        `title.ilike.%${term}%,location.ilike.%${term}%,description.ilike.%${term}%`
      );
    }
    if (searchParams.series === "1") query = query.not("series_id", "is", null);

    // --- Hangouts vs professional -------------------------------------------
    // The default feed is hangouts. 19 of 53 upcoming events were conferences,
    // summits and expos filed under "Networking", which is not what the
    // homepage promised anyone. Applied in SQL so the paginated count stays
    // right; skipped entirely when the viewer asked for something specific.
    if (work) {
      query = query.or(
        `category.in.${professionalCategoriesFilter()},is_corporate.eq.true`
      );
    } else if (shouldFilterByKind(searchParams)) {
      query = query
        .not("category", "in", professionalCategoriesFilter())
        .or("is_corporate.is.null,is_corporate.eq.false");
    }

    // Past events read newest-first; upcoming read soonest-first.
    let { data, error: e, count } = await query
      .order("date", { ascending: !past })
      .order("time", { ascending: !past })
      .range(from, to);
    error = e;

    // Quiet week: scoping found nothing, so drop the scope rather than show an
    // empty app. A Lagos visitor with no Lagos events this week is better
    // served by the rest of the country than by a blank page — and the banner
    // below says which they're looking at, so it never silently pretends
    // these are local.
    //
    // Rebuilt from scratch rather than mutated: a PostgREST filter can't be
    // removed from a query once it's on.
    if (autoState && !e && (count ?? 0) === 0) {
      scopeRelaxed = true;
      let wide = supabase
        .from("events")
        .select(SELECT, { count: "exact" })
        .eq("event_type", "general");
      wide = past ? wide.lt("date", today) : wide.gte("date", today);
      if (searchParams.category) wide = wide.eq("category", searchParams.category);
      if (searchParams.series === "1") wide = wide.not("series_id", "is", null);
      if (work) {
        wide = wide.or(
          `category.in.${professionalCategoriesFilter()},is_corporate.eq.true`
        );
      } else if (shouldFilterByKind(searchParams)) {
        wide = wide
          .not("category", "in", professionalCategoriesFilter())
          .or("is_corporate.is.null,is_corporate.eq.false");
      }
      ({ data, error: e, count } = await wide
        .order("date", { ascending: !past })
        .order("time", { ascending: !past })
        .range(from, to));
      error = e;
    }

    totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

    const now = Date.now();
    const activeFeatured = (ev: FeedEvent) =>
      ev.featured && !!ev.featured_until && new Date(ev.featured_until).getTime() > now;
    let rows = ((data ?? []) as unknown as FeedEvent[])
      .sort((a, b) => (activeFeatured(b) ? 1 : 0) - (activeFeatured(a) ? 1 : 0));

    // The showcase, first and in order, on page one only.
    if (past && page === 1) {
      const { data: pinnedRows } = await supabase
        .from("events")
        .select(SELECT)
        .in("id", PINNED_PAST as unknown as string[]);
      const byId = new Map(
        ((pinnedRows ?? []) as unknown as FeedEvent[]).map((e) => [e.id, e])
      );
      // Ordered by the list, not by whatever order Postgres returned, and
      // silently skipped if an id no longer exists.
      const pinned = PINNED_PAST.map((id) => byId.get(id)).filter(
        (e): e is FeedEvent => !!e
      );
      rows = [...pinned, ...rows];
    }

    feedEvents = rows.map(decorate);
  }

  // Two identical rows can exist in the database — a host double-submitting
  // produced two "Cocktails and Chow Festival 2.0" listings 15 minutes apart,
  // and an import run twice produced three of one film festival. The host
  // form now refuses the second write, but that does nothing for rows already
  // there, so the feed collapses them on the way out.
  feedEvents = dedupeEvents(feedEvents);

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
        .select("event_id, users!rsvps_user_id_fkey(name, avatar_url)")
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

  // --- Header pill destinations --------------------------------------------
  // Each pill offers the opposite of what you are currently looking at, and
  // carries the rest of the query with it so tapping one never silently drops
  // a search or a category.
  const withParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams();
    if (searchParams.state) params.set("state", searchParams.state);
    if (searchParams.category) params.set("category", searchParams.category);
    if (searchParams.q?.trim()) params.set("q", searchParams.q.trim());
    if (searchParams.series === "1") params.set("series", "1");
    if (searchParams.tab) params.set("tab", searchParams.tab);
    if (searchParams.scope === "all") params.set("scope", "all");
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  // An explicit state clears; an automatic one widens to everywhere. With
  // neither there is nothing to undo, so the pill opens the state picker
  // rather than being a tap that does nothing.
  const placeHref = searchParams.state
    ? withParams((p) => p.delete("state"))
    : autoScope
      ? withParams((p) => p.set("scope", "all"))
      : "#state";

  const tabHref = withParams((p) =>
    past ? p.delete("tab") : p.set("tab", "past")
  );

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
    <div>
      {/* Status, not a tagline.
          This used to carry "Parties, hangouts and everything buzzing near
          you", which is marketing copy under a page title: the exact web-hero
          shape AppHeader exists to avoid, and a line that says the same thing
          on every visit whatever the feed holds. The pills say where the feed
          is scoped and which tab is open, which is information the screen
          cannot otherwise give and which changes as you use it. */}
      <AppHeader
        title={"Events"}
        meta={[
          {
            icon: "pin",
            label: searchParams.state ?? autoScope ?? "All Nigeria",
            href: placeHref,
          },
          past
            ? { icon: "clock", label: "Been and gone", href: tabHref }
            : { icon: "calendar", label: "Upcoming", href: tabHref },
        ]}
        action={<Link href="/host" className="btn-primary rounded-full px-4 py-2 text-sm">Host</Link>}
      />

      <div className="container-page py-5">

      {/* Search leads the page, the way it does on Pinterest — one wide pill
          with nothing competing beside it. */}
      <Suspense fallback={null}>
        <SearchPill />
      </Suspense>

      <div className="mt-5">
        <Suspense fallback={null}>
          <EventsTabs />
        </Suspense>
      </div>

      {!forYou && !searchParams.state && (
        <div className="mt-5">
          {/* Doubles as the "what is this site" line for anyone who landed
              here from a TikTok link without seeing the home page. */}
          <LocationMatch intro={!user} />
        </div>
      )}

      {/* Say which set of events this is.

          Scoping to a state and then quietly widening when it's empty would
          mean a Lagos visitor scrolling through Abuja parties believing they
          were local. Either way the strip is one line and it names the place. */}
      {autoScope && (
        <div className="container-page mt-4">
          <p className="flex items-center gap-2 text-[13px] text-gray-500">
            <LineIcon name="pin" size={13} className="shrink-0 text-gray-400" />
            {scopeRelaxed ? (
              <>
                Nothing in <span className="font-bold text-gray-700">{autoScope}</span>{" "}
                this week — showing link-ups across Nigeria.
              </>
            ) : (
              <>
                Showing link-ups in{" "}
                <span className="font-bold text-gray-700">{autoScope}</span>.{" "}
                <Link href="/events?scope=all" className="font-bold text-brand hover:underline">
                  See everywhere
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {!error && !past && !searchParams.q?.trim() && feedEvents.length > 0 && (
        <FeaturedCarousel
          events={feedEvents.slice(0, 5).map((e) => ({
            id: e.id,
            title: e.title,
            category: e.category,
            date: e.date,
            location: e.location,
            state: e.state,
            cover_image_url: e.cover_image_url,
          }))}
        />
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
        <div className="mt-8 space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-gray-500">
              Explore by vibe
            </p>
            <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900">
              Link-ups you might like
            </h2>
          </div>
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
      ) : searchParams.q?.trim() && feedEvents.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-4xl">🔍</p>
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            Nothing for &ldquo;{searchParams.q.trim()}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Try a vibe instead — or start it yourself.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/events" className="btn-outline">
              Clear search
            </Link>
            <Link href="/host" className="btn-primary">
              Host it
            </Link>
          </div>
        </div>
      ) : past && feedEvents.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-4xl">🕰️</p>
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            Nothing behind you yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Link-ups show up here the day after they happen.
          </p>
          <Link href="/events" className="btn-primary mt-5">
            See what&apos;s coming up
          </Link>
        </div>
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
    </div>
  );
}
