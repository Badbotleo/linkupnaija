import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PhoneVerify from "@/components/PhoneVerify";
import SafetySettings from "@/components/safety/SafetySettings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Phone and safety" };

/**
 * The phone number and the emergency contact, together.
 *
 * They were two cards on opposite ends of a long page and they are the same
 * subject: who we can reach, and who you want told. A verified number is also
 * what gates a payout, so somebody arriving here from that message finds both
 * halves in one place.
 */
export default async function SafetySettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit/safety");

  const { data: profile } = await supabase
    .from("users")
    .select("phone, phone_verified, emergency_contact_name, emergency_contact_phone")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <AppHeader
        title="Phone and safety"
        subtitle="Who we can reach, and who you want told"
        back
      />
      <div className="container-page max-w-[640px] space-y-5 py-4">
        <PhoneVerify
          initialPhone={profile?.phone ?? null}
          alreadyVerified={!!profile?.phone_verified}
        />
        <SafetySettings
          userId={user.id}
          initial={{
            name: profile?.emergency_contact_name ?? null,
            phone: profile?.emergency_contact_phone ?? null,
          }}
        />
      </div>
    </div>
  );
}
