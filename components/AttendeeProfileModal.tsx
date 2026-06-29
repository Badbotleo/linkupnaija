"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import SocialLinks from "./SocialLinks";
import VerifiedBadge from "./VerifiedBadge";
import RatingSummary from "./RatingSummary";
import { hasSocialLinks } from "@/lib/social";
import { ProfileSkeleton } from "./skeletons/Skeletons";
import type { PublicProfile } from "@/lib/types";

interface FullProfile extends PublicProfile {
  rating_avg: number;
  rating_count: number;
  created_at: string;
  gender: string | null;
}

export default function AttendeeProfileModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [attended, setAttended] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase
        .from("users")
        .select(
          "id, name, state, avatar_url, bio, instagram_url, twitter_url, facebook_url, rating_avg, rating_count, created_at, gender"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "accepted"),
    ]).then(([p, c]) => {
      if (!active) return;
      setProfile((p.data as unknown as FullProfile) ?? null);
      setAttended(c.count ?? 0);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Record a profile view (notifies the viewed user), deduped to once / 24h.
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user || user.id === userId) return;

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("profile_views")
        .select("*", { count: "exact", head: true })
        .eq("viewer_id", user.id)
        .eq("viewed_id", userId)
        .gte("created_at", since);
      if (!active || (count ?? 0) > 0) return;

      await supabase
        .from("profile_views")
        .insert({ viewer_id: user.id, viewed_id: userId });
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <ProfileSkeleton />
        ) : !profile ? (
          <p className="py-10 text-center text-sm text-gray-500">
            Profile not available.
          </p>
        ) : (
          <div className="-mt-2 text-center">
            <div className="flex justify-center">
              <Avatar name={profile.name} url={profile.avatar_url} size="lg" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <h2 className="text-xl font-extrabold text-gray-900">
                {profile.name ?? "LinkUpNaija member"}
              </h2>
              {hasSocialLinks(profile) && <VerifiedBadge />}
            </div>
            {profile.state && (
              <p className="mt-0.5 text-sm text-gray-500">📍 {profile.state}</p>
            )}
            {profile.gender && profile.gender !== "prefer not to say" && (
              <p className="mt-0.5 text-sm capitalize text-gray-500">
                {profile.gender}
              </p>
            )}
            {profile.rating_count > 0 && (
              <div className="mt-1 flex justify-center">
                <RatingSummary
                  avg={profile.rating_avg}
                  count={profile.rating_count}
                />
              </div>
            )}

            {profile.bio && (
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                {profile.bio}
              </p>
            )}

            <div className="mt-4 flex justify-center">
              <SocialLinks profile={profile} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-center">
              <div>
                <p className="text-lg font-extrabold text-gray-900">
                  {attended}
                </p>
                <p className="text-xs text-gray-500">Events attended</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString("en-NG", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs text-gray-500">Joined</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
