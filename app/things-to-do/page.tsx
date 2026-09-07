import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import ThingsReel from "@/components/things/ThingsReel";
import { createClient } from "@/lib/supabase/server";
import { getVisitorState } from "@/lib/visitor-geo";
import { buildIdeas, hostHref } from "@/lib/things-to-do";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Things to do this week",
  description:
    "Ideas for linking up in Nigeria this week: parks, restaurants, clubs, cinemas and more. Pick one, bring your people, and host it in two minutes.",
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

      <div className="container-page py-3">
        {/* One line above a full-screen reel, not a paragraph. The reel is the
            page now, and every pixel spent explaining it is a pixel of
            photograph nobody sees. */}
        {/* Gone on a short phone. At 640px tall the header and this line
            together take 250px, and every one of them comes out of the
            photograph. The reel explains itself; the hint is a nicety. */}
        <p className="text-sm leading-relaxed text-gray-600 [@media(max-height:700px)]:hidden">
          Tap one and the host form opens filled in.
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
          /* One place per screen, the same gesture as the events reel.
             A grid asks you to compare and a reel asks you to react, and
             picking somewhere to go on a Saturday is the second kind of
             decision. The artwork does most of the work, and it cannot do it
             at 248px in a three-column grid. */
          <div className="mt-3">
            <ThingsReel
              ideas={ideas.map((idea) => ({
                key: idea.key,
                title: idea.title,
                place: idea.place,
                category: idea.category,
                image: idea.image,
                mediaType: idea.mediaType,
                state: idea.state,
                href: hostHref(idea),
                liveCount: idea.liveCount,
                liveHref: idea.liveHref,
                hideLabel: idea.hideLabel,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
