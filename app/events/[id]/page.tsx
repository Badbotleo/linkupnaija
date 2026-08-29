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
import ApprovedGuests from "@/components/events/ApprovedGuests";
import QuorumMeter from "@/components/events/QuorumMeter";
import ViewRecorder from "@/components/events/ViewRecorder";
import { quorumState } from "@/lib/quorum";
import FriendPickerButton from "@/components/friends/FriendPickerButton";
import SharePlansButton from "@/components/safety/SharePlansButton";
import AddToCalendar from "@/components/AddToCalendar";
import ReportButton from "@/components/ReportButton";
import LineIcon from "@/components/ui/LineIcon";
import TicketButton from "@/components/TicketButton";
import SafetyCheckinButton from "@/components/safety/SafetyCheckinButton";
import EventGallery from "@/components/gallery/EventGallery";
import EventCover from "@/components/EventCover";
import ReviewsSection from "@/components/ReviewsSection";
import FeatureButton from "@/components/FeatureButton";
import RatingSummary from "@/components/RatingSummary";
import ProBadge from "@/components/ProBadge";
import HostBadges from "@/components/host/HostBadges";
import HostSocials from "@/components/host/HostSocials";
import { computeBadges } from "@/lib/hostBadges";
import FeaturedBadge, { isFeatured } from "@/components/FeaturedBadge";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { attendanceProof, ATTENDANCE_REVEAL_AT } from "@/lib/social-proof";
import TicketPanel from "@/components/events/TicketPanel";
import TicketTiersEditor from "@/components/events/TicketTiersEditor";
import EventPictures from "@/components/events/EventPictures";
import StickyJoinBar from "@/components/events/StickyJoinBar";
import RecapReel from "@/components/home/RecapReel";
import { getRecapsForEvent } from "@/lib/recaps";
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
  "id, user_id, status, paid, created_at, companion_id, attended, users!rsvps_user_id_fkey(id, name, state, avatar_url, bio, instagram_url, twitter_url, facebook_url, gender)";

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
    `A ${event.category} in ${event.state}. Join it on LinkUpNaija.`;
  const cover = event.cover_image_url as string | null;

  // The images themselves come from opengraph-image.tsx alongside this file,
  // which renders a branded card for EVERY event — Next injects those tags, so
  // listing `images` here would override them with a bare photo.
  void cover;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
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
      "*, host:users!events_host_id_fkey(id, name, avatar_url, state, rating_avg, rating_count, paystack_subaccount_code, instagram_url, twitter_url, facebook_url, is_pro, pro_expires_at)"
    )
    .eq("id", params.id)
    .single();

  if (!event) notFound();

  // chat_approved arrives with migration-chat-approval.sql. Asked for first,
  // and dropped if the column isn't there yet.
  //
  // Selecting a missing column doesn't error into anything the page shows —
  // it returns no rows, so the guest list, the attendance count and the host's
  // request queue would all quietly render empty on an event that has
  // attendees. A blank guest list looks like nobody came, which is the single
  // worst thing this page can say wrongly.
  // The two selects return different shapes, so the result is typed once here
  // rather than fighting the inferred union at every use site.
  let rsvpRows: unknown[] | null = null;
  {
    const enriched = await supabase
      .from("rsvps")
      .select(`${RSVP_PROFILE_SELECT}, chat_approved`)
      .eq("event_id", params.id)
      .order("created_at", { ascending: true });
    if (enriched.data) {
      rsvpRows = enriched.data;
    } else {
      const base = await supabase
        .from("rsvps")
        .select(RSVP_PROFILE_SELECT)
        .eq("event_id", params.id)
        .order("created_at", { ascending: true });
      rsvpRows = base.data;
    }
  }

  const rsvps = (rsvpRows ?? []) as unknown as RsvpWithProfile[];
  const accepted = rsvps.filter((r) => r.status === "accepted");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The home-page reel links here, so the footage has to be here too.
  const eventRecaps = await getRecapsForEvent(params.id);

  // Ticket tiers, in their own query rather than embedded in the event
  // select: if the migration hasn't run, an embed would fail the WHOLE event
  // query and take the page down. On its own, a missing table just means no
  // tiers and the single price shows as before.
  const { data: tierRows } = await supabase
    .from("ticket_tiers")
    .select("id, name, price, description, admits")
    .eq("event_id", params.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("price", { ascending: true });
  const tiers = (tierRows ?? []) as {
    id: string;
    name: string;
    price: number;
    description: string | null;
    admits: number | null;
  }[];

  // The partner behind this event, when there is one. Its own query for the
  // same reason as the tiers: embedded, a missing table would fail the whole
  // event select and take the page down.
  interface PartnerBadge {
    slug: string;
    name: string;
    logo_url: string | null;
  }
  let partner: PartnerBadge | null = null;
  const partnerId = (event as { partner_id?: string | null }).partner_id;
  if (partnerId) {
    const { data } = await supabase
      .from("partners")
      .select("slug, name, logo_url")
      .eq("id", partnerId)
      .eq("is_active", true)
      .maybeSingle();
    partner = (data as PartnerBadge | null) ?? null;
  }

  const attendeeCount = accepted.length;
  const attendance = attendanceProof(attendeeCount, {
    capacity: event.max_attendees,
    createdAt: event.created_at,
    past: !!event.date && event.date < new Date().toISOString().slice(0, 10),
  });
  const isHost = !!user && user.id === event.host_id;
  const myRsvpId = user
    ? (rsvps.find((r) => r.user_id === user.id)?.id ?? null)
    : null;
  const myStatus: "none" | RsvpStatus = user
    ? (rsvps.find((r) => r.user_id === user.id)?.status ?? "none")
    : "none";
  const isFull =
    !!event.max_attendees && attendeeCount >= event.max_attendees;

  // "Nobody goes alone" — null min_attendees means this is an ordinary event
  // and the meter renders nothing.
  const quorum = quorumState({
    minAttendees: (event as { min_attendees?: number | null }).min_attendees,
    price: event.price,
    going: attendeeCount,
    date: event.date,
    quorumMetAt: (event as { quorum_met_at?: string | null }).quorum_met_at,
  });

  // Reserve-first: a paid event with a minimum the room hasn't reached yet.
  // Nothing is charged until quorum is met, so no refund is ever needed.
  const reserveFirst = quorum.kind === "pending" && (event.price ?? 0) > 0;

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

  // Host reputation badges (attendee-facing trust signal).
  const { data: hostStatsRow } = await supabase
    .from("host_stats")
    .select("*")
    .eq("host_id", event.host_id)
    .maybeSingle();
  const hostBadges = computeBadges(
    (hostStatsRow as import("@/lib/types").HostStats | null) ?? null
  );

  // Pro status + this month's join-request count (free users are capped).
  let isPro = false;
  let requestsThisMonth = 0;
  let walletBalance = 0;
  let myName = "A LinkUpNaija member";
  let emergencyContact: { name: string | null; phone: string | null } = {
    name: null,
    phone: null,
  };
  if (user && !isHost) {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const [{ data: meProfile }, { count }] = await Promise.all([
      supabase
        .from("users")
        .select(
          "name, is_pro, pro_expires_at, wallet_balance, emergency_contact_name, emergency_contact_phone"
        )
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
    walletBalance = meProfile?.wallet_balance ?? 0;
    myName = meProfile?.name ?? myName;
    emergencyContact = {
      name: meProfile?.emergency_contact_name ?? null,
      phone: meProfile?.emergency_contact_phone ?? null,
    };
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

      {/* What, when and where — before the flyer.
          
          The title used to render at about 930px on an 812px phone: below the
          fold on every device an ad click arrives from. A stranger saw a back
          link, a poster and the host's face, then a button asking them to join
          something the page had not yet named. Date and location were further
          down again, inside a tab nobody had opened.
          
          Deciding whether to go IS what, when and where. It goes first, and
          the flyer becomes what it actually is: supporting art. */}
      <h1 className="mt-4 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 sm:text-4xl">
        {event.title}
      </h1>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] font-semibold text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <LineIcon name="calendar" size={15} className="shrink-0 text-brand" />
          {formatEventDate(event.date)}
          {event.time
            ? ` · ${formatEventTimeRange(
                event.time,
                (event as { end_time?: string | null }).end_time
              )}`
            : ""}
        </span>
        {event.location && (
          <span className="inline-flex items-center gap-1.5">
            <LineIcon name="pin" size={15} className="shrink-0 text-brand" />
            {event.location}
            {/* "Merit House, Abuja, FCT" + "FCT - Abuja" read as
                "…FCT, FCT - Abuja". Hosts usually type the city into the
                address already, so the state is only appended when it adds
                something. Compared on the part after the dash, because the
                state is stored as "FCT - Abuja" and nobody writes that. */}
            {(() => {
              const short = (event.state ?? "").split("-").pop()?.trim() ?? "";
              const already =
                !!short &&
                (event.location ?? "").toLowerCase().includes(short.toLowerCase());
              return event.state && !already ? `, ${event.state}` : "";
            })()}
          </span>
        )}
      </p>

      {/* Only for people who are not already in. A host, or somebody whose
          request is already accepted, has nothing to tap. */}
      {!isHost && myStatus !== "accepted" && (
        <StickyJoinBar
          targetId="join-cta"
          label={
            event.price > 0
              ? `Get a ticket · ${formatNaira(event.price)}`
              : "Ask to join — free"
          }
        />
      )}

      <div className="mt-4 overflow-hidden rounded-2xl shadow-card">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-80 w-full sm:h-[26rem]"
          priority
          fit="contain"
        />
      </div>

      {/* The host's other pictures. `gallery_urls` only exists once
          migration-event-gallery.sql has run, so read it defensively —
          `select("*")` simply won't return the key before then. */}
      {Array.isArray((event as { gallery_urls?: string[] }).gallery_urls) &&
        (event as { gallery_urls: string[] }).gallery_urls.length > 0 && (
          <EventPictures
            urls={(event as { gallery_urls: string[] }).gallery_urls}
            title={event.title}
          />
        )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {featured && <FeaturedBadge />}
            {event.is_corporate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#121212] px-2.5 py-1 text-xs font-bold text-white">
                Corporate Event
              </span>
            )}
            {event.event_type === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                Private Event
              </span>
            )}
            {/* The partner was invisible here: their page existed and nothing
                on the event pointed at it. */}
            {partner && (
              <Link
                href={`/partners/${partner.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] px-2.5 py-1 text-xs font-bold text-white transition hover:opacity-90"
              >
                {partner.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={partner.logo_url}
                    alt=""
                    className="h-3.5 w-auto max-w-[54px] object-contain"
                  />
                ) : null}
                {partner.name}
                <LineIcon name="chevronRight" size={11} />
              </Link>
            )}
            <CategoryBadge category={event.category} />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">
              {event.state}
            </span>
            {/* The price used to sit here as a chip, the same weight as the
                state. It's now the Buy Ticket panel further down. */}
          </div>

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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Detail
                        icon="calendar"
                        label="Date"
                        value={formatEventDate(event.date)}
                      />
                      <Detail
                        icon="clock"
                        label="Time"
                        value={formatEventTimeRange(
                          event.time,
                          (event as { end_time?: string | null }).end_time
                        )}
                      />
                      <Detail
                        icon="pin"
                        label="Location"
                        value={event.location}
                      />
                      {/* Drops out entirely when there's nothing worth saying,
                          rather than announcing "0 / 15". */}
                      {attendance && (
                        <Detail
                          icon="users"
                          label="Attendees"
                          value={attendance.label}
                        />
                      )}
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <ShareButtons
                        title={event.title}
                        dateLabel={formatEventDate(event.date)}
                        location={event.location}
                      />
                    </div>
                  </div>

                  {eventRecaps.length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        How it went
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Tap to watch
                      </p>
                      <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
                        <RecapReel recaps={eventRecaps} />
                      </div>
                    </div>
                  )}

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
                      Who&apos;s going
                      {attendeeCount >= ATTENDANCE_REVEAL_AT
                        ? ` (${attendeeCount})`
                        : ""}
                    </h2>
                    {/* The counter goes above the faces: when a room is
                        nearly empty the gap to the target is the reason to
                        join, and the faces are not. */}
                    <div className="mt-2">
                      <QuorumMeter
                        state={quorum}
                        paid={(event.price ?? 0) > 0}
                      />
                    </div>
                    <div className="mt-2">
                      <ApprovedGuests
                        count={attendeeCount}
                        guests={accepted.map((a) => ({
                          user_id: a.user_id,
                          name: a.users?.name ?? null,
                          avatar_url: a.users?.avatar_url ?? null,
                          gender: a.users?.gender ?? null,
                          isHost: a.user_id === event.host_id,
                        }))}
                        friendIds={friendIds}
                      />
                    </div>

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
              {/* Numbers first: before deciding whether the guest list is the
                  problem, a host wants to know how many people got as far as
                  looking. */}
              <Link
                href={`/events/${event.id}/analytics`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-brand/30"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-brand">
                    <LineIcon name="trending" size={17} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-extrabold text-gray-900">
                      See your event analytics
                    </span>
                    <span className="block text-[13px] text-gray-500">
                      Where people drop off between looking and turning up
                    </span>
                  </span>
                </span>
                <LineIcon name="chevronRight" size={16} className="shrink-0 text-gray-400" />
              </Link>

              {/* Only the host sees this; RLS is what actually enforces it. */}
              {!eventIsOver && <TicketTiersEditor eventId={event.id} />}
              <ManageRequests initialRequests={rsvps} isPast={eventIsOver} />
              <DeleteEventButton
                eventId={event.id}
                hasPaidAttendees={rsvps.some((r) => r.paid)}
              />
            </div>
          )}

          <ViewRecorder eventId={event.id} isHost={isHost} />

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
        <aside className="order-first lg:order-none lg:col-span-1">
          <div className="surface sticky top-24 p-6 lg:shadow-raised">
            {isHost ? (
              <FeatureButton eventId={event.id} alreadyFeatured={featured} />
            ) : (
              <>
                <p className="text-sm text-gray-500">Hosted by</p>
                <div className="mt-2 flex items-center gap-3">
                  {/* The one page where somebody decides whether to trust a
                      stranger with money and an address. "Who is this?" has
                      to lead somewhere. */}
                  <Link href={`/u/${event.host_id}`} className="shrink-0">
                    <Avatar
                      name={event.host?.name ?? null}
                      url={event.host?.avatar_url ?? null}
                      size="md"
                    />
                  </Link>
                  <div>
                    <span className="flex items-center gap-1.5">
                      <Link
                        href={`/u/${event.host_id}`}
                        className="font-bold text-gray-900 hover:text-brand hover:underline"
                      >
                        {event.host?.name ?? "A LinkUpNaija host"}
                      </Link>
                      {/* is_pro was fetched for the VIEWER and never for the
                          host, so a Pro host's badge could never render here.
                          Checked through isProActive rather than the raw flag,
                          because an expired subscription is not Pro. */}
                      {isProActive(
                        event.host?.is_pro,
                        event.host?.pro_expires_at
                      ) && <ProBadge size={15} />}
                    </span>
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
                    {hostBadges.length > 0 && (
                      <div className="mt-1.5">
                        <HostBadges badges={hostBadges} max={3} />
                      </div>
                    )}
                    <HostSocials
                      instagram={event.host?.instagram_url ?? null}
                      twitter={event.host?.twitter_url ?? null}
                      facebook={event.host?.facebook_url ?? null}
                    />
                  </div>
                </div>

                {(event.price > 0 || tiers.length > 0) && (
                  <div className="mt-6">
                    <TicketPanel price={event.price} tiers={tiers} />
                  </div>
                )}

                <div className="mt-6" id="join-cta">
                  <RsvpButton
                    eventId={event.id}
                    isLoggedIn={!!user}
                    initialStatus={myStatus}
                    isHost={isHost}
                    isFull={isFull}
                    price={event.price}
                    tiers={tiers}
                    isPro={isPro}
                    requestsThisMonth={requestsThisMonth}
                    eventTitle={event.title}
                    hostSubaccount={event.host?.paystack_subaccount_code ?? null}
                    walletBalance={walletBalance}
                    reserveFirst={reserveFirst}
                    eventDate={event.date}
                    eventTime={event.time}
                    eventLocation={event.location}
                    autoConfirm={
                      (event as { auto_confirm?: boolean | null })
                        .auto_confirm === true && (event.price ?? 0) === 0
                    }
                  />

                  {/* Add to calendar — cheapest no-show reducer. */}
                  <div className="mt-3">
                    <AddToCalendar
                      event={{
                        id: event.id,
                        title: event.title,
                        description: event.description,
                        location: event.location,
                        date: event.date,
                        time: event.time,
                      }}
                    />
                  </div>

                  {/* Ride to the venue — prefilled with this event's address
                      so the rider only picks their pick-up point. */}
                  <div className="mt-3">
                    <Link
                      href={`/rides?to=${encodeURIComponent(
                        [event.location, event.state].filter(Boolean).join(", ")
                      )}&event=${event.id}&title=${encodeURIComponent(event.title)}`}
                      className="btn-outline flex w-full items-center justify-center gap-2"
                    >
                      <LineIcon name="car" size={17} />
                      Hail a ride to this event
                    </Link>
                  </div>

                  {/* QR ticket for accepted attendees — scan at the door. */}
                  {myStatus === "accepted" && myRsvpId && (
                    <div className="mt-3">
                      <TicketButton
                        rsvpId={myRsvpId}
                        eventTitle={event.title}
                        attendeeName={myName}
                      />
                    </div>
                  )}

                  {/* Secondary option: bring a friend along (both join
                      together). Not on an event that's already been and gone. */}
                  {!!user && myStatus === "none" && !isFull && !eventIsOver && (
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

                  {/* Safety: share your plans with a trusted contact. */}
                  {!!user && myStatus === "accepted" && (
                    <div className="mt-3">
                      <SharePlansButton
                        eventId={event.id}
                        eventTitle={event.title}
                        eventDate={event.date}
                        eventLocation={event.location}
                        hostName={event.host?.name ?? "the host"}
                        userName={myName}
                        defaultContactName={emergencyContact.name}
                        defaultContactPhone={emergencyContact.phone}
                      />
                      {eventIsOver && (
                        <div className="mt-2">
                          <SafetyCheckinButton eventId={event.id} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Report this event */}
                  {!isHost && (
                    <div className="mt-4 text-center">
                      <ReportButton
                        targetType="event"
                        targetId={event.id}
                        isLoggedIn={!!user}
                        label="Report this event"
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
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand" aria-hidden>
        <LineIcon name={icon} size={16} />
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
