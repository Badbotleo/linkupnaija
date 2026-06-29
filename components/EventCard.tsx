import Link from "next/link";
import CategoryBadge from "./CategoryBadge";
import EventCover from "./EventCover";
import FeaturedBadge, { isFeatured } from "./FeaturedBadge";
import RatingSummary from "./RatingSummary";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import type { EventRow } from "@/lib/types";

export default function EventCard({
  event,
  attendeeCount,
  hostRating,
}: {
  event: EventRow;
  attendeeCount: number;
  hostRating?: { avg: number; count: number } | null;
}) {
  const spotsLabel = event.max_attendees
    ? `${attendeeCount}/${event.max_attendees} going`
    : `${attendeeCount} going`;
  const featured = isFeatured(event.featured, event.featured_until);
  const spotsLeft = event.max_attendees
    ? event.max_attendees - attendeeCount
    : null;
  const lowSpots = spotsLeft !== null && spotsLeft > 0 && spotsLeft < 5;

  return (
    <Link
      href={`/events/${event.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition-all duration-200 hover:-translate-y-2 hover:shadow-xl ${
        featured
          ? "border-amber-300 ring-1 ring-amber-200"
          : "border-gray-100 hover:border-brand/40 hover:ring-2 hover:ring-brand/15"
      }`}
    >
      <div className="relative overflow-hidden">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-40 w-full transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <CategoryBadge category={event.category} className="shadow-sm" />
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold text-gray-900 group-hover:text-brand">
            {event.title}
          </h3>
        </div>
        {hostRating && (
          <RatingSummary
            avg={hostRating.avg}
            count={hostRating.count}
            className="mt-1"
          />
        )}
        <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">
          {event.description}
        </p>

        <dl className="mt-4 space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span aria-hidden>📅</span>
            <span>
              {formatEventDate(event.date)} · {formatEventTime(event.time)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>📍</span>
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          {lowSpots ? (
            <span className="inline-flex animate-spot-pulse items-center gap-1.5 text-sm font-bold text-red-600">
              <span aria-hidden>🔥</span>
              {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <span aria-hidden>👥</span>
              {spotsLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
