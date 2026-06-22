import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the email-confirmation and OAuth (Google) redirects from Supabase.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/login?verified=1";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Email-verification flow: clear the session so the user logs in explicitly.
      if (redirect.startsWith("/login")) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}${redirect}`);
      }

      // OAuth (Google) sign-in: keep the session and send first-timers to setup.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let destination = redirect;
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("profile_completed")
          .eq("id", user.id)
          .single();
        if (!profile || !profile.profile_completed) {
          destination = "/profile/setup";
        }
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
