import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoryBadge from "@/components/CategoryBadge";
import RsvpButton from "@/components/RsvpButton";
import ShareButtons from "@/components/ShareButtons";
import EventTabs from "@/components/EventTabs";
import ChatPanel from "@/components/ChatPanel";
import ManageRequests from "@/components/ManageRequests";
import Avatar from "@/components/Avatar";
import { formatEventDate, formatEventTime } from "@/lib/format";
import type {
  ChatMessageUI,
  RsvpStatus,
  RsvpWithProfile,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const RSVP_PROFILE_SELECT =
  "id, user_id, status, created_at, users(id, name, state, avatar_url, bio, instagram_url, twitter_url, facebook_url)";

interface ChatRow {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  users: { name: string | null } | null;
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

  const { data: rsvpRows } = await supabase
    .from("rsvps")
    .select(RSVP_PROFILE_SELECT)
    .eq("event_id", params.id)
    .order("created_at", { ascending: true });

  const rsvps = (rsvpRows ?? []) as unknown as RsvpWithProfile[];
  const accepted = rsvps.filter((r) => r.status === "accepted");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const attendeeCount = accepted.length;
  const isHost = !!user && user.id === event.host_id;
  const myStatus: "none" | RsvpStatus = user
    ? (rsvps.find((r) => r.user_id === user.id)?.status ?? "none")
    : "none";
  const isFull =
    !!event.max_attendees && attendeeCount >= event.max_attendees;

  // Group chat is private to accepted attendees + the host.
  const canChat = isHost || myStatus === "accepted";

  let initialMessages: ChatMessageUI[] = [];
  let currentUserName = "You";
  if (user && canChat) {
    const [{ data: chatRows }, { data: me }] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("id, user_id, message, created_at, users(name)")
        .eq("event_id", params.id)
        .order("created_at", { ascending: true }),
      supabase.from("users").select("name").eq("id", user.id).single(),
    ]);

    initialMessages = ((chatRows ?? []) as unknown as ChatRow[]).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      message: m.message,
      created_at: m.created_at,
      senderName: m.users?.name ?? "Member",
    }));
    currentUserName = me?.name ?? "You";
  }

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

          <div className="mt-6">
            <EventTabs
              details={
                <div className="space-y-8">
                  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
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
                      <Detail
                        emoji="📍"
                        label="Location"
                        value={event.location}
                      />
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

                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      About this event
                    </h2>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600">
                      {event.description || "No description provided."}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Who&apos;s going ({attendeeCount})
                    </h2>
                    {attendeeCount === 0 ? (
                      <p className="mt-2 text-gray-500">
                        No one yet — be the first to join! 🎈
                      </p>
                    ) : (
                      <ul className="mt-4 flex flex-wrap gap-3">
                        {accepted.map((a) => (
                          <li
                            key={a.user_id}
                            className="flex items-center gap-2 rounded-full border border-gray-100 bg-white py-1.5 pl-1.5 pr-4 shadow-sm"
                          >
                            <Avatar
                              name={a.users?.name ?? null}
                              url={a.users?.avatar_url ?? null}
                              size="sm"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              {a.users?.name ?? "Guest"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              }
              chat={
                canChat && user ? (
                  <ChatPanel
                    eventId={event.id}
                    currentUserId={user.id}
                    currentUserName={currentUserName}
                    initialMessages={initialMessages}
                  />
                ) : (
                  <LockedChat isLoggedIn={!!user} eventId={event.id} />
                )
              }
            />
          </div>

          {isHost && (
            <div className="mt-8">
              <ManageRequests initialRequests={rsvps} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
            <p className="text-sm text-gray-500">Hosted by</p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar
                name={event.host?.name ?? null}
                url={event.host?.avatar_url ?? null}
                size="md"
              />
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
                initialStatus={myStatus}
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

function LockedChat({
  isLoggedIn,
  eventId,
}: {
  isLoggedIn: boolean;
  eventId: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
      <p className="text-4xl">🔒</p>
      <h2 className="mt-3 text-lg font-bold text-gray-900">
        Group chat is for attendees
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-gray-500">
        {isLoggedIn
          ? "Join this event to unlock the private group chat with everyone going."
          : "Log in and join this event to chat with everyone going."}
      </p>
      {!isLoggedIn && (
        <Link
          href={`/login?redirect=/events/${eventId}`}
          className="btn-primary mt-6"
        >
          Log in to join
        </Link>
      )}
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
