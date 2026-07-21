import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import CategoryBadge from "@/components/CategoryBadge";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { categoriesForInterests } from "@/lib/constants";
import LineIcon from "@/components/ui/LineIcon";

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
    <div className="container-page max-w-4xl py-6 sm:py-8">
      {/* Greeting hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
        style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 60%, #221E49 100%)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#534AB7]/40 blur-[90px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-[#FAC775]/15 blur-[90px]" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FAC775]">
            {greeting()}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Hey <span className="text-[#FAC775]">{firstName}</span>, ready to link up?
          </h1>
          <p className="mt-1.5 text-sm text-white/70">
            {upcoming.length > 0
              ? `You've got ${upcoming.length} link-up${upcoming.length === 1 ? "" : "s"} on your calendar.`
              : "Your calendar's clear. Let's fix that."}
          </p>

          {/* Quick actions as glass tiles */}
          <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.07] py-3 backdrop-blur transition hover:bg-white/[0.14]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[#FAC775]">
                  <LineIcon name={a.icon} />
                </span>
                <span className="text-xs font-bold text-white">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Your upcoming events */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900">
            Your <span className="text-brand">line-up</span>
          </h2>
          <Link href="/dashboard" className="text-sm font-semibold text-brand">
            See all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
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
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">
                Your taste
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-gray-900">
                Picked for <span className="text-brand">you</span>
              </h2>
            </div>
            <Link href="/profile/edit" className="text-sm font-semibold text-brand">
              Edit interests →
            </Link>
          </div>
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
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
              <LineIcon name="pin" size={18} className="text-brand" />
              Happening {profile?.state ? `in ${profile.state}` : "near you"}
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
