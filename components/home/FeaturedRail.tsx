import Link from "next/link";
import Rail from "./Rail";
import EventCover from "@/components/EventCover";
import LineIcon from "@/components/ui/LineIcon";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { getFeaturedEvents } from "@/lib/featured";

/**
 * The featured shelf, on both home pages.
 *
 * Renders nothing when nothing is featured — an empty "Featured" heading
 * advertises that we had nothing worth pushing.
 */
export default async function FeaturedRail() {
  const events = await getFeaturedEvents(6);
  if (events.length === 0) return null;

  return (
    <Rail
      title="Featured"
      subtitle="Worth your Saturday"
      href="/events"
      seeAll="See all events"
    >
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="group w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px] lg:w-full lg:max-w-none"
        >
          <div className="relative h-[176px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            <EventCover
              url={e.cover_image_url}
              category={e.category}
              title={e.title}
              className="absolute inset-0 h-full w-full"
              fit="cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#FAC775] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#121212]">
              <LineIcon name="star" size={10} />
              Featured
            </span>

            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
              {/* The partner gets the credit on their own boosted events. */}
              {e.partner && (
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                  {e.partner.name}
                </p>
              )}
              <p className="line-clamp-2 text-[16px] font-extrabold leading-tight">
                {e.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-white/75">
                {formatEventDate(e.date)} · {formatEventTime(e.time)}
              </p>
              {e.price > 0 && (
                <p className="mt-1 text-[12px] font-extrabold tabular-nums">
                  {formatNaira(e.price)}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </Rail>
  );
}
