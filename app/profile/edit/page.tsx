import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import PhoneVerify from "@/components/PhoneVerify";
import PayoutSettings from "@/components/PayoutSettings";
import EmailPreferences from "@/components/EmailPreferences";
import SafetySettings from "@/components/safety/SafetySettings";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit");

  const [{ data: profile }, { data: emailPrefs }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "name, state, bio, avatar_url, instagram_url, twitter_url, facebook_url, phone, phone_verified, gender, interests, payout_bank, payout_account_number, payout_account_name, emergency_contact_name, emergency_contact_phone"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("email_preferences")
      .select("weekly_digest_enabled, welcome_emails_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

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

      <div className="mt-6">
        <PhoneVerify
          initialPhone={profile?.phone ?? null}
          alreadyVerified={!!profile?.phone_verified}
        />
      </div>

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
            interests: profile?.interests ?? [],
          }}
        />
      </div>

      <div className="mt-6">
        <PayoutSettings
          userId={user.id}
          initial={{
            payout_bank: profile?.payout_bank ?? null,
            payout_account_number: profile?.payout_account_number ?? null,
            payout_account_name: profile?.payout_account_name ?? null,
          }}
        />
      </div>

      <div className="mt-6">
        <SafetySettings
          userId={user.id}
          initial={{
            name: profile?.emergency_contact_name ?? null,
            phone: profile?.emergency_contact_phone ?? null,
          }}
        />
      </div>

      <div className="mt-6">
        <EmailPreferences
          userId={user.id}
          initial={{
            weekly_digest_enabled: emailPrefs?.weekly_digest_enabled ?? true,
            welcome_emails_enabled: emailPrefs?.welcome_emails_enabled ?? true,
          }}
        />
      </div>
    </div>
  );
}
