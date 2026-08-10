import Link from "next/link";
import Rail from "./Rail";
import LineIcon from "../ui/LineIcon";
import { buildIdeas, hostHref } from "@/lib/things-to-do";
import { isRealText } from "@/lib/content-guards";

/**
 * The "Things to do this week" shelf, on both home pages.
 *
 * The heading links through to /things-to-do, where the full set lives —
 * eight cards is a taste, not the catalogue.
 */
export default async function ThingsToDo({ state }: { state?: string | null }) {
  // buildIdeas already filters these, but the component refuses to render a
  // titleless card on its own account — a blank card on the home page is the
  // exact failure this shelf had, and it shouldn't depend on one caller
  // getting it right.
  const ideas = (await buildIdeas(state, { limit: 8 })).filter((i) =>
    isRealText(i.title)
  );
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
        <div
          key={idea.key}
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
              {/* Two doors. "Host it" alone is a big ask for someone just
                  browsing — if it's already happening this week, joining is
                  the smaller and far likelier step. */}
              <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {idea.liveCount ? (
                  <Link
                    href={idea.liveHref!}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-gray-900 transition hover:bg-white/90"
                  >
                    <LineIcon name="calendar" size={12} />
                    {idea.liveCount} on now
                  </Link>
                ) : null}
                <Link
                  href={hostHref(idea)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black transition ${
                    idea.liveCount
                      ? "bg-white/15 text-white hover:bg-white/25"
                      : "bg-white text-gray-900 hover:bg-white/90"
                  }`}
                >
                  <LineIcon name="mic" size={12} />
                  Host it
                </Link>
              </span>
            </div>
          </div>
        </div>
      ))}
    </Rail>
  );
}
