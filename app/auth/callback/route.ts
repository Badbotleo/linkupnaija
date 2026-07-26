import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the email-confirmation and OAuth (Google) redirects from Supabase.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/login?verified=1";

  // Redirect on the SAME host the callback landed on — the auth cookies
  // (PKCE verifier before the exchange, session after it) are host-only, so
  // hopping to another host (www vs apex) strands the session. Behind a
  // proxy the request origin can resolve to localhost, so prefer the
  // forwarded host when present.
  const fwdHost = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl = (fwdHost ? `${fwdProto}://${fwdHost}` : origin).replace(
    /\/+$/,
    ""
  );

  if (code) {
    const supabase = createClient();
    // exchangeCodeForSession already returns the user — no extra getUser() call.
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;

      // Email-verification flow: clear the session so the user logs in explicitly.
      if (redirect.startsWith("/login")) {
        // If they signed up via a referral link, pay out both wallets now that
        // the email is verified (idempotent + guarded in the RPC).
        const ref = user?.user_metadata?.ref_code as string | undefined;
        if (ref) {
          await supabase.rpc("complete_referral", { p_ref_code: ref });
        }
        await supabase.auth.signOut();
        return NextResponse.redirect(`${baseUrl}${redirect}`);
      }

      // OAuth (Google) sign-in: keep the session and send first-timers to setup.
      let destination = redirect;
      if (user) {
        // One round trip: track activity for re-engagement emails and read
        // profile_completed via UPDATE … RETURNING.
        const { data: profile } = await supabase
          .from("users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", user.id)
          .select("profile_completed")
          .single();
        if (!profile || !profile.profile_completed) {
          destination = "/profile/setup";
        }
      }
      return NextResponse.redirect(`${baseUrl}${destination}`);
    }
    console.error("auth callback: code exchange failed", error?.message);
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth`);
}
