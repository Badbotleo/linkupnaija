// LinkUpNaija — send a verification code to the account's own email.
//
// Auth: pass the caller's Supabase JWT as Bearer; we resolve the user from it.
// Body: none. The address is read from the session, never from the request.
//
// Secrets: RESEND_API_KEY (already set for the retention emails).
// Deploy: supabase functions deploy email-send-otp
//
// WHY THIS EXISTS. The payout gate ran on the SMS flow, and Nigerian numbers
// on the networks' DND list are not receiving it, so hosts hit a condition
// they cannot satisfy and their money stays here. Resend is the channel this
// project already runs reliably.
//
// THE ADDRESS IS NOT A PARAMETER. phone-send-otp takes a number from the
// body, because the point there is to attach a new number to the account.
// Here the point is the opposite: prove the person asking owns the address
// already on the account. Accepting one from the body would let a stolen
// session redirect the code to the attacker's inbox and verify itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emailLayout,
  heading,
  paragraph,
  sendEmail,
  firstName,
} from "../_shared/email.ts";

const OTP_TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 45;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // TWO CLIENTS, AND THE DIFFERENCE IS THE WHOLE BUG.
  //
  // Handing the caller's JWT to a client built with the service role key does
  // NOT give you a service-role client with a user attached. PostgREST reads
  // the Authorization header to decide the role, so every query that client
  // makes runs as `authenticated` — service role in name only. Both OTP
  // tables have RLS on with no policies, so every write was refused: 42501,
  // the function returned 500, and the browser showed "Couldn't send code".
  //
  // This is why the SMS flow never worked either. phone-send-otp is built the
  // same way and its upsert has been failing the same way, which is what
  // OTP_TEST_MODE was hiding: in test mode nobody noticed the code was never
  // being stored, because it was handed straight back to the caller.
  //
  // So: `caller` resolves who is asking, and nothing else. `db` does the
  // writing, with no Authorization override, and is genuinely service role.
  const caller = createClient(url, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const db = createClient(url, serviceKey);

  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "not authenticated" }, 401);

  const email = (user.email ?? "").trim();
  if (!email) {
    return json(
      { error: "Your account has no email address. Contact support." },
      400
    );
  }

  // Cooldown, so a held-down button is not a mailing list.
  const { data: existing } = await db
    .from("email_verifications")
    .select("last_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.last_sent_at) {
    const since =
      (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SEC) {
      return json(
        {
          error: `Please wait ${Math.ceil(
            RESEND_COOLDOWN_SEC - since
          )}s before resending.`,
        },
        429
      );
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString();

  // Store before sending. A code that was mailed but never written verifies
  // nothing and answers "Request a code first" forever, which is the bug the
  // SMS function had to be fixed for.
  const { error: storeErr } = await db.from("email_verifications").upsert(
    {
      user_id: user.id,
      email,
      code,
      expires_at: expires,
      attempts: 0,
      last_sent_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (storeErr) {
    console.error("email_verifications upsert failed", storeErr.message);
    return json({ error: "Couldn't start verification. Please try again." }, 500);
  }

  // Test mode, matching the SMS function: exercise the whole flow with no
  // mail provider. Gate with OTP_TEST_MODE=true.
  if (testModeAllowed(url)) {
    return json({ sent: true, email: mask(email), test_code: code });
  }

  const { data: profile } = await db
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const sent = await sendEmail({
    to: email,
    subject: `${code} is your LinkUpNaija code`,
    html: emailLayout({
      title: "Your verification code",
      preheader: `${code} — expires in ${OTP_TTL_MIN} minutes.`,
      bodyHtml: `
        ${heading(`Hi ${firstName(profile?.name)}, here's your code`)}
        ${paragraph(
          "Enter this to confirm it's you before your money moves. It expires in " +
            OTP_TTL_MIN +
            " minutes."
        )}
        <div style="margin:18px 0;padding:18px;border-radius:14px;background:#F4F3FA;text-align:center">
          <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#1A1040;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${code}</span>
        </div>
        ${paragraph(
          "If you didn't ask for this, somebody may have your password. Change it and email <a href=\"mailto:support@linkupnaija.com\" style=\"color:#534AB7\">support@linkupnaija.com</a>."
        )}
      `,
    }),
  });

  if (!sent) return json({ error: "Couldn't send the code. Try again." }, 502);
  return json({ sent: true, email: mask(email) });
});

/** j***n@gmail.com — enough to spot the wrong inbox, not enough to harvest. */
function mask(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown = name.length <= 2 ? name[0] : `${name[0]}***${name.slice(-1)}`;
  return `${shown}@${domain}`;
}

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Test mode, and why it cannot be switched on in production.
 *
 * OTP_TEST_MODE returns the code to the caller instead of sending it, which
 * makes verification bypassable by anyone who can read a response body. It
 * was set to "true" on the live project, where it did two kinds of damage:
 * it handed out codes, and it hid the fact that the upsert beneath it had
 * been failing since the day this function was written. The flow looked fine
 * while nothing was being stored.
 *
 * So the flag is no longer enough on its own. A hosted Supabase project is
 * always reached over https at its own domain; a local stack is http, on
 * localhost, 127.0.0.1 or kong. Test mode is honoured only there, so setting
 * the flag on production from now on does nothing at all.
 */
function testModeAllowed(projectUrl: string): boolean {
  if (Deno.env.get("OTP_TEST_MODE") !== "true") return false;
  return /^http:\/\//.test(projectUrl) ||
    /(localhost|127\.0\.0\.1|\bkong\b|host\.docker\.internal)/.test(projectUrl);
}
