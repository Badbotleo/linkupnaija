import Link from "next/link";
import EventCover from "@/components/EventCover";
import LineIcon from "@/components/ui/LineIcon";
import CategoryBadge from "@/components/CategoryBadge";
import FriendsGoing from "./FriendsGoing";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { directionsHref } from "@/lib/directions";
import type { FeedEvent } from "@/lib/feed";
import type { FriendUser } from "@/lib/types";

/**
 * One event, full width, in a column.
 *
 * The shelf card is 268px wide and has room for a title, a date and a badge.
 * Everything else about the night has to be discovered by tapping. A column
 * card is three times the width and costs nothing extra to scroll past, so it
 * carries the things that actually decide whether someone goes: who else is
 * going, what it costs, and where it is.
 */
export default function FeedCard({
  event,
  friends,
  reason,
  mine,
}: {
  event: FeedEvent;
  friends: FriendUser[];
  reason: string;
  mine: "going" | "hosting" | null;
}) {
  const price = event.price ?? 0;

  /**
   * A night that has already happened cannot be bought a ticket for.
   *
   * This card replaced the reel on /events, and "Been and gone" is one of
   * that page's tabs, so every finished event on it was offering "Get a
   * ticket" with a ticket icon. The event page has guarded this since
   * fe930e5; the card did not, because when it was written it had never
   * been shown a past event.
   *
   * Compared as plain YYYY-MM-DD strings, which is how the column is
   * stored. Parsing to Date here would introduce a timezone where there was
   * not one: an event is on its date in Lagos, not at an instant.
   */
  const isOver = event.date < new Date().toISOString().slice(0, 10);

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:bg-white/[0.04]">
      {/* The reason line. Meta hides its ranking behind "Suggested for you";
          saying it plainly costs one line and makes the sort arguable, by
          the member and by us.

          Suppressed when friends are going, because then the reason IS the
          friend row further down and printing it twice on one card is just
          noise. Faces win, so the faces keep it. */}
      {/* WHAT IT IS, OPPOSITE WHEN IT IS.
          The category chip sat at the very bottom, under the ticket button
          and the address, which is after the decision rather than before
          it. What kind of night this is belongs beside how soon it is: the
          two facts somebody scans a card for, on one line, before the
          artwork. */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <span className="flex min-w-0 items-center gap-2">
          {/* A calendar, because every reason that reaches this line is about
              when: "Today", "15 days away in Lagos", "You said yes". The
              sparkle that used to sit here appeared on every card in the
              app and meant nothing. */}
          <LineIcon
            name={mine ? "check" : "calendar"}
            size={14}
            className={mine ? "text-brand" : "text-gray-400"}
          />
          <p
            className={`min-w-0 truncate text-[13px] ${
              mine ? "font-bold text-gray-900" : "font-medium text-gray-500"
            }`}
          >
            {friends.length > 0 ? formatEventDate(event.date) : reason}
          </p>
        </span>
        <CategoryBadge category={event.category} className="shrink-0" />
      </div>

      <Link
        href={`/events/${event.id}`}
        className="group mt-3 block"
      >
        <div className="relative">
          <EventCover
            url={event.cover_image_url}
            category={event.category}
            title={event.title}
            className="h-[196px] w-full sm:h-[260px]"
          />
          {mine === "hosting" && (
            <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
              Hosting
            </span>
          )}
          {price > 0 && !isOver && (
            <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-white backdrop-blur">
              {formatNaira(price)}
            </span>
          )}
        </div>

        <div className="px-4 pt-3">
          <h3 className="text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900 group-hover:text-brand">
            {event.title}
          </h3>
          {/* No year on an event in the current year. Every card read
              "Sun, 18 Oct 2026" and every event on the platform is 2026, so
              the year was four characters of noise on every row. */}
          <p className="mt-1 text-[13.5px] text-gray-500">
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("en-NG", {
              weekday: "short",
              day: "numeric",
              month: "short",
              ...(new Date(`${event.date}T00:00:00`).getFullYear() !==
              new Date().getFullYear()
                ? { year: "numeric" }
                : {}),
            })}
            {event.time ? ` · ${formatEventTime(event.time)}` : ""}
          </p>
          {/* A listing is somebody else's night. Saying whose, on the card,
              is the difference between carrying an event and claiming it. */}
          {event.is_listing && event.organiser_name && (
            <p className="mt-0.5 text-[13px] text-gray-500">
              By{" "}
              <span className="font-semibold text-gray-700">
                {event.organiser_name}
              </span>
            </p>
          )}
        </div>
      </Link>

      {friends.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
          <span className="min-w-0 flex-1">
            <FriendsGoing friends={friends} line={reason} />
          </span>
          <CategoryBadge category={event.category} className="shrink-0" />
        </div>
      )}

      {/* The venue name is the one piece of text here with no length limit,
          so it gets the leftover width and nothing else may wrap. Equal
          flex-1 halves put "Get a ticket" on two lines and still pushed the
          address past the card edge. */}
      <div className="mt-3 flex items-center gap-1 border-t border-gray-100 px-3 py-2 dark:border-white/10">
        <Link
          href={isOver ? `/events/${event.id}#gallery` : `/events/${event.id}`}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13.5px] font-bold text-gray-700 transition hover:bg-gray-50 dark:hover:bg-white/5"
        >
          {/* The icon follows the label. It was a calendar under every one
              of them, so "Get a ticket" came with a date picker. */}
          <LineIcon
            name={
              isOver
                ? "camera"
                : mine === "hosting"
                  ? "mic"
                  : price > 0
                    ? "ticket"
                    : mine === "going"
                      ? "check"
                      : "calendar"
            }
            size={15}
          />
          {isOver
            ? "See how it went"
            : mine === "hosting"
              ? "Your event"
              : mine === "going"
                ? "Your ticket"
                : price > 0
                  ? "Get a ticket"
                  : "Join this"}
        </Link>
        <span aria-hidden className="h-5 w-px shrink-0 bg-gray-100 dark:bg-white/10" />
        <a
          href={directionsHref(event.location, event.state)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl px-3 py-2 text-[13.5px] font-bold text-gray-700 transition hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <LineIcon name="pin" size={15} className="shrink-0" />
          {/* Venue AND state together, so the card says where exactly once.
              The top line used to carry "in FCT - Abuja" while this said
              "Kubwa", which is two different answers to the same question on
              one card. The FCT prefix is stripped the way the rest of the
              app strips it. */}
          <span className="min-w-0 truncate">
            {(() => {
              const place = event.state?.replace(/^FCT\s*-\s*/, "").trim();
              return place &&
                !event.location.toLowerCase().includes(place.toLowerCase())
                ? `${event.location}, ${place}`
                : event.location;
            })()}
          </span>
        </a>
      </div>

    </article>
  );
}
