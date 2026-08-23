import Link from "next/link";
import CardActions from "./events/CardActions";
import CategoryBadge from "./CategoryBadge";
import EventCover from "./EventCover";
import FeaturedBadge, { isFeatured } from "./FeaturedBadge";
import RatingSummary from "./RatingSummary";
import LineIcon from "./ui/LineIcon";
import HostBadges from "./host/HostBadges";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { attendanceProof } from "@/lib/social-proof";
import { capacityBand } from "@/lib/capacity-band";
import type { EventRow } from "@/lib/types";
import type { Badge } from "@/lib/hostBadges";

export default function EventCard({
  event,
  attendeeCount,
  hostRating,
  hostBadges,
  trending = false,
  recommended = false,
  friendsGoing,
}: {
  event: EventRow;
  attendeeCount: number;
  hostRating?: { avg: number; count: number } | null;
  hostBadges?: Badge[];
  trending?: boolean;
  recommended?: boolean;
  friendsGoing?: { count: number; names: string[]; avatars: (string | null)[] };
}) {
  const featured = isFeatured(event.featured, event.featured_until);
  // Every attendee number on the site goes through this. It may return null,
  // in which case the row renders nothing rather than an empty pill.
  const proof = attendanceProof(attendeeCount, {
    capacity: event.max_attendees,
    createdAt: event.created_at,
  });

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
        featured
          ? "border-amber-300 ring-1 ring-amber-200"
          : "border-gray-100 hover:border-brand/40"
      }`}
    >
      <Link href={`/events/${event.id}`} className="flex flex-1 flex-col">
      <div className="relative overflow-hidden">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-40 w-full transition-transform duration-300 group-hover:scale-105"
        fit="contain"
          />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            <CategoryBadge category={event.category} className="shadow-sm" />
            {event.series_id && (
              <span className="rounded-full bg-brand/90 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                Series
              </span>
            )}
            {trending && (
              <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                Trending
              </span>
            )}
            {event.is_corporate && (
              <span className="rounded-full bg-[#121212] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                Corporate
              </span>
            )}
          </div>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm">
            {event.state}
          </span>
        </div>
        {featured && (
          <div className="absolute bottom-3 left-3">
            <FeaturedBadge />
          </div>
        )}
        {event.price > 0 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-bold text-white">
            {formatNaira(event.price)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4">
        {recommended && (
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
            Recommended for you
          </p>
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold text-gray-900 group-hover:text-brand">
            {event.title}
          </h3>
        </div>
        {/* Guard on count, not on the object: an unrated host now renders
            nothing, and an empty flex row would still take up space. */}
        {((hostRating && hostRating.count > 0) ||
          (hostBadges && hostBadges.length > 0)) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {hostRating && (
              <RatingSummary avg={hostRating.avg} count={hostRating.count} />
            )}
            {hostBadges && hostBadges.length > 0 && (
              <span className="text-sm">
                <HostBadges badges={hostBadges} compact max={2} />
              </span>
            )}
          </div>
        )}
        <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">
          {event.description}
        </p>

        <dl className="mt-4 space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <LineIcon name="calendar" size={15} className="shrink-0 text-gray-400" />
            <span>
              {formatEventDate(event.date)} ·{" "}
              {formatEventTimeRange(
                event.time,
                (event as { end_time?: string | null }).end_time
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LineIcon name="pin" size={15} className="shrink-0 text-gray-400" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
          {/* Scale from the host's capacity, not the RSVP count — true from
              the moment a listing exists, and it never reveals that nobody
              has joined yet. */}
          {capacityBand(event.max_attendees) && (
            <div className="flex items-center gap-2">
              <LineIcon name="users" size={15} className="shrink-0 text-gray-400" />
              <span>{capacityBand(event.max_attendees)} people</span>
            </div>
          )}
        </dl>

        {friendsGoing && friendsGoing.count > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {friendsGoing.avatars.map((url, i) =>
                url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-6 w-6 rounded-full border-2 border-white object-cover"
                  />
                ) : (
                  <span
                    key={i}
                    className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-brand text-[10px] font-bold text-white"
                    aria-hidden
                  >
                    {(friendsGoing.names[i] ?? "?").charAt(0).toUpperCase()}
                  </span>
                )
              )}
            </div>
            <span className="text-xs font-semibold text-brand">
              {friendsGoing.count === 1
                ? `${friendsGoing.names[0]} is going`
                : `${friendsGoing.names[0]} + ${friendsGoing.count - 1} ${
                    friendsGoing.count - 1 === 1 ? "friend" : "friends"
                  } going`}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          {/* Empty span keeps "View →" hard right when there's no proof to show. */}
          {proof ? (
            proof.tone === "urgent" ? (
              <span className="inline-flex animate-spot-pulse items-center gap-1.5 text-sm font-bold text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                {proof.label}
              </span>
            ) : proof.tone === "warm" ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                <LineIcon name="sparkles" size={15} className="text-brand/70" />
                {proof.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                <LineIcon name="users" size={15} className="text-gray-400" />
                {proof.label}
              </span>
            )
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">
            View →
          </span>
        </div>
      </div>
      </Link>

      {/* Reactions act in place — no trip into the event page */}
      <CardActions
        eventId={event.id}
        eventTitle={event.title}
        price={event.price ?? 0}
      />
    </div>
  );
}

