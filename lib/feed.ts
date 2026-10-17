import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { FriendUser } from "./types";
import { categoriesForInterests } from "./constants";
import { dedupeEvents } from "./content-guards";
import { getRecapsFor, type Recap } from "./recaps";

/**
 * One ranked column, the way a feed-shaped product builds a home page.
 *
 * The shelved home page (LoggedInHome) makes one editorial decision for all
 * 300 members: Featured above Picked for you above Happening in Lagos. That
 * ordering is a guess, and it is the same guess for everybody. This builds a
 * single list instead and sorts it per person, so a member with two friends
 * going to a party on Friday sees that party first and a member with none
 * sees whatever is soonest in their state.
 *
 * WHAT THIS IS NOT. There is no model here and there shouldn't be. Ranking
 * learns from interactions, and 108 lifetime RSVPs across 39 upcoming events
 * is not a training set, it is a rounding error. So the score below is a
 * hand-written sort with weights you can read, argue with and change in one
 * line. At this inventory that is not a compromise: sorting 13 Lagos events
 * well beats ranking them badly, and when there are 300 a week the shape here
 * is already right and only the weights need to move.
 *
 * THE ONE REAL EDGE. `friends` on a unit. Who else is going outperforms
 * category, cover photo and price put together, and nothing on the current
 * home page shows it anywhere. If this experiment wins, that is why.
 */

export interface FeedEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string | null;
  location: string;
  state: string | null;
  price: number | null;
  cover_image_url: string | null;
  is_listing: boolean | null;
  organiser_name: string | null;
}

export interface MetPerson {
  id: string;
  name: string | null;
  avatar_url: string | null;
  /** One night you were both at, for the second line. */
  sharedTitle: string;
  /** How many you have shared. Ranks them. */
  shared: number;
}

export type FeedUnit =
  | { kind: "signup"; variant: "first" | "second" }
  | { kind: "people"; people: MetPerson[] }
  | {
      kind: "event";
      event: FeedEvent;
      /** Accepted friends with an accepted RSVP. The headline signal. */
      friends: FriendUser[];
      /** Why this is here, in the member's own terms. */
      reason: string;
      /** Their relationship to it, when they already have one. */
      mine: "going" | "hosting" | null;
    }
  | { kind: "stories"; recaps: Recap[] }
  | { kind: "circle"; circle: FeedCircle }
  | { kind: "venue"; venues: FeedVenue[] }
  | { kind: "ideas" }
  | { kind: "rate" };

export interface FeedCircle {
  id: string;
  name: string;
  category: string | null;
  state: string | null;
  member_count: number;
  cover_image_url: string | null;
}

export interface FeedVenue {
  id: string;
  name: string;
  category: string;
  state: string | null;
  image_url: string | null;
}

export interface FeedResult {
  firstName: string;
  state: string | null;
  units: FeedUnit[];
  /** Shown under the composer so the page can be argued about with numbers. */
  debug: {
    candidates: number;
    withFriends: number;
    friendCount: number;
    inState: number;
  };
}

export interface VisitorFeedResult {
  /** The state the column is scoped to, chosen or guessed. */
  state: string | null;
  /** Every state with something on, biggest first, for the picker. */
  places: { state: string; n: number }[];
  /** Everything upcoming, which is what the headline counts. */
  total: number;
  /** How many of them this column actually renders. */
  shown: number;
  units: FeedUnit[];
}

/** A column is a first impression, not a catalogue. /events is the catalogue. */
const VISITOR_PAGE = 20;

/**
 * The logged-out column.
 *
 * Meta's logged-out home is a login box, because their front door is never
 * the home page: it is a shared post, an invite, a tagged photo, and each one
 * is its own landing page. Ours is the same shape. People arrive on an event
 * page from a WhatsApp link, so `/` does not have to carry the whole pitch.
 *
 * What it does have to do is prove, in the first screen, that something is
 * actually happening near the person reading. So: no slogan, no tour, no
 * testimonials. A count, a place picker, and the real list. The account is
 * asked for twice on the way down, both times at the moment it would buy
 * something specific, never as a toll gate on arrival.
 */
