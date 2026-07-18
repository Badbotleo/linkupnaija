import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { EVENT_CATEGORIES, CATEGORY_STYLES } from "@/lib/constants";
import FcPopup from "@/components/FcPopup";
import EventCover from "@/components/EventCover";
import { formatEventDate } from "@/lib/format";
import Typewriter from "@/components/anim/Typewriter";
import LandingStats from "@/components/LandingStats";
import LoggedInHome from "@/components/home/LoggedInHome";
import { getSessionUser } from "@/lib/supabase/auth";

// The homepage hero/stats don't need to be real-time — cache the event count
// for 5 minutes so we don't hit the DB on every single landing-page view.
// Uses a cookieless anon client (unstable_cache can't read request cookies).
const getEventsCount = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { count } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true });
    return count ?? 0;
  },
  ["homepage-events-count"],
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
    text: "Not just parties. Family hangouts, friend meetups, book clubs, picnics — events that bring people closer together.",
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

  const [eventsCount, popularSeries, heroEvents] = await Promise.all([
    getEventsCount(),
    getPopularSeries(),
    getHeroEvents(),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-white">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand">
              🇳🇬 Nigeria&apos;s social events platform
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Find your people.
              <br />
              Build real connections.
            </h1>
            <p className="mt-3 text-lg font-bold text-brand">
              <Typewriter text="Link up. Hang out. Vibe." />
            </p>
            <p className="mt-5 max-w-lg text-lg text-gray-600">
              From family picnics to friend reunions, book clubs to new
              friendships — LinkUpNaija helps Nigerians build real connections,
              not just attend events.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events" className="btn-primary px-6 py-3 text-base">
                Explore events
              </Link>
              <Link href="/signup" className="btn-outline px-6 py-3 text-base">
                Join free
              </Link>
            </div>
          </div>

          <div className="relative">
            {/* Soft brand glow for depth behind the collage */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-brand-100/60 via-transparent to-amber-100/50 blur-2xl"
            />
            <div className="grid grid-cols-2 gap-4">
              {heroEvents.map((e, i) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className={`group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
                    i % 2 === 0 ? "sm:translate-y-5" : ""
                  }`}
                >
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-32 w-full"
                  />
                  <div className="p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
                      {e.category}
                    </span>
                    <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-gray-900">
                      {e.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {formatEventDate(e.date)}
                      {e.state ? ` · ${e.state}` : ""}
                    </p>
                  </div>
                </Link>
              ))}

              {/* Fill the grid to a full 2×2 with category shortcuts. */}
              {EVENT_CATEGORIES.slice(0, Math.max(0, 4 - heroEvents.length)).map((cat, i) => {
                const { emoji, badge } = CATEGORY_STYLES[cat];
                const idx = heroEvents.length + i;
                return (
                  <Link
                    key={cat}
                    href={`/events?category=${encodeURIComponent(cat)}`}
                    className={`flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-xl ${
                      idx % 2 === 0 ? "sm:translate-y-5" : ""
                    }`}
                  >
                    <span className={`grid h-12 w-12 place-items-center rounded-xl text-2xl ${badge}`}>
                      {emoji}
                    </span>
                    <div className="mt-3">
                      <p className="font-bold text-gray-900">{cat}</p>
                      <p className="text-sm text-gray-500">Browse this vibe →</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Floating stats */}
      <LandingStats eventsCount={eventsCount} />

      {/* Why LinkUpNaija */}
      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Why LinkUpNaija
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          More than an events app — a place to build genuine connections.
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
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {EVENT_CATEGORIES.map((cat) => {
              const { emoji, badge } = CATEGORY_STYLES[cat];
              return (
                <Link
                  key={cat}
                  href={`/events?category=${encodeURIComponent(cat)}`}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
                >
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${badge}`}
                  >
                    {emoji}
                  </span>
                  <span className="font-bold text-gray-900 group-hover:text-brand">
                    {cat}
                  </span>
                </Link>
              );
            })}
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
            Communities that meet again and again — subscribe and never miss one.
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
        <div className="overflow-hidden rounded-3xl bg-brand px-8 py-14 text-center text-white">
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
              className="btn bg-white px-6 py-3 text-base text-brand hover:bg-brand-50"
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
