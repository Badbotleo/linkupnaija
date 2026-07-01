import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the email-confirmation and OAuth (Google) redirects from Supabase.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/login?verified=1";

  // Prefer the configured public site URL (the request origin can resolve to
  // localhost behind a proxy/load balancer), falling back to the origin.
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? origin).replace(
    /\/+$/,
    ""
  );

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Email-verification flow: clear the session so the user logs in explicitly.
      if (redirect.startsWith("/login")) {
        // If they signed up via a referral link, pay out both wallets now that
        // the email is verified (idempotent + guarded in the RPC).
        const {
          data: { user: verified },
        } = await supabase.auth.getUser();
        const ref = verified?.user_metadata?.ref_code as string | undefined;
        if (ref) {
          await supabase.rpc("complete_referral", { p_ref_code: ref });
        }
        await supabase.auth.signOut();
        return NextResponse.redirect(`${baseUrl}${redirect}`);
      }

      // OAuth (Google) sign-in: keep the session and send first-timers to setup.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let destination = redirect;
      if (user) {
        // Track activity for re-engagement emails (best-effort).
        await supabase
          .from("users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", user.id);
        const { data: profile } = await supabase
          .from("users")
          .select("profile_completed")
          .eq("id", user.id)
          .single();
        if (!profile || !profile.profile_completed) {
          destination = "/profile/setup";
        }
      }
      return NextResponse.redirect(`${baseUrl}${destination}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login`);
}
