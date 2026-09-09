import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ProfileForm from "@/components/ProfileForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

/** One screen, one job. See the comment on the settings index. */
export default async function ProfileDetailsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit/details");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "name, state, bio, avatar_url, instagram_url, twitter_url, facebook_url, phone, gender, interests"
    )
    .eq("id", user.id)
    .single();

  return (
    <div>
      <AppHeader title="Profile" subtitle="What other members see" back />
      <div className="container-page max-w-[640px] py-4">
        <div className="surface p-5 sm:p-7">
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
              interests: profile?.interests ?? [],
            }}
          />
        </div>
      </div>
    </div>
  );
}
