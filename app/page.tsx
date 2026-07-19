import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { EVENT_CATEGORIES, CATEGORY_STYLES, categoryGradient } from "@/lib/constants";
import FcPopup from "@/components/FcPopup";
import EventCover from "@/components/EventCover";
import { formatEventDate } from "@/lib/format";
import Typewriter from "@/components/anim/Typewriter";
import LandingStats from "@/components/LandingStats";
import LoggedInHome from "@/components/home/LoggedInHome";
import { getSessionUser } from "@/lib/supabase/auth";

// The homepage hero/stats don't need to be real-time — cache the live counts
// for 5 minutes so we don't hit the DB on every single landing-page view.
// Uses a cookieless anon client (unstable_cache can't read request cookies).
const getLandingCounts = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [{ count: events }, { count: members }] = await Promise.all([
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }),
    ]);
    return { events: events ?? 0, members: members ?? 0 };
  },
  ["homepage-landing-counts"],
  { revalidate: 300 }
);

// Popular recurring series for the "Recurring events near you" section.
const getPopularSeries = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("event_series")
      .select("id, title, category, state, frequency, cover_image_url, subscriber_count")
      .order("subscriber_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);
    return data ?? [];
  },
  ["homepage-popular-series"],
  { revalidate: 300 }
);

// A few real upcoming events for the hero collage — makes the landing feel
// alive instead of showing static category placeholders.
const getHeroEvents = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("events")
      .select("id, title, category, state, date, cover_image_url")
      .eq("event_type", "general")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(4);
    return data ?? [];
  },
  ["homepage-hero-events"],
  { revalidate: 300 }
);

const WHY_LINKUPNAIJA = [
  {
    emoji: "🤝",
    title: "Built for real connection",
    text: "Not just parties. Family hangouts, friend meetups, book clubs, picnics. Events that bring people closer together.",
  },
  {
    emoji: "✅",
    title: "Vetted, safe gatherings",
    text: "Hosts approve every attendee. Verified profiles. No randos, no wahala.",
  },
  {
    emoji: "👨‍👩‍👧‍👦",
    title: "For everyone, not just nightlife",
    text: "Whether you're planning a family outing or meeting new friends who share your interests, there's a place for you here.",
  },
  {
    emoji: "💬",
    title: "Connect before you meet",
    text: "Private group chats let you get to know your fellow attendees before the event even starts.",
  },
  {
    emoji: "🇳🇬",
    title: "Made for Nigeria, by Nigerians",
    text: "We understand the culture, the cities, and what brings Nigerians together.",
  },
];

const HOW_IT_WORKS = [
  {
    emoji: "🔎",
    title: "Find your vibe",
    text: "Browse hangouts, parties, picnics and more happening in your state.",
  },
  {
    emoji: "🙌",
    title: "Join the link-up",
    text: "Tap join to RSVP and see who else is pulling up. No stress.",
  },
  {
    emoji: "🎤",
    title: "Or host your own",
    text: "Got a vibe in mind? Create an event and gather your people.",
  },
];

