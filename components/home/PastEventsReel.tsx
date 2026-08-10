import Link from "next/link";
import Rail from "./Rail";
import LineIcon from "../ui/LineIcon";
import { getRecapsFor } from "@/lib/recaps";
import { formatEventDate } from "@/lib/format";

/**
 * "This actually happened" — recap footage from past events.
 *
 * Everything else on the home page is a promise about the future: upcoming
 * listings, ideas to host, attendee counts that are mostly zero. This is the
 * one shelf that shows a night that already went ahead, with a crowd in it.
 *
 * Every card links back to its event page where the link still exists, so the
 * footage isn't a dead end — you can see who hosted it and what else they're
 * running.
 */
export default async function PastEventsReel({
  state,
}: {
  state?: string | null;
}) {
  const recaps = await getRecapsFor(state, 12);
  // No recaps yet → render nothing. An empty "this actually happened" shelf
  // would say the opposite of what it exists to say.
  if (recaps.length === 0) return null;

  return (
    <Rail
      title="This actually happened"
      subtitle="Recent link-ups, as they went down"
      href="/events?tab=past"
      seeAll="See past events"
    >
      {recaps.map((r) => {
        const card = (
          <div className="relative h-[248px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            {r.mediaType === "video" ? (
              /* Muted + playsInline is what lets it autoplay on iOS at all;
                 without both, Safari shows a paused black frame. */
              <video
                src={r.mediaUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={r.mediaUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            )}

            {/* Lighter scrim when there's no caption to make readable — these
                clips often carry their own text and shouldn't be dimmed
                behind one that isn't there. */}
            <div
              className={`absolute inset-0 bg-gradient-to-t ${
                r.title || r.event
                  ? "from-black/85 via-black/25 to-transparent"
                  : "from-black/45 via-transparent to-transparent"
              }`}
            />

            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-gray-900">
              <LineIcon name="check" size={11} />
              Happened
            </span>

            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
              {r.title && (
                <p className="text-[16px] font-extrabold leading-tight">
                  {r.title}
                </p>
              )}
              {r.event && (
                <p className="mt-0.5 truncate text-xs font-semibold text-white/85">
                  {r.event.title}
                </p>
              )}
              {r.event && (
                <p className="mt-0.5 text-[11px] text-white/60">
                  {formatEventDate(r.event.date)}
                  {r.state ? ` · ${r.state}` : ""}
                </p>
              )}
              {r.credit && (
                <p className="mt-1 truncate text-[10px] text-white/45">
                  {r.mediaType === "video" ? "🎬" : "📷"} {r.credit}
                </p>
              )}
            </div>
          </div>
        );

        return (
          <div
            key={r.id}
            className="group w-[62vw] max-w-[210px] shrink-0 snap-start sm:w-[210px]"
          >
            {/* Links back to the event where that link survives. A recap whose
                event was deleted still shows — it just isn't clickable. */}
            {r.event ? (
              <Link href={`/events/${r.event.id}`}>{card}</Link>
            ) : (
              card
            )}
          </div>
        );
      })}
    </Rail>
  );
}
