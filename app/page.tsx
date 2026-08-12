import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { EVENT_CATEGORIES, CATEGORY_STYLES } from "@/lib/constants";
import { categoryPhoto } from "@/lib/category-photos";
import EventCover from "@/components/EventCover";
import { formatEventDate, formatPriceRange } from "@/lib/format";
import LoggedInHome from "@/components/home/LoggedInHome";
import Rail from "@/components/home/Rail";
import SwipeDeck from "@/components/home/SwipeDeck";
import PastEventsReel from "@/components/home/PastEventsReel";
import FeaturedRail from "@/components/home/FeaturedRail";
import CollabCard from "@/components/home/CollabCard";
import ScreenTour from "@/components/home/ScreenTour";
import ThingsToDo from "@/components/home/ThingsToDo";
import LineIcon from "@/components/ui/LineIcon";
import { memberProof, subscriberProof } from "@/lib/social-proof";
import { dedupeEvents } from "@/lib/content-guards";
import { LogoMark } from "@/components/Logo";
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
    // Duplicate rows exist in the table; never show the same listing twice.
    return dedupeEvents(data ?? []);
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

  const [series, events, circles, partnerVenues] = await Promise.all([
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
  // Always a real link-up now. FC26 used to take this slot for Abuja, which
  // meant the most prominent card on the homepage advertised one tournament
  // instead of the thing the product is for. It still has its own page, its
  // menu entry and a shelf card — it just doesn't own the hero.
  const localFeature =
    (visitorState ? upcoming.find((e) => e.state === visitorState) : null) ??
    upcoming[0] ??
    null;

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

      <CollabCard />

      <FeaturedRail />

      <PastEventsReel state={visitorState} />

      <ThingsToDo state={visitorState} />

      <ScreenTour />

      {/* ---------------------------------------------------------------- */}
      {/* Shelves                                                           */}
      {/* ---------------------------------------------------------------- */}

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
                    {[memberProof(c.member_count), c.state]
                      .filter(Boolean)
                      .join(" · ") || "New circle"}
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

      {/* Turn browsing into hosting */}

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
                    {[subscriberProof(s.subscriber_count), s.state]
                      .filter(Boolean)
                      .join(" · ") || s.frequency || "Recurring"}
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
          { href: "/vendors", icon: "briefcase", title: "Vendors", text: "Food, drinks, decor, DJs and more" },
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
              <span aria-hidden className="flex overflow-hidden rounded-[2px]">
                <span className="block h-2.5 w-1 bg-naija" />
                <span className="block h-2.5 w-1 bg-white" />
                <span className="block h-2.5 w-1 bg-naija" />
              </span>
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
