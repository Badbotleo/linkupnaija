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
import { eventJsonLd, jsonLdScript } from "@/lib/structured-data";
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
  "id, user_id, status, paid, created_at, companion_id, attended, users!rsvps_user_id_fkey(id, name, state, avatar_url, bio, instagram_url, twitter_url, facebook_url, gender, is_pro, pro_expires_at)";

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
    alternates: { canonical: `/events/${params.id}` },
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

  // "Merit House, Abuja, FCT" plus "FCT - Abuja" reads as "…FCT, FCT - Abuja".
  // Hosts usually type the city into the address already, so the state is only
  // shown when it adds something. Compared on the part after the dash, because
  // the state is stored as "FCT - Abuja" and nobody writes that.
  const stateSuffix = (() => {
    const short = (event.state ?? "").split("-").pop()?.trim() ?? "";
    const already =
      !!short && (event.location ?? "").toLowerCase().includes(short.toLowerCase());
    return event.state && !already ? event.state : "";
  })();

  return (
    <div className="container-page py-10">
      {/* Back, as a target rather than a 14px text link.
          "← Back to events" was about 20px tall, half a thumb, and it was the
          first thing on the page. */}
      <Link
        href="/events"
        aria-label="Back to events"
        className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-gray-700 shadow-[var(--e1)] transition-transform duration-150 active:scale-[0.94] dark:bg-white/10 dark:text-white"
      >
        <LineIcon name="chevronLeft" size={20} />
      </Link>

      {/* Only for people who are not already in. A host, or somebody whose
          request is already accepted, has nothing to tap. */}
      {!isHost && myStatus !== "accepted" && (
        <StickyJoinBar
          targetId="join-cta"
          price={event.price > 0 ? formatNaira(event.price) : null}
          label={event.price > 0 ? "Get a ticket" : "Ask to join"}
        />
      )}

      {/* Event structured data. Turns a blue link into a result showing the
          date, the place and the price, and makes this page eligible for
          Google's events carousel — which is where "things to do in Lagos
          this weekend" actually lands. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            eventJsonLd({
              id: event.id,
              title: event.title,
              description: event.description,
              date: event.date,
              time: event.time,
              end_time: (event as { end_time?: string | null }).end_time,
              location: event.location,
              state: event.state,
              price: event.price,
              cover_image_url: event.cover_image_url,
              host: { id: event.host_id, name: event.host?.name ?? null },
            })
          ),
        }}
      />

      {/* The flyer, then what it is, then the facts. One decision, in the
          order it gets made.

          The page used to open on a back link, a poster and a host's face,
          then ask you to join something it had not yet named: the title
          rendered around 930px down an 812px phone. Title and facts came up
          in August, and this finishes the job by giving them a shape. */}
      <div className="overflow-hidden rounded-[26px] bg-gray-900 shadow-[var(--e3)]">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-[19rem] w-full sm:h-[26rem]"
          priority
          fit="contain"
        />
      </div>

      {/* Labels live under the artwork, never on it. On a flyer the corners
          are where the host printed the date. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {featured && <FeaturedBadge />}
        <CategoryBadge category={event.category} />
        <span className="rounded-full bg-gray-900/[0.06] px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-white/80">
          {event.state}
        </span>
        {event.is_corporate && (
          <span className="rounded-full bg-[#121212] px-2.5 py-1 text-xs font-bold text-white">
            Corporate
          </span>
        )}
        {event.event_type === "private" && (
          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
            Private
          </span>
        )}
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
      </div>

      <h1 className="mt-3 text-[28px] font-extrabold leading-[1.08] tracking-[-0.035em] text-gray-900 sm:text-[34px] dark:text-white">
        {event.title}
      </h1>

      {/* One aligned icon column and hairline rules, in place of a four-box
          grid that lived behind a tab. These are the facts the decision is
          made on, so they are not a tab. */}
      <dl className="mt-4 divide-y divide-gray-200/70 rounded-2xl bg-white px-4 shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
        <Fact
          icon="calendar"
          label={formatEventDate(event.date)}
          sub={
            event.time
              ? formatEventTimeRange(
                  event.time,
                  (event as { end_time?: string | null }).end_time
                )
              : null
          }
        />
        {event.location && (
          <Fact icon="pin" label={event.location} sub={stateSuffix || null} />
        )}
        {event.price > 0 && (
          <Fact
            icon="ticket"
            label={formatNaira(event.price)}
            sub="Per person"
          />
        )}
      </dl>

      {friendsGoing.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand dark:bg-brand/20">
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
          {/* The chips and the friends banner moved under the flyer, where
              they belong to the thing they describe. Rendered here as well,
              they appeared twice on one screen. */}

          <div className="mt-6">
            <EventTabs
              details={
                <div className="space-y-8">
                  {/* The date/time/location/attendees grid that used to open
                      this tab is gone: it repeated, in four boxes behind a
                      tab, the facts strip that now sits under the title. Share
                      is what is actually left to do here. */}
                  <div className="rounded-2xl bg-white p-5 shadow-[var(--e1)] dark:bg-white/[0.04]">
                    <ShareButtons
                      title={event.title}
                      dateLabel={formatEventDate(event.date)}
                      location={event.location}
                    />
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
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:border-brand/30"
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
                {/* One row, one tap target, leading to the host.
                    This was a label, an avatar, a name, a state line, a
                    rating, a badge row and a socials row stacked in a bordered
                    card, above the button it was competing with. Trust is
                    worth one line and a chevron here; the rest of it lives on
                    the profile the row opens. */}
                <Link
                  href={`/u/${event.host_id}`}
                  className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-3 transition-transform duration-150 active:scale-[0.99] dark:bg-white/[0.04]"
                >
                  <Avatar
                    name={event.host?.name ?? null}
                    url={event.host?.avatar_url ?? null}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-bold text-gray-900 dark:text-white">
                        {event.host?.name ?? "A LinkUpNaija host"}
                      </span>
                      {/* isProActive rather than the raw flag: an expired
                          subscription is not Pro. */}
                      {isProActive(
                        event.host?.is_pro,
                        event.host?.pro_expires_at
                      ) && <ProBadge size={15} />}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <RatingSummary
                        avg={event.host?.rating_avg ?? 0}
                        count={event.host?.rating_count ?? 0}
                      />
                      {hostBadges.length > 0 && (
                        <HostBadges badges={hostBadges} compact max={2} />
                      )}
                    </span>
                  </span>
                  <LineIcon
                    name="chevronRight"
                    size={16}
                    className="shrink-0 text-gray-400"
                  />
                </Link>

                {/* How full it is, at the moment of deciding. This lived under
                    "Who's going" inside a tab, which is the one place it
                    cannot do its job: scarcity is a reason to act, and it was
                    behind the button. */}
                <div className="mt-4">
                  <QuorumMeter state={quorum} paid={(event.price ?? 0) > 0} />
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

function Fact({
  icon,
  label,
  sub,
}: {
  icon: string;
  label: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <span
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/[0.08] text-brand"
        aria-hidden
      >
        <LineIcon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <dt className="text-[15px] font-bold leading-snug text-gray-900 dark:text-white">
          {label}
        </dt>
        {sub && (
          <dd className="mt-0.5 text-[13.5px] leading-snug text-gray-500">
            {sub}
          </dd>
        )}
      </div>
    </div>
  );
}
