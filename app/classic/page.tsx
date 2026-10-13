import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import EventCover from "@/components/EventCover";
import { formatEventDate } from "@/lib/format";
import LoggedInHome from "@/components/home/LoggedInHome";
import Rail from "@/components/home/Rail";
import SwipeDeck from "@/components/home/SwipeDeck";
import FeaturedRail from "@/components/home/FeaturedRail";
import ThingsToDo from "@/components/home/ThingsToDo";
import CollabCard from "@/components/home/CollabCard";
import ProvenRail from "@/components/home/ProvenRail";
import ScreenTour from "@/components/home/ScreenTour";
import LineIcon from "@/components/ui/LineIcon";
import { categoryIcon } from "@/lib/category-icons";
import NaijaFlag from "@/components/ui/NaijaFlag";
import { dedupeEvents } from "@/lib/content-guards";
import { professionalCategoriesFilter } from "@/lib/event-kind";
import { LogoMark } from "@/components/Logo";
import { getSessionUser } from "@/lib/supabase/auth";
import { getVisitorState } from "@/lib/visitor-geo";
import { scopeState } from "@/lib/geo-scope";

/**
 * THE OLD HOME PAGE, KEPT.
 *
 * This was `/` until the feed replaced it: a marketing landing page for
 * visitors and twelve shelves for members. It is parked here whole, routes
 * and all, so the change is one line to undo rather than a trip through the
 * history, and so the two can still be put side by side.
 *
 * Not indexed, and nothing links to it. Delete it once the feed has been
 * live long enough to trust.
 */
export const metadata = {
  title: "LinkUpNaija",
  robots: { index: false, follow: false },
};

// Vibes our core audience actually searches for, leading the chip row.
const TOP_CATEGORIES = [
  "Party", "Game Night", "Beach Day", "Concert", "Clubbing",
  "Dinner", "Hiking", "Karaoke", "Bowling", "Pool Party",
];


// What the platform actually does for you — the marketing, delivered as cards
// in a shelf rather than a full-screen pitch section.
const PROMISES = [
  { icon: "shield", title: "Hosts approve every guest", text: "No randos. You see who's coming before you go." },
  { icon: "ticket", title: "Your ticket is a QR code", text: "Pay in-app, get scanned at the door. No printouts." },
  { icon: "chat", title: "Group chat before you arrive", text: "Every link-up has one, so you never pull up cold." },
  { icon: "users", title: "Built around your taste", text: "Pick what you're into and the feed shapes itself." },
  // The two questions that follow every "yes, I'll come": where, and how do I
  // get there. They had their own shelves on the old page; as promises they
  // do more work in less space.
  { icon: "pin", title: "Book the spot too", text: "Clubs, rooftops and restaurants you can reserve in-app." },
  { icon: "car", title: "Get there and back", text: "Hail a ride to the link-up without leaving the app." },
];

const cache = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );




/**
 * The live number behind the claim in the hero.
 *
 * A bold line with nothing under it is a slogan, and a visitor discounts it
 * on sight. This counts what is genuinely on, right now, with the same
 * filters the shelves use — so the boast and the shelves can never disagree.
 *
 * Counted separately because getUpcomingEvents caps at 12 for the shelves;
 * using that length would have quietly claimed "12" forever.
 */
const getSupplyProof = unstable_cache(
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await cache()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "general")
      .gte("date", today)
      .not("category", "in", professionalCategoriesFilter());

    // Same filter as the count above, or the two numbers describe different
    // sets: the hero reads "68 link-ups ... live in 8 states", which is only
    // true if those are the SAME 68. Without this, a state whose only
    // upcoming events are professional ones inflated the state count.
    const { data: states } = await cache()
      .from("events")
      .select("state")
      .eq("event_type", "general")
      .gte("date", today)
      .not("category", "in", professionalCategoriesFilter())
      .not("state", "is", null);

    const distinct = new Set((states ?? []).map((s: { state: string }) => s.state));
    return { count: count ?? 0, states: distinct.size };
  },
  ["home-supply-proof"],
  { revalidate: 600 }
);

