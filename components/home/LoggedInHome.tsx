import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import CategoryBadge from "@/components/CategoryBadge";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { categoriesForInterests } from "@/lib/constants";
import { categoryPhoto } from "@/lib/category-photos";
import RateVenuePrompt from "@/components/venues/RateVenuePrompt";
import ThingsToDo from "@/components/home/ThingsToDo";
import LineIcon from "@/components/ui/LineIcon";
import { memberProof } from "@/lib/social-proof";
import Rail from "@/components/home/Rail";
import SwipeDeck from "@/components/home/SwipeDeck";

interface CircleLite {
  id: string;
  name: string;
  category: string | null;
  state: string | null;
  member_count: number;
  cover_image_url: string | null;
}

interface VenueLite {
  id: string;
  name: string;
  category: string;
  address: string | null;
  state: string | null;
  image_url: string | null;
}

interface EventLite {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string | null;
  location: string;
  state: string;
  cover_image_url: string | null;
}

// Matches the visitor homepage exactly — the two screens should feel like
// one product, not two.
const CARD = "w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px]";

const QUICK_ACTIONS = [
  { href: "/events", label: "Explore", icon: "search" },
  { href: "/host", label: "Host", icon: "mic" },
  { href: "/circles", label: "Circles", icon: "circles" },
  { href: "/friends", label: "Friends", icon: "users" },
];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Lagos",
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Personalised home for signed-in users — replaces the marketing landing so
// members aren't re-reading the same pitch on every visit.
export default async function LoggedInHome({ userId }: { userId: string }) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profile }, { data: rsvpRows }, { data: hostingRows }] =
    await Promise.all([
      supabase.from("users").select("name, state, interests").eq("id", userId).single(),
      supabase
        .from("rsvps")
        .select(
          "events(id, title, category, date, time, location, state, cover_image_url)"
        )
        .eq("user_id", userId)
        .eq("status", "accepted")
        .gte("events.date", today)
        .limit(6),
      supabase
        .from("events")
        .select("id, title, category, date, time, location, state, cover_image_url")
        .eq("host_id", userId)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(4),
    ]);

  const firstName = profile?.name?.split(" ")[0] ?? "there";

  // Merge RSVPs + hosting into one "your upcoming" list, deduped and by date.
  const joined = ((rsvpRows ?? []) as unknown as { events: EventLite | null }[])
    .map((r) => r.events)
    .filter(Boolean) as EventLite[];
  const hosting = (hostingRows ?? []) as EventLite[];
  const seen = new Set<string>();
  const upcoming = [...hosting, ...joined]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const hostingIds = new Set(hosting.map((e) => e.id));

  // Picked for you — upcoming events whose category matches the user's
  // interests, soonest first. Events they already have are excluded.
  const forYouCategories = categoriesForInterests(profile?.interests ?? []);
  let forYou: EventLite[] = [];
  if (forYouCategories.length > 0) {
    const { data: forYouRows } = await supabase
      .from("events")
      .select("id, title, category, date, time, location, state, cover_image_url")
      .eq("event_type", "general")
      .gte("date", today)
      .neq("host_id", userId)
      .in("category", forYouCategories)
      .order("date", { ascending: true })
      .limit(12);
    forYou = ((forYouRows ?? []) as EventLite[])
      .filter((e) => !seen.has(e.id))
      // Rank: same-state matches first, then soonest.
      .sort((a, b) => {
        const sa = profile?.state && a.state === profile.state ? 0 : 1;
        const sb = profile?.state && b.state === profile.state ? 0 : 1;
        return sa - sb || a.date.localeCompare(b.date);
      })
      .slice(0, 4);
    for (const e of forYou) seen.add(e.id);
  }

  // The page used to stop dead after the last event rail. These give it an
  // ending: somewhere to belong, somewhere to book, and something to do when
  // there's nothing on.
  const [{ data: myCircleRows }, { data: venueRows }] =
    await Promise.all([
      supabase.from("circle_members").select("circle_id").eq("user_id", userId),
      supabase
        .from("venues")
        .select("id, name, category, address, state, image_url")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .limit(8),
    ]);

  const myCircleIds = new Set(
    ((myCircleRows ?? []) as { circle_id: string }[]).map((r) => r.circle_id)
  );
  const { data: circleRows } = await supabase
    .from("circles")
    .select("id, name, category, state, member_count, cover_image_url")
    .eq("is_private", false)
    .order("member_count", { ascending: false })
    .limit(12);
  const circles = ((circleRows ?? []) as CircleLite[])
    .filter((c) => !myCircleIds.has(c.id))
    .slice(0, 8);
  const venues = (venueRows ?? []) as VenueLite[];

  // Nearby events (their state), excluding ones already in their list.
  let nearbyQuery = supabase
    .from("events")
    .select("id, title, category, date, time, location, state, cover_image_url")
    .gte("date", today)
    .neq("host_id", userId)
    .order("date", { ascending: true })
    .limit(6);
  if (profile?.state) nearbyQuery = nearbyQuery.eq("state", profile.state);
  const { data: nearbyRows } = await nearbyQuery;
  const nearby = ((nearbyRows ?? []) as EventLite[])
    .filter((e) => !seen.has(e.id))
    .slice(0, 4);

  return (
    <div className="pb-28 pt-6 lg:pb-14">
      {/* Greeting — app style: type sits on the page, not inside a navy card,
          and the shortcuts are a row of round icon buttons like a phone home. */}
      <section className="container-page">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">
          {greeting()}
        </p>
        <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 sm:text-[30px]">
          Hey <span className="text-brand">{firstName}</span>, ready to link up?
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {upcoming.length > 0
            ? `You've got ${upcoming.length} link-up${upcoming.length === 1 ? "" : "s"} on your calendar.`
            : "Your calendar's clear. Let's fix that."}
        </p>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="group flex shrink-0 flex-col items-center gap-2"
            >
              <span className="grid h-[58px] w-[58px] place-items-center rounded-2xl bg-white text-brand shadow-card ring-1 ring-gray-100 transition group-hover:-translate-y-0.5 group-hover:text-brand-600 group-hover:shadow-md group-active:scale-95">
                <LineIcon name={a.icon} size={23} />
              </span>
              <span className="text-xs font-bold text-gray-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Your upcoming events */}
      {upcoming.length === 0 ? (
        <section className="container-page mt-8">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
            Your line-up
          </h2>
          <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              Nothing on your calendar yet. Find a vibe near you.
            </p>
            <Link href="/events" className="btn-primary mt-4">
              Explore events
            </Link>
          </div>
        </section>
      ) : (
        <Rail
          title="Your line-up"
          auto
          subtitle="What you've already said yes to"
          href="/dashboard"
        >
          {upcoming.map((e) => (
            <div key={e.id} className={CARD}>
              <EventTile event={e} hosting={hostingIds.has(e.id)} />
            </div>
          ))}
        </Rail>
      )}

      <ThingsToDo state={profile?.state ?? null} />

      {/* Picked for you — a deck, because a recommendation deserves a look
          rather than a skim past */}
      {forYou.length > 0 && (
        <>
          <div className="container-page mt-7 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
                Picked for you
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Swipe through link-ups matched to your taste
              </p>
            </div>
            <Link
              href="/profile/edit"
              className="shrink-0 whitespace-nowrap text-sm font-bold text-brand transition hover:opacity-70"
            >
              Edit interests
            </Link>
          </div>
          <SwipeDeck className="h-[336px]">
            {forYou.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="group relative block h-full overflow-hidden rounded-3xl shadow-card"
              >
                <div className="absolute inset-0">
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-full w-full"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[22px] font-extrabold leading-tight">
                    {e.title}
                  </p>
                  <p className="mt-1.5 text-sm text-white/80">
                    {formatEventDate(e.date)}
                    {e.time ? ` · ${formatEventTime(e.time)}` : ""} · {e.location}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900">
                    See the link-up
                    <LineIcon name="chevronRight" size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </SwipeDeck>
        </>
      )}

      {/* No interests yet → nudge to personalise */}
      {(!profile?.interests || profile.interests.length === 0) && (
        <section className="container-page mt-8">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand/20 bg-brand-50 px-6 py-8 text-center sm:flex-row sm:text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand">
              <LineIcon name="sparkles" size={22} />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">
                Get events picked just for you
              </h2>
              <p className="mt-0.5 text-sm text-gray-600">
                Tell us what you&apos;re into and we&apos;ll surface link-ups
                you&apos;ll actually love.
              </p>
            </div>
            <Link href="/profile/edit" className="btn-primary shrink-0">
              Choose interests
            </Link>
          </div>
        </section>
      )}

      {/* Near you */}
      {nearby.length > 0 && (
        <Rail
          title={`Happening ${profile?.state ? `in ${profile.state}` : "near you"}`}
          auto
          subtitle="Fresh link-ups on your doorstep"
          href="/events"
        >
          {nearby.map((e) => (
            <div key={e.id} className={CARD}>
              <EventTile event={e} />
            </div>
          ))}
        </Rail>
      )}

      {/* Rate anywhere they booked and have now been to */}
      <RateVenuePrompt userId={userId} />

      {/* Turn browsing into hosting — same shelf as the visitor home, but
          ranked against the state on their own profile. */}

      {/* Somewhere to belong between events */}
      {circles.length > 0 && (
        <Rail
          title="Circles to join"
          auto
          subtitle="Communities you're not in yet"
          href="/circles"
        >
          {circles.map((c) => (
            <Link key={c.id} href={`/circles/${c.id}`} className={`${CARD} group`}>
              <div className="relative h-[148px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.cover_image_url ?? categoryPhoto(c.category ?? "Party")}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="mt-0.5 truncate text-xs text-white/75">
                    {[memberProof(c.member_count), c.state]
                      .filter(Boolean)
                      .join(" · ") || "New circle"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </Rail>
      )}

      {/* Somewhere to book */}
      {venues.length > 0 && (
        <Rail
          title="Book the spot"
          auto
          subtitle="Partner venues you can reserve through us"
          href="/venues"
        >
          {venues.map((v) => (
            <Link key={v.id} href="/venues" className={`${CARD} group`}>
              <div className="relative h-[132px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.image_url ?? "/venues/restaurants.jpg"}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-[#FAC775] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1A1040]">
                  Partner
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="truncate font-bold">{v.name}</p>
                  <p className="mt-0.5 truncate text-xs text-white/75">
                    {[v.category, v.state].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </Rail>
      )}

      {/* Two things you can do, as rows rather than a banner. A big gradient
          marketing block at the end of a personal feed reads as an ad in your
          own app — a settings-style list reads as part of it. */}
      <section className="container-page mt-9">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
          Nothing catching your eye?
        </h2>

        <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
          <Link
            href="/refer"
            className="flex items-center gap-3.5 p-4 transition hover:bg-gray-50 active:bg-gray-100"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-naija-50 text-naija-700">
              <LineIcon name="gift" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-gray-900">
                Bring your paddy
              </span>
              <span className="mt-0.5 block text-[13px] text-gray-500">
                You both get &#8358;500 when they join
              </span>
            </span>
            <LineIcon
              name="chevronRight"
              size={16}
              className="shrink-0 text-gray-300"
            />
          </Link>

          <Link
            href="/host"
            className="flex items-center gap-3.5 p-4 transition hover:bg-gray-50 active:bg-gray-100"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
              <LineIcon name="mic" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-gray-900">
                Host something yourself
              </span>
              <span className="mt-0.5 block text-[13px] text-gray-500">
                Pick a vibe and let your people come to you
              </span>
            </span>
            <LineIcon
              name="chevronRight"
              size={16}
              className="shrink-0 text-gray-300"
            />
          </Link>
        </div>
      </section>
    </div>
  );
}

function EventTile({ event, hosting }: { event: EventLite; hosting?: boolean }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group overflow-hidden surface transition hover:-translate-y-0.5 hover:border-brand/30"
    >
      <div className="relative">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-28 w-full"
        />
        {hosting && (
          <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
            Hosting
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate font-bold text-gray-900 group-hover:text-brand">
          {event.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {formatEventDate(event.date)}
          {event.time ? ` · ${formatEventTime(event.time)}` : ""} · {event.location}
        </p>
        <div className="mt-2">
          <CategoryBadge category={event.category} />
        </div>
      </div>
    </Link>
  );
}