export default async function HomePage() {
  // Signed-in members get a personalised home instead of re-reading the pitch.
  const user = await getSessionUser();
  if (user) return <LoggedInHome userId={user.id} />;

  const [counts, popularSeries, heroEvents] = await Promise.all([
    getLandingCounts(),
    getPopularSeries(),
    getHeroEvents(),
  ]);

  return (
    <div>
      {/* Hero: bold navy color-block with a tilted polaroid collage */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 55%, #221E49 100%)" }}>
        {/* Purple + gold glows */}
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#534AB7]/30 blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[#FAC775]/15 blur-[110px]" />

        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white">
              <span aria-hidden className="flex overflow-hidden rounded-[3px]">
                <span className="h-3 w-1.5 bg-[#008753]" />
                <span className="h-3 w-1.5 bg-white" />
                <span className="h-3 w-1.5 bg-[#008753]" />
              </span>
              Nigeria&apos;s social events platform
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find your <span className="text-[#FAC775]">people</span>.
              <br />
              Build real connections.
            </h1>
            <p className="mt-4 text-lg font-bold text-[#AFA9EC]">
              <Typewriter text="Link up. Hang out. Vibe." />
            </p>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/70">
              From family picnics to friend reunions, book clubs to new
              friendships. LinkUpNaija helps Nigerians build real connections,
              not just attend events.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/events"
                className="btn bg-[#FAC775] px-7 py-3 text-base font-bold text-[#1A1040] shadow-[0_8px_24px_-8px_rgba(250,199,117,0.6)] hover:bg-[#fbd28e]"
              >
                Explore events
              </Link>
              <Link
                href="/signup"
                className="btn border border-white/25 px-7 py-3 text-base text-white hover:bg-white/10"
              >
                Join free
              </Link>
            </div>
          </div>

          {/* Polaroid collage: real event photos, hand-placed feel */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="grid grid-cols-2 gap-5 px-2 py-4">
              {heroEvents.map((e, i) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className={`group rounded-xl bg-[#fff] p-2 pb-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] transition duration-200 hover:z-10 hover:rotate-0 hover:scale-[1.03] ${
                    i % 2 === 0 ? "-rotate-2 sm:translate-y-4" : "rotate-2"
                  }`}
                >
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-32 w-full rounded-lg sm:h-36"
                  />
                  <p className="mt-2 truncate px-1 text-sm font-bold text-gray-900">
                    {e.title}
                  </p>
                  <p className="truncate px-1 text-xs text-gray-500">
                    {formatEventDate(e.date)}
                    {e.state ? ` · ${e.state}` : ""}
                  </p>
                </Link>
              ))}
              {EVENT_CATEGORIES.slice(0, Math.max(0, 4 - heroEvents.length)).map((cat, i) => {
                const { emoji } = CATEGORY_STYLES[cat];
                const idx = heroEvents.length + i;
                return (
                  <Link
                    key={cat}
                    href={`/events?category=${encodeURIComponent(cat)}`}
                    className={`group rounded-xl bg-[#fff] p-2 pb-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] transition duration-200 hover:z-10 hover:rotate-0 hover:scale-[1.03] ${
                      idx % 2 === 0 ? "-rotate-2 sm:translate-y-4" : "rotate-2"
                    }`}
                  >
                    <div className={`flex h-32 w-full items-center justify-center rounded-lg bg-gradient-to-br sm:h-36 ${categoryGradient(cat)}`}>
                      <span className="text-4xl drop-shadow-sm" aria-hidden>{emoji}</span>
                    </div>
                    <p className="mt-2 truncate px-1 text-sm font-bold text-gray-900">{cat}</p>
                    <p className="truncate px-1 text-xs text-gray-500">Browse events →</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Floating stats */}
      <LandingStats
        eventsCount={counts.events}
        membersCount={counts.members}
        categoriesCount={EVENT_CATEGORIES.length}
      />

      {/* Why LinkUpNaija */}
      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Why LinkUpNaija
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          More than an events app. A place to build genuine connections.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_LINKUPNAIJA.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-2xl">
                {item.emoji}
              </span>
              <h3 className="mt-4 text-lg font-bold text-gray-900">
                {item.title}
              </h3>
              <p className="mt-1.5 text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          Three steps to never having a boring weekend again.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-2xl">
                  {step.emoji}
                </span>
                <span className="text-sm font-bold text-brand">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">
                {step.title}
              </h3>
              <p className="mt-1.5 text-gray-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-gray-50 py-16">
        <div className="container-page">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Pick your vibe
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
            Whatever your energy, there&apos;s a link-up for it.
          </p>
          {/* Two staggered scrolling rows of colored pills, not a tile wall. */}
          <div className="no-scrollbar mt-10 space-y-3 overflow-x-auto pb-2">
            {[EVENT_CATEGORIES.slice(0, 12), EVENT_CATEGORIES.slice(12)].map((row, r) => (
              <div key={r} className={`flex w-max gap-3 ${r === 1 ? "pl-10" : ""}`}>
                {row.map((cat) => {
                  const { emoji, badge } = CATEGORY_STYLES[cat];
                  return (
                    <Link
                      key={cat}
                      href={`/events?category=${encodeURIComponent(cat)}`}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-md ${badge}`}
                    >
                      <span aria-hidden>{emoji}</span>
                      {cat}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recurring series */}
      {popularSeries.length > 0 && (
        <section className="container-page py-16">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            🔄 Recurring events near you
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
            Communities that meet again and again. Subscribe and never miss one.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {popularSeries.map(
              (s: {
                id: string;
                title: string;
                category: string | null;
                state: string | null;
                subscriber_count: number;
              }) => (
                <Link
                  key={s.id}
                  href={`/series/${s.id}`}
                  className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
                >
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
                    🔄 Series
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-gray-900">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {[s.category, s.state].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-brand">
                    {s.subscriber_count}{" "}
                    {s.subscriber_count === 1 ? "follower" : "followers"} →
                  </p>
                </Link>
              )
            )}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page py-16">
        <div className="relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white" style={{ background: "linear-gradient(150deg, #1A1040 0%, #322C6E 100%)" }}>
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FAC775]/15 blur-[80px]" />
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Ready to link up?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-100">
            Join thousands of Nigerians finding their next hangout. It&apos;s
            free and takes 30 seconds.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="btn bg-[#FAC775] px-6 py-3 text-base font-bold text-[#1A1040] hover:bg-[#fbd28e]"
            >
              Create your account
            </Link>
            <Link
              href="/events"
              className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10"
            >
              Browse events
            </Link>
          </div>
        </div>
      </section>

      <FcPopup />
    </div>
  );
}
