import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { EVENT_CATEGORIES, CATEGORY_STYLES } from "@/lib/constants";
import { categoryPhoto } from "@/lib/category-photos";
import EventCover from "@/components/EventCover";
import { formatEventDate } from "@/lib/format";
import LandingStats from "@/components/LandingStats";
import LoggedInHome from "@/components/home/LoggedInHome";
import Rail from "@/components/home/Rail";
import LineIcon from "@/components/ui/LineIcon";
import { getSessionUser } from "@/lib/supabase/auth";

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

export default async function HomePage() {
  // Signed-in members get a personalised home instead of re-reading the pitch.
  const user = await getSessionUser();
  if (user) return <LoggedInHome userId={user.id} />;

  const [counts, series, events, circles] = await Promise.all([
    getLandingCounts(),
    getPopularSeries(),
    getUpcomingEvents(),
    getPopularCircles(),
  ]);
  const upcoming = events as EventRow[];

  return (
    <div className="pb-12">
      {/* ---------------------------------------------------------------- */}
      {/* Top: who we are in one line, then straight into search + browsing */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-page pt-6">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-brand">
          <span aria-hidden className="flex overflow-hidden rounded-[3px]">
            <span className="block h-3 w-1.5 bg-[#008753]" />
            <span className="block h-3 w-1.5 bg-white" />
            <span className="block h-3 w-1.5 bg-[#008753]" />
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
      {/* Featured card                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-page mt-6">
        <Link
          href="/tournament"
          className="group relative flex min-h-[190px] flex-col justify-end overflow-hidden rounded-3xl p-5 text-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:min-h-[220px] sm:p-6"
          style={{ background: "linear-gradient(150deg, #1A1040 0%, #322C6E 100%)" }}
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#FAC775]/25 blur-[70px]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAC775] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#1A1040]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1A1040] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1A1040]" />
              </span>
              Now on
            </span>
            <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">
              FC26 Tournament
            </h2>
            <p className="mt-1 text-[15px] text-white/75">
              <span className="font-bold text-[#FAC775]">&#8358;2,000,000</span> prize
              pool · 40 players · Abuja
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#FAC775]">
              Register now
              <LineIcon name="chevronRight" size={14} />
            </span>
          </div>
        </Link>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Shelves                                                           */}
      {/* ---------------------------------------------------------------- */}
      <Rail
        title="Happening soon"
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
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/92 px-2 py-0.5 text-[11px] font-black text-gray-800 backdrop-blur">
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
        <Rail
          title="Circles to join"
          subtitle="Communities built around what you love"
          href="/circles"
        >
          {circles.map((c: {
            id: string; name: string; category: string | null; state: string | null;
            member_count: number; cover_image_url: string | null;
          }) => (
            <Link key={c.id} href={`/circles/${c.id}`} className={`${CARD} group`}>
              <div className="relative h-[148px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.cover_image_url ?? categoryPhoto(c.category)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/75">
                    <LineIcon name="users" size={12} />
                    {c.member_count} member{c.member_count === 1 ? "" : "s"}
                    {c.state ? ` · ${c.state}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </Rail>
      )}

      <Rail
        title="Book the spot"
        subtitle="Clubs, restaurants, rooftops and cinemas near you"
        href="/venues"
      >
        {VENUE_TYPES.map((v) => (
          <Link key={v.label} href="/venues" className={`${CARD} group`}>
            <div className="relative h-[132px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.img}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <p className="absolute inset-x-0 bottom-0 p-3 font-bold text-white">
                {v.label}
              </p>
            </div>
          </Link>
        ))}
      </Rail>

      {series.length > 0 && (
        <Rail
          title="The regulars"
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
      <Rail title="Why LinkUpNaija" subtitle="What you get every time you pull up">
        {PROMISES.map((p) => (
          <div
            key={p.title}
            className={`${CARD} rounded-2xl border border-gray-100 bg-white p-4 shadow-card`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
              <LineIcon name={p.icon} size={19} />
            </span>
            <p className="mt-3 font-extrabold leading-snug text-gray-900">{p.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{p.text}</p>
          </div>
        ))}
      </Rail>

      {/* More of the platform */}
      <Rail title="More on LinkUpNaija" subtitle="Beyond the party">
        {[
          { href: "/live", icon: "activity", title: "Live feed", text: "Who's hosting and joining right now" },
          { href: "/hosts/leaderboard", icon: "trophy", title: "Host leaderboard", text: "Nigeria's most-loved hosts" },
          { href: "/opportunities", icon: "briefcase", title: "Opportunities", text: "List your car, venue or services" },
          { href: "/refer", icon: "gift", title: "Invite & earn", text: "Give ₦500, get ₦500" },
          { href: "/pro", icon: "star", title: "Go Pro", text: "Early access and a gold badge" },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`${CARD} group rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
              <LineIcon name={f.icon} size={19} />
            </span>
            <p className="mt-3 font-extrabold text-gray-900 group-hover:text-brand">
              {f.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{f.text}</p>
          </Link>
        ))}
      </Rail>

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