/**
 * How many link-ups are on, where the visitor is, in the next few days.
 *
 * WHY THIS REPLACED THE SLOGAN. The hero used to read "This weekend, you're
 * going out," under a second tagline saying much the same thing. Two
 * promises stacked, neither telling anybody what was actually on, and the
 * white-line-then-accent-line shape is the house style of every generated
 * landing page — which is what somebody meant when they said the site looked
 * AI-ish. A real count cannot be generated, changes every week, and proves
 * the place is alive instead of claiming it.
 *
 * SCOPED THE SAME WAY THE FEED IS. A Lagos visitor is told about Lagos,
 * because a national number includes events they cannot reach, which is the
 * exact mistake lib/geo-scope.ts exists to prevent. Outside the dense states
 * it counts the country, because scoping Plateau to Plateau would print a
 * confident zero.
 *
 * IT WIDENS RATHER THAN PRINTS A SAD NUMBER. A count run on a Sunday night
 * finds almost nothing, and "2 link-ups this weekend" argues against us. So
 * it tries the weekend, then the fortnight, then the month, and the label
 * says which one it answered. The first version stopped at a fortnight and
 * printed 6 nationally, which was true and sold us short: there are forty
 * upcoming, they are just not all in the next two weeks.
 */
const getHeroCount = unstable_cache(
  async (state: string | null) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Sunday of the current week, in whole days, so a Wednesday visitor is
    // told about the weekend ahead and a Saturday visitor about today.
    const toSunday = (7 - now.getDay()) % 7;
    const sunday = new Date(now.getTime() + toSunday * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const fortnight = new Date(now.getTime() + 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);


    const count = async (until: string) => {
      // Everything, deliberately. The shelves below exclude professional
      // listings because a first-time visitor who opens on a conference has
      // misread what this is, but the headline is a count of what is on,
      // and a conference is a thing that is on.
      let q = cache()
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("date", today)
        .lte("date", until);
      if (state) q = q.eq("state", state);
      const { count: n } = await q;
      return n ?? 0;
    };

    const weekend = await count(sunday);
    if (weekend >= 3) return { n: weekend, window: "this weekend" };
    const soon = await count(fortnight);
    if (soon >= 8) return { n: soon, window: "in the next two weeks" };
    const month = new Date(now.getTime() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { n: await count(month), window: "in the next month" };
  },
  ["home-hero-count"],
  { revalidate: 600 }
);

// Real upcoming events fill the shelves — the page leads with what's actually
// on, not with a pitch about what could be on.
const getUpcomingEvents = unstable_cache(
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await cache()
      .from("events")
      .select("id, title, category, state, location, date, price, cover_image_url")
      .eq("event_type", "general")
      .gte("date", today)
      // Hangouts only. The visitor home page promises parties, beach days and
      // game nights, and then opened with a conference — the single loudest
      // way to tell a first-time visitor they've misread what this is. The
      // professional listings still exist, still rank, and still have their
      // own tab; they just don't get the shop window.
      //
      // Excluded in SQL rather than after the fetch, so `limit` returns 12
      // hangouts instead of 12 rows that might contain four.
      .not("category", "in", professionalCategoriesFilter())
      .order("date", { ascending: true })
      .limit(12);
    // Duplicate rows exist in the table; never show the same listing twice.
    return dedupeEvents(data ?? []);
  },
  ["homepage-upcoming-events"],
  { revalidate: 300 }
);


interface EventRow {
  id: string;
  title: string;
  category: string;
  state: string | null;
  location: string | null;
  date: string;
  price: number | null;
  cover_image_url: string | null;
}

const CARD =
  // Fixed 268px is the phone card. In a desktop grid it has to fill its cell,
  // or four cards sit in a row leaving the rest of the shelf empty.
  "w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px] lg:w-full lg:max-w-none";


