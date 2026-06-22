import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/setup");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "name, state, bio, avatar_url, instagram_url, twitter_url, facebook_url, phone"
    )
    .eq("id", user.id)
    .single();

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Set up your profile ✨
        </h1>
        <p className="mt-2 text-gray-600">
          Add a photo and your socials so hosts know you&apos;re a real person.
          Verified profiles get accepted faster!
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <ProfileForm
          userId={user.id}
          mode="setup"
          initial={{
            name: profile?.name ?? null,
            state: profile?.state ?? null,
            bio: profile?.bio ?? null,
            avatar_url: profile?.avatar_url ?? null,
            instagram_url: profile?.instagram_url ?? null,
            twitter_url: profile?.twitter_url ?? null,
            facebook_url: profile?.facebook_url ?? null,
            phone: profile?.phone ?? null,
          }}
        />
      </div>
    </div>
  );
}
