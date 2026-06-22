import Link from "next/link";
import Avatar from "./Avatar";
import SocialLinks from "./SocialLinks";
import VerifiedBadge from "./VerifiedBadge";
import { hasSocialLinks } from "@/lib/social";
import type { PublicProfile } from "@/lib/types";

export default function ProfileCard({
  profile,
  showEdit = false,
}: {
  profile: PublicProfile;
  showEdit?: boolean;
}) {
  const verified = hasSocialLinks(profile);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <div className="flex items-start gap-4">
        <Avatar name={profile.name} url={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-extrabold text-gray-900">
              {profile.name ?? "LinkUpNaija member"}
            </h2>
            {verified && <VerifiedBadge />}
          </div>
          {profile.state && (
            <p className="mt-0.5 text-sm text-gray-500">📍 {profile.state}</p>
          )}
          {profile.bio && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {profile.bio}
            </p>
          )}
          <SocialLinks profile={profile} className="mt-3" />
        </div>
      </div>

      {showEdit && (
        <Link href="/profile/edit" className="btn-outline mt-5 w-full">
          Edit profile
        </Link>
      )}
    </div>
  );
}
