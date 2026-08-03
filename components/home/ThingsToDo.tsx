import Link from "next/link";
import Rail from "./Rail";
import LineIcon from "../ui/LineIcon";
import { buildIdeas, hostHref } from "@/lib/things-to-do";

/**
 * The "Things to do this week" shelf, on both home pages.
 *
 * The heading links through to /things-to-do, where the full set lives —
 * eight cards is a taste, not the catalogue.
 */
export default async function ThingsToDo({ state }: { state?: string | null }) {
  const ideas = await buildIdeas(state, { limit: 8 });
  if (ideas.length === 0) return null;

  return (
    <Rail
      title="Things to do this week"
      auto
      subtitle="Pick one, bring your people — you're the host"
      href="/things-to-do"
      seeAll="See all"
    >
      {ideas.map((idea) => (
        <Link
          key={idea.key}
          href={hostHref(idea)}
          className="group w-[72vw] max-w-[268px] shrink-0 snap-start sm:w-[268px]"
        >
          <div className="relative h-[176px] overflow-hidden rounded-2xl shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            {idea.mediaType === "video" ? (
              /* Muted + playsInline is what lets it autoplay on iOS at all;
                 without both, Safari shows a paused black frame. */
              <video
                src={idea.image}
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
                src={idea.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/35 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
              <p className="text-[17px] font-extrabold leading-tight">
                {idea.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-white/70">
                {idea.place}
              </p>
              {idea.credit && (
                <p className="mt-1 truncate text-[10px] text-white/45">
                  {idea.mediaType === "video" ? "🎬" : "📷"} {idea.credit}
                </p>
              )}
              <span className="mt-2.5 flex w-fit items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-gray-900">
                <LineIcon name="mic" size={12} />
                Host it
              </span>
            </div>
          </div>
        </Link>
      ))}
    </Rail>
  );
}
