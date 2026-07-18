import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import CategoryBadge from "@/components/CategoryBadge";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { categoriesForInterests } from "@/lib/constants";

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

const QUICK_ACTIONS = [
  { href: "/events", label: "Explore", emoji: "🔎" },
  { href: "/host", label: "Host", emoji: "🎤" },
  { href: "/circles", label: "Circles", emoji: "⭕" },
  { href: "/friends", label: "Friends", emoji: "👥" },
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

  // ✨ Picked for you — upcoming events whose category matches the user's
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
    <div className="container-page max-w-3xl py-8">
      {/* Greeting */}
      <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
        {greeting()}, {firstName} 👋
      </h1>
      <p className="mt-1 text-gray-600">
        {upcoming.length > 0
          ? "Here's what's coming up for you."
          : "Ready for your next link-up?"}
      </p>

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
          >
            <span className="text-2xl" aria-hidden>
              {a.emoji}
            </span>
            <span className="text-xs font-bold text-gray-800">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Your upcoming events */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            🗓️ Your upcoming events
          </h2>
          <Link href="/dashboard" className="text-sm font-semibold text-brand">
            See all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
            <p className="text-3xl">🎈</p>
            <p className="mt-2 text-sm text-gray-500">
              Nothing on your calendar yet. Find a vibe near you.
            </p>
            <Link href="/events" className="btn-primary mt-4">
              Explore events
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {upcoming.map((e) => (
              <EventTile key={e.id} event={e} hosting={hostingIds.has(e.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Picked for you */}
      {forYou.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              ✨ Picked for you
            </h2>
            <Link href="/profile/edit" className="text-sm font-semibold text-brand">
              Edit interests →
            </Link>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            Based on what you&apos;re into.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {forYou.map((e) => (
              <EventTile key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* No interests yet → nudge to personalise */}
      {(!profile?.interests || profile.interests.length === 0) && (
        <section className="mt-8">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand/20 bg-brand-50 px-6 py-8 text-center sm:flex-row sm:text-left">
            <span className="text-3xl" aria-hidden>✨</span>
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
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              📍 Happening {profile?.state ? `in ${profile.state}` : "near you"}
            </h2>
            <Link href="/events" className="text-sm font-semibold text-brand">
              See all →
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {nearby.map((e) => (
              <EventTile key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventTile({ event, hosting }: { event: EventLite; hosting?: boolean }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
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
            🎤 Hosting
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
