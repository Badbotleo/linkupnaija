import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import Rail from "./Rail";
import LineIcon from "../ui/LineIcon";

/**
 * "Things to do this week" — the bridge between browsing and hosting.
 *
 * Someone with nothing on their calendar won't tap "Host an event": that's a
 * blank form and a lot of decisions. An idea with a real place attached is a
 * much smaller ask, so every card lands on /host with the vibe, the spot and
 * a starting title already filled in.
 *
 * Partner venues come first because those are places we can actually book.
 */

interface Idea {
  /** "image" cards use <img>; "video" cards autoplay muted inline. */
  mediaType: "image" | "video";
  key: string;
  /** What you'd do. */
  title: string;
  /** Where. */
  place: string;
  category: string;
  image: string;
  state: string | null;
  /** Pre-written event title, so the host form opens part-done. */
  seedTitle: string;
  /** Who shot the media, shown small on the card. */
  credit?: string | null;
  creditUrl?: string | null;
}

// Fallbacks when we have no partner venue for a slot. Each one is a real thing
// people do in a group, not a venue type dressed up as an activity.
const GENERIC: Omit<Idea, "state" | "mediaType">[] = [
  { key: "g-picnic", title: "Sunday picnic", place: "A park near you", category: "Picnic", image: "/venues/parks.jpg", seedTitle: "Sunday picnic — bring a blanket" },
  { key: "g-grill", title: "Long table dinner", place: "A restaurant", category: "Dinner", image: "/venues/restaurants.jpg", seedTitle: "Long table dinner" },
  { key: "g-club", title: "Friday night out", place: "A club or lounge", category: "Clubbing", image: "/venues/clubs.jpg", seedTitle: "Friday night out" },
  { key: "g-beach", title: "Beach day", place: "The waterfront", category: "Beach Day", image: "/venues/beaches.jpg", seedTitle: "Beach day with the gang" },
  { key: "g-bowl", title: "Bowling showdown", place: "A bowling alley", category: "Bowling", image: "/venues/bowling.jpg", seedTitle: "Bowling showdown" },
  { key: "g-cinema", title: "Cinema night", place: "A cinema", category: "Cinema", image: "/venues/cinemas.jpg", seedTitle: "Cinema night" },
];

/** An activity that fits each venue category — the venue is the where, not the what. */
const ACTIVITY: Record<string, { title: string; category: string; seed: string }> = {
  Parks: { title: "Picnic in the park", category: "Picnic", seed: "Picnic at" },
  Restaurants: { title: "Group dinner", category: "Dinner", seed: "Dinner at" },
  Clubs: { title: "Night out", category: "Clubbing", seed: "Night out at" },
  Bars: { title: "Drinks after work", category: "Rooftop Party", seed: "Drinks at" },
  Cinemas: { title: "Cinema night", category: "Cinema", seed: "Cinema night at" },
  Bowling: { title: "Bowling showdown", category: "Bowling", seed: "Bowling at" },
  Karaoke: { title: "Karaoke night", category: "Karaoke", seed: "Karaoke at" },
  Beaches: { title: "Beach day", category: "Beach Day", seed: "Beach day at" },
  Gyms: { title: "Workout together", category: "Fitness", seed: "Workout at" },
  Museums: { title: "Gallery wander", category: "Art Gallery", seed: "Gallery visit to" },
  Hotels: { title: "Pool day", category: "Pool Party", seed: "Pool day at" },
  Stadiums: { title: "Match day", category: "Sports Viewing", seed: "Match day at" },
};

/** Admin-curated cards. These win over anything we derive ourselves. */
const getCuratedIdeas = unstable_cache(
  async (): Promise<Idea[]> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from("things_to_do")
      .select("id, title, place, category, state, seed_title, media_url, media_type, credit, credit_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(12);

    // Throw rather than return []: unstable_cache caches return values, so a
    // single failed request would otherwise pin an empty shelf in place for
    // the whole revalidate window. Thrown errors are not cached.
    if (error) throw new Error(`things_to_do: ${error.message}`);

    return ((data ?? []) as {
      id: string;
      title: string;
      place: string | null;
      category: string;
      state: string | null;
      seed_title: string | null;
      media_url: string | null;
      media_type: string | null;
      credit: string | null;
      credit_url: string | null;
    }[]).map((r) => ({
      key: r.id,
      title: r.title,
      place: r.place ?? "",
      category: r.category,
      image: r.media_url ?? "/venues/restaurants.jpg",
      mediaType: r.media_type === "video" ? "video" : "image",
      state: r.state,
      seedTitle: r.seed_title ?? r.title,
      credit: r.credit,
      creditUrl: r.credit_url,
    }));
  },
  ["things-to-do-curated"],
  { revalidate: 120 }
);

