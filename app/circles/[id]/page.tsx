import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import Avatar from "@/components/Avatar";
import { memberProof } from "@/lib/social-proof";
import JoinCircleButton from "@/components/circles/JoinCircleButton";
import CircleFeed from "@/components/circles/CircleFeed";
import CirclePendingRequests from "@/components/circles/CirclePendingRequests";
import type { Circle } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("circles").select("name").eq("id", params.id).single();
  return { title: data?.name ?? "Circle" };
}

export default async function CirclePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: circleRow } = await supabase
    .from("circles")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!circleRow) notFound();
  const circle = circleRow as Circle;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [membershipRes, { data: memberRows }] = await Promise.all([
    user
      ? supabase
          .from("circle_members")
          .select("status, role")
          .eq("circle_id", params.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("circle_members")
      .select("user_id, role, users(name, avatar_url)")
      .eq("circle_id", params.id)
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(8),
  ]);

  const membership = membershipRes.data as { status: string; role: string } | null;
  const isMember = membership?.status === "active";
  const isCreator = !!user && circle.creator_id === user.id;
  const isAdmin = isCreator || membership?.role === "admin";
  const members = (memberRows ?? []) as unknown as {
    user_id: string;
    users: { name: string | null; avatar_url: string | null } | null;
  }[];

  // Mark as read + fetch pending requests (creator only).
  let pending: {
    id: string;
    user_id: string;
    users: { name: string | null; avatar_url: string | null } | null;
  }[] = [];
  if (isMember && user) {
    await supabase
      .from("circle_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("circle_id", params.id)
      .eq("user_id", user.id);
  }
  if (isCreator) {
    const { data } = await supabase
      .from("circle_members")
      .select("id, user_id, users(name, avatar_url)")
      .eq("circle_id", params.id)
      .eq("status", "pending");
    pending = (data ?? []) as unknown as typeof pending;
  }

  return (
    <div>
      <AppHeader
        title={circle.name}
        subtitle={
          [memberProof(circle.member_count), circle.state]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        back
      />
      <div className="container-page py-5">

      {/* Laid out like a profile on X: banner, avatar breaking out of it,
          the action top-right, then one column of feed. The old two-column
          split put the join button and the members in a sidebar that fell
          BELOW the feed on a phone — so the first thing you did on arriving
          was scroll past everything to find the join button. */}
      <div className="relative">
        <EventCover
          url={circle.cover_image_url}
          category={circle.category ?? "Networking"}
          title={circle.name}
          className="h-36 w-full rounded-2xl sm:h-48"
        />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
            {circle.name}
          </h1>
          {/* One quiet meta line instead of a row of emoji pills. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <span className="font-semibold text-brand">
              {circle.category ?? "Community"}
            </span>
            {circle.state && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <LineIcon name="pin" size={12} className="text-gray-400" />
                  {circle.state}
                </span>
              </>
            )}
            {circle.is_private && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <LineIcon name="shield" size={12} className="text-gray-400" />
                  Private
                </span>
              </>
            )}
          </p>
        </div>

        {/* Where a follow button sits on X, and where it should have been
            all along on a phone. */}
        <div className="shrink-0">
          <JoinCircleButton
            circleId={circle.id}
            isPrivate={circle.is_private}
            isLoggedIn={!!user}
            isCreator={isCreator}
            initialStatus={
              (membership?.status as "active" | "pending" | undefined) ?? null
            }
          />
        </div>
      </div>

      {circle.description && (
        <p className="mt-3 whitespace-pre-line leading-relaxed text-gray-600">
          {circle.description}
        </p>
      )}

      {/* Members as an overlapping stack, the way every social app shows
          "who else is here" — a wrapped grid of avatars read as a directory. */}
      {members.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 6).map((m) => (
              <span
                key={m.user_id}
                className="rounded-full ring-2 ring-white dark:ring-[#1A1040]"
              >
                <Avatar
                  name={m.users?.name ?? null}
                  url={m.users?.avatar_url ?? null}
                  size="sm"
                />
              </span>
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {memberProof(circle.member_count) ?? "Members"}
          </span>
        </div>
      )}

      {isCreator && pending.length > 0 && (
        <div className="mt-4">
          <CirclePendingRequests initial={pending} />
        </div>
      )}

      <div className="mt-5 border-t border-gray-100 pt-5 dark:border-white/10">
        {circle.is_private && !isMember ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
            <LineIcon
              name="shield"
              size={22}
              className="mx-auto text-gray-300"
            />
            <p className="mt-2 font-semibold text-gray-700">
              This circle is private
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Join to see posts and events.
            </p>
          </div>
        ) : (
          <CircleFeed
            circleId={circle.id}
            meId={user?.id ?? null}
            isMember={isMember}
            isAdmin={!!isAdmin}
          />
        )}
      </div>
    </div>
    </div>
  );
}
