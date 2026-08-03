import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

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

export interface Idea {
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
export const GENERIC: Omit<Idea, "state" | "mediaType">[] = [
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
      .limit(24);

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


/**
 * Build the shelf: curated first, then real venues, then evergreen ideas.
 *
 * `perActivity` caps repeats — with eight parks onboarded the shelf otherwise
 * reads "Picnic in the park" eight times. The full page passes a higher cap
 * because there, seeing every park IS the point.
 */
export async function buildIdeas(
  state: string | null | undefined,
  { limit = 8, perActivityCap = 2 }: { limit?: number; perActivityCap?: number } = {}
): Promise<Idea[]> {
  // Each source degrades on its own: a broken curated table still leaves the
  // venue ideas, and a broken venues query still leaves the evergreen ones.
  const [curated, fromVenues] = await Promise.all([
    getCuratedIdeas().catch(() => [] as Idea[]),
    getVenueIdeas().catch(() => [] as Idea[]),
  ]);

  // Their own state first — a picnic in Lagos is no use to someone in Kano.
  const ranked = state
    ? [...fromVenues].sort(
        (a, b) => (a.state === state ? 0 : 1) - (b.state === state ? 0 : 1)
      )
    : fromVenues;

  const seen = new Map<string, number>();
  const varied = [...curated, ...ranked].filter((idea) => {
    const n = seen.get(idea.title) ?? 0;
    if (n >= perActivityCap) return false;
    seen.set(idea.title, n + 1);
    return true;
  });

  return [
    ...varied,
    ...GENERIC.map((g) => ({
      ...g,
      mediaType: "image" as const,
      state: state ?? null,
    })),
  ].slice(0, limit);
}

/** The /host link an idea should open, with the vibe and spot filled in. */
export function hostHref(idea: Idea): string {
  const params = new URLSearchParams({
    category: idea.category,
    title: idea.seedTitle,
  });
  if (idea.place && !idea.place.startsWith("A ") && idea.place !== "The waterfront") {
    params.set("location", idea.place);
  }
  if (idea.state) params.set("state", idea.state);
  return `/host?${params.toString()}`;
}
