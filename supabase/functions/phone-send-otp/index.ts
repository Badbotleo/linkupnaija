// LinkUpNaija — send a phone verification code via Termii SMS.
//
// Auth: pass the caller's Supabase JWT as Bearer; we resolve the user from it.
// Body: { phone: "+2348012345678" }
//
// Secrets: TERMII_API_KEY, TERMII_SENDER_ID (an approved sender / "N-Alert").
// Deploy: supabase functions deploy phone-send-otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const OTP_TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 45;

Deno.serve(async (req) => {
  // Before any work: the browser asks permission, and it asks without
  // credentials. Answering late is the same as not answering.
  const pre = preflight(req);
  if (pre) return pre;

  const cors = corsHeaders(req);
  // Defined here, not at module scope, because every reply needs the
  // headers for THIS request's origin. A 401 or a 500 without them is
  // still a blocked response as far as the browser is concerned.
  const json = (b: unknown, status = 200): Response =>
    new Response(JSON.stringify(b), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // TWO CLIENTS. Handing the caller's JWT to a client built with the service
  // role key does not give you a service-role client with a user attached:
  // PostgREST reads the Authorization header to pick the role, so every query
  // it made ran as `authenticated`. phone_verifications has RLS on with no
  // policies, so the upsert below was refused with 42501 and this function
  // returned 500 on every single call. It has never stored a code.
  //
  // That went unnoticed because OTP_TEST_MODE was on, and in test mode the
  // code is handed straight back to the caller — so the flow appeared to
  // work while nothing was being saved, and verifying then answered "Request
  // a code first" forever. The missing TERMII_API_KEY was never the problem.
  //
  // `caller` works out who is asking. `db` does the reading and writing, with
  // no Authorization override, and is genuinely service role.
  const caller = createClient(url, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const db = createClient(url, serviceKey);

  // Resolve the caller from their JWT.
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const phone = (body.phone ?? "").trim();
  if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, ""))) {
    return json({ error: "Enter a valid phone number." }, 400);
  }

  // Cooldown to prevent spamming.
  const { data: existing } = await db
    .from("phone_verifications")
    .select("last_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.last_sent_at) {
    const since = (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SEC) {
      return json({ error: `Please wait ${Math.ceil(RESEND_COOLDOWN_SEC - since)}s before resending.` }, 429);
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString();

  // If this write fails we must NOT send an SMS: the person would receive a
  // code that was never stored, and verifying it would answer "Request a code
  // first" forever. Previously the error was discarded.
  const { error: storeErr } = await db.from("phone_verifications").upsert(
    { user_id: user.id, phone, code, expires_at: expires, attempts: 0, last_sent_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (storeErr) {
    console.error("phone_verifications upsert failed", storeErr.message);
    return json({ error: "Couldn't start verification. Please try again." }, 500);
  }

  // Test mode: skip the SMS provider and return the code so the full flow can
  // be exercised without a Termii account. Gate with OTP_TEST_MODE=true; remove
  // it (and set TERMII_API_KEY) before real launch.
  if (testModeAllowed(url)) {
    return json({ sent: true, test_code: code });
  }

  const apiKey = Deno.env.get("TERMII_API_KEY");
  if (!apiKey) {
    // Said in the member's terms, not ours. This used to answer "SMS not
    // configured. Set TERMII_API_KEY." — an instruction to an engineer,
    // shown to whoever tapped a button asking us to text them, naming a
    // secret along the way.
    //
    // The stored code is cleared first. Leaving it would mean the next
    // attempt hits the resend cooldown for a message that was never sent.
    await db.from("phone_verifications").delete().eq("user_id", user.id);
    return json(
      { error: "We can't send text messages right now. Verify by email instead." },
      503
    );
  }

  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: phone.replace(/^\+/, ""),
      from: Deno.env.get("TERMII_SENDER_ID") ?? "N-Alert",
      sms: `Your LinkUpNaija code is ${code}. It expires in ${OTP_TTL_MIN} minutes.`,
      type: "plain",
      // "dnd", not "generic".
      //
      // A large share of Nigerian numbers are registered on the networks' Do
      // Not Disturb list, and generic-channel traffic to them is filtered.
      // For a verification code that means the SMS is billed and never
      // arrives, and the person sits staring at an empty inbox blaming us.
      // The DND channel is the transactional route those numbers still
      // receive, which is also why the sender defaults to N-Alert.
      //
      // Overridable: set TERMII_CHANNEL if your account is set up otherwise.
      channel: Deno.env.get("TERMII_CHANNEL") ?? "dnd",
      api_key: apiKey,
    }),
  });

  if (!res.ok) {
    console.error("Termii error", res.status, await res.text());
    return json({ error: "Couldn't send the code. Try again." }, 502);
  }
  return json({ sent: true });
});


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
