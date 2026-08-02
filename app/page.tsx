import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { EVENT_CATEGORIES, CATEGORY_STYLES } from "@/lib/constants";
import { categoryPhoto } from "@/lib/category-photos";
import EventCover from "@/components/EventCover";
import { formatEventDate, formatPriceRange } from "@/lib/format";
import LandingStats from "@/components/LandingStats";
import LoggedInHome from "@/components/home/LoggedInHome";
import Rail from "@/components/home/Rail";
import SwipeDeck from "@/components/home/SwipeDeck";
import ScreenTour from "@/components/home/ScreenTour";
import LineIcon from "@/components/ui/LineIcon";
import { getSessionUser } from "@/lib/supabase/auth";
import { getVisitorState } from "@/lib/visitor-geo";

// Vibes our core audience actually searches for, leading the chip row.
const TOP_CATEGORIES = [
  "Party", "Game Night", "Beach Day", "Concert", "Clubbing",
  "Dinner", "Hiking", "Karaoke", "Bowling", "Pool Party",
];

const VENUE_TYPES = [
  { label: "Clubs & Lounges", img: "/venues/clubs.jpg" },
  { label: "Restaurants", img: "/venues/restaurants.jpg" },
  { label: "Rooftops & Bars", img: "/venues/rooftops.jpg" },
  { label: "Cinemas", img: "/venues/cinemas.jpg" },
];

// What the platform actually does for you — the marketing, delivered as cards
// in a shelf rather than a full-screen pitch section.
const PROMISES = [
  { icon: "shield", title: "Hosts approve every guest", text: "No randos. You see who's coming before you go." },
  { icon: "ticket", title: "Your ticket is a QR code", text: "Pay in-app, get scanned at the door. No printouts." },
  { icon: "chat", title: "Group chat before you arrive", text: "Every link-up has one, so you never pull up cold." },
  { icon: "users", title: "Built around your taste", text: "Pick what you're into and the feed shapes itself." },
];

const cache = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const getLandingCounts = unstable_cache(
  async () => {
    const supabase = cache();
    const [{ count: events }, { count: members }] = await Promise.all([
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }),
    ]);
    return { events: events ?? 0, members: members ?? 0 };
  },
  ["homepage-landing-counts"],
  { revalidate: 300 }
);

const getPopularSeries = unstable_cache(
  async () => {
    const { data } = await cache()
      .from("event_series")
      .select("id, title, category, state, frequency, cover_image_url, subscriber_count")
      .order("subscriber_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);
    return data ?? [];
  },
  ["homepage-popular-series"],
  { revalidate: 300 }
);

const getPartnerVenues = unstable_cache(
  async () => {
    const { data } = await cache()
      .from("venues")
      .select("id, name, category, state, address, image_url, price_range")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("is_featured", { ascending: false })
      .limit(10);
    return data ?? [];
  },
  ["homepage-partner-venues"],
  { revalidate: 300 }
);

const getPopularCircles = unstable_cache(
  async () => {
    const { data } = await cache()
      .from("circles")
      .select("id, name, category, state, member_count, is_private, description, cover_image_url")
      .order("member_count", { ascending: false })
      .limit(8);
    return data ?? [];
  },
  ["homepage-popular-circles"],
  { revalidate: 300 }
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
      .order("date", { ascending: true })
      .limit(12);
    return data ?? [];
  },
  ["homepage-upcoming-events"],
  { revalidate: 300 }
);

interface VenueRow {
  id: string;
  name: string;
  category: string;
  state: string | null;
  address: string | null;
  image_url: string | null;
  price_range: string | null;
}

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

const CARD = "w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px]";