/**
 * The logged-out column's data, cached.
 *
 * Nothing in it varies by visitor: the same upcoming events are fetched for
 * everybody and the place filter is applied in memory afterwards. So it runs
 * on the anon key through unstable_cache rather than on the request's own
 * client, and the home page stops making two round trips per anonymous hit
 * on the busiest page we have.
 *
 * Five minutes. An event added now is on the home page before anybody has
 * finished telling their friends about it.
 */
const getVisitorEvents = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: rows }, { data: featuredRows }] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, category, date, time, location, state, price, cover_image_url, is_listing, organiser_name"
        )
        .eq("event_type", "general")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(60),
      supabase
        .from("events")
        .select("id")
        .eq("featured", true)
        .gt("featured_until", new Date().toISOString())
        .gte("date", today),
    ]);

    return {
      rows: (rows ?? []) as FeedEvent[],
      featured: ((featuredRows ?? []) as { id: string }[]).map((r) => r.id),
    };
  },
  ["visitor-feed-events"],
  { revalidate: 300 }
);

export async function buildVisitorFeed(
  guessedState: string | null,
  chosenState: string | null
): Promise<VisitorFeedResult> {
  const { rows, featured } = await getVisitorEvents();

  const all = dedupeEvents(rows);
  const featuredIds = new Set(featured);

  const counts = new Map<string, number>();
  for (const e of all) {
    if (!e.state) continue;
    counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
  }
  // Array.from rather than a spread: the tsconfig target here predates
  // iterating a Map directly.
  const places = Array.from(counts.entries())
    .map(([state, n]) => ({ state, n }))
    .sort((a, b) => b.n - a.n || a.state.localeCompare(b.state));

  // A chosen place wins. A guessed one only counts if there is anything on
  // there, because scoping someone to an empty state to be clever about
  // their IP is worse than showing them the whole country.
  const state =
    chosenState && counts.has(chosenState)
      ? chosenState
      : guessedState && counts.has(guessedState)
        ? guessedState
        : null;

  const ranked = [...all].sort((a, b) => {
    const sa = state && a.state === state ? 0 : 1;
    const sb = state && b.state === state ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const fa = featuredIds.has(a.id) ? 0 : 1;
    const fb = featuredIds.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.date.localeCompare(b.date);
  });

  // Scoped to a state the column is short anyway; across the country it is
  // 39 full-width cards and 39 cover images, which is a catalogue rather than
  // a first impression. The headline still counts all of them and /events
  // still holds all of them.
  const sorted = ranked.slice(0, VISITOR_PAGE);

  const recaps = await getRecapsFor(state, 12);

  const units: FeedUnit[] = [];
  if (recaps.length > 0) units.push({ kind: "stories", recaps });

  if (sorted.length === 0) {
    units.push({ kind: "ideas" });
  } else {
    sorted.forEach((event, i) => {
      const days = daysUntil(event.date);
      const inState = !!state && event.state === state;
      const reason = inState
        ? days <= 0
          ? `In ${event.state}, today`
          : days === 1
            ? `In ${event.state}, tomorrow`
            : `In ${event.state}, ${days} days away`
        : featuredIds.has(event.id)
          ? "Featured this week"
          : event.state
            ? `In ${event.state}`
            : "Coming up on LinkUpNaija";
      units.push({ kind: "event", event, friends: [], reason, mine: null });
      // Asked after enough has been shown to be worth keeping, and again at
      // the point someone has read the lot.
      if (i === 2) units.push({ kind: "signup", variant: "first" });
      if (i === 8) units.push({ kind: "signup", variant: "second" });
    });
    units.push({ kind: "ideas" });
  }

  return { state, places, total: all.length, shown: sorted.length, units };
}

function daysUntil(date: string): number {
  const d = new Date(`${date}T00:00:00`).getTime();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  return Math.round((d - today) / 86_400_000);
}

/**
 * "Tobi and 2 others are going."
 *
 * Exported because the event page says the same thing about the same people,
 * and two places phrasing it differently is how a product starts to feel like
 * several products. First names only: a guest list is not a register.
 */
