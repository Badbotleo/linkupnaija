import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";
import { getVisitorState } from "@/lib/visitor-geo";
import { buildIdeas, hostHref } from "@/lib/things-to-do";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Things to do this week",
  description:
    "Ideas for linking up in Nigeria this week — parks, restaurants, clubs, cinemas and more. Pick one, bring your people, and host it in two minutes.",
};

export default async function ThingsToDoPage() {
  // Signed-in members get ranked against their own state; visitors against
  // wherever the edge places them.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let state: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("state")
      .eq("id", user.id)
      .single<{ state: string | null }>();
    state = data?.state ?? null;
  }
  if (!state) state = getVisitorState();

  // The whole point of this page is seeing everything, so the shelf's
  // two-per-activity cap is relaxed rather than removed — eight identical
  // park cards in a row still reads as a bug.
  const ideas = await buildIdeas(state, { limit: 60, perActivityCap: 6 });

  return (
    <div>
      <AppHeader
        title="Things to do this week"
        subtitle={
          state
            ? `Ideas for linking up around ${state}`
            : "Ideas for linking up with your people"
        }
        back
        action={
          <Link href="/host" className="btn-primary rounded-full px-4 py-2 text-sm">
            Host
          </Link>
        }
      />

      <div className="container-page py-5">
        <p className="text-sm leading-relaxed text-gray-600">
          Every one of these opens the host form already filled in — the vibe,
          the spot and a title. All you add is a date.
        </p>

        {ideas.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
            <p className="text-4xl">🗓️</p>
            <h2 className="mt-3 text-lg font-bold text-gray-900">
              Nothing here yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
              We&apos;re lining up ideas for your area. Meanwhile you can start
              anything you like.
            </p>
            <Link href="/host" className="btn-primary mt-5">
              Host something
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => (
              /* The card is a container, not an anchor: an <a> can't nest
                 inside another <a>, and the credit needs its own link. The
                 whole-card link is an overlay, and the credit sits above it. */
              <div
                key={idea.key}
                className="group relative h-[210px] overflow-hidden rounded-2xl shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                {idea.mediaType === "video" ? (
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

                <Link
                  href={hostHref(idea)}
                  aria-label={`Host ${idea.title}${idea.place ? ` at ${idea.place}` : ""}`}
                  className="absolute inset-0 z-10"
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 text-white">
                  <p className="text-[19px] font-extrabold leading-tight">
                    {idea.title}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-white/70">
                    {idea.place}
                  </p>
                  {idea.credit &&
                    (idea.creditUrl ? (
                      <a
                        href={idea.creditUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="pointer-events-auto mt-1 block w-fit max-w-full truncate text-[11px] text-white/50 underline underline-offset-2 hover:text-white/80"
                      >
                        {idea.mediaType === "video" ? "🎬" : "📷"} {idea.credit}
                      </a>
                    ) : (
                      <p className="mt-1 truncate text-[11px] text-white/45">
                        {idea.mediaType === "video" ? "🎬" : "📷"} {idea.credit}
                      </p>
                    ))}
                  <span className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-black text-gray-900">
                    <LineIcon name="mic" size={13} />
                    Host it
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
