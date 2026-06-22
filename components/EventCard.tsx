import Link from "next/link";
import CategoryBadge from "./CategoryBadge";
import EventCover from "./EventCover";
import { formatEventDate, formatEventTime } from "@/lib/format";
import type { EventRow } from "@/lib/types";

export default function EventCard({
  event,
  attendeeCount,
}: {
  event: EventRow;
  attendeeCount: number;
}) {
  const spotsLabel = event.max_attendees
    ? `${attendeeCount}/${event.max_attendees} going`
    : `${attendeeCount} going`;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
    >
      <div className="relative">
        <EventCover
          url={event.cover_image_url}
          category={event.category}
          title={event.title}
          className="h-40 w-full"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <CategoryBadge category={event.category} className="shadow-sm" />
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm">
            {event.state}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <h3 className="line-clamp-2 text-lg font-bold text-gray-900 group-hover:text-brand">
          {event.title}
        </h3>
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
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <span aria-hidden>👥</span>
            {spotsLabel}
          </span>
          <span className="text-sm font-semibold text-brand opacity-0 transition group-hover:opacity-100">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
