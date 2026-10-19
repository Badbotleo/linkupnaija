import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import EmailVerify from "@/components/EmailVerify";
import SafetySettings from "@/components/safety/SafetySettings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification and safety" };

/**
 * Proving who you are, and who we tell if something goes wrong.
 *
 * They were two cards on opposite ends of a long page and they are the same
 * subject: how we reach you, and who you want told. Verification is also
 * what gates a payout, so somebody arriving from that message lands on both
 * halves at once.
 *
 * NO SMS CARD. PhoneVerify used to sit here. The component still exists and
 * the two Termii functions are still deployed, but there is no TERMII_API_KEY
 * on this project, so the only thing the button could do was return "SMS not
 * configured. Set TERMII_API_KEY." — internal configuration language, shown
 * to a member, as the answer to a trust prompt. While OTP_TEST_MODE was on
 * it instead handed the code straight back to the browser and announced
 * itself as a test.
 *
 * Neither is a verification. Email is, it is the channel this project
 * already sends on reliably, and it is the one the payout gate reads, so it
 * is the only one offered. Members who verified a number back when SMS ran
 * keep their badge; nothing takes it away.
 */
export default async function SafetySettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit/safety");

  const { data: profile } = await supabase
    .from("users")
    .select("email_verified, emergency_contact_name, emergency_contact_phone")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <AppHeader
        title="Verification and safety"
        subtitle="How we reach you, and who you want told"
        back
      />
      <div className="container-page max-w-[640px] space-y-5 py-4">
        <EmailVerify
          email={user.email ?? null}
          alreadyVerified={!!profile?.email_verified}
          reason="This is what we check before a payout leaves the platform."
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
