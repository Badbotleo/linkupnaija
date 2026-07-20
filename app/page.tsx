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
import LineIcon from "@/components/ui/LineIcon";
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

// Popular circles for the "Find your Circle" section.
const getPopularCircles = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("circles")
      .select("id, name, category, state, member_count, is_private")
      .order("member_count", { ascending: false })
      .limit(4);
    return data ?? [];
  },
  ["homepage-popular-circles"],
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



export default async function HomePage() {
  // Signed-in members get a personalised home instead of re-reading the pitch.
  const user = await getSessionUser();
  if (user) return <LoggedInHome userId={user.id} />;

  const [counts, popularSeries, heroEvents, popularCircles] = await Promise.all([
    getLandingCounts(),
    getPopularSeries(),
    getHeroEvents(),
    getPopularCircles(),
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
              House parties, beach days, game nights, raves and everything in
              between. LinkUpNaija is where young Nigerians pull up, vibe and
              connect for real.
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

      {/* Why LinkUpNaija: feature bento */}
      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-gray-900">
          Everything you need to pull up
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          From finding the vibe to getting home safe, the whole link-up is
          handled.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Safety: the flagship tile */}
          <div
            className="relative overflow-hidden rounded-2xl p-6 text-white sm:col-span-2 lg:row-span-2"
            style={{ background: "linear-gradient(150deg, #1A1040 0%, #322C6E 100%)" }}
          >
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FAC775]/15 blur-[70px]" />
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-[#FAC775]">
              <LineIcon name="shield" size={22} />
            </span>
            <h3 className="mt-4 text-xl font-extrabold">
              Safety isn&apos;t a feature. It&apos;s the point.
            </h3>
            <p className="mt-2 leading-relaxed text-white/70">
              Hosts approve every guest, so no randos. Profiles carry phone
              verification. Share your plans with a trusted contact before you
              go, check in safe after, and report anything off in two taps.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <LineIcon name="check" size={14} className="text-[#FAC775]" /> Host-approved guest lists
              </li>
              <li className="flex items-center gap-2">
                <LineIcon name="check" size={14} className="text-[#FAC775]" /> Verified profiles
              </li>
              <li className="flex items-center gap-2">
                <LineIcon name="check" size={14} className="text-[#FAC775]" /> Share-my-plans + safety check-ins
              </li>
            </ul>
          </div>

          <Bento icon="ticket" title="Your ticket is a QR code">
            No printouts, no wahala. Your pass lives on your phone and the host
            scans you in at the door in seconds.
          </Bento>

          <Bento icon="chat" title="Chat before you arrive">
            Every event has a group chat, so you know the vibe and the people
            before you walk in. Never pull up cold.
          </Bento>

          <Bento icon="sparkles" title="A feed picked for you">
            Tell us what you&apos;re into once. Your homepage fills with parties,
            hangouts and link-ups that match your vibe and your state.
          </Bento>

          <Bento icon="zap" title="Money, handled">
            Paid tickets through Paystack, a wallet for refunds and credits, and
            automatic payouts when you host. Naira-native, end to end.
          </Bento>

          {/* Host reputation: gold tile */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 sm:col-span-2">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-600">
              <LineIcon name="trophy" size={22} />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-gray-900">
              Hosting builds your name
            </h3>
            <p className="mt-1.5 max-w-lg text-gray-600">
              Ratings, attendance and safety scores roll into a public host
              scorecard. Earn badges, climb the leaderboard, get featured. Great
              hosts get seen.
            </p>
            <Link href="/hosts/leaderboard" className="mt-3 inline-block text-sm font-bold text-amber-600 hover:underline">
              See the leaderboard →
            </Link>
          </div>

          <Bento icon="bell" title="Never miss it">
            Push notifications, email reminders and one-tap add-to-calendar.
            If you said you&apos;d be there, we make sure you remember.
          </Bento>

          {/* Nigeria strip */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:col-span-2 lg:col-span-3">
            <span aria-hidden className="flex shrink-0 overflow-hidden rounded">
              <span className="h-8 w-4 bg-[#008753]" />
              <span className="h-8 w-4 bg-white ring-1 ring-inset ring-gray-100" />
              <span className="h-8 w-4 bg-[#008753]" />
            </span>
            <div>
              <h3 className="font-extrabold text-gray-900">Made for Nigeria, by Nigerians</h3>
              <p className="text-sm text-gray-600">
                All 36 states + FCT, naira payments, and a team that knows what
                brings us together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: numbered journey */}
      <section className="container-page py-16">
        <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-amber-500">
          The playbook
        </p>
        <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-gray-900">
          Three moves. One link-up.
        </h2>

        <div className="relative mt-12">
          {/* Dashed journey line behind the cards (desktop) */}
          <div
            aria-hidden
            className="absolute left-[12%] right-[12%] top-10 hidden border-t-2 border-dashed border-brand-200 md:block"
          />
          <div className="grid gap-10 md:grid-cols-3 md:gap-6">
            {[
              {
                n: "01",
                icon: "search",
                tilt: "md:-rotate-1",
                title: "Scout the vibe",
                text: "Open Explore and see what's moving: parties, game nights, beach days, whatever your city is on this week.",
              },
              {
                n: "02",
                icon: "users",
                tilt: "md:rotate-1 md:translate-y-4",
                title: "Pull up with people",
                text: "Tap join, get the host's yes, and land in the group chat before you land at the venue. Zero awkward entrances.",
              },
              {
                n: "03",
                icon: "mic",
                tilt: "md:-rotate-1",
                title: "Run your own",
                text: "Got the idea? Set it up in two minutes, approve your guests, and watch your host name grow.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className={`relative rounded-2xl border border-gray-100 bg-white p-6 pt-7 shadow-card transition duration-200 hover:rotate-0 hover:shadow-xl ${s.tilt}`}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-5 right-4 select-none text-7xl font-black leading-none tracking-tighter text-transparent"
                  style={{ WebkitTextStroke: "1.5px #DAD8F0" }}
                >
                  {s.n}
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white shadow-sm">
                  <LineIcon name={s.icon} size={20} />
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-gray-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-gray-500">
            No long thing. Your first link-up is minutes away.
          </p>
          <Link
            href="/events"
            className="btn bg-[#FAC775] px-7 py-3 text-base font-bold text-[#1A1040] shadow-[0_8px_24px_-8px_rgba(250,199,117,0.6)] hover:bg-[#fbd28e]"
          >
            Find a link-up
          </Link>
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

      {/* Circles: communities, the brand moment mid-page */}
      {popularCircles.length > 0 && (
        <section
          className="relative overflow-hidden"
          style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 60%, #221E49 100%)" }}
        >
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#534AB7]/30 blur-[100px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[#FAC775]/15 blur-[100px]" />
          <div className="container-page relative py-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white">
                  Find your <span className="text-[#FAC775]">Circle</span>
                </h2>
                <p className="mt-2 max-w-xl text-white/70">
                  Communities built around what you love. Join one, meet the
                  regulars, and never miss a link-up.
                </p>
              </div>
              <Link
                href="/circles"
                className="btn self-start bg-[#FAC775] font-bold text-[#1A1040] hover:bg-[#fbd28e] sm:self-auto"
              >
                Explore Circles
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popularCircles.map(
                (c: {
                  id: string;
                  name: string;
                  category: string | null;
                  state: string | null;
                  member_count: number;
                  is_private: boolean;
                }) => (
                  <Link
                    key={c.id}
                    href={`/circles/${c.id}`}
                    className="group rounded-2xl bg-[#fff] p-5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] transition duration-200 hover:-translate-y-1"
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-lg font-extrabold text-white ${categoryGradient(c.category ?? "Networking")}`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <p className="mt-3 truncate font-bold text-gray-900 group-hover:text-brand">
                      {c.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {[c.category, c.state].filter(Boolean).join(" · ") || "Community"}
                      {c.is_private ? " · Private" : ""}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-brand">
                      {c.member_count} {c.member_count === 1 ? "member" : "members"} →
                    </p>
                  </Link>
                )
              )}
            </div>
          </div>
        </section>
      )}

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

function Bento({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand">
        <LineIcon name={icon} size={22} />
      </span>
      <h3 className="mt-4 text-lg font-extrabold text-gray-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}
