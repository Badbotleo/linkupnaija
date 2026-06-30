import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventsFilters from "@/components/EventsFilters";
import EventsList from "@/components/EventsList";
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

// How many events we load per page. Keeps the query and the payload bounded
// instead of fetching the entire events table on every visit.
const PAGE_SIZE = 24;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { state?: string; category?: string; page?: string };
}) {
  const supabase = createClient();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const today = new Date().toISOString().slice(0, 10);

  // `count: "exact"` returns the total matching rows alongside the ranged
  // page, so a single query drives both the feed and the pager.
  let query = supabase
    .from("events")
    .select(
      "*, rsvps(status), host:users!events_host_id_fkey(rating_avg, rating_count)",
      { count: "exact" }
    )
    .eq("event_type", "general")
    .gte("date", today);

  if (searchParams.state) query = query.eq("state", searchParams.state);
  if (searchParams.category)
    query = query.eq("category", searchParams.category);

  const { data, error, count } = await query
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .range(from, to);

  const events = (data ?? []) as unknown as FeedEvent[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const acceptedCount = (e: FeedEvent) =>
    e.rsvps.filter((r) => r.status === "accepted").length;

  const now = Date.now();
  const activeFeatured = (e: FeedEvent) =>
    e.featured && !!e.featured_until && new Date(e.featured_until).getTime() > now;

  // Boosted events (within their 48h window) float to the top of the page.
  const sorted = [...events].sort((a, b) => {
    const fa = activeFeatured(a) ? 1 : 0;
    const fb = activeFeatured(b) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return 0; // preserve the date ordering from the query
  });

  const feedEvents = sorted.map((e) => ({
    ...e,
    attendeeCount: acceptedCount(e),
    hostRating: e.host
      ? { avg: e.host.rating_avg, count: e.host.rating_count }
      : null,
  }));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams.state) params.set("state", searchParams.state);
    if (searchParams.category) params.set("category", searchParams.category);
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

      <div className="mt-8 space-y-4">
        <Suspense fallback={null}>
          <EventsFilters />
        </Suspense>
      </div>

      {error ? (
        <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          Could not load events: {error.message}. Did you run the SQL schema and
          set your Supabase env vars?
        </p>
      ) : (
        <>
          <div className="mt-6">
            <EventsList events={feedEvents} stateFilter={searchParams.state} />
          </div>

          {totalPages > 1 && (
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
