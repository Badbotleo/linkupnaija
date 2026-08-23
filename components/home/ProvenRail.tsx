import Link from "next/link";
import Rail from "./Rail";
import EventCover from "@/components/EventCover";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { formatEventDate } from "@/lib/format";
import { professionalCategoriesFilter } from "@/lib/event-kind";

/**
 * Upcoming events from hosts who have already been rated well.
 *
 * The site collects reviews and then only shows them once you've opened a
 * host's profile, which is the last place a stranger looks. Turning them into
 * a browsing surface is the point of collecting them: it answers "is this
 * person any good" before anyone has to ask.
 *
 * Renders nothing below a real threshold. A "proven" shelf populated by a
 * host with one five-star review from their friend is worse than no shelf —
 * it teaches people the badge means nothing.
 */
const MIN_REVIEWS = 3;
const MIN_RATING = 4;

export interface ProvenEvent {
  id: string;
  title: string;
  category: string;
  state: string | null;
  date: string;
  cover_image_url: string | null;
  host: { name: string | null; rating_avg: number | null; rating_count: number | null } | null;
}

const getProven = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("events")
      .select(
        "id, title, category, state, date, cover_image_url, host:users!events_host_id_fkey(name, rating_avg, rating_count)"
      )
      .eq("event_type", "general")
      .gte("date", today)
      .not("category", "in", professionalCategoriesFilter())
      .order("date", { ascending: true })
      .limit(60);

    // Filtered here rather than in SQL: the rating lives on the embedded host
    // row, and PostgREST can't order or filter a parent by an embedded column
    // without a view. Sixty rows is nothing to sift in memory.
    return ((data ?? []) as unknown as ProvenEvent[])
      .filter(
        (e) =>
          (e.host?.rating_count ?? 0) >= MIN_REVIEWS &&
          (e.host?.rating_avg ?? 0) >= MIN_RATING
      )
      .sort((a, b) => (b.host?.rating_avg ?? 0) - (a.host?.rating_avg ?? 0))
      .slice(0, 8);
  },
  ["homepage-proven-events"],
  { revalidate: 300 }
);

export default async function ProvenRail() {
  const events = await getProven();
  // Fewer than four and it's a gap in a grid rather than a shelf.
  if (events.length < 4) return null;

  return (
    <Rail
      title="From hosts people rate"
      subtitle="Upcoming link-ups from hosts with a track record"
      href="/hosts/leaderboard"
      seeAll="Top hosts"
    >
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="group w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px] lg:w-full lg:max-w-none"
        >
          <div className="relative h-[176px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            <EventCover
              url={e.cover_image_url}
              category={e.category}
              title={e.title}
              className="absolute inset-0 h-full w-full"
              fit="cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

            {/* The rating is the reason this card is here, so it leads. */}
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#FAC775] px-2.5 py-1 text-[11px] font-black text-[#121212]">
              <LineIcon name="star" size={11} filled />
              {(e.host?.rating_avg ?? 0).toFixed(1)}
              <span className="font-bold opacity-70">
                ({e.host?.rating_count ?? 0})
              </span>
            </span>

            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
              <p className="line-clamp-2 text-[16px] font-extrabold leading-tight">
                {e.title}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-white/75">
                {formatEventDate(e.date)}
                {e.state ? ` · ${e.state}` : ""}
              </p>
              {e.host?.name && (
                <p className="mt-0.5 truncate text-[11px] text-white/55">
                  Hosted by {e.host.name}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </Rail>
  );
}
