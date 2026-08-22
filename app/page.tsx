import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_STYLES } from "@/lib/constants";
import EventCover from "@/components/EventCover";
import { formatEventDate } from "@/lib/format";
import LoggedInHome from "@/components/home/LoggedInHome";
import Rail from "@/components/home/Rail";
import SwipeDeck from "@/components/home/SwipeDeck";
import FeaturedRail from "@/components/home/FeaturedRail";
import ScreenTour from "@/components/home/ScreenTour";
import LineIcon from "@/components/ui/LineIcon";
import CategoryEmoji from "@/components/ui/CategoryEmoji";
import NaijaFlag from "@/components/ui/NaijaFlag";
import { dedupeEvents } from "@/lib/content-guards";
import { professionalCategoriesFilter } from "@/lib/event-kind";
import { LogoMark } from "@/components/Logo";
import { getSessionUser } from "@/lib/supabase/auth";
import { getVisitorState } from "@/lib/visitor-geo";

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

  // The featured slot is for something the visitor could actually turn up to.
  // FC26 is an Abuja event, so it only runs for Abuja; everyone else gets the
  // soonest link-up in their own state. When the edge can't place someone
  // (local dev, VPN, non-Vercel host) we show neither rather than defaulting
  // to "everyone sees Abuja" — that's the behaviour this replaces.
  const visitorState = getVisitorState();
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
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-brand">
          {/* Was three divs, and the middle one was `bg-white` — which the
              global .dark layer repaints along with every other white surface,
              so the stripe went black in dark mode. NaijaFlag paints #FFFFFF
              into an SVG, where no utility override can reach it. */}
          <NaijaFlag size={12} />
          Nigeria&apos;s social events platform
        </p>

        <h1 className="mt-2 text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] text-gray-900 sm:text-[38px]">
          Find your <span className="text-brand">people</span>.
        </h1>
        <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-gray-500">
          House parties, beach days, game nights and raves — see what&apos;s
          actually happening near you this week.
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
            {/* Drawn, not typed — the flag is the one emoji that inherits
                text colour when it falls back. See CategoryEmoji. */}
            <CategoryEmoji
              emoji={CATEGORY_STYLES[c as keyof typeof CATEGORY_STYLES]?.emoji}
              size={13}
            />
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
            : "Nothing on the calendar yet — start something"
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

      {/* Featured link-ups. Cut with the rest of the shelves, put back on
          purpose: these are the events we're actively promoting, and a
          landing page that hides its best inventory is stripped past the
          point of useful. */}
      <FeaturedRail />

      {/* Real listings, not invented ones — the demo shows the same events the
          rails above are showing. */}
      <ScreenTour events={upcoming.slice(0, 3)} />

      {/* The pitch, as a shelf rather than a full-screen section */}
      <DeckHeading
        title="Why LinkUpNaija"
        subtitle="Swipe through — what you get every time you pull up"
      />
      <SwipeDeck className="h-[212px]">
        {PROMISES.map((p) => (
          <div
            key={p.title}
            className="flex h-full flex-col justify-center rounded-3xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand">
              <LineIcon name={p.icon} size={22} />
            </span>
            <p className="mt-4 text-lg font-extrabold leading-snug text-gray-900">
              {p.title}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">
              {p.text}
            </p>
          </div>
        ))}
      </SwipeDeck>

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
            Free to join, and the host approves every guest — so you always know
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