export function friendsLine(names: (string | null | undefined)[]): string {
  const first = names.map((n) => n?.split(" ")[0]).filter(Boolean);
  if (first.length === 0) return "";
  if (first.length === 1) return `${first[0]} is going`;
  if (first.length === 2) return `${first[0]} and ${first[1]} are going`;
  return `${first[0]} and ${first.length - 1} others are going`;
}

function firstNames(friends: FriendUser[]): string {
  return friendsLine(friends.map((f) => f.name));
}

export async function buildFeed(
  supabase: SupabaseClient,
  userId: string
): Promise<FeedResult> {
  const today = new Date().toISOString().slice(0, 10);

  const EVENT_COLS =
    "id, title, category, date, time, location, state, price, cover_image_url, is_listing, organiser_name";

  const [
    { data: profile },
    { data: rsvpRows },
    { data: hostingRows },
    { data: connRows },
    { data: candidateRows },
    { data: featuredRows },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("name, state, interests")
      .eq("id", userId)
      .single(),
    supabase
      .from("rsvps")
      .select(`events(${EVENT_COLS})`)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .gte("events.date", today)
      .limit(10),
    supabase
      .from("events")
      .select(EVENT_COLS)
      .eq("host_id", userId)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(6),
    supabase
      .from("connections")
      // Status comes back rather than being filtered out. Accepted rows give
      // the friend signal; every row, whatever its status, has to be
      // excluded from "people you met", because suggesting somebody you
      // already asked is worse than suggesting nobody.
      .select("requester_id, receiver_id, status")
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
    // One query for the whole column. 60 is more than the platform currently
    // holds, so in practice this is every upcoming event, which is the point:
    // at this size ranking is sorting, and sorting wants the full set.
    supabase
      .from("events")
      .select(EVENT_COLS)
      .eq("event_type", "general")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(60),
    supabase
      .from("events")
      .select("id")
      .eq("featured", true)
      .gt("featured_until", new Date().toISOString())
      .gte("date", today),
  ]);

  const state = profile?.state ?? null;
  const firstName = profile?.name?.split(" ")[0] ?? "there";

  // Yours, pinned. Hosting first so a host never has to hunt for their own
  // night, then by date.
  const joined = ((rsvpRows ?? []) as unknown as { events: FeedEvent | null }[])
    .map((r) => r.events)
    .filter(Boolean) as FeedEvent[];
  const hosting = (hostingRows ?? []) as FeedEvent[];
  const hostingIds = new Set(hosting.map((e) => e.id));
  const mineSeen = new Set<string>();
  const mine = [...hosting, ...joined]
    .filter((e) => (mineSeen.has(e.id) ? false : (mineSeen.add(e.id), true)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const allConns = (connRows ?? []) as {
    requester_id: string;
    receiver_id: string;
    status: string;
  }[];
  const other = (c: { requester_id: string; receiver_id: string }) =>
    c.requester_id === userId ? c.receiver_id : c.requester_id;

  const friendIds = allConns
    .filter((c) => c.status === "accepted")
    .map(other);
  /** Anybody already connected, asked, or asking. Never suggested. */
  const spokenFor = new Set(allConns.map(other));

  // event_id -> the friends going to it.
  const friendsByEvent = new Map<string, FriendUser[]>();
  if (friendIds.length > 0) {
    const [{ data: friendRsvps }, { data: friendUsers }] = await Promise.all([
      supabase
        .from("rsvps")
        .select("event_id, user_id")
        .eq("status", "accepted")
        .in("user_id", friendIds),
      supabase
        .from("users")
        .select("id, name, avatar_url, state")
        .in("id", friendIds),
    ]);
    const byId = new Map(
      ((friendUsers ?? []) as FriendUser[]).map((u) => [u.id, u])
    );
    for (const r of (friendRsvps ?? []) as {
      event_id: string;
      user_id: string;
    }[]) {
      const u = byId.get(r.user_id);
      if (!u) continue;
      const list = friendsByEvent.get(r.event_id) ?? [];
      // A friend can hold more than one RSVP row to the same event.
      if (!list.some((f) => f.id === u.id)) list.push(u);
      friendsByEvent.set(r.event_id, list);
    }
  }

  const featuredIds = new Set(
    ((featuredRows ?? []) as { id: string }[]).map((r) => r.id)
  );
  const interestCats = new Set<string>(
    categoriesForInterests(profile?.interests ?? [])
  );

  const candidates = dedupeEvents(
    ((candidateRows ?? []) as FeedEvent[]).filter((e) => !mineSeen.has(e.id))
  );

  const scored = candidates
    .map((event) => {
      const friends = friendsByEvent.get(event.id) ?? [];
      const days = daysUntil(event.date);
      const sameState = !!state && event.state === state;
      const onTaste = interestCats.has(event.category);

      // Weights, in the order they matter. Someone you know going is worth
      // more than everything else on the card combined, which is the whole
      // bet of this layout.
      let score = 0;
      if (friends.length > 0) score += 120 + Math.min(friends.length, 5) * 20;
      if (sameState) score += 45;
      if (onTaste) score += 30;
      if (featuredIds.has(event.id)) score += 25;
      // Soon beats later, but only inside a month. Beyond that the date stops
      // being a reason to look now.
      score += Math.max(0, 30 - Math.max(days, 0)) * 2;
      // A listing is somebody else's night that we merely carry. Worth
      // showing, worth showing second.
      if (event.is_listing) score -= 8;

      const reason = friends.length
        ? firstNames(friends)
        : onTaste && sameState
          ? `${event.category} in ${event.state}, your kind of thing`
          : sameState
            ? days <= 1
              ? `In ${event.state}, ${days <= 0 ? "today" : "tomorrow"}`
              : `In ${event.state}, ${days} days away`
            : onTaste
              ? `Matches your taste for ${event.category}`
              : featuredIds.has(event.id)
                ? "Featured this week"
                : "Coming up on LinkUpNaija";

      return { event, friends, reason, score };
    })
    .sort((a, b) => b.score - a.score || a.event.date.localeCompare(b.event.date));

  // The supporting units. One circle and one venue, not a shelf of eight:
  // in a single column a suggestion is a card like any other, and eight of
  // them in a row is the shelf problem again.
  const [{ data: memberRows }, { data: circleRows }, { data: venueRows }] =
    await Promise.all([
      supabase.from("circle_members").select("circle_id").eq("user_id", userId),
      supabase
        .from("circles")
        .select("id, name, category, state, member_count, cover_image_url")
        .eq("is_private", false)
        .order("member_count", { ascending: false })
        .limit(12),
      supabase
        .from("venues")
        .select("id, name, category, state, image_url")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .limit(12),
    ]);

  const myCircles = new Set(
    ((memberRows ?? []) as { circle_id: string }[]).map((r) => r.circle_id)
  );
  const circlePool = ((circleRows ?? []) as FeedCircle[]).filter(
    (c) => !myCircles.has(c.id)
  );
  const circle =
    circlePool.find((c) => state && c.state === state) ?? circlePool[0] ?? null;

  // SEVERAL, NOT ONE.
  //
  // This unit was a single venue in a 56px thumbnail with a chevron, which
  // is a button wearing a card's clothes: it said "reserve through us" and
  // showed almost nothing you could want to reserve. The venues are the
  // argument, so the unit carries a swipeable row of them, nearest state
  // first and featured within that.
  const venuePool = (venueRows ?? []) as FeedVenue[];
  const venues = [...venuePool]
    .sort((a, b) => {
      const sa = state && a.state === state ? 0 : 1;
      const sb = state && b.state === state ? 0 : 1;
      return sa - sb;
    })
    .slice(0, 8);

  // PEOPLE YOU WERE IN A ROOM WITH.
  //
  // This exists on /friends already and almost nobody opens /friends. The
  // platform's bottleneck is that members have no connections, which leaves
  // the friend row on every card, the faces on every circle and half the
  // ranking of this feed with nothing to draw. A suggestion behind a tab
  // does not fix that; a suggestion in the feed might.
  //
  // Built from accepted RSVPs on both sides, so every name here is somebody
  // who was actually at the same link-up. Ranked by how many you have
  // shared, so the person you keep running into comes first.
  let metPeople: MetPerson[] = [];
  {
    const myEventIds = Array.from(mineSeen);
    const attendedIds = (
      (rsvpRows ?? []) as unknown as { events: FeedEvent | null }[]
    )
      .map((r) => r.events?.id)
      .filter(Boolean) as string[];
    const pool = Array.from(new Set([...myEventIds, ...attendedIds]));

    if (pool.length > 0) {
      const { data: others } = await supabase
        .from("rsvps")
        .select("user_id, event_id")
        .eq("status", "accepted")
        .in("event_id", pool)
        .neq("user_id", userId);

      const tally = new Map<string, { n: number; eventId: string }>();
      for (const r of (others ?? []) as {
        user_id: string;
        event_id: string;
      }[]) {
        if (spokenFor.has(r.user_id)) continue;
        const cur = tally.get(r.user_id);
        if (cur) cur.n += 1;
        else tally.set(r.user_id, { n: 1, eventId: r.event_id });
      }

      const top = Array.from(tally.entries())
        .sort((a, b) => b[1].n - a[1].n)
        .slice(0, 3);

      if (top.length > 0) {
        const ids = top.map(([id]) => id);
        const eventIds = Array.from(new Set(top.map(([, v]) => v.eventId)));
        const [{ data: users }, { data: evs }] = await Promise.all([
          supabase
            .from("users")
            .select("id, name, avatar_url")
            .in("id", ids),
          supabase.from("events").select("id, title").in("id", eventIds),
        ]);
        const byUser = new Map(
          ((users ?? []) as { id: string; name: string | null; avatar_url: string | null }[]).map(
            (u) => [u.id, u]
          )
        );
        const byEvent = new Map(
          ((evs ?? []) as { id: string; title: string }[]).map((e) => [e.id, e.title])
        );
        metPeople = top
          .map(([id, v]) => {
            const u = byUser.get(id);
            if (!u) return null;
            return {
              id,
              name: u.name,
              avatar_url: u.avatar_url,
              sharedTitle: byEvent.get(v.eventId) ?? "a link-up",
              shared: v.n,
            } satisfies MetPerson;
          })
          .filter((p): p is MetPerson => !!p);
      }
    }
  }

  const recaps = await getRecapsFor(state, 12);

  // Assembly. Stories first because they are the only moving thing we own,
  // then yours, then the ranked column with the supporting units dropped in
  // at fixed depths so there is always something different a screen away.
  const units: FeedUnit[] = [];
  if (recaps.length > 0) units.push({ kind: "stories", recaps });

  for (const e of mine) {
    units.push({
      kind: "event",
      event: e,
      friends: friendsByEvent.get(e.id) ?? [],
      reason: hostingIds.has(e.id) ? "You're hosting this" : "You said yes",
      mine: hostingIds.has(e.id) ? "hosting" : "going",
    });
  }

  // A feed that announces its own emptiness is the one thing Meta would never
  // ship. With nothing to rank, the ideas shelf moves to the top and becomes
  // the feed rather than the apology at the end of it.
  if (scored.length === 0) {
    units.push({ kind: "ideas" });
  } else {
    scored.forEach((s, i) => {
      units.push({ kind: "event", event: s.event, friends: s.friends, reason: s.reason, mine: null });
      // People first, and high. Connections are what the friend row, the
      // circle faces and half of this ranking are all waiting on, so the one
      // unit that creates them outranks the chore and the two suggestions.
      if (i === 1 && metPeople.length > 0)
        units.push({ kind: "people", people: metPeople });
      if (i === 3) units.push({ kind: "rate" });
      if (i === 5 && circle) units.push({ kind: "circle", circle });
      if (i === 8 && venues.length > 0)
        units.push({ kind: "venue", venues });
    });
    units.push({ kind: "ideas" });
  }

  return {
    firstName,
    state,
    units,
    debug: {
      candidates: candidates.length,
      withFriends: scored.filter((s) => s.friends.length > 0).length,
      friendCount: friendIds.length,
      inState: candidates.filter((e) => !!state && e.state === state).length,
    },
  };
}
