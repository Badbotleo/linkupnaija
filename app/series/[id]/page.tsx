import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import Avatar from "@/components/Avatar";
import SeriesSubscribeButton from "@/components/series/SeriesSubscribeButton";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { frequencyLabel } from "@/lib/series";
import type { EventRow, EventSeries, SeriesFrequency } from "@/lib/types";

export const dynamic = "force-dynamic";

type SeriesWithHost = EventSeries & {
  host: { id: string; name: string | null; avatar_url: string | null; state: string | null } | null;
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data } = await supabase
    .from("event_series")
    .select("title")
    .eq("id", params.id)
    .single();
  return { title: data?.title ?? "Series" };
}

export default async function SeriesPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: seriesRow } = await supabase
    .from("event_series")
    .select(
      "*, host:users!event_series_host_id_fkey(id, name, avatar_url, state)"
    )
    .eq("id", params.id)
    .single();

  if (!seriesRow) notFound();
  const series = seriesRow as unknown as SeriesWithHost;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: eventRows }, subRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, category, state, location, date, time, cover_image_url")
      .eq("series_id", params.id)
      .order("date", { ascending: true }),
    user
      ? supabase
          .from("series_subscriptions")
          .select("id")
          .eq("series_id", params.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const events = (eventRows ?? []) as Pick<
    EventRow,
    "id" | "title" | "category" | "state" | "location" | "date" | "time" | "cover_image_url"
  >[];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today);
  const isSubscribed = !!(subRes.data as { id: string } | null);

  // First photo per past event (gated by RLS to host/attendees).
  const pastThumbs = new Map<string, string>();
  if (past.length) {
    const { data: photos } = await supabase
      .from("event_photos")
      .select("event_id, photo_url, created_at")
      .in(
        "event_id",
        past.map((e) => e.id)
      )
      .order("created_at", { ascending: true });
    for (const p of (photos ?? []) as { event_id: string; photo_url: string }[]) {
      if (!pastThumbs.has(p.event_id)) pastThumbs.set(p.event_id, p.photo_url);
    }
  }

  return (
    <div className="container-page py-10">
      <Link
        href="/events"
        className="text-sm font-medium text-gray-500 hover:text-brand"
      >
        ← Back to events
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl shadow-card">
            <EventCover
              url={series.cover_image_url}
              category={series.category ?? "Networking"}
              title={series.title}
              className="h-52 w-full sm:h-64"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
              🔄 {frequencyLabel(series.frequency as SeriesFrequency)} series
            </span>
            {series.state && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                📍 {series.state}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {series.title}
          </h1>
          {series.description && (
            <p className="mt-3 whitespace-pre-line text-gray-600">
              {series.description}
            </p>
          )}

          {/* Upcoming */}
          <h2 className="mt-8 text-lg font-bold text-gray-900">
            Upcoming events ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No upcoming events scheduled right now. Check back soon!
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {upcoming.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
                >
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-32 w-full"
                  />
                  <div className="p-4">
                    <p className="font-bold text-gray-900">{e.title}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      📅 {formatEventDate(e.date)} · {formatEventTime(e.time)}
                    </p>
                    <p className="text-sm text-gray-400">📍 {e.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-bold text-gray-900">
                Past events ({past.length})
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {past.map((e) => {
                  const thumb = pastThumbs.get(e.id);
                  return (
                    <Link
                      key={e.id}
                      href={`/events/${e.id}`}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:border-brand/30"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={e.title}
                          className="h-28 w-full object-cover"
                        />
                      ) : (
                        <EventCover
                          url={e.cover_image_url}
                          category={e.category}
                          title={e.title}
                          className="h-28 w-full opacity-80"
                        />
                      )}
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {e.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatEventDate(e.date)}
                          {thumb ? " · 📸 photos" : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
            <SeriesSubscribeButton
              seriesId={series.id}
              isLoggedIn={!!user}
              initialSubscribed={isSubscribed}
              initialCount={series.subscriber_count}
            />

            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">Hosted by</p>
              <div className="mt-2 flex items-center gap-3">
                <Avatar
                  name={series.host?.name ?? null}
                  url={series.host?.avatar_url ?? null}
                  size="md"
                />
                <div>
                  <p className="font-bold text-gray-900">
                    {series.host?.name ?? "A LinkUpNaija host"}
                  </p>
                  {series.host?.state && (
                    <p className="text-sm text-gray-500">{series.host.state}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