// Where the FC26 tournament actually is.
const TOURNAMENT_STATE = "FCT - Abuja";

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

  const [counts, series, events, circles, partnerVenues] = await Promise.all([
    getLandingCounts(),
    getPopularSeries(),
    getUpcomingEvents(),
    getPopularCircles(),
    getPartnerVenues(),
  ]);
  const upcoming = events as EventRow[];

  // The featured slot is for something the visitor could actually turn up to.
  // FC26 is an Abuja event, so it only runs for Abuja; everyone else gets the
  // soonest link-up in their own state. When the edge can't place someone
  // (local dev, VPN, non-Vercel host) we show neither rather than defaulting
  // to "everyone sees Abuja" — that's the behaviour this replaces.
  const visitorState = getVisitorState();
  const featureFc26 = visitorState === TOURNAMENT_STATE;
  const localFeature =
    !featureFc26 && visitorState
      ? upcoming.find((e) => e.state === visitorState) ?? null
      : null;

  return (
    <div className="pb-12">
      {/* ---------------------------------------------------------------- */}
      {/* Top: who we are in one line, then straight into search + browsing */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-page pt-6">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-brand">
          <span aria-hidden className="flex overflow-hidden rounded-[3px]">
            <span className="block h-3 w-1.5 bg-naija" />
            <span className="block h-3 w-1.5 bg-white" />
            <span className="block h-3 w-1.5 bg-naija" />
          </span>
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
            className="shrink-0 snap-start whitespace-nowrap rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-brand hover:text-brand"
          >
            {CATEGORY_STYLES[c as keyof typeof CATEGORY_STYLES]?.emoji} {c}
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
      {featureFc26 && (
      <section className="container-page mt-6">
        <Link
          href="/tournament"
          className="group relative block overflow-hidden rounded-3xl text-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
          style={{ background: "linear-gradient(135deg, #1A1040 0%, #2C2260 55%, #3B2F7A 100%)" }}
        >
          {/* PlayStation face buttons — the tournament is FIFA, so the
              texture should say so instead of a generic dot grid. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <svg className="absolute -right-6 -top-8 h-44 w-44 opacity-[0.13]" viewBox="0 0 24 24" fill="none">
              <path d="M12 4 21 20H3z" stroke="#4FD1A5" strokeWidth="1.4" />
            </svg>
            <svg className="absolute right-24 top-16 h-24 w-24 opacity-[0.10]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#F65A78" strokeWidth="1.4" />
            </svg>
            <svg className="absolute -bottom-6 right-10 h-28 w-28 opacity-[0.10]" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="#E06FCB" strokeWidth="1.4" />
            </svg>
            <div className="absolute -left-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[#FAC775]/20 blur-[80px]" />
          </div>

          <div className="relative p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAC775] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#1A1040]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1A1040] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1A1040]" />
                </span>
                Registration open
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/70">
                <span aria-hidden className="flex overflow-hidden rounded-[2px]">
                  <span className="block h-2.5 w-1 bg-naija" />
                  <span className="block h-2.5 w-1 bg-white" />
                  <span className="block h-2.5 w-1 bg-naija" />
                </span>
                FC26 · Abuja
              </span>
            </div>

            {/* The prize is the reason anyone reads this card, so it leads. */}
            <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.18em] text-white/50">
              Prize pool
            </p>
            <p className="mt-0.5 text-[42px] font-extrabold leading-none tracking-[-0.03em] text-[#FAC775] sm:text-[54px]">
              &#8358;2,000,000
            </p>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
              FC26 Tournament
            </h2>

            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
              {[
                { k: "Entry", v: "\u20A610,000" },
                { k: "Slots", v: "40 players" },
                { k: "Where", v: "Abuja" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-white/45">
                    {s.k}
                  </dt>
                  <dd className="mt-0.5 text-[15px] font-extrabold">{s.v}</dd>
                </div>
              ))}
            </dl>

            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FAC775] px-5 py-2.5 text-sm font-black text-[#1A1040] transition group-hover:brightness-105">
              Claim your slot
              <LineIcon name="chevronRight" size={14} />
            </span>
          </div>
        </Link>
      </section>
      )}

      {/* Not in Abuja — feature the soonest thing happening where they are. */}
      {localFeature && (
        <section className="container-page mt-6">
          <Link
            href={`/events/${localFeature.id}`}
            className="group relative block min-h-[210px] overflow-hidden rounded-3xl text-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:min-h-[240px]"
          >
            <div className="absolute inset-0">
              <EventCover
                url={localFeature.cover_image_url}
                category={localFeature.category}
                title={localFeature.title}
                className="h-full w-full"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#120B2E] via-[#120B2E]/70 to-[#120B2E]/25" />

            <div className="relative flex min-h-[210px] flex-col justify-end p-5 sm:min-h-[240px] sm:p-7">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FAC775] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#1A1040]">
                <span aria-hidden className="flex overflow-hidden rounded-[2px]">
                  <span className="block h-2.5 w-1 bg-naija" />
                  <span className="block h-2.5 w-1 bg-white" />
                  <span className="block h-2.5 w-1 bg-naija" />
                </span>
                Near you in {visitorState}
              </span>
              <h2 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]">
                {localFeature.title}
              </h2>
              <p className="mt-1 text-[15px] text-white/75">
                {formatEventDate(localFeature.date)}
                {localFeature.location ? ` · ${localFeature.location}` : ""}
                {" · "}
                {localFeature.price && localFeature.price > 0
                  ? `₦${localFeature.price.toLocaleString("en-NG")}`
                  : "Free"}
              </p>
              <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-black text-gray-900">
                See the link-up
                <LineIcon name="chevronRight" size={14} />
              </span>
            </div>
          </Link>
        </section>
      )}

      <ScreenTour />

      {/* ---------------------------------------------------------------- */}
      {/* Shelves                                                           */}
      {/* ---------------------------------------------------------------- */}
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
                        ? "bg-white/92 text-gray-800"
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

      {circles.length > 0 && (
        <>
          <DeckHeading
            title="Circles to join"
            subtitle="Swipe through communities built around what you love"
            href="/circles"
          />
          {/* Full-bleed photo card, the way a dating deck reads: one circle at
              a time, big enough to actually see who's in it. */}
          <SwipeDeck className="h-[336px]">
            {circles.map((c: {
              id: string; name: string; category: string | null; state: string | null;
              member_count: number; cover_image_url: string | null;
            }) => (
              <Link
                key={c.id}
                href={`/circles/${c.id}`}
                className="group relative block h-full overflow-hidden rounded-3xl shadow-card transition duration-200 group-hover:shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.cover_image_url ?? categoryPhoto(c.category)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

                {c.category && (
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-gray-900 backdrop-blur">
                    {c.category}
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[22px] font-extrabold leading-tight">
                    {c.name}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/80">
                    <LineIcon name="users" size={14} />
                    {c.member_count} member{c.member_count === 1 ? "" : "s"}
                    {c.state ? ` · ${c.state}` : ""}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900">
                    Join the circle
                    <LineIcon name="chevronRight" size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </SwipeDeck>
        </>
      )}

      <DeckHeading
        title="Book the spot"
        subtitle={
          partnerVenues.length > 0
            ? "Swipe through real spots on LinkUpNaija"
            : "Swipe through clubs, restaurants, rooftops and cinemas"
        }
        href="/venues"
      />
      <SwipeDeck className="h-[336px]">
        {/* Real onboarded venues when we have them; the stock category tiles
            are only a fallback for an empty venues table. */}
        {partnerVenues.length > 0
          ? (partnerVenues as VenueRow[]).map((v) => (
              <Link key={v.id} href="/venues" className="group block h-full">
                <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-card transition duration-200 group-hover:shadow-lg">
                  <div className="relative min-h-0 flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.image_url!}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-[#FAC775] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1A1040]">
                      {v.category}
                    </span>
                  </div>
                  <div className="shrink-0 p-4">
                    <p className="truncate font-extrabold text-gray-900 group-hover:text-brand">
                      {v.name}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-gray-500">
                      {v.address ?? v.state ?? "Nigeria"}
                    </p>
                    {formatPriceRange(v.price_range) && (
                      <p className="mt-1 truncate text-[13px] font-bold text-naija-700">
                        {formatPriceRange(v.price_range)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))
          : VENUE_TYPES.map((v) => (
              <Link key={v.label} href="/venues" className="group block h-full">
                <div className="relative h-full overflow-hidden rounded-3xl shadow-card transition duration-200 group-hover:shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <p className="absolute inset-x-0 bottom-0 p-4 text-lg font-extrabold text-white">
                    {v.label}
                  </p>
                </div>
              </Link>
            ))}
      </SwipeDeck>

      {series.length > 0 && (
        <Rail
          title="The regulars"
          auto
          subtitle="Link-ups that keep coming back"
          href="/events?series=1"
        >
          {series.map((s: {
            id: string; title: string; category: string | null; state: string | null;
            frequency: string | null; cover_image_url: string | null; subscriber_count: number;
          }) => (
            <Link key={s.id} href={`/series/${s.id}`} className={`${CARD} group`}>
              <div className="relative h-[132px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.cover_image_url ?? categoryPhoto(s.category)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-[#FAC775] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1A1040]">
                  {s.frequency ?? "Recurring"}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="truncate font-bold">{s.title}</p>
                  <p className="mt-0.5 truncate text-xs text-white/75">
                    {s.subscriber_count} subscriber{s.subscriber_count === 1 ? "" : "s"}
                    {s.state ? ` · ${s.state}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </Rail>
      )}

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

      {/* More of the platform */}
      <DeckHeading title="More on LinkUpNaija" subtitle="Swipe through — beyond the party" />
      <SwipeDeck className="h-[212px]">
        {[
          { href: "/live", icon: "activity", title: "Live feed", text: "Who's hosting and joining right now" },
          { href: "/hosts/leaderboard", icon: "trophy", title: "Host leaderboard", text: "Nigeria's most-loved hosts" },
          { href: "/rides", icon: "car", title: "Hail a car", text: "Get a ride to your next link-up" },
          { href: "/opportunities", icon: "briefcase", title: "Opportunities", text: "List your car, venue or services" },
          { href: "/refer", icon: "gift", title: "Invite & earn", text: "Give ₦500, get ₦500" },
          { href: "/pro", icon: "star", title: "Go Pro", text: "Early access and a gold badge" },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="group flex h-full flex-col justify-center rounded-3xl border border-gray-100 bg-white p-6 shadow-card transition duration-200 hover:border-brand/30 hover:shadow-lg"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand">
              <LineIcon name={f.icon} size={22} />
            </span>
            <p className="mt-4 text-lg font-extrabold text-gray-900 group-hover:text-brand">
              {f.title}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">{f.text}</p>
          </Link>
        ))}
      </SwipeDeck>

      {/* Honest live numbers */}
      <div className="mt-8">
        <LandingStats
          eventsCount={counts.events}
          membersCount={counts.members}
          categoriesCount={EVENT_CATEGORIES.length}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Sign-up card                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-page mt-8">
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-8 text-center text-white sm:px-10 sm:py-10"
          style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 60%, #221E49 100%)" }}
        >
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-[#534AB7]/40 blur-[90px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-14 h-60 w-60 rounded-full bg-[#FAC775]/15 blur-[90px]" />
          <div className="relative">
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Your next link-up is <span className="text-[#FAC775]">minutes away</span>.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-white/70">
              Free to join. Hosts approve every guest, so you always know who
              you&apos;re pulling up with.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="btn rounded-full bg-[#FAC775] px-6 py-3 font-bold text-[#1A1040] hover:bg-[#fbd28e]"
              >
                Join free
              </Link>
              <Link
                href="/events"
                className="btn rounded-full border border-white/25 px-6 py-3 font-bold text-white hover:bg-white/10"
              >
                Browse first
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
