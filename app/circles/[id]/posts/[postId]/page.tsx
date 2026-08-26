import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import CircleFeed from "@/components/circles/CircleFeed";
import type { Circle } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * One post, on its own page.
 *
 * Two things needed this. A post had no address, so "share" copied a link to
 * the circle and dropped people into a feed to go hunting for the thing they
 * were sent. And replies could only ever be read inline underneath a row in a
 * scrolling list, which is fine for two and unusable for twenty.
 *
 * The post itself is rendered by CircleFeed in focus mode rather than by a
 * second copy of the card. Likes, reposts, pinning, deleting and the reply box
 * are all one implementation, so they cannot drift apart between the feed and
 * the thread.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string; postId: string };
}) {
  const supabase = createClient();
  const { data } = await supabase
    .from("circle_posts")
    .select("content, author:users!circle_posts_user_id_fkey(name)")
    .eq("id", params.postId)
    .maybeSingle();

  const row = data as unknown as
    | { content: string | null; author: { name: string | null } | null }
    | null;
  const who = row?.author?.name ?? "Someone";
  const what = row?.content?.slice(0, 60);

  return {
    title: what ? `${who}: ${what}` : `Post by ${who}`,
    // A circle post is somebody's conversation with their group, not content
    // we should be putting in front of search. Private circles are already
    // closed by RLS; this covers the public ones.
    robots: { index: false, follow: false },
  };
}

export default async function CirclePostPage({
  params,
}: {
  params: { id: string; postId: string };
}) {
  const supabase = createClient();

  const { data: circleRow } = await supabase
    .from("circles")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!circleRow) notFound();
  const circle = circleRow as Circle;

  // Confirm the post is actually in THIS circle. Without it, any post id
  // could be read through any circle's URL, which would quietly route a
  // private circle's post through a public circle's page.
  const { data: postRow } = await supabase
    .from("circle_posts")
    .select("id")
    .eq("id", params.postId)
    .eq("circle_id", params.id)
    .maybeSingle();
  if (!postRow) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membershipRow } = user
    ? await supabase
        .from("circle_members")
        .select("status, role")
        .eq("circle_id", params.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const membership = membershipRow as { status: string; role: string } | null;
  const isMember = membership?.status === "active";
  const isCreator = !!user && circle.creator_id === user.id;
  const isAdmin = isCreator || membership?.role === "admin";

  return (
    <div className="container-page max-w-2xl py-4">
      <AppHeader
        title="Post"
        back
        meta={[{ icon: "users", label: circle.name, href: `/circles/${circle.id}` }]}
      />

      <div className="mt-4">
        <CircleFeed
          circleId={params.id}
          meId={user?.id ?? null}
          isMember={isMember}
          isAdmin={isAdmin}
          focusPostId={params.postId}
        />
      </div>

      <p className="mt-4 text-center text-sm text-gray-500">
        <Link href={`/circles/${circle.id}`} className="font-semibold text-brand hover:underline">
          Back to {circle.name}
        </Link>
      </p>
    </div>
  );
}
