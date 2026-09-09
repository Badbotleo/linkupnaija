import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import EmailPreferences from "@/components/EmailPreferences";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email preferences" };

export default async function EmailSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit/emails");

  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("weekly_digest_enabled, welcome_emails_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div>
      <AppHeader
        title="Email preferences"
        subtitle="What lands in your inbox"
        back
      />
      <div className="container-page max-w-[640px] py-4">
        <EmailPreferences
          userId={user.id}
          initial={{
            weekly_digest_enabled: prefs?.weekly_digest_enabled ?? true,
            welcome_emails_enabled: prefs?.welcome_emails_enabled ?? true,
          }}
        />
      </div>
    </div>
  );
}
