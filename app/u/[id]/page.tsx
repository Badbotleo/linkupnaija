import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import EventCover from "@/components/EventCover";
import SocialLinks from "@/components/SocialLinks";
import AddFriendButton from "@/components/profile/AddFriendButton";
import MessageButton from "@/components/MessageButton";
import ReportButton from "@/components/ReportButton";
import ProBadge from "@/components/ProBadge";
import LineIcon from "@/components/ui/LineIcon";
import { showsVerifiedBadge } from "@/lib/pro";
import ProfilePhotos from "@/components/profile/ProfilePhotos";
import HostScorecard from "@/components/host/HostScorecard";
import HostBadges from "@/components/host/HostBadges";
import BrandIcon from "@/components/ui/BrandIcon";
import AvatarLightbox from "@/components/profile/AvatarLightbox";
import { computeBadges } from "@/lib/hostBadges";
import { formatEventDate } from "@/lib/format";
import type { UserProfile, HostStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "events", label: "Link-ups" },
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
          <Link href="/events" className="btn-outline mt-6">Back to link-ups</Link>
        </div>
      );
    }
  }

  const [friendsRes, attending, hosting] = await Promise.all([
    // Via RPC, not a direct count. RLS on connections only exposes rows the
    // viewer is part of, so counting another member's friends through the
    // table returns 1 when you're the friend and 0 otherwise. friend_count is
    // SECURITY DEFINER — it returns the number without exposing who.
    supabase.rpc("friend_count", { uid: params.id }),
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

  // friend_count arrives with migration-friend-count.sql. Until that runs the
  // RPC 404s, so fall back to the direct count — which under-reports on other
  // people's profiles, but under-reporting beats a profile that fails to
  // render at all.
  let friendCount = (friendsRes.data as number | null) ?? 0;
  if (friendsRes.error) {
    const { count } = await supabase
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${params.id},receiver_id.eq.${params.id}`);
    friendCount = count ?? 0;
  }

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

  // "Member since March 2026" says more about whether somebody is real than
  // any count does, and it was on the record already without being shown.
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-NG", {
        month: "long",
        year: "numeric",
      })
    : "a while back";

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
      <AppHeader title={profile.name ?? "Member"} back />
      {/* A third of the height it was.
          144px of banner and an overlapping avatar is the Twitter profile
          pattern, and it spent the first third of a phone screen before
          saying anything about the person. Their own image still shows when
          they have set one; without one it is a tint rather than a slab. */}
      <div className="h-20 w-full sm:h-28">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-brand/25 via-brand/10 to-transparent" />
        )}
      </div>

      <div className="container-page max-w-2xl">
        <div className="-mt-10 flex items-end gap-4">
          <div className="rounded-full border-4 border-white bg-white">
            {/* Tappable: a 96px circle is a thumbnail of a photo someone chose
                carefully, and there was no way to see it properly. */}
            <AvatarLightbox
              name={profile.name}
              url={profile.avatar_url}
              size="lg"
            />
          </div>
        </div>

        <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold text-gray-900">
          {profile.name ?? "LinkUpNaija member"}
          {showsVerifiedBadge(
            profile.is_pro,
            profile.pro_expires_at,
            (profile as { id_verified_at?: string | null }).id_verified_at
          ) && <ProBadge size={20} />}
          {/* The green "✓ Verified" chip is gone.
              Two things next to one name both saying verified is worse than
              either alone: a reader has to work out which is which, and the
              gold badge, which is the one backed by a checked government ID,
              gets diluted by a chip that only meant a phone number went
              through. Phone status still appears in the strip below, worded
              as what it is. */}
        </h1>
        {profile.state && (
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <LineIcon name="pin" size={13} className="text-gray-400" />
            {profile.state}
          </p>
        )}
        {badges.length > 0 && (
          <div className="mt-2">
            <HostBadges badges={badges} />
          </div>
        )}

        {/* Bio sits under the name, the way Instagram does it — before the
            numbers, not buried in a tab. It's the one line that tells you
            whether you want to know this person. */}
        {profile.bio && (
          <p className="mt-2.5 whitespace-pre-line text-[14px] leading-snug text-gray-700">
            {profile.bio}
          </p>
        )}

        {/* Evidence, not vanity.
            This was "Friends / Attending / Hosting", which is what a social
            network shows. The question actually being asked on this page is
            whether to let a stranger into a room, and none of those three
            spoke to it: friend count is irrelevant to it, and "Attending 5"
            does not say whether they were ever approved for any of them.

            Phone verification, how long they have been here, how many
            link-ups they have been approved for and what their guests say
            about them were all on this page already, scattered across a chip
            in the heading, a badge row, and a scorecard further down. Same
            facts, one place, in the order somebody weighs them. */}
        <dl className="mt-4 divide-y divide-gray-200/70 rounded-2xl bg-white px-4 shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
          <Fact
            icon="check"
            tone={profile.phone_verified ? "green" : "muted"}
            // "Phone number", not "Phone": the badge row directly above can
            // read "Verified Host", which is a hosting badge and nothing to do
            // with a phone. Side by side, a bare "Phone not verified" looked
            // like the page contradicting itself.
            label={
              profile.phone_verified
                ? "Phone number confirmed"
                : "Phone number not confirmed"
            }
            sub={
              profile.phone_verified
                ? "We texted a code and they entered it"
                : "Nobody has confirmed this number"
            }
          />
          <Fact
            icon="calendar"
            tone="muted"
            label={
              (attending.count ?? 0) > 0
                ? `Approved for ${attending.count} link-up${
                    attending.count === 1 ? "" : "s"
                  }`
                : "No link-ups yet"
            }
            sub={`Member since ${memberSince}`}
          />
          {hostStats && hostStats.total_events > 0 && (
            <Fact
              icon="star"
              tone="amber"
              label={
                hostStats.review_count > 0
                  ? `${hostStats.average_rating.toFixed(1)} from ${
                      hostStats.review_count
                    } guest${hostStats.review_count === 1 ? "" : "s"}`
                  : "No guest ratings yet"
              }
              sub={`Has hosted ${hosting.count ?? 0} link-up${
                (hosting.count ?? 0) === 1 ? "" : "s"
              }`}
            />
          )}
          {friendCount > 0 && (
            <Fact
              icon="users"
              tone="brand"
              label={`${friendCount} friend${friendCount === 1 ? "" : "s"} here`}
              sub="People who have connected with them"
            />
          )}
        </dl>

        {user?.id !== params.id && (
          <div className="mt-4 flex items-center gap-2">
            <AddFriendButton targetId={params.id} isLoggedIn={!!user} />
            <MessageButton
              meId={user?.id ?? null}
              targetId={params.id}
              targetName={profile.name}
              targetAvatar={profile.avatar_url}
            />
            {/* Where Report used to sit. Reporting someone is a rare, deliberate
                act; opening their Instagram is the common one, and the common
                action should have the prominent slot. Report moves to the foot
                of the page rather than going away — see below. */}
            {[
              { url: profile.instagram_url, name: "instagram", label: "Instagram" },
              { url: profile.twitter_url, name: "x", label: "X" },
              { url: profile.facebook_url, name: "facebook", label: "Facebook" },
            ]
              .filter((sc) => !!sc.url)
              .map((sc) => (
                <a
                  key={sc.name}
                  href={sc.url as string}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={sc.label}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gray-200 text-gray-700 transition hover:border-brand/40 hover:text-brand dark:border-white/15 dark:text-white"
                >
                  <BrandIcon name={sc.name} size={17} />
                </a>
              ))}
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

        {/* Report, kept but quiet.
            It lost the action row to the social icons, which is the right
            trade — reporting is rare and deliberate, opening someone's
            Instagram is the common act. But a social platform with no way to
            report a member is a safety hole, so it sits here at the foot of
            the page: still one tap, just no longer competing with the things
            people came to do. */}
        {user && user.id !== params.id && (
          <div className="mt-8 flex justify-center border-t border-gray-100 pt-4 dark:border-white/10">
            <ReportButton
              targetType="user"
              targetId={params.id}
              isLoggedIn={!!user}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon,
  tone,
  label,
  sub,
}: {
  icon: string;
  tone: "brand" | "green" | "amber" | "muted";
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <span
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          tone === "brand"
            ? "bg-brand/[0.10] text-brand"
            : tone === "green"
              ? "bg-naija/[0.12] text-naija"
              : tone === "amber"
                ? "bg-amber-400/[0.16] text-amber-600"
                : "bg-gray-900/[0.05] text-gray-500 dark:bg-white/10 dark:text-white/60"
        }`}
        aria-hidden
      >
        <LineIcon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <dt className="text-[15px] font-bold leading-snug text-gray-900 dark:text-white">
          {label}
        </dt>
        <dd className="mt-0.5 text-[13.5px] leading-snug text-gray-500">
          {sub}
        </dd>
      </div>
    </div>
  );
}

function AboutCard({ profile }: { profile: UserProfile }) {
  const hasSocials = !!profile.instagram_url || !!profile.twitter_url || !!profile.facebook_url;
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <ul className="space-y-3 text-sm text-gray-700">
        {/* Bio moved up under the name; repeating it here read as a bug. */}
        {profile.state && (
          <li className="flex items-start gap-2">
            <LineIcon name="pin" size={15} className="mt-0.5 shrink-0 text-gray-400" />
            Lives in {profile.state}
          </li>
        )}
        <li className="flex items-start gap-2">
          <LineIcon name="calendar" size={15} className="mt-0.5 shrink-0 text-gray-400" />
          Joined {formatEventDate(profile.created_at.slice(0, 10))}
        </li>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {events.map((e) => (
        <Link key={e.id} href={`/events/${e.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:border-brand/30">
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
