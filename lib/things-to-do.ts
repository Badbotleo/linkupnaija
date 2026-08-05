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
  /** Upcoming link-ups already happening in this category — filled in by
      buildIdeas. "Host it" is a big ask; if someone else is already doing
      it this week, joining is the smaller, likelier step. */
  liveCount?: number;
  liveHref?: string;
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
  Camping: { title: "Camping trip", category: "Camping", seed: "Camping at" },
  "Event Centres": { title: "Throw something", category: "Party", seed: "Party at" },
  "Art Galleries": { title: "Gallery wander", category: "Art Gallery", seed: "Gallery visit to" },
  "Amusement Parks": { title: "Theme park day", category: "Entertainment", seed: "Theme park day at" },
  Golf: { title: "Round of golf", category: "Outdoor", seed: "Golf at" },
  Swimming: { title: "Swim session", category: "Pool Party", seed: "Swim at" },
  Malls: { title: "Mall link-up", category: "Friend Reunion", seed: "Link up at" },
  Arcades: { title: "Arcade showdown", category: "Game Night", seed: "Arcade night at" },
};

/** How many upcoming link-ups exist per category, so a card can offer
    "join" instead of only "host". */
const getLiveCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select("category, state")
      .eq("event_type", "general")
      .gte("date", today)
      .limit(500);
    if (error) return {};
    const out: Record<string, number> = {};
    for (const e of (data ?? []) as { category: string; state: string | null }[]) {
      out[e.category] = (out[e.category] ?? 0) + 1;
      if (e.state) out[`${e.category}|${e.state}`] = (out[`${e.category}|${e.state}`] ?? 0) + 1;
    }
    return out;
  },
  ["things-to-do-live-counts"],
  { revalidate: 300 }
);

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
  const [curated, fromVenues, live] = await Promise.all([
    getCuratedIdeas().catch(() => [] as Idea[]),
    getVenueIdeas().catch(() => [] as Idea[]),
    getLiveCounts().catch(() => ({}) as Record<string, number>),
  ]);

  // Their own state first — a picnic in Lagos is no use to someone in Kano.
  const ranked = state
    ? [...fromVenues].sort(
        (a, b) => (a.state === state ? 0 : 1) - (b.state === state ? 0 : 1)
      )
    : fromVenues;

  const seen = new Map<string, number>();
  const take = (list: Idea[], max: number) => {
    const out: Idea[] = [];
    for (const idea of list) {
      if (out.length >= max) break;
      const n = seen.get(idea.title) ?? 0;
      if (n >= perActivityCap) continue;
      seen.set(idea.title, n + 1);
      out.push(idea);
    }
    return out;
  };

  // Curated used to win outright, so with 19 curated cards and an 8-card
  // shelf no real venue ever surfaced — no restaurants, no parks, no bars.
  // Each source gets half the shelf, then whatever's left is topped up from
  // either, so a thin day still fills.
  const half = Math.max(1, Math.floor(limit / 2));
  const pickedCurated = take(curated, half);
  const pickedVenues = take(ranked, limit - pickedCurated.length);
  const varied = [
    ...pickedCurated,
    ...pickedVenues,
    ...take(curated, limit),
    ...take(ranked, limit),
  ];

  return [
    ...varied,
    ...GENERIC.map((g) => ({
      ...g,
      mediaType: "image" as const,
      state: state ?? null,
    })),
  ]
    .slice(0, limit)
    .map((idea) => {
      // Prefer a count for their own state; fall back to nationwide.
      const local = idea.state ? live[`${idea.category}|${idea.state}`] : 0;
      const n = local || live[idea.category] || 0;
      if (!n) return idea;
      const qs = new URLSearchParams({ category: idea.category });
      if (idea.state && local) qs.set("state", idea.state);
      return { ...idea, liveCount: n, liveHref: `/events?${qs.toString()}` };
    });
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
