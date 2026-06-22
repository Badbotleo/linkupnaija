import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventsFilters from "@/components/EventsFilters";
import EventCard from "@/components/EventCard";
import type { EventWithCount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { state?: string; category?: string };
}) {
  const supabase = createClient();

  let query = supabase
    .from("events")
    .select("*, rsvps(count)")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (searchParams.state) query = query.eq("state", searchParams.state);
  if (searchParams.category)
    query = query.eq("category", searchParams.category);

  const { data, error } = await query;
  const events = (data ?? []) as unknown as EventWithCount[];

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

      <div className="mt-8">
        <Suspense fallback={null}>
          <EventsFilters />
        </Suspense>
      </div>

      {error && (
        <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          Could not load events: {error.message}. Did you run the SQL schema and
          set your Supabase env vars?
        </p>
      )}

      {!error && events.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <p className="text-4xl">🗓️</p>
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            No events match your filters yet
          </h2>
          <p className="mt-1 text-gray-500">
            Try a different state or category — or be the first to host one!
          </p>
          <Link href="/host" className="btn-primary mt-6">
            Host an event
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
