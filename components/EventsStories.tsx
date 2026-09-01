import Link from "next/link";
import EventCover from "./EventCover";

interface StoryEvent {
  id: string;
  title: string;
  category: string;
  cover_image_url: string | null;
}

export default function EventsStories({ events }: { events: StoryEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex gap-3">
        {/* A size smaller on phones. The rail is a browse-more affordance, and
            every pixel it takes comes straight off the reel underneath it,
            which is the thing people came for. */}
        <Link
          href="/host"
          className="flex w-14 shrink-0 flex-col items-center gap-1 sm:w-16 sm:gap-1.5"
          aria-label="Host an event"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-brand/40 bg-brand-50 text-2xl text-brand sm:h-16 sm:w-16">
            +
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-gray-600">
            Host
          </span>
        </Link>

        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1 sm:w-16 sm:gap-1.5"
          >
            <span className="rounded-full p-[2px]" style={{ background: "linear-gradient(135deg,#534AB7,#FAC775)" }}>
              <span className="block overflow-hidden rounded-full border-2 border-white">
                <EventCover
                  url={e.cover_image_url}
                  category={e.category}
                  title={e.title}
                  className="h-12 w-12 sm:h-14 sm:w-14"
                />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-gray-600">
              {e.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
