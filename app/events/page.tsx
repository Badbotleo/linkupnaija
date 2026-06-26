import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventsFilters from "@/components/EventsFilters";
import EventsList from "@/components/EventsList";
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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { state?: string; category?: string };
}) {
  const supabase = createClient();

  let query = supabase
    .from("events")
    .select(
      "*, rsvps(status), host:users!events_host_id_fkey(rating_avg, rating_count)"
    )
    .eq("event_type", "general")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (searchParams.state) query = query.eq("state", searchParams.state);
  if (searchParams.category)
    query = query.eq("category", searchParams.category);

  const { data, error } = await query;
  const events = (data ?? []) as unknown as FeedEvent[];

  const acceptedCount = (e: FeedEvent) =>
    e.rsvps.filter((r) => r.status === "accepted").length;

  const now = Date.now();
  const activeFeatured = (e: FeedEvent) =>
    e.featured && !!e.featured_until && new Date(e.featured_until).getTime() > now;

  // Boosted events (within their 48h window) float to the top of the feed.
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

  return (
    <div className="container-page py-10">
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
        <div className="mt-6">
          <EventsList events={feedEvents} />
        </div>
      )}
    </div>
  );
}
