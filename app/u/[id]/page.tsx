import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import EventCover from "@/components/EventCover";
import SocialLinks from "@/components/SocialLinks";
import AddFriendButton from "@/components/profile/AddFriendButton";
import MessageButton from "@/components/MessageButton";
import ReportButton from "@/components/ReportButton";
import ProBadge from "@/components/ProBadge";
import { isProActive } from "@/lib/pro";
import ProfilePhotos from "@/components/profile/ProfilePhotos";
import HostScorecard from "@/components/host/HostScorecard";
import HostBadges from "@/components/host/HostBadges";
import { computeBadges } from "@/lib/hostBadges";
import { formatEventDate } from "@/lib/format";
import type { UserProfile, HostStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "events", label: "Events" },
  { key: "about", label: "About" },
  { key: "photos", label: "Photos" },
] as const;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("users").select("name").eq("id", params.id).single();
  return { title: data?.name ?? "Profile" };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const tab = TABS.find((t) => t.key === searchParams.tab)?.key ?? "events";

  const { data: p } = await supabase
    .from("users")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!p) notFound();
  const profile = p as UserProfile;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Blocked (by me)? Show a stub.
  if (user) {
    const { data: blocked } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", params.id)
      .maybeSingle();
    if (blocked) {
      return (
        <div className="container-page max-w-2xl py-16 text-center">
          <p className="text-4xl">🚫</p>
          <p className="mt-3 font-semibold text-gray-900">You&apos;ve blocked this user.</p>
          <Link href="/events" className="btn-outline mt-6">Back to events</Link>
        </div>
      );
    }
  }

  const [friends, attending, hosting] = await Promise.all([
    supabase
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${params.id},receiver_id.eq.${params.id}`),
    supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("user_id", params.id)
      .eq("status", "accepted"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("host_id", params.id),
  ]);

  const { data: hs } = await supabase
    .from("host_stats")
    .select("*")
    .eq("host_id", params.id)
    .maybeSingle();
  const hostStats = hs as HostStats | null;
  const badges = computeBadges(hostStats, {
    awarded: profile.awarded_badges,
    revoked: profile.revoked_badges,
  });

  // Record a profile view (deduped to once/24h) — triggers the "who viewed"
  // notification (named for Pro users).
  if (user && user.id !== params.id) {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from("profile_views")
      .select("*", { count: "exact", head: true })
      .eq("viewer_id", user.id)
      .eq("viewed_id", params.id)
      .gte("created_at", since);
    if (!count) {
      await supabase.from("profile_views").insert({ viewer_id: user.id, viewed_id: params.id });
    }
  }

  return (
    <div className="pb-4">
      <div className="h-36 w-full sm:h-52">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: "linear-gradient(120deg,#1A1040,#534AB7)" }} />
        )}
      </div>

      <div className="container-page max-w-2xl">
        <div className="-mt-12 flex items-end gap-4">
          <div className="rounded-full border-4 border-white bg-white">
            <Avatar name={profile.name} url={profile.avatar_url} size="lg" />
          </div>
        </div>

        <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold text-gray-900">
          {profile.name ?? "LinkUpNaija member"}
          {isProActive(profile.is_pro, profile.pro_expires_at) && (
            <ProBadge size={20} />
          )}
          {profile.phone_verified && (
            <span
              title="Verified phone number"
              className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700"
            >
              ✓ Verified
            </span>
          )}
        </h1>
        {profile.state && <p className="text-sm text-gray-500">📍 {profile.state}</p>}
        {badges.length > 0 && (
          <div className="mt-2">
            <HostBadges badges={badges} />
          </div>
        )}

        <div className="mt-4 flex gap-6">
          <Stat value={friends.count ?? 0} label="Friends" />
          <Stat value={attending.count ?? 0} label="Attending" />
          <Stat value={hosting.count ?? 0} label="Hosting" />
        </div>

        {user?.id !== params.id && (
          <div className="mt-4 flex items-center gap-2">
            <AddFriendButton targetId={params.id} isLoggedIn={!!user} />
            <MessageButton
              meId={user?.id ?? null}
              targetId={params.id}
              targetName={profile.name}
              targetAvatar={profile.avatar_url}
            />
            <ReportButton
              targetType="user"
              targetId={params.id}
              isLoggedIn={!!user}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-500"
            />
          </div>
        )}

        {hostStats && hostStats.total_events > 0 && (
          <div className="mt-5">
            <HostScorecard stats={hostStats} badges={badges} />
          </div>
        )}

        <div className="mt-5 flex gap-1 border-b border-gray-100">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "events" ? `/u/${params.id}` : `/u/${params.id}?tab=${t.key}`}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.key ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-5">
          {tab === "about" ? (
            <AboutCard profile={profile} />
          ) : tab === "photos" ? (
            <ProfilePhotos userId={params.id} editable={false} />
          ) : (
            <HostedEvents userId={params.id} />
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

function AboutCard({ profile }: { profile: UserProfile }) {
  const hasSocials = !!profile.instagram_url || !!profile.twitter_url || !!profile.facebook_url;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <ul className="space-y-3 text-sm text-gray-700">
        {profile.bio && <li>💬 {profile.bio}</li>}
        {profile.state && <li>📍 Lives in {profile.state}</li>}
        <li>🗓️ Joined {formatEventDate(profile.created_at.slice(0, 10))}</li>
      </ul>
      {hasSocials && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <SocialLinks profile={profile} />
        </div>
      )}
    </div>
  );
}

async function HostedEvents({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, category, date, location, cover_image_url")
    .eq("host_id", userId)
    .eq("event_type", "general")
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
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center text-sm text-gray-500">
        No public events yet.
      </p>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((e) => (
        <Link key={e.id} href={`/events/${e.id}`} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:border-brand/30">
          <EventCover url={e.cover_image_url} category={e.category} title={e.title} className="h-28 w-full" />
          <div className="p-3">
            <p className="truncate font-bold text-gray-900">{e.title}</p>
            <p className="text-xs text-gray-500">{formatEventDate(e.date)} · {e.location}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
