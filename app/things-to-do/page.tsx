import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import ThingsReel from "@/components/things/ThingsReel";
import { createClient } from "@/lib/supabase/server";
import { getVisitorState } from "@/lib/visitor-geo";
import { buildIdeas, hostHref } from "@/lib/things-to-do";
import StateIcon from "@/components/ui/StateIcon";

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

  // Thirty, not sixty.
  //
  // Sixty full-screen slides is what crashed the tab on a phone: every one
  // that has been seen holds a decoded frame, and Safari killed the renderer
  // around the end of the reel. LazyMedia now releases media it has scrolled
  // past, which fixed the memory, but the DOM is still sixty articles deep
  // and nobody has ever reached the bottom of it.
  //
  // The shelf's two-per-activity cap is still relaxed rather than removed,
  // because the point of this page is seeing a range: eight identical park
  // cards in a row reads as a bug. Four is enough range at this length.
  const ideas = await buildIdeas(state, { limit: 30, perActivityCap: 4 });

  return (
    <div>
      <AppHeader
        title="Things to do this week"
        /* A fact, not a restatement of the title.
           It read "Ideas for linking up around FCT - Abuja" under "Things
           to do this week", which is the title again in longer words. The
           count and the place are the two things the title does not
           already say. */
        subtitle={
          state
            ? `${ideas.length} around ${state.replace(/^FCT\s*-\s*/, "")}`
            : `${ideas.length} ideas near you`
        }
        back
        action={
          <Link href="/host" className="btn-primary rounded-full px-4 py-2 text-sm">
            Host
          </Link>
        }
      />

      <div className="container-page py-2">
        {ideas.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
            <StateIcon name="calendar" tone="quiet" size={48} />
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
                poster: idea.poster,
                state: idea.state,
                href: hostHref(idea),
                liveCount: idea.liveCount,
                liveHref: idea.liveHref,
                hideLabel: idea.hideLabel,
                credit: idea.credit,
                creditUrl: idea.creditUrl,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
