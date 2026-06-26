import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "name, state, bio, avatar_url, instagram_url, twitter_url, facebook_url, phone, gender"
    )
    .eq("id", user.id)
    .single();

  return (
    <div className="container-page max-w-2xl py-10">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-gray-500 hover:text-brand"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold text-gray-900">
        Edit your profile
      </h1>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <ProfileForm
          userId={user.id}
          mode="edit"
          initial={{
            name: profile?.name ?? null,
            state: profile?.state ?? null,
            bio: profile?.bio ?? null,
            avatar_url: profile?.avatar_url ?? null,
            instagram_url: profile?.instagram_url ?? null,
            twitter_url: profile?.twitter_url ?? null,
            facebook_url: profile?.facebook_url ?? null,
            phone: profile?.phone ?? null,
            gender: profile?.gender ?? null,
          }}
        />
      </div>
    </div>
  );
}
