import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import Avatar from "@/components/Avatar";
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
    <div className="container-page py-10">
      <Link href="/circles" className="text-sm font-medium text-gray-500 hover:text-brand">
        ← All circles
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl shadow-card">
        <EventCover
          url={circle.cover_image_url}
          category={circle.category ?? "Networking"}
          title={circle.name}
          className="h-40 w-full sm:h-56"
        />
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        {/* Feed */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
              {circle.category ?? "Community"}
            </span>
            {circle.state && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                📍 {circle.state}
              </span>
            )}
            {circle.is_private && (
              <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                🔒 Private
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900">{circle.name}</h1>
          {circle.description && <p className="mt-2 text-gray-600">{circle.description}</p>}

          <div className="mt-6">
            {circle.is_private && !isMember ? (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
                🔒 This is a private circle. Join to see posts and events.
              </p>
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

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
              <JoinCircleButton
                circleId={circle.id}
                isPrivate={circle.is_private}
                isLoggedIn={!!user}
                isCreator={isCreator}
                initialStatus={
                  (membership?.status as "active" | "pending" | undefined) ?? null
                }
              />

              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="text-sm font-bold text-gray-900">
                  👥 {circle.member_count}{" "}
                  {circle.member_count === 1 ? "member" : "members"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <Avatar
                      key={m.user_id}
                      name={m.users?.name ?? null}
                      url={m.users?.avatar_url ?? null}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            </div>

            {isCreator && pending.length > 0 && (
              <CirclePendingRequests initial={pending} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
