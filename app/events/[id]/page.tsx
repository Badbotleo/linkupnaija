import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoryBadge from "@/components/CategoryBadge";
import RsvpButton from "@/components/RsvpButton";
import ShareButtons from "@/components/ShareButtons";
import { formatEventDate, formatEventTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface AttendeeRow {
  user_id: string;
  users: { name: string | null; state: string | null } | null;
}

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, host:users!events_host_id_fkey(id, name, avatar_url, state)")
    .eq("id", params.id)
    .single();

  if (!event) notFound();

  const { data: attendeeRows } = await supabase
    .from("rsvps")
    .select("user_id, users(name, state)")
    .eq("event_id", params.id)
    .order("created_at", { ascending: true });

  const attendees = (attendeeRows ?? []) as unknown as AttendeeRow[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const attendeeCount = attendees.length;
  const isHost = !!user && user.id === event.host_id;
  const initialJoined = !!user && attendees.some((a) => a.user_id === user.id);
  const isFull =
    !!event.max_attendees && attendeeCount >= event.max_attendees;

  return (
    <div className="container-page py-10">
      <Link
        href="/events"
        className="text-sm font-medium text-gray-500 hover:text-brand"
      >
        ← Back to events
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={event.category} />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">
              📍 {event.state}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {event.title}
          </h1>

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                emoji="📅"
                label="Date"
                value={formatEventDate(event.date)}
              />
              <Detail
                emoji="⏰"
                label="Time"
                value={formatEventTime(event.time)}
              />
              <Detail emoji="📍" label="Location" value={event.location} />
              <Detail
                emoji="👥"
                label="Attendees"
                value={
                  event.max_attendees
                    ? `${attendeeCount} / ${event.max_attendees}`
                    : `${attendeeCount} going`
                }
              />
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <ShareButtons
                title={event.title}
                dateLabel={formatEventDate(event.date)}
                location={event.location}
              />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">About this event</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600">
              {event.description || "No description provided."}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">
              Who&apos;s going ({attendeeCount})
            </h2>
            {attendeeCount === 0 ? (
              <p className="mt-2 text-gray-500">
                No one yet — be the first to join! 🎈
              </p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-3">
                {attendees.map((a) => {
                  const name = a.users?.name ?? "Guest";
                  return (
                    <li
                      key={a.user_id}
                      className="flex items-center gap-2 rounded-full border border-gray-100 bg-white py-1.5 pl-1.5 pr-4 shadow-sm"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
            <p className="text-sm text-gray-500">Hosted by</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-lg font-bold text-white">
                {(event.host?.name ?? "H").charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-gray-900">
                  {event.host?.name ?? "A LinkUpNaija host"}
                </p>
                {event.host?.state && (
                  <p className="text-sm text-gray-500">{event.host.state}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <RsvpButton
                eventId={event.id}
                isLoggedIn={!!user}
                initialJoined={initialJoined}
                isHost={isHost}
                isFull={isFull}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Detail({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl" aria-hidden>
        {emoji}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
