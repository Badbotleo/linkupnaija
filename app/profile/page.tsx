import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventCover from "@/components/EventCover";
import SocialLinks from "@/components/SocialLinks";
import ShareProfileButton from "@/components/profile/ShareProfileButton";
import BannerUpload from "@/components/profile/BannerUpload";
import AvatarUpload from "@/components/profile/AvatarUpload";
import ProfilePhotos from "@/components/profile/ProfilePhotos";
import HostScorecard from "@/components/host/HostScorecard";
import HostBadges from "@/components/host/HostBadges";
import { computeBadges } from "@/lib/hostBadges";
import { formatEventDate } from "@/lib/format";
import type { UserProfile, HostStats } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

const TABS = [
  { key: "events", label: "Events" },
  { key: "about", label: "About" },
  { key: "photos", label: "Photos" },
  { key: "posts", label: "Posts" },
] as const;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const tab = TABS.find((t) => t.key === searchParams.tab)?.key ?? "events";

  const [{ data: p }, friends, attending, hosting] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`),
    supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("host_id", user.id),
  ]);

  const profile = p as UserProfile | null;

  const { data: hs } = await supabase
    .from("host_stats")
    .select("*")
    .eq("host_id", user.id)
    .maybeSingle();
  const hostStats = hs as HostStats | null;
  const badges = computeBadges(hostStats, {
    awarded: profile?.awarded_badges,
    revoked: profile?.revoked_badges,
  });

  return (
    <div className="pb-4">
      {/* Cover + avatar */}
      <BannerUpload userId={user.id} initialUrl={profile?.banner_url ?? null} editable />

      <div className="container-page relative z-10 max-w-2xl">
        <div className="pointer-events-none -mt-12 flex items-end gap-4">
          <div className="pointer-events-auto">
            <AvatarUpload
              userId={user.id}
              name={profile?.name ?? null}
              initialUrl={profile?.avatar_url ?? null}
              editable
            />
          </div>
        </div>

        <h1 className="mt-3 text-2xl font-extrabold text-gray-900">
          {profile?.name ?? "LinkUpNaija member"}
        </h1>
        {profile?.state && (
          <p className="text-sm text-gray-500">📍 {profile.state}</p>
        )}
        {badges.length > 0 && (
          <div className="mt-2">
            <HostBadges badges={badges} />
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 flex gap-6">
          <Stat value={friends.count ?? 0} label="Friends" />
          <Stat value={attending.count ?? 0} label="Attending" />
          <Stat value={hosting.count ?? 0} label="Hosting" />
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Link href="/profile/edit" className="btn-primary flex-1 rounded-full py-2 text-center">
            Edit profile
          </Link>
          <ShareProfileButton />
        </div>

        {hostStats && hostStats.total_events > 0 && (
          <div className="mt-5">
            <HostScorecard stats={hostStats} badges={badges} />
          </div>
        )}

        {/* Tabs */}
        <div className="mt-5 flex gap-1 border-b border-gray-100">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "events" ? "/profile" : `/profile?tab=${t.key}`}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.key
                  ? "border-brand text-brand"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-5">
          {tab === "about" ? (
            <About profile={profile} />
          ) : tab === "photos" ? (
            <ProfilePhotos userId={user.id} editable />
          ) : tab === "posts" ? (
            <Posts userId={user.id} />
          ) : (
            <EventsTab userId={user.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-lg font-extrabold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

async function EventsTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, category, date, time, location, cover_image_url")
    .eq("host_id", userId)
    .order("date", { ascending: false })
    .limit(20);
  const events = (data ?? []) as {
    id: string;
    title: string;
    category: string;
    date: string;
    location: string;
    cover_image_url: string | null;
  }[];
  if (events.length === 0)
    return <Empty text="No events hosted yet." cta={{ href: "/host", label: "Host an event" }} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:border-brand/30"
        >
          <EventCover url={e.cover_image_url} category={e.category} title={e.title} className="h-28 w-full" />
          <div className="p-3">
            <p className="truncate font-bold text-gray-900">{e.title}</p>
            <p className="text-xs text-gray-500">
              {formatEventDate(e.date)} · {e.location}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function About({ profile }: { profile: UserProfile | null }) {
  const rows = [
    profile?.bio && { icon: "💬", text: profile.bio },
    profile?.state && { icon: "📍", text: `Lives in ${profile.state}` },
    profile?.created_at && {
      icon: "🗓️",
      text: `Joined ${formatEventDate(profile.created_at.slice(0, 10))}`,
    },
  ].filter(Boolean) as { icon: string; text: string }[];
  const hasSocials =
    !!profile?.instagram_url || !!profile?.twitter_url || !!profile?.facebook_url;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
            <span aria-hidden>{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      {profile?.interests && profile.interests.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Interests
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((i) => (
              <span
                key={i}
                className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasSocials && profile && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Social
          </p>
          <SocialLinks profile={profile} />
        </div>
      )}
    </div>
  );
}

async function Posts({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("circle_posts")
    .select("id, content, created_at, circle:circles(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const posts = (data ?? []) as unknown as {
    id: string;
    content: string | null;
    created_at: string;
    circle: { id: string; name: string } | null;
  }[];
  if (posts.length === 0) return <Empty text="No posts yet." />;
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {post.circle && (
            <Link href={`/circles/${post.circle.id}`} className="text-xs font-bold text-brand">
              {post.circle.name}
            </Link>
          )}
          <p className="mt-1 text-sm text-gray-800">{post.content}</p>
          <p className="mt-1 text-xs text-gray-400">{formatEventDate(post.created_at.slice(0, 10))}</p>
        </div>
      ))}
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
      <p className="text-sm text-gray-500">{text}</p>
      {cta && (
        <Link href={cta.href} className="btn-primary mt-4">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
