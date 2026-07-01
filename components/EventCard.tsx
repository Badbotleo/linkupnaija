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
  trending = false,
  recommended = false,
}: {
  event: EventRow;
  attendeeCount: number;
  hostRating?: { avg: number; count: number } | null;
  trending?: boolean;
  recommended?: boolean;
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
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            <CategoryBadge category={event.category} className="shadow-sm" />
            {event.series_id && (
              <span className="rounded-full bg-brand/90 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                🔄 Series
              </span>
            )}
            {trending && (
              <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                🔥 Trending
              </span>
            )}
            {event.is_corporate && (
              <span className="rounded-full bg-[#1A1040] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                🏢 Corporate
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
            ✨ Recommended for you
          </p>
        )}
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

      {/* Facebook-style reaction row */}
      <div className="flex border-t border-gray-100">
        <Reaction href={`/events/${event.id}`} icon="star" label="Interested" />
        <Reaction href={`/events/${event.id}`} icon="check" label="Going" />
        <Reaction href={`/events/${event.id}`} icon="share" label="Share" />
      </div>
    </div>
  );
}

function Reaction({ href, icon, label }: { href: string; icon: string; label: string }) {
  const paths: Record<string, string> = {
    star: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7L12 2z",
    check: "M20 6 9 17l-5-5",
    share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  };
  return (
    <Link
      href={href}
      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-brand-50 hover:text-brand"
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={paths[icon]} />
      </svg>
      {label}
    </Link>
  );
}
