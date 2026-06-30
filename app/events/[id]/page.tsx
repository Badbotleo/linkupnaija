import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoryBadge from "@/components/CategoryBadge";
import RsvpButton from "@/components/RsvpButton";
import ShareButtons from "@/components/ShareButtons";
import EventTabs from "@/components/EventTabs";
import ChatPanel from "@/components/ChatPanel";
import ManageRequests from "@/components/ManageRequests";
import DeleteEventButton from "@/components/DeleteEventButton";
import Avatar from "@/components/Avatar";
import AttendeeChips from "@/components/AttendeeChips";
import FriendPickerButton from "@/components/friends/FriendPickerButton";
import EventGallery from "@/components/gallery/EventGallery";
import EventCover from "@/components/EventCover";
import ReviewsSection from "@/components/ReviewsSection";
import FeatureButton from "@/components/FeatureButton";
import RatingSummary from "@/components/RatingSummary";
import FeaturedBadge, { isFeatured } from "@/components/FeaturedBadge";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { isProActive } from "@/lib/pro";
import type {
  ChatMessageUI,
  RsvpStatus,
  RsvpWithProfile,
  ReviewWithReviewer,
  EventPhoto,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const RSVP_PROFILE_SELECT =
  "id, user_id, status, paid, created_at, companion_id, users(id, name, state, avatar_url, bio, instagram_url, twitter_url, facebook_url, gender)";

interface ChatRow {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  users: { name: string | null } | null;
}

// Rich link previews per event (WhatsApp, X, etc.) using the cover image.
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, description, category, state, cover_image_url")
    .eq("id", params.id)
    .single();

  if (!event) return { title: "Event not found" };

  const title = event.title as string;
  const description =
    (event.description as string)?.slice(0, 150) ||
    `A ${event.category} in ${event.state} — join it on LinkUpNaija.`;
  const cover = event.cover_image_url as string | null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "*, host:users!events_host_id_fkey(id, name, avatar_url, state, rating_avg, rating_count, paystack_subaccount_code)"
    )
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

  // Friends of the viewer (accepted connections) → 🤝 markers in the attendee
  // list and a "your friend is going" banner.
  let friendIds: string[] = [];
  if (user) {
    const { data: conns } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    friendIds = (conns ?? []).map((c) =>
      c.requester_id === user.id ? c.receiver_id : c.requester_id
    );
  }
  const friendIdSet = new Set(friendIds);
  const friendsGoing = accepted.filter((a) => friendIdSet.has(a.user_id));

  // Pro status + this month's join-request count (free users are capped).
  let isPro = false;
  let requestsThisMonth = 0;
  if (user && !isHost) {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const [{ data: meProfile }, { count }] = await Promise.all([
      supabase
        .from("users")
        .select("is_pro, pro_expires_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString()),
    ]);
    isPro = isProActive(meProfile?.is_pro, meProfile?.pro_expires_at);
    requestsThisMonth = count ?? 0;
  }

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

  // Reviews — eligible reviewers are accepted attendees of a past event.
  const todayStr = new Date().toISOString().slice(0, 10);
  const eventIsOver = event.date < todayStr;
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("*, reviewer:users!reviews_reviewer_id_fkey(name, avatar_url)")
    .eq("event_id", params.id)
    .order("created_at", { ascending: false });
  const reviews = (reviewRows ?? []) as unknown as ReviewWithReviewer[];
  const myReview = user
    ? reviews.find((r) => r.reviewer_id === user.id) ?? null
    : null;
  const canReview = !isHost && myStatus === "accepted" && eventIsOver;

  // Post-event gallery — visible (and uploadable) to the host + accepted
  // attendees once the event date has passed.
  const canViewGallery = eventIsOver && (isHost || myStatus === "accepted");
  let galleryPhotos: EventPhoto[] = [];
  let galleryViewer: { id: string; name: string | null; avatar_url: string | null } | null =
    null;
  if (canViewGallery && user) {
    const [{ data: photoRows }, { data: viewer }] = await Promise.all([
      supabase
        .from("event_photos")
        .select(
          "id, event_id, uploader_id, photo_url, caption, created_at, uploader:users!event_photos_uploader_id_fkey(name, avatar_url)"
        )
        .eq("event_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, name, avatar_url")
        .eq("id", user.id)
        .single(),
    ]);
    galleryPhotos = (photoRows ?? []) as unknown as EventPhoto[];
    galleryViewer = viewer ?? null;
  }

  const featured = isFeatured(event.featured, event.featured_until);

  return (
    <div className="container-page py-10">
      <Link
        href="/events"
        className="text-sm font-medium text-gray-500 hover:text-brand"
      >
        ← Back to events
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl shadow-card">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-52 w-full sm:h-72"
          priority
        />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {featured && <FeaturedBadge />}
            {event.event_type === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                🔒 Private Event
              </span>
            )}
            <CategoryBadge category={event.category} />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">
              📍 {event.state}
            </span>
            {event.price > 0 && (
              <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                {formatNaira(event.price)}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {event.title}
          </h1>

          {friendsGoing.length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand">
              <span aria-hidden>🤝</span>
              <span>
                {friendsGoing.length === 1
                  ? `Your friend ${friendsGoing[0].users?.name ?? "is"} is going to this`
                  : `Your friends ${friendsGoing[0].users?.name ?? ""} and ${
                      friendsGoing.length - 1
                    } other${friendsGoing.length - 1 > 1 ? "s" : ""} are going to this`}
              </span>
            </div>
          )}

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
                      <AttendeeChips
                        attendees={accepted.map((a) => ({
                          user_id: a.user_id,
                          name: a.users?.name ?? null,
                          avatar_url: a.users?.avatar_url ?? null,
                        }))}
                        friendIds={friendIds}
                      />
                    )}

                    {/* Invite a friend — only for attendees who've joined. */}
                    {myStatus === "accepted" && (
                      <div className="mt-4">
                        <FriendPickerButton
                          mode="invite"
                          eventId={event.id}
                          eventTitle={event.title}
                          buttonLabel="🤝 Invite a Friend"
                          buttonClassName="btn-outline"
                        />
                      </div>
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
              gallery={
                canViewGallery ? (
                  <EventGallery
                    eventId={event.id}
                    eventTitle={event.title}
                    canUpload={canViewGallery}
                    isHost={isHost}
                    currentUser={galleryViewer}
                    initialPhotos={galleryPhotos}
                  />
                ) : undefined
              }
            />
          </div>

          {isHost && (
            <div className="mt-8 space-y-8">
              <ManageRequests initialRequests={rsvps} />
              <DeleteEventButton
                eventId={event.id}
                hasPaidAttendees={rsvps.some((r) => r.paid)}
              />
            </div>
          )}

          <ReviewsSection
            eventId={event.id}
            hostId={event.host_id}
            currentUserId={user?.id ?? null}
            canReview={canReview}
            initialReviews={reviews}
            existingReview={myReview}
            hostAvg={event.host?.rating_avg ?? 0}
            hostCount={event.host?.rating_count ?? 0}
          />
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
            {isHost ? (
              <FeatureButton eventId={event.id} alreadyFeatured={featured} />
            ) : (
              <>
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
                      <p className="text-sm text-gray-500">
                        {event.host.state}
                      </p>
                    )}
                    <RatingSummary
                      avg={event.host?.rating_avg ?? 0}
                      count={event.host?.rating_count ?? 0}
                      className="mt-0.5"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <RsvpButton
                    eventId={event.id}
                    isLoggedIn={!!user}
                    initialStatus={myStatus}
                    isHost={isHost}
                    isFull={isFull}
                    price={event.price}
                    isPro={isPro}
                    requestsThisMonth={requestsThisMonth}
                    eventTitle={event.title}
                    hostSubaccount={event.host?.paystack_subaccount_code ?? null}
                  />

                  {/* Secondary option: bring a friend along (both join together). */}
                  {!!user && myStatus === "none" && !isFull && (
                    <div className="mt-3">
                      <FriendPickerButton
                        mode="join"
                        eventId={event.id}
                        eventTitle={event.title}
                        buttonLabel="🤝 Join with a friend"
                        buttonClassName="btn-outline w-full"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
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