const getVenueIdeas = unstable_cache(
  async (): Promise<Idea[]> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, category, state, image_url")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .limit(8);

    // Same reason as above — never cache a failure.
    if (error) throw new Error(`venues: ${error.message}`);

    return ((data ?? []) as {
      id: string;
      name: string;
      category: string;
      state: string | null;
      image_url: string | null;
    }[])
      .map((v) => {
        const a = ACTIVITY[v.category];
        if (!a) return null;
        return {
          key: v.id,
          title: a.title,
          place: v.name,
          category: a.category,
          image: v.image_url ?? "/venues/restaurants.jpg",
          mediaType: "image" as const,
          state: v.state,
          seedTitle: `${a.seed} ${v.name}`,
        } satisfies Idea;
      })
      .filter(Boolean) as Idea[];
  },
  ["things-to-do-venues"],
  { revalidate: 300 }
);

export default async function ThingsToDo({ state }: { state?: string | null }) {
  // Each source degrades on its own: a broken curated table still leaves the
  // venue ideas, and a broken venues query still leaves the evergreen ones.
  const [curated, fromVenues] = await Promise.all([
    getCuratedIdeas().catch(() => [] as Idea[]),
    getVenueIdeas().catch(() => [] as Idea[]),
  ]);

  // Their own state first — a picnic in Lagos is no use to someone in Kano.
  const ranked = state
    ? [...fromVenues].sort((a, b) =>
        (a.state === state ? 0 : 1) - (b.state === state ? 0 : 1)
      )
    : fromVenues;

  // Curated first, then real venues, then the evergreen ideas — so the shelf
  // is never empty, but an admin's picks always lead.
  //
  // Capped at two per activity: we have eight parks onboarded, and without
  // this the whole shelf reads "Picnic in the park" eight times.
  const perActivity = new Map<string, number>();
  const varied = [...curated, ...ranked].filter((idea) => {
    const n = perActivity.get(idea.title) ?? 0;
    if (n >= 2) return false;
    perActivity.set(idea.title, n + 1);
    return true;
  });

  const ideas: Idea[] = [
    ...varied,
    ...GENERIC.map((g) => ({
      ...g,
      mediaType: "image" as const,
      state: state ?? null,
    })),
  ].slice(0, 8);

  if (ideas.length === 0) return null;

  return (
    <Rail
      title="Things to do this week"
      auto
      subtitle="Pick one, bring your people — you're the host"
      href="/venues"
      seeAll="All spots"
    >
      {ideas.map((idea) => {
        const params = new URLSearchParams({
          category: idea.category,
          title: idea.seedTitle,
        });
        if (idea.place && !idea.place.startsWith("A ") && idea.place !== "The waterfront") {
          params.set("location", idea.place);
        }
        if (idea.state) params.set("state", idea.state);

        return (
          <Link
            key={idea.key}
            href={`/host?${params.toString()}`}
            className="group w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px]"
          >
            <div className="relative h-[176px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
              {idea.mediaType === "video" ? (
                /* Muted + playsInline is what lets it autoplay on iOS at all;
                   without both, Safari shows a paused black frame. */
                <video
                  src={idea.image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={idea.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/35 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                <p className="text-[17px] font-extrabold leading-tight">
                  {idea.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/70">
                  {idea.place}
                </p>
                {idea.credit && (
                  <p className="mt-1 truncate text-[10px] text-white/45">
                    {idea.mediaType === "video" ? "🎬" : "📷"} {idea.credit}
                  </p>
                )}
                <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-gray-900">
                  <LineIcon name="mic" size={12} />
                  Host it
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </Rail>
  );
}