// Decks carry their own heading — Rail draws one, SwipeDeck deliberately
// doesn't, so it can be dropped anywhere.
function DeckHeading({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href?: string;
}) {
  return (
    <div className="container-page mt-7 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
          {title}
        </h2>
        <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p>
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 whitespace-nowrap text-sm font-bold text-brand transition hover:opacity-70"
        >
          See all
          <LineIcon name="chevronRight" size={13} className="ml-0.5 inline align-[-1px]" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  // Signed-in members get a personalised home instead of re-reading the pitch.
  const user = await getSessionUser();
  if (user) return <LoggedInHome userId={user.id} />;

  // One query now. The visitor page used to fetch series, circles and partner
  // venues as well, for shelves that no longer exist — three round trips per
  // load for data nobody saw.
  const upcoming = (await getUpcomingEvents()) as EventRow[];
  const supply = await getSupplyProof();

  // The featured slot is for something the visitor could actually turn up to.
  // FC26 is an Abuja event, so it only runs for Abuja; everyone else gets the
  // soonest link-up in their own state. When the edge can't place someone
  // (local dev, VPN, non-Vercel host) we show neither rather than defaulting
  // to "everyone sees Abuja" — that's the behaviour this replaces.
  const visitorState = getVisitorState();
  // The same scoping rule the feed uses, so the number and the shelves below
  // it are describing the same place.
  const heroState = scopeState({ visitorState });
  const hero = await getHeroCount(heroState);
  const heroPlace =
    heroState === "FCT - Abuja" ? "Abuja" : (heroState ?? "Nigeria");
  // Always a real link-up now. FC26 used to take this slot for Abuja, which
  // meant the most prominent card on the homepage advertised one tournament
  // instead of the thing the product is for. It still has its own page, its
  // menu entry and a shelf card — it just doesn't own the hero.
  const localFeature =
    (visitorState ? upcoming.find((e) => e.state === visitorState) : null) ??
    upcoming[0] ??
    null;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Top: who we are in one line, then straight into search + browsing */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-page pt-6">
        {/* Tracking is tighter than the label this replaced, and the flag
            aligns to the first line rather than the block. The old text was
            three short words; a full sentence at 0.2em wrapped and left
            "CONNECTIONS." hanging on its own under the flag. */}
        <p className="flex items-start gap-2 text-[11px] font-black uppercase leading-[1.45] tracking-[0.09em] text-brand">
          {/* Was three divs, and the middle one was `bg-white` — which the
              global .dark layer repaints along with every other white surface,
              so the stripe went black in dark mode. NaijaFlag paints #FFFFFF
              into an SVG, where no utility override can reach it. */}
          <span className="mt-[3px] shrink-0">
            <NaijaFlag size={12} />
          </span>
          Find your people. Build real connections.
        </p>

        {/* The hero is a pitch board, so it has to name the real scarcity.
            Two earlier attempts named the wrong one.

            "Find your people." was positioning, not a hook — it could be a
            dating app, a church or a recruiter. "Raves and book clubs." was
            merchandising: it says what is in the shop, not why anyone walks
            in. Both describe US.

            Nobody in Lagos or Abuja lacks events. The city is drowning in
            them. What people lack is somebody to go with, which is why a good
            flyer still ends with staying home. That is the scarcity this
            product actually removes, so that is the line — in the words
            somebody would really use, not "companionship" or "connection".

            The group chat is the proof and it goes directly underneath. It is
            the one detail that makes the promise credible instead of warm:
            you have already spoken to the room before you walk into it. */}
        <h1 className="mt-2 text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] text-gray-900 sm:text-[38px]">
          <span className="text-brand">{hero.n}</span> link-ups in {heroPlace}
          <br />
          {hero.window}.
        </h1>

        {/* Safety is third: the reason to trust the offer, which only matters
            once there is an offer worth trusting. Still the one thing a
            ticketing site structurally cannot say. */}
        <p className="mt-1.5 flex max-w-lg items-start gap-2 text-[15px] leading-relaxed text-gray-500">
          <span className="mt-0.5 shrink-0 text-brand">
            <LineIcon name="shield" size={15} />
          </span>
          <span>
            The host approves every guest, so it&apos;s never a room full of
            randos.
            {supply.states > 1 && <> Live in {supply.states} states.</>}
          </span>
        </p>

        {/* Search opens the explore screen, the way tapping search in an app does */}
        <Link
          href="/events"
          className="mt-4 flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-400 shadow-card transition hover:border-brand/40"
        >
          <LineIcon name="search" size={18} className="shrink-0 text-gray-400" />
          Search link-ups near you
        </Link>
      </section>

      {/* Category chips */}
      <div className="no-scrollbar mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8">
        {TOP_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/events?category=${encodeURIComponent(c)}`}
            className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-brand hover:text-brand"
          >
            {/* Our own glyph, not an emoji. Emoji standing in for an icon
                set is the loudest signal that nobody designed a thing, and
                these chips are the first UI a stranger sees. */}
            <LineIcon name={categoryIcon(c)} size={15} className="shrink-0 opacity-70" />
            {c}
          </Link>
        ))}
        <Link
          href="/events"
          className="shrink-0 snap-start whitespace-nowrap rounded-full bg-gray-900 px-3.5 py-2 text-sm font-bold text-white"
        >
          All vibes
        </Link>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Featured — location aware                                         */}
      {/* ---------------------------------------------------------------- */}

      {/* Not in Abuja — feature the soonest thing happening where they are. */}
      {localFeature && (
        <section className="container-page mt-6">
          <Link
            href={`/events/${localFeature.id}`}
            className="group relative block min-h-[210px] overflow-hidden rounded-3xl text-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:min-h-[240px]"
          >
            {/* Poster beside the words, not behind them.

                Nigerian hosts upload flyers that already carry the title, time,
                venue and price burned into the artwork. Laying our text over
                that printed two sets of the same information on top of each
                other — the hero read as a mistake, on the one screen most
                likely to end up in a screenshot or a video. Giving the poster
                its own panel means it stays intact and our text stays legible,
                and the block is the same shape for every event instead of
                depending on how busy someone's flyer is. */}
            <div className="relative flex min-h-[210px] bg-[#120B2E] sm:min-h-[240px]">
              <div className="relative w-[38%] shrink-0 overflow-hidden sm:w-[34%]">
                <EventCover
                  url={localFeature.cover_image_url}
                  category={localFeature.category}
                  title={localFeature.title}
                  className="h-full w-full transition duration-300 group-hover:scale-105"
                />
                {/* A short fade into the panel so the two halves read as one
                    card rather than a photo glued to a box. */}
                <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-[#120B2E]" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-6">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FAC775] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#121212]">
                  <NaijaFlag size={10} />
                  Near you in {visitorState}
                </span>
                <h2 className="mt-2.5 line-clamp-2 text-[19px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[26px]">
                  {localFeature.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/70 sm:text-[15px]">
                  {formatEventDate(localFeature.date)}
                  {localFeature.location ? ` · ${localFeature.location}` : ""}
                </p>
                <span className="mt-1 text-[13px] font-bold text-[#FAC775] sm:text-[15px]">
                  {localFeature.price && localFeature.price > 0
                    ? `₦${localFeature.price.toLocaleString("en-NG")}`
                    : "Free to join"}
                </span>
                <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-black text-gray-900 sm:px-5 sm:py-2.5 sm:text-sm">
                  See the link-up
                  <LineIcon name="chevronRight" size={14} />
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Boosted events, directly under the one near you.
          Hosts pay ₦5,000 for this placement, so it belongs with the other
          event content at the top rather than seven sections down. */}
      <FeaturedRail />

      {/* Real events lead. Working backwards found sentence 1 failing: 8
          events on this page and none visible without scrolling, because a
          shelf of ideas and a product explainer came first. "Open the app and
          you see what's on near you this week" has to be literally true. */}
      <Rail
        title="Happening soon"
        auto
        subtitle={
          upcoming.length > 0
            ? "Real link-ups you can join today"
            : "Nothing on the calendar yet. Start something"
        }
        href="/events"
      >
        {/* A content-led home is thin when there's no content, so the empty
            case sells hosting rather than leaving a gap. */}
        {upcoming.length === 0 && (
          <Link href="/host" className={`${CARD} group`}>
            <div className="flex h-[188px] flex-col justify-end rounded-2xl border border-dashed border-brand/30 bg-brand-50 p-4 transition group-hover:border-brand/60">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand shadow-sm">
                <LineIcon name="mic" size={19} />
              </span>
              <p className="mt-3 font-extrabold leading-snug text-gray-900">
                Host the first one
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                Set it up in two minutes and your people get notified.
              </p>
            </div>
          </Link>
        )}
        {upcoming.slice(0, 8).map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className={`${CARD} group`}>
              <div className="overflow-hidden rounded-2xl bg-white shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <div className="relative">
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-36 w-full"
                  />
                  <span
                    className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-black backdrop-blur ${
                      e.price && e.price > 0
                        ? "bg-[#FFFFFF]/92 text-[#1f2937]"
                        : "bg-naija text-white"
                    }`}
                  >
                    {e.price && e.price > 0 ? `₦${e.price.toLocaleString("en-NG")}` : "Free"}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate font-bold text-gray-900 group-hover:text-brand">
                    {e.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {formatEventDate(e.date)}
                    {e.location ? ` · ${e.location}` : e.state ? ` · ${e.state}` : ""}
                  </p>
                </div>
              </div>
            </Link>
        ))}
      </Rail>

      {/* Places to go, for the visitor who is not ready to ask a stranger
          for permission to attend their party.

          Everything else on this site costs something before it gives
          anything: an account, a request, a host's approval, sometimes money.
          This costs a read. On a page converting at 2.4% that gap is the
          whole argument, and until now a logged-out visitor never saw this
          shelf at all, because it rendered only inside LoggedInHome.

          It is also the answer to the query the structured data was aimed at.
          "Things to do in Lagos this weekend" is a search for PLACES, and
          organic sends under a hundred sessions a month against TikTok's
          eleven hundred.

          BELOW the events rail, not above it. Ideas led this page once and
          were moved down because eight events existed and none were visible
          without scrolling. That finding still holds: real link-ups lead, and
          this sits directly under them rather than in front. */}
      <ThingsToDo state={visitorState} />

      {/* The running collaboration, now shown to visitors as well.
          It rendered only inside LoggedInHome, which meant a partner we had
          agreed to promote was visible to members and invisible to the 1,800
          people a month who arrive without an account. A partnership nobody
          outside the app can see is not worth much to the partner.

          Same position as on the logged-in home, under Things to do and above
          Featured, so both pages read in one order. Renders nothing at all
          when no collab is running, which is most weeks. */}
      <CollabCard />


      {/* ProvenRail removed on 7 Sep 2026. It was a THIRD shelf of upcoming
          events, after the featured rail and "Happening soon", differing only
          by how its hosts were rated. Three rails of the same listings is
          most of why this page felt scattered. The component stays in the
          repo; the reviews it surfaced are still on each host's profile. */}

      {/* Real listings, not invented ones — the demo shows the same events the
          rails above are showing. */}
      <ScreenTour events={upcoming.slice(0, 6)} />

      {/* The "Why LinkUpNaija" swipe deck went on 7 Sep 2026. It sat
          directly under the phone demo and made the same argument in words
          that the demo makes by showing you the app, so the page explained
          itself twice in a row before asking for anything. The demo is the
          better half and it stays. */}

      {/* ---------------------------------------------------------------- */}
      {/* Closing action                                                    */}
      {/* ---------------------------------------------------------------- */}
      {/* Was a dark gradient band with glow orbs — the same treatment as the
          FC26 card, and the most website-like thing left on the page. An app
          asks once, plainly, on the same surface as everything else. */}
      <section className="container-page mt-10">
        <div className="surface p-6 text-center sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50">
            <LogoMark size={34} />
          </span>

          <h2 className="mt-4 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900 sm:text-[26px]">
            Find your people this week
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-gray-600">
            Free to join, and the host approves every guest, so you always know
            who you&apos;re pulling up with.
          </p>

          <Link
            href="/signup"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-brand-600 sm:w-auto sm:px-10"
          >
            Create a free account
          </Link>

          <p className="mt-3 text-sm text-gray-500">
            Just looking?{" "}
            <Link href="/events" className="font-bold text-brand hover:underline">
              Browse what&apos;s on
            </Link>
          </p>

          {/* Real facts, not invented social proof. */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-4 text-[13px] font-semibold text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <NaijaFlag size={10} />
              All 36 states + FCT
            </span>
            <span>Free to join</span>
            <span>Hosts approve every guest</span>
          </div>
        </div>
      </section>
    </div>
  );
}
